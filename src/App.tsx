import { useState } from "react"
import { HEADER_CALLBACK_PING, HEADER_CLOSE, HEADER_INCOMING_IMAGE, HEADER_INCOMING_KEY, MsgCallbackPing, MsgClose, MsgCsv, MsgImage, MsgKey, SentimentAnalysisError, SentimentAnalysisResult } from "./messages.js"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, ChartData, Title } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { Form, Button } from "react-bootstrap";

import 'bootstrap/dist/css/bootstrap.min.css'

ChartJS.register(ArcElement, Tooltip, Legend, Title);

document.addEventListener("DOMContentLoaded", (_) => {
    document.getElementById("input-form")?.addEventListener("submit", (e) => {
        e.preventDefault()
    })
})

const PROD_NAME_KEY = "productName"
const REV_NAME_KEY = "revName"

class ClientComms {
    setImageReady: (to: boolean) => void = to => console.log(`Setting image ready before setter provided: ${to}`)
    setCharts: (to: React.JSX.Element[]) => void = to => console.log(`Setting chart before setter provided: ${to}`)
    setError: (to: string | null) => void = to => console.log(`Setting error before setter provided: ${to}`)
    setLoading: (to: string) => void = to => console.log(`Setting loading before setter provided: ${to}`)
    setInfer: (to: boolean) => void = (to) => console.log(`Setting infer before setter provided: ${to}`)
    infer: boolean = true
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
            this.setImageReady(false)
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

