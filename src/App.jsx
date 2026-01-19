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
    setImageReady;
    ws;
    reader;
    clientKey;
    data;
    error;
    constructor() {
        this.setImageReady = (_) => { console.log("Image setter not yet provided."); };
        this.setSocket("ws://localhost:5500");
        console.log("Hello from ClientComms!");
        this.reader = new FileReader();
        this.reader.addEventListener("load", (_) => {
            this.submit(this.reader.result);
        });
        this.reader.addEventListener("error", e => {
            console.log(`Error in reading file: ${e}.`);
            this.error = "Error in reading file.";
            this.setImageReady(true);
        });
        this.data = {};
        this.error = null;
    }
    setSocket(address) {
        this.ws = new WebSocket(address);
        this.ws.addEventListener("message", (event) => {
            this.handleMessage(event.data.toString());
        });
        this.ws.addEventListener("error", (e) => {
            console.log(`Websocket error: ${e}`);
            this.error = `Websocket error.`;
            this.setImageReady(true);
        });
        this.ws.addEventListener("close", (_) => {
            console.log("ClientComms socket closing.");
        });
        this.ws.addEventListener("open", (_) => { console.log("Hello from the ClientComms socket!"); });
    }
    handleMessage(message) {
        try {
            var json = JSON.parse(message);
            if ("header" in json) {
                console.log(`Incoming: ${message}`);
                switch (json.header) {
                    case HEADER_CALLBACK_PING:
                        this.send(new MsgCallbackPing(this.clientKey));
                        break;
                    case HEADER_INCOMING_IMAGE:
                        this.handleIncomingImage(json);
                        break;
                    case HEADER_INCOMING_KEY:
                        this.handleIncomingKey(json);
                        break;
                    case HEADER_CLOSE:
                        this.handleClose(json);
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
        let ip = "";
        let port = "";
        document.querySelector(".input-form")?.querySelectorAll("input").forEach((input) => {
            switch (input.id) {
                case "ip-input":
                    ip = input.value;
                    break;
                case "port-input":
                    port = input.value;
                    break;
                case "file-input":
                    if (input.files !== null && input.files?.length > 0) {
                        this.reader.readAsText(input.files[0]);
                    }
                    break;
            }
        });
    }
    submit(data) {
        let request = new XMLHttpRequest();
        request.open("POST", "http://localhost:8000/csv", true);
        request.onreadystatechange = () => {
            if (request.readyState == XMLHttpRequest.DONE) {
                console.log(`POST response: ${JSON.stringify(request.response, null, 2)}`);
            }
        };
        request.onerror = (_) => {
            console.log("Upload to server failed.");
            this.error = "Upload to server failed.";
            this.setImageReady(true);
        };
        request.send(JSON.stringify(new MsgCsv(this.clientKey, data)));
        console.log("Outgoing: CSV");
    }
    handleIncomingImage(msg) {
        this.error = null;
        const rawData = JSON.parse(msg.data);
        let data;
        if ("error" in rawData) {
            this.error = "Whoops! A server error occurred.";
            this.setImageReady(true);
            return;
        }
        else {
            data = rawData;
        }
        const labels = ["Positive", "Negative"];
        const charts = {};
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
            console.log(`Chart data (${productName}): ${JSON.stringify(chart)}`);
            charts[productName] = chart;
        }
        this.data = charts;
        this.setImageReady(true);
    }
    handleIncomingKey(msg) {
        this.clientKey = msg.clientKey;
    }
    handleClose(_) {
        this.ws.close();
    }
    send(data) {
        const str = JSON.stringify(data);
        console.log(`Outgoing: ${str}`);
        this.ws.send(str);
    }
}
const comms = new ClientComms();
export default function App() {
    const [imageReady, setImageReady] = useState(false);
    comms.setImageReady = setImageReady;
    const charts = [];
    for (const productName in comms.data) {
        charts.push(<div className="chart-container">
            <Pie className="sentiment-chart" data={comms.data[productName]} options={{
                plugins: {
                    title: {
                        display: true,
                        text: productName
                    }
                },
                maintainAspectRatio: false
            }}/>
        </div>);
    }
    return (<>
    <form className="input-form" id="input-form">
        <label htmlFor="file-input">Choose file (only .csv allowed)</label> <br />
        <input type="file" id="file-input" name="file-input" accept=".csv"/> <br />
        <label htmlFor="ip-input">Input server address:</label> <br />
        <input type="text" id="ip-input"/> <br />
        <label htmlFor="port_input">Input port number:</label> <br />
        <input type="text" id="port-input"/> <br />
        <button onClick={comms.prepareSubmit.bind(comms)} type="button">Submit</button> <br />
    </form>
    <div className="error-area">{comms.error == null ? "" : comms.error}</div>
    {imageReady ? <div className="chart-display-area">{charts}</div> : <></>}
    </>);
}
