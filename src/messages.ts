export type Message = {
    header: string
    clientkey: string
}

export type SentimentAnalysisResult = {
    [index: string]: {
        sentiments: ("p" | "n" | "e")[],
        reviews: string[]
    },
}

export type SentimentAnalysisError = {
    error: string
}

export const HEADER_INCOMING_IMAGE = "incoming_image"
/**Contains a JSON string encoding the returned data.*/
export class MsgImage {
    header: "incoming_image" = "incoming_image"
    clientKey: string
    data: string

    constructor(clientKey: string, data: string) {
        this.clientKey = clientKey
        this.data = data
    }
}

/**Contains the entirety of the file as a string, as well as header names.*/
export class MsgCsv {
    clientKey: string
    data: string
    prodName: string
    revName: string

    constructor(clientKey: string, data: string, prodName: string, revName: string) {
        this.clientKey = clientKey
        this.data = data
        this.prodName = prodName
        this.revName = revName
    }
}

export const HEADER_INCOMING_KEY = "incoming_key"
/**Contains the new client's key.*/
export class MsgKey {
    header: "incoming_key" = "incoming_key"
    clientKey: string

    constructor(clientKey: string) {
        this.clientKey = clientKey
    }
}

export const HEADER_CLOSE = "close"
/**Signals the recipient to close this connection.*/
export class MsgClose {
    header: "close" = "close"
    clientKey: string

    constructor(clientKey: string) {
        this.clientKey = clientKey
    }
}

export const HEADER_CALLBACK_PING = "callback_ping"
/**Signals the server that this connection is still active.*/
export class MsgCallbackPing {
    header: "callback_ping" = "callback_ping"
    clientKey: string

    constructor(clientKey: string) {
        this.clientKey = clientKey
    }
}