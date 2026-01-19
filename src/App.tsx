import { useState } from "react"
import { HEADER_CALLBACK_PING, HEADER_CLOSE, HEADER_INCOMING_IMAGE, HEADER_INCOMING_KEY, MsgCallbackPing, MsgClose, MsgCsv, MsgImage, MsgKey, SentimentAnalysisResult } from "./messages.js"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, ChartData, Title, Chart } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

document.addEventListener("DOMContentLoaded", (_) => {
    document.getElementById("input-form")?.addEventListener("submit", (e) => {
        e.preventDefault()
    })
})

class ClientComms {
    setImageReady: (to: boolean) => void
    setCharts: (to: React.JSX.Element[]) => void
    ws: WebSocket
    reader: FileReader
    clientKey: string
    error: string | null
    charts: React.JSX.Element[]
    chartRefs: ChartJS<"pie">[]

    constructor() {
        this.setImageReady = (_) => { console.log("Image setter not yet provided.") }
        this.setCharts = (_) => { console.log("Chart setter not yet provided.") }
        this.setSocket("ws://localhost:5500")
        this.reader = new FileReader()
        this.reader.addEventListener("load", (_) => {
            this.submit(this.reader.result as string)
        })
        this.reader.addEventListener("error", e => {
            console.log(`Error in reading file: ${e}.`)
            this.error = "Error in reading file."
            this.setImageReady(true)
        })
        this.error = null
        this.charts = []
        this.chartRefs = []
    }

    setSocket(address: string) {
        this.ws = new WebSocket(address)
        this.ws.addEventListener("message", (event) => {
            this.handleMessage(event.data.toString())
        })
        this.ws.addEventListener("error", (e) => { 
            console.log(`Websocket error: ${e}`) 
            this.error = `Websocket error.`
            this.setImageReady(true)
        })
        this.ws.addEventListener("close", (_) => { console.log("ClientComms socket closing.")
         })
        this.ws.addEventListener("open", (_) => { console.log("Hello from the ClientComms socket!") })
    }

    handleMessage(message: string) {
        try {
            var json = JSON.parse(message)
            if ("header" in json) {
                console.log(`Incoming: ${message}`)
                switch (json.header) {
                    case HEADER_CALLBACK_PING:
                        this.send(new MsgCallbackPing(this.clientKey))
                        break
                    case HEADER_INCOMING_IMAGE:
                        this.handleIncomingImage(json)
                        break
                    case HEADER_INCOMING_KEY:
                        this.handleIncomingKey(json)
                        break
                    case HEADER_CLOSE:
                        this.handleClose(json)
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
        let ip = ""
        let port = ""
        document.querySelector(".input-form")?.querySelectorAll("input").forEach((input) => {
            switch (input.id) {
                case "ip-input":
                    ip = input.value
                    break
                case "port-input":
                    port = input.value
                    break
                case "file-input":
                    if (input.files !== null && input.files?.length > 0) {
                        this.reader.readAsText(input.files[0])
                    }
                    break
            }
        })
    }

    submit(data: string) {
        let request = new XMLHttpRequest()
        request.open("POST", "http://localhost:8000/csv", true)
        request.onreadystatechange = () => {
            if (request.readyState == XMLHttpRequest.DONE) {
                console.log(`POST response: ${JSON.stringify(request.response, null, 2)}`)
            }
        }
        request.onerror = (_) => {
            console.log("Upload to server failed.")
            this.error = "Upload to server failed."
            this.setImageReady(true)
        }
        request.send(JSON.stringify(new MsgCsv(this.clientKey, data)))
        console.log("Outgoing: CSV")
    }

    handleIncomingImage(msg: MsgImage) {
        this.error = null
        const rawData = JSON.parse(msg.data)
        let data
        if ("error" in rawData) {
            this.error = "Whoops! A server error occurred."
            this.setImageReady(true)
            return
        } else {
            data = rawData as SentimentAnalysisResult
        }
        const labels = ["Positive", "Negative"]
        let ind = 0
        let tempCharts = this.charts.slice()
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
            if (ind >= tempCharts.length) {
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
                        }} ref={ref => { console.log(`Ref for ${productName} added.`)
                            this.chartRefs.push(ref as ChartJS<"pie">)}} redraw={true}/>
                    </div>)
            } else {
                const ref = this.chartRefs[ind]
                if (ref !== null) {
                    tempCharts[ind].key = productName
                    ref.data = chart
                    const refTitle = ref.options.plugins?.title
                    if (refTitle !== undefined) {
                        refTitle.text = productName
                    }
                    ref.update()
                }
            }
            console.log(`Index: ${ind}, charts length: ${tempCharts.length}, refs length: ${this.chartRefs.length}, product: ${productName}`)
            ind += 1
        }
        if (ind < tempCharts.length) {
            console.log(`Extra elements found (ind: ${ind}, charts length: ${tempCharts.length}), removing...`)
            const removedElements = tempCharts.splice(ind)
            const removedRefs = this.chartRefs.splice(ind)
            for (const ref of removedRefs) {
                ref.destroy()
            }
            console.log(`Lengths after removal: charts: ${tempCharts.length}, refs: ${this.chartRefs.length}`)
        }
        this.setImageReady(true)
        this.charts = tempCharts
        this.setCharts(tempCharts)
        console.log("Setting image as ready")
    }

    handleIncomingKey(msg: MsgKey) {
        this.clientKey = msg.clientKey
    }

    handleClose(_: MsgClose) {
        this.ws.close()
    }

    send(data: object) {
        const str = JSON.stringify(data)
        console.log(`Outgoing: ${str}`)
        this.ws.send(str)
    }
}

const comms = new ClientComms()
export default function App() {
    const [imageReady, setImageReady] = useState(false)
    comms.setImageReady = setImageReady
    const [charts, setCharts] = useState<React.JSX.Element[]>([])
    comms.setCharts = setCharts
    console.log(`Charts: ${JSON.stringify(charts)}`)
    return (<>
    <form className="input-form" id="input-form">
        <label htmlFor="file-input">Choose file (only .csv allowed)</label> <br />
        <input type="file" id="file-input" name="file-input" accept=".csv" /> <br />
        <label htmlFor="ip-input">Input server address:</label> <br />
        <input type="text" id="ip-input"/> <br />
        <label htmlFor="port-input">Input port number:</label> <br />
        <input type="text" id="port-input"/> <br />
        <button onClick={comms.prepareSubmit.bind(comms)} type="button">Submit</button> <br />
    </form>
    <div className="error-area">{comms.error == null ? "" : comms.error}</div>
    {imageReady ? <div className="chart-display-area">{charts}</div> : <></>}
    </>)
}