import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
//import dotenv from "dotenv"
import { serverComms } from "./src/serverComms.js";
//dotenv.config({path: "./.env"})
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use((req, res, next) => {
    console.log(`${req.method} for ${req.path} from ${req.ip}.`);
    next();
});
app.use("/", express.static(__dirname + "/dist"));
app.use("/assets", express.static(__dirname + "/dist/assets"));
serverComms.start();
app.listen(5200);
