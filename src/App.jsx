import { useState } from "react";
import { HEADER_CALLBACK_PING, HEADER_CLOSE, HEADER_INCOMING_IMAGE, HEADER_INCOMING_KEY, MsgCallbackPing, MsgCsv } from "./messages.js";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
ChartJS.register(ArcElement, Tooltip, Legend);
document.addEventListener("DOMContentLoaded", (_) => {
    document.getElementById("input_form")?.addEventListener("submit", (e) => {
        e.preventDefault();
    });
});
class ClientComms {
    setImageReady;
    ws;
    reader;
    clientKey;
    data;
    constructor() {
        this.setImageReady = (_) => { console.log("Image setter not yet provided."); };
        this.setSocket("ws://localhost:5500");
        console.log("Hello from ClientComms!");
        this.reader = new FileReader();
        this.data = {};
    }
    setSocket(address) {
        this.ws = new WebSocket(address);
        this.ws.addEventListener("message", (event) => {
            this.handleMessage(event.data.toString());
        });
        this.ws.addEventListener("error", (e) => { console.log(`Error: ${e}`); });
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
        document.querySelector(".input_form")?.querySelectorAll("input").forEach((input) => {
            switch (input.id) {
                case "ip_input":
                    ip = input.value;
                    break;
                case "port_input":
                    port = input.value;
                    break;
                case "file_input":
                    if (input.files !== null && input.files?.length > 0) {
                        this.reader.readAsText(input.files[0]);
                        this.reader.addEventListener("load", (_) => {
                            this.submit(this.reader.result);
                        });
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
            let error_area = document.getElementById("error_area");
            if (error_area !== null) {
                error_area.textContent = "Upload to server failed.";
            }
        };
        request.send(JSON.stringify(new MsgCsv(this.clientKey, data)));
        console.log("Outgoing: CSV");
    }
    handleIncomingImage(msg) {
        const data = msg.data;
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
                            'rgba(255, 99, 132, 0.2)',
                            'rgba(54, 162, 235, 0.2)',
                        ],
                        borderColor: [
                            'rgba(255, 99, 132, 1)',
                            'rgba(54, 162, 235, 1)',
                        ],
                        borderWidth: 1,
                    }
                ],
            };
            charts[productName] = (chart);
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
        charts.push(<><Pie data={comms.data[productName]} options={{
                plugins: {
                    title: {
                        display: true,
                        text: productName
                    }
                }
            }}/><br /></>);
    }
    return (<>
    <form className="input_form" id="input_form">
        <label htmlFor="file_input">Choose file (only .csv allowed)</label> <br />
        <input type="file" id="file_input" name="file_input" accept=".csv"/> <br />
        <label htmlFor="ip_input">Input server address:</label> <br />
        <input type="text" id="ip_input"/> <br />
        <label htmlFor="port_input">Input port number:</label> <br />
        <input type="text" id="port_input"/> <br />
        <button onClick={comms.prepareSubmit.bind(comms)} type="button">Submit</button> <br />
    </form>
    <div className="error_area"></div>
    {imageReady ? charts : <></>}
    </>);
}
