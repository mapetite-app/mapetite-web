import { readFileSync } from "fs";
import { homedir } from "os";

const imagePath = homedir() + "/Desktop/Screenshot_Mapetite.png";

const base64 = readFileSync(imagePath).toString("base64");
const dataUrl = `data:image/png;base64,${base64}`;

const res = await fetch("http://localhost:3000/api/import-caption", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ image: dataUrl }),
});

const data = await res.json();
console.log("Risposta della route:", data);
