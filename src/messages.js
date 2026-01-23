export const HEADER_INCOMING_IMAGE = "incoming_image";
/**Contains a JSON string encoding the returned data.*/
export class MsgImage {
    header = "incoming_image";
    clientKey;
    data;
    constructor(clientKey, data) {
        this.clientKey = clientKey;
        this.data = data;
    }
}
/**Contains the entirety of the file as a string, as well as header names.*/
export class MsgCsv {
    clientKey;
    data;
    infer;
    prodName;
    revName;
    constructor(clientKey, data, prodName, revName, infer) {
        this.clientKey = clientKey;
        this.data = data;
        this.infer = infer;
        this.prodName = prodName;
        this.revName = revName;
    }
}
export const HEADER_INCOMING_KEY = "incoming_key";
/**Contains the new client's key.*/
export class MsgKey {
    header = "incoming_key";
    clientKey;
    constructor(clientKey) {
        this.clientKey = clientKey;
    }
}
export const HEADER_CLOSE = "close";
/**Signals the recipient to close this connection.*/
export class MsgClose {
    header = "close";
    clientKey;
    constructor(clientKey) {
        this.clientKey = clientKey;
    }
}
export const HEADER_CALLBACK_PING = "callback_ping";
/**Signals the server that this connection is still active.*/
export class MsgCallbackPing {
    header = "callback_ping";
    clientKey;
    constructor(clientKey) {
        this.clientKey = clientKey;
    }
}