    prepareSubmit() {
        this.setError(null)
        this.#prodName = (document.getElementById("prod-name-input") as (HTMLInputElement | null))?.value ?? ""
        this.#revName = (document.getElementById("rev-name-input") as (HTMLInputElement | null))?.value ?? ""
        const ls = window.localStorage
        ls.setItem(PROD_NAME_KEY, this.#prodName)
        ls.setItem(REV_NAME_KEY, this.#revName)
        if (!this.infer && this.#prodName == this.#revName) {
            this.setError("Product name column name and reviews column name cannot be the same.")
            return
        }
        if (!this.infer && (this.#prodName == "" || this.#revName == "")) {
            this.setError("Either column name cannot be empty.")
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
        request.send(JSON.stringify(new MsgCsv(this.#clientKey, data, this.#prodName, this.#revName, this.infer)))
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
        const rawData = JSON.parse(msg.data)
        let data

        if ("error" in rawData) {
            data = rawData as SentimentAnalysisError
            if (data.inferFailure) {
                this.setInfer(false)
            }
            this.setError(`Error: ${data.error}`)
            this.#stopLoading()
            return
        } else {
            data = rawData as SentimentAnalysisResult
        }

        for (const ref of this.#chartRefs) {
            if (ref !== null) {
                ref.destroy()
            }
        }

        const accumulatedData: {[index: string]: {"p": number, "n": number, "e": number}} = {}
        for (const productName in data) {
            const sentiments = {"p": 0, "n": 0, "e": 0}
            for (const sent of data[productName].sentiments) {
                sentiments[sent] += 1
            }
            accumulatedData[productName] = sentiments
        }

        this.#chartRefs = []
        let ind = 0
        const tempCharts = []
        for (const productName in accumulatedData) {
            const chart = this.#pieData(accumulatedData[productName])
            tempCharts.push(<div className="sentiment-analysis-container">
                <div className="chart-title">{productName}</div>
                <div className="chart-container" key={productName}>
                    <Pie className="sentiment-chart" data={chart} options={{
                        maintainAspectRatio: false
                    }} ref={ref => { this.#chartRefs.push(ref as (ChartJS<"pie"> | null))}} redraw/>
                </div>
                {this.#pieTable(data[productName].reviews, data[productName].sentiments)} 
                </div>) // Note: Do NOT remove redraw. It will cause a crash when rendering for the 3rd time.
            ind += 1
        }
        this.#stopLoading()
        this.setImageReady(true)
        this.setCharts(tempCharts)
        console.log("Setting image as ready")
    }

    #pieData(data: {"p": number, "n": number, "e": number}): ChartData<"pie"> {
        return {
            labels: ["Positive", "Neutral", "Negative"],
            datasets: [
                {
                    label: "Number of reviews",
                    data: [data["p"], data["e"], data["n"]],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(130, 130, 130, 0.6)',
                        'rgba(255, 99, 132, 0.6)',
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(130, 130, 130, 1)',
                        'rgba(255, 99, 132, 1)',
                    ],
                    borderWidth: 1,
                }
            ],
        }
    }

    #pieTable(reviews: string[], sents: ("p" | "e" | "n")[]): React.JSX.Element {
        const labels: {p: "Positive", n: "Negative", e: "Neutral"} = {p: "Positive", n: "Negative", e: "Neutral"}
        const classes = {Positive: "sent-pos", Negative: "sent-neg", Neutral: "sent-neut"}
        const zipped = reviews.map((val, ind) => {return {review: val, sent: labels[sents[ind]]}})
        const rows = zipped.map(({review, sent}) => {
            return (<tr>
                <td>{review}</td>
                <td className={classes[sent]}>{sent}</td>
            </tr>)
        })
        return (<table className="sentiment-table">
            <tr>
                <th>Review</th>
                <th>Sentiment</th>
            </tr>
            {rows}
        </table>)
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
const savedRevName = window.localStorage.getItem(REV_NAME_KEY) || "reviews"
const comms = new ClientComms()
export default function App() {
    const [imageReady, setImageReady] = useState(false)
    comms.setImageReady = setImageReady
    const [charts, setCharts] = useState<React.JSX.Element[]>([])
    comms.setCharts = setCharts
    const [error, setError] = useState<string | null>(null)
    comms.setError = setError
    const [loadingText, setLoadingText] = useState("")
    comms.setLoading = setLoadingText
    const [infer, setInfer] = useState(true)
    comms.setInfer = setInfer
    comms.infer = infer
    //console.log(`Charts: ${JSON.stringify(charts)}`)
    return (<>
    <Form className="input-form m-3" id="input-form">
        <Form.Group controlId="infer-select" className="form-input-group">
            <Form.Label>Choose column name type:</Form.Label>
            <Form.Select id="infer-select" className="infer-select" value={infer ? "infer" : "specify"} onChange={(e) => {setInfer(e.target.value === "infer")}}>
                <option value="infer">Infer</option>
                <option value="specify">Specify</option>
            </Form.Select>
            <Form.Text className="text-muted">Manually specify or allow the program to infer which columns are considered the product name and product review columns.</Form.Text>
        </Form.Group>
        {!infer ? <>
        <Form.Group controlId="prod-name-input" className="form-input-group">
            <Form.Label>Enter product name column name:</Form.Label>
            <Form.Control type="text" id="prod-name-input" className="form-input" defaultValue={savedProdName}/>
        </Form.Group>
        <Form.Group controlId="rev-name-input" className="form-input-group">
            <Form.Label>Enter product name column name:</Form.Label>
            <Form.Control type="text" id="rev-name-input" className="form-input" defaultValue={savedRevName}/>
        </Form.Group>
        </> : <></>}
        <Form.Group controlId="file-input" className="form-input-group">
            <Form.Label>Select CSV file:</Form.Label>
            <Form.Control type="file" id="file-input" className="form-input" accept=".csv"/>
        </Form.Group>
        <Button className="form-input-group" variant="primary" type="button" onClick={comms.prepareSubmit.bind(comms)}>Submit</Button>
        <div className="error-area">{error == null ? "" : error}</div>
        <div className="loading-area">{loadingText}</div>
    </Form>
    {imageReady ? <div className="chart-display-area">{charts}</div> : <></>}
    </>)
}