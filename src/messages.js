export const HEADER_INCOMING_IMAGE = "incoming_image";
/**Contains a JSON string encoding the returned data.*/
export class MsgImage {
    header;
    clientKey;
    data;
    constructor(clientKey, data) {
        this.header = HEADER_INCOMING_IMAGE;
        this.clientKey = clientKey;
        this.data = data;
    }
}
/**Contains the entirety of the file as a string.*/
export class MsgCsv {
    clientKey;
    data;
    constructor(clientKey, data) {
        this.clientKey = clientKey;
        this.data = data;
    }
}
export const HEADER_INCOMING_KEY = "incoming_key";
/**Contains the new client's key.*/
export class MsgKey {
    header;
    clientKey;
    constructor(clientKey) {
        this.header = HEADER_INCOMING_KEY;
        this.clientKey = clientKey;
    }
}
export const HEADER_CLOSE = "close";
/**Signals the recipient to close this connection.*/
export class MsgClose {
    header;
    clientKey;
    constructor(clientKey) {
        this.header = HEADER_CLOSE;
        this.clientKey = clientKey;
    }
}
export const HEADER_CALLBACK_PING = "callback_ping";
/**Signals the server that this connection is still active.*/
export class MsgCallbackPing {
    header;
    clientKey;
    constructor(clientKey) {
        this.header = HEADER_CALLBACK_PING;
        this.clientKey = clientKey;
    }
}
