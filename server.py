'''
Python implementation of server code for this project (originally in JavaScript)
'''

import os
import json
import asyncio
import uvicorn
import fastapi as fast
import traceback as tb
import src.serverComms as sc
from fastapi import staticfiles
from typing import Awaitable, Any, Annotated
from collections.abc import Callable
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(_: fast.FastAPI):
    asyncio.ensure_future(serverComms.start())
    yield
    await serverComms.stop()

app = fast.FastAPI(lifespan=lifespan)
serverComms = sc.ServerComms()

@app.middleware("http")
async def logReqs(request: fast.Request, next: Callable[[fast.Request], Awaitable[Any]]) -> Any:
    #print(f"{request.method} for {request.url} from {request.client}.") # This line is already handled by fastapi.
    response = await next(request)
    return response

@app.post("/csv")
async def handleCsv(msg: Annotated[Any, fast.Body()]):
    try:
        message = json.loads(msg) # msg comes as a byte string, which apparently includes 'b' at the start and ' at the end. Maybe that's why fastapi kept rejecting it. But why does it happen in the first place?
        if "clientKey" in message and "data" in message:
            await serverComms.handleCsv(message["clientKey"], message["data"])
        else:
            print(f"Received malformed JSON; {message}")
    except Exception as e:
        raise e
        #print(f"Error in CSV handling: {e}: {tb.format_tb(e.__traceback__)}") # Enable in production
async def handleCsvOri(msg: sc.JsonCsv):
    '''The original CSV handler. The server rejects what seems like perfectly good JSON, so I'm putting this on the back burner until I can figure it out. The other version works fine anyways.'''
    await serverComms.handleCsv(msg.clientKey, msg.data)

dir = os.path.dirname(os.path.abspath(__file__))

app.mount("/", staticfiles.StaticFiles(directory=dir + "/dist", html=True), name="dist")
app.mount("/assets", staticfiles.StaticFiles(directory=dir + "/dist/assets"), name="distassets")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)