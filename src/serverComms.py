'''
Python implementation of server-sde communications (originally in JavaScript)
'''

import enum
import json
import uuid
import asyncio
import pydantic as pyd
import websockets as ws
from src.process import analyse
from typing import Literal, Callable, Awaitable

class Headers(enum.Enum):
    INCOMING_KEY = "incoming_key"
    CALLBACK_PING = "callback_ping"
    CLOSE = "close"
    INCOMING_IMAGE = "incoming_image"

class MsgKey(pyd.BaseModel):
    header: Literal["incoming_key"] = "incoming_key"
    clientKey: str

class MsgCallbackPing(pyd.BaseModel):
    header: Literal["callback_ping"] = "callback_ping"
    clientKey: str

class MsgClose(pyd.BaseModel):
    header: Literal["close"] = "close"
    clientKey: str

class MsgImage(pyd.BaseModel):
    header: Literal["incoming_image"] = "incoming_image"
    clientKey: str
    data: str

class JsonCsv(pyd.BaseModel):
    clientKey: str
    data: str
    infer: bool
    prodName: str
    revName: str

class Timer:
    def __init__(self, timeout: int, callback: Callable[[], Awaitable[None]]):
        self._timeout = timeout
        self._callback = callback
        self._cancelled: bool = False
        self._task: asyncio.Task

    async def _time(self):
        while not self._cancelled:
            await asyncio.sleep(self._timeout)
            await self._callback()

    def start(self):
        self._task = asyncio.create_task(self._time())

    def stop(self):
        self._cancelled = True
        self._task.cancel()

class ServerComms:
    def __init__(self, host: str = "localhost", port: int = 5500) -> None:
        self.clients: dict[str, ws.ServerConnection] = {}
        self.server: ws.Server
        self.awaitingCallback: list[str] = []
        self.started: bool = False
        self.stopped: bool = False
        self.port = port
        self.host = host
        self.timer = Timer(60, self.callbackPing)

    async def start(self):
        '''Start the server. Idempotent.'''
        print("Starting ServerComms.")
        if self.started:
            return
        self.started = True
        self.timer.start()
        self._stopper = asyncio.get_event_loop().create_future()
        await self._startServer()

    async def _startServer(self):
        '''Start the server's operation. Do NOT call this alone. It should only be called once, by start().'''
        self.server = await ws.serve(self.onConnect, self.host, self.port, start_serving=False)
        async with self.server as server:
            await server.start_serving()
            await self._stopper

    async def stop(self):
        '''Stop the server and perform cleanup. Idempotent.'''
        print("Stopping ServerComms.")
        if self.stopped: 
            return
        self.stopped = True
        self._stopper.set_result(True)
        self.timer.stop()
        keys = []
        for key in self.clients:
            keys.append(key)
        for key in keys:
            await self.closeConnection(key)

    async def onConnect(self, conn: ws.ServerConnection):
        '''Called whenever a new connection is detected. Is responsible for all I/O from/to that connection.'''
        key = str(uuid.uuid4())
        self.clients[key] = conn
        await self.send(conn, MsgKey(clientKey=key).model_dump_json())
        async for message in conn:
            print(f"Incoming: {message}")
            try:
                event = json.loads(message)
                if "header" in event:
                    match event["header"]:
                        case Headers.CALLBACK_PING.value:
                            self.handleCallbackPing(MsgCallbackPing.model_validate_json(message))
                        case Headers.CLOSE.value:
                            await self.handleMsgClose(MsgClose.model_validate_json(message))
                        case _:
                            print(f"Received JSON with unrecognised header: {message}")
                else:
                    print(f"Received JSON without header: {message}")
            except json.JSONDecodeError:
                print(f"Received malformed message: {message}")

    def handleCallbackPing(self, msg: MsgCallbackPing): 
        self.awaitingCallback.remove(msg.clientKey)

    async def handleMsgClose(self, msg: MsgClose):
        await self.closeConnection(msg.clientKey)

    async def handleCsv(self, clientKey: str, data: str, infer: bool, prodName: str, revName: str):
        print("Incoming: CSV")
        result = asyncio.ensure_future(analyse(data, infer, prodName, revName))
        result.add_done_callback(lambda task: asyncio.ensure_future(self.send(self.clients[clientKey], MsgImage(clientKey=clientKey, data=task.result()).model_dump_json())))

    async def callbackPing(self): 
        for key in self.awaitingCallback:
            await self.send(self.clients[key], MsgClose(clientKey=key).model_dump_json())
            await self.clients[key].close()
            del self.clients[key]
            print(f"Client {key} failed callback ping.")
        self.awaitingCallback.clear()
        for key, conn in self.clients.items():
            await self.send(conn, MsgCallbackPing(clientKey=key).model_dump_json())
            self.awaitingCallback.append(key)

    async def send(self, conn: ws.ServerConnection, data: str):
        '''Send data through a connection. For centralisation, always use this instead of doing it directly.'''
        try:
            print(f"Outgoing: {data}")
            await conn.send(data)
        except ws.ConnectionClosed:
            print("Outgoing failed (socket already closed).")

    async def closeConnection(self, key: str):
        '''Close the connection and remove it from any relevant collections.'''
        await self.send(self.clients[key], MsgClose(clientKey=key).model_dump_json())
        await self.clients[key].close()
        del self.clients[key]
        for acKey in self.awaitingCallback:
            if acKey == key:
                self.awaitingCallback.remove(acKey)
                break

if __name__ == "__main__":
    asyncio.run(ServerComms().start())