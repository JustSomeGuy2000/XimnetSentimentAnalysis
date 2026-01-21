import { useState } from "react"
import { HEADER_CALLBACK_PING, HEADER_CLOSE, HEADER_INCOMING_IMAGE, HEADER_INCOMING_KEY, MsgCallbackPing, MsgClose, MsgCsv, MsgImage, MsgKey, SentimentAnalysisResult } from "./messages.js"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, ChartData, Title } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

document.addEventListener("DOMContentLoaded", (_) => {
    document.getElementById("input-form")?.addEventListener("submit", (e) => {
        e.preventDefault()
    })
})

const PROD_NAME_KEY = "productName"
const REV_NAME_KEY = "revName"

class ClientComms {
    setImageReady: (to: boolean) => void = (_) => console.log("Image setter not yet provided.")
    setCharts: (to: React.JSX.Element[]) => void = (_) => console.log("Chart setter not yet provided.")
    setError: (to: string | null) => void = (_) => console.log("Error setter not yet provided.")
    setLoading: (to: string) => void = (_) => console.log("Loading setter not yet provided.")
    #ws: WebSocket
    #reader: FileReader
    #clientKey: string
    #chartRefs: (ChartJS<"pie"> | null)[] = []
    #prodName = ""
    #revName = ""
    #loadingProgress = 1
    #loadingIntervalID: number | null = null

    constructor() {
        this.#setSocket("ws://localhost:5500")
        this.#reader = new FileReader()
        this.#reader.addEventListener("load", (_) => this.#submit(this.#reader.result as string))
        this.#reader.addEventListener("error", e => {
            console.log(`Error in reading file: ${e}.`)
            this.setError("Error in reading file.")
            this.setImageReady(true)
        })
        this.setError(null)
    }

    #setSocket(address: string) {
        this.#ws = new WebSocket(address)
        this.#ws.addEventListener("message", event => 
            this.#handleMessage(event.data.toString())
        )
        this.#ws.addEventListener("error", e => { 
            console.log(`Websocket error: ${e}`) 
            this.setError(`Websocket error.`)
        })
        this.#ws.addEventListener("close", (_) => console.log("ClientComms socket closing."))
        this.#ws.addEventListener("open", (_) => console.log("Hello from the ClientComms socket!"))
    }

    #handleMessage(message: string) {
        try {
            var json = JSON.parse(message)
            if ("header" in json) {
                console.log(`Incoming: ${message}`)
                switch (json.header) {
                    case HEADER_CALLBACK_PING:
                        this.#send(new MsgCallbackPing(this.#clientKey))
                        break
                    case HEADER_INCOMING_IMAGE:
                        this.#handleIncomingImage(json)
                        break
                    case HEADER_INCOMING_KEY:
                        this.#handleIncomingKey(json)
                        break
                    case HEADER_CLOSE:
                        this.#handleClose(json)
                        break
                    default:
                        console.log(`Recevived JSON with unknown header: ${message}`)
                }
            } else {
                console.log(`Received JSON without header: ${message}`)
            }
        } catch {
            console.log(`Received malformed message: ${message}`)
        }
    }

    prepareSubmit(prodName: string, revName: string) {
        this.#prodName = prodName
        this.#revName = revName
        const ls = window.localStorage
        ls.setItem(PROD_NAME_KEY, this.#prodName)
        ls.setItem(REV_NAME_KEY, this.#revName)
        if (this.#prodName == this.#revName) {
            this.setError("Product name column name and reviews column name cannot be the same.")
            return
        }
        if (this.#prodName == "" || this.#revName == "") {
            this.setError("Column names cannot be empty.")
            return
        }
        document.querySelector(".input-form")?.querySelectorAll("input").forEach(input => {
            switch (input.id) {
                case "prod-name-input":
                    this.#prodName = input.value
                    break
                case "rev-name-input":
                    this.#revName = input.value
                    break
                case "file-input":
                    if (input.files !== null && input.files?.length > 0) {
                        this.#reader.readAsText(input.files[0])
                    }
                    break
            }
        })
    }

    #submit(data: string) {
        let request = new XMLHttpRequest()
        request.open("POST", "http://localhost:8000/csv", true)
        request.onreadystatechange = () => {
            if (request.readyState == XMLHttpRequest.DONE) {
                console.log(`POST response: ${JSON.stringify(request.response, null, 2)}`)
            }
        }
        request.onerror = (_) => {
            console.log("Upload to server failed.")
            this.setError("Upload to server failed.")
        }
        request.send(JSON.stringify(new MsgCsv(this.#clientKey, data, this.#prodName, this.#revName)))
        console.log("Outgoing: CSV")
        this.#startLoading()
    }

    #startLoading() {
        this.#stopLoading()
        this.#loadingIntervalID = window.setInterval((() => {
            this.setLoading(`Loading${".".repeat(this.#loadingProgress)}`)
            this.#loadingProgress += 1
            if (this.#loadingProgress >= 4) {
                this.#loadingProgress = 1
            }
        }).bind(this), 1000)
    }

    #stopLoading(){
        if (this.#loadingIntervalID !== null) {
            window.clearInterval(this.#loadingIntervalID)
        }
        this.setLoading("")
        this.#loadingIntervalID = null
    }

    #handleIncomingImage(msg: MsgImage) {
        this.setError(null)
        const rawData = JSON.parse(msg.data)
        let data
        if ("error" in rawData) {
            this.setError(`Error: ${rawData.error}`)
            return
        } else {
            data = rawData as SentimentAnalysisResult
        }
        for (const ref of this.#chartRefs) {
            if (ref !== null) {
                ref.destroy()
            }
        }
        this.#chartRefs = []
        const labels = ["Positive", "Negative"]
        let ind = 0
        let tempCharts = []
        for (const productName in data) {
            const chart: ChartData<"pie"> = {
                labels: labels,
                datasets: [
                    {
                        label: "Number of reviews",
                        data: [data[productName]["p"], data[productName]["n"]],
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.2)',
                            'rgba(255, 99, 132, 0.2)',
                        ],
                        borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 99, 132, 1)', 
                        ],
                        borderWidth: 1,
                    }
                ],
            }
            tempCharts.push(
                <div className="chart-container" key={productName}>
                    <Pie className="sentiment-chart" data={chart} options={{
                        plugins: {
                            title: {
                                display: true,
                                text: productName
                            }
                        },
                        maintainAspectRatio: false
                    }} ref={ref => { this.#chartRefs.push(ref as (ChartJS<"pie"> | null))}} redraw/>
                </div>) // Note: Do NOT remove redraw. It will cause a crash when rendering for the 3rd time.
            ind += 1
        }
        this.#stopLoading()
        this.setImageReady(true)
        this.setCharts(tempCharts)
        console.log("Setting image as ready")
    }

    #handleIncomingKey(msg: MsgKey) {
        this.#clientKey = msg.clientKey
    }

    #handleClose(_: MsgClose) {
        this.#ws.close()
    }

    #send(data: object) {
        const str = JSON.stringify(data)
        console.log(`Outgoing: ${str}`)
        this.#ws.send(str)
    }
}

const savedProdName = window.localStorage.getItem(PROD_NAME_KEY) || "productName"
const savedRevName  =window.localStorage.getItem(REV_NAME_KEY) || "reviews"
const comms = new ClientComms()
export default function App() {
    const [imageReady, setImageReady] = useState(false)
    comms.setImageReady = setImageReady
    const [charts, setCharts] = useState<React.JSX.Element[]>([])
    comms.setCharts = setCharts
    const [error, setError] = useState<string | null>(null)
    comms.setError = setError
    const [prodName, setProdName] = useState(savedProdName)
    const [revName, setRevName] = useState(savedRevName)
    const [loadingText, setLoadingText] = useState("")
    comms.setLoading = setLoadingText
    //console.log(`Charts: ${JSON.stringify(charts)}`)
    return (<>
    <form className="input-form" id="input-form">
        <label htmlFor="prod-name-input">Product name column name:</label> <br />
        <input type="text" id="prod-name-input" name="prod-name-input" title="Must not contain spaces." value={prodName} onChange={e => setProdName(e.target.value)}/> <br />

        <label htmlFor="rev-name-input">Reviews column name:</label> <br />
        <input type="text" id="rev-name-input" name="rev-name-input" title="Must not contain spaces." value={revName} onChange={e => setRevName(e.target.value)}/> <br />

        <label htmlFor="file-input">Choose file (only .csv allowed)</label> <br />
        <input type="file" id="file-input" name="file-input" accept=".csv" /> <br />
        <button onClick={comms.prepareSubmit.bind(comms, prodName, revName)} type="button">Submit</button> <br />
    </form>
    <div className="error-area">{error == null ? "" : error}</div>
    <div className="loading-area">{loadingText}</div>
    {imageReady ? <div className="chart-display-area">{charts}</div> : <></>}
    </>)
}