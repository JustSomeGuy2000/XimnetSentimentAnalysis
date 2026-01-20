import { useState } from "react";
import { HEADER_CALLBACK_PING, HEADER_CLOSE, HEADER_INCOMING_IMAGE, HEADER_INCOMING_KEY, MsgCallbackPing, MsgCsv } from "./messages.js";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { Pie } from 'react-chartjs-2';
ChartJS.register(ArcElement, Tooltip, Legend, Title);
document.addEventListener("DOMContentLoaded", (_) => {
    document.getElementById("input-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
    });
});
class ClientComms {
    setImageReady = (_) => console.log("Image setter not yet provided.");
    setCharts = (_) => console.log("Chart setter not yet provided.");
    setError = (_) => console.log("Error setter not yet provided.");
    #ws;
    #reader;
    #clientKey;
    #chartRefs = [];
    constructor() {
        this.#setSocket("ws://localhost:5500");
        this.#reader = new FileReader();
        this.#reader.addEventListener("load", (_) => this.#submit(this.#reader.result));
        this.#reader.addEventListener("error", e => {
            console.log(`Error in reading file: ${e}.`);
            this.setError("Error in reading file.");
            this.setImageReady(true);
        });
        this.setError(null);
    }
    #setSocket(address) {
        this.#ws = new WebSocket(address);
        this.#ws.addEventListener("message", event => this.#handleMessage(event.data.toString()));
        this.#ws.addEventListener("error", e => {
            console.log(`Websocket error: ${e}`);
            this.setError(`Websocket error.`);
            this.setImageReady(true);
        });
        this.#ws.addEventListener("close", (_) => console.log("ClientComms socket closing."));
        this.#ws.addEventListener("open", (_) => console.log("Hello from the ClientComms socket!"));
    }
    #handleMessage(message) {
        try {
            var json = JSON.parse(message);
            if ("header" in json) {
                console.log(`Incoming: ${message}`);
                switch (json.header) {
                    case HEADER_CALLBACK_PING:
                        this.#send(new MsgCallbackPing(this.#clientKey));
                        break;
                    case HEADER_INCOMING_IMAGE:
                        this.#handleIncomingImage(json);
                        break;
                    case HEADER_INCOMING_KEY:
                        this.#handleIncomingKey(json);
                        break;
                    case HEADER_CLOSE:
                        this.#handleClose(json);
                        break;
                    default:
                        console.log(`Recevived JSON with unknown header: ${message}`);
                }
            }
            else {
                console.log(`Received JSON without header: ${message}`);
            }
        }
        catch {
            console.log(`Received malformed message: ${message}`);
        }
    }
    prepareSubmit() {
        document.querySelector(".input-form")?.querySelectorAll("input").forEach(input => {
            switch (input.id) {
                case "file-input":
                    if (input.files !== null && input.files?.length > 0) {
                        this.#reader.readAsText(input.files[0]);
                    }
                    break;
            }
        });
    }
    #submit(data) {
        let request = new XMLHttpRequest();
        request.open("POST", "http://localhost:8000/csv", true);
        request.onreadystatechange = () => {
            if (request.readyState == XMLHttpRequest.DONE) {
                console.log(`POST response: ${JSON.stringify(request.response, null, 2)}`);
            }
        };
        request.onerror = (_) => {
            console.log("Upload to server failed.");
            this.setError("Upload to server failed.");
            this.setImageReady(true);
        };
        request.send(JSON.stringify(new MsgCsv(this.#clientKey, data)));
        console.log("Outgoing: CSV");
    }
    #handleIncomingImage(msg) {
        this.setError(null);
        const rawData = JSON.parse(msg.data);
        let data;
        if ("error" in rawData) {
            this.setError("Whoops! A server error occurred.");
            this.setImageReady(true);
            return;
        }
        else {
            data = rawData;
        }
        for (const ref of this.#chartRefs) {
            if (ref !== null) {
                ref.destroy();
            }
        }
        this.#chartRefs = [];
        const labels = ["Positive", "Negative"];
        let ind = 0;
        let tempCharts = [];
        for (const productName in data) {
            const chart = {
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
            };
            tempCharts.push(<div className="chart-container" key={productName}>
                    <Pie className="sentiment-chart" data={chart} options={{
                    plugins: {
                        title: {
                            display: true,
                            text: productName
                        }
                    },
                    maintainAspectRatio: false
                }} ref={ref => {
                    console.log(`Ref for ${productName} added.`);
                    this.#chartRefs.push(ref);
                }} redraw/>
                </div>); // Note: Do NOT remove redraw={true}
            ind += 1;
        }
        this.setImageReady(true);
        this.setCharts(tempCharts);
        console.log("Setting image as ready");
    }
    #handleIncomingKey(msg) {
        this.#clientKey = msg.clientKey;
    }
    #handleClose(_) {
        this.#ws.close();
    }
    #send(data) {
        const str = JSON.stringify(data);
        console.log(`Outgoing: ${str}`);
        this.#ws.send(str);
    }
}
const comms = new ClientComms();
export default function App() {
    const [imageReady, setImageReady] = useState(false);
    comms.setImageReady = setImageReady;
    const [charts, setCharts] = useState([]);
    comms.setCharts = setCharts;
    const [error, setError] = useState(null);
    comms.setError = setError;
    console.log(`Charts: ${JSON.stringify(charts)}`);
    return (<>
    <form className="input-form" id="input-form">
        <label htmlFor="file-input">Choose file (only .csv allowed)</label> <br />
        <input type="file" id="file-input" name="file-input" accept=".csv"/> <br />
        <button onClick={comms.prepareSubmit.bind(comms)} type="button">Submit</button> <br />
    </form>
    <div className="error-area">{error == null ? "" : error}</div>
    {imageReady ? <div className="chart-display-area">{charts}</div> : <></>}
    </>);
}
