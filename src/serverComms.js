import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";
import fs from "node:fs";
import { HEADER_CLOSE, HEADER_CALLBACK_PING, HEADER_INCOMING_IMAGE, MsgClose, MsgCallbackPing, MsgKey, MsgImage } from "./messages.js";
/**An all-in-one object for server functions and communications.*/
class ServerComms {
    clients;
    server;
    awaitingCallback;
    constructor() {
        this.clients = new Map();
        this.awaitingCallback = new Array();
        this.server = new WebSocketServer({ port: 5500 });
        console.log(`Accepting connections on port ${JSON.stringify(this.server.address())}`);
        this.server.on("connection", (ws) => {
            ws.on("message", (data, _) => {
                this.handleMessage(data.toString());
            });
            ws.on("close", (_, __) => {
                this.clients.forEach((value, key, map) => {
                    if (value == ws) {
                        map.delete(key);
                        return;
                    }
                });
            });
            const key = this.key();
            this.send(ws, new MsgKey(key));
            this.clients.set(key, ws);
        });
        setInterval(this.callbackPing.bind(this), 60000);
    }
    handleMessage(msg) {
        console.log(`Incoming: ${msg}`);
        try {
            var json = JSON.parse(msg);
            if ("header" in json) {
                switch (json.header) {
                    case HEADER_CLOSE:
                        this.handleMsgClose(json);
                        break;
                    case HEADER_INCOMING_IMAGE:
                        this.handleMsgCsv(json);
                        break;
                    case HEADER_CALLBACK_PING:
                        this.handleCallbackPing(json);
                        break;
                    default:
                        console.log(`Received JSON with unrecognised header: ${msg}`);
                        break;
                }
            }
            else {
                console.log(`Received JSON without header: ${msg}`);
            }
        }
        catch (_) {
            console.log(`Received malformed message: ${msg}`);
            return;
        }
    }
    key() {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));
    }
    handleMsgClose(msg) {
        this.clients.delete(msg.clientKey);
    }
    handleMsgCsv(msg) {
        fs.writeFile(`../csvs/${msg.clientKey}.csv`, msg.data, err => {
            if (err) {
                console.log(`Could not write file ${msg.clientKey}: ${err.cause}`);
            }
            else {
                const process = spawn("python", ["./src/process.py", msg.clientKey]);
                process.on("error", (err) => {
                    console.log(`Process for ${msg.clientKey} failed due to ${err.message}.`);
                });
                process.stdout.on("data", (data) => {
                    const client = this.clients.get(msg.clientKey);
                    if (client !== undefined) {
                        this.send(client, new MsgImage(msg.clientKey, data));
                    }
                    process.kill();
                });
            }
        });
    }
    handleCallbackPing(msg) {
        const pos = this.awaitingCallback.findIndex((value, _, __) => {
            return value == msg.clientKey;
        });
        if (pos !== -1) {
            this.awaitingCallback.splice(pos, 1);
        }
    }
    /**Note that this must be bound before using in `setInterval` because of the dynamic nature of `this`.*/
    callbackPing() {
        this.awaitingCallback.forEach((value, _, __) => {
            this.send(this.clients.get(value), new MsgClose(value));
            this.clients.get(value)?.close();
            this.clients.delete(value);
            this.awaitingCallback.splice(this.awaitingCallback.indexOf(value), 1);
            console.log(`Client ${value} failed callback ping.`);
        });
        this.clients.forEach((value, key, _) => {
            this.send(value, new MsgCallbackPing(key));
            this.awaitingCallback.push(key);
        });
    }
    send(socket, data) {
        const str = JSON.stringify(data);
        console.log(`Outgoing: ${str}`);
        socket.send(str);
    }
    start() {
        console.log(`Hello from ServerComms!`);
    }
}
export const serverComms = new ServerComms();
