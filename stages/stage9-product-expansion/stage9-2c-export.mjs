/**
 * Stage 9.2-C visual QA export — 4 page frames → .vibe/stage9/screenshots/*.png
 * Uses the new "export-node" plugin op (base64 PNG over Bridge).
 */
import fs from "fs";

const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
const BRIDGE = "http://127.0.0.1:45677/v1/command";
const OUT = new URL("../.vibe/stage9/screenshots/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

async function cmd(op, params = {}) {
  const res = await fetch(`${BRIDGE}?token=${TOKEN}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, params }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`${op} failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.data ?? j;
}

const FRAMES = [
  { id: "4:235", file: "userlist-4-235.png" },
  { id: "7:480", file: "examlist-7-480.png" },
  { id: "8:1034", file: "examdetail-8-1034.png" },
  { id: "8:1215", file: "settings-8-1215.png" },
];

const manifest = [];
for (const f of FRAMES) {
  const d = await cmd("export-node", { id: f.id, scale: 1 });
  const buf = Buffer.from(d.base64, "base64");
  fs.writeFileSync(new URL(f.file, OUT), buf);
  manifest.push({ nodeId: d.id, name: d.name, file: f.file, bytes: buf.length, reportedBytes: d.bytes, scale: d.scale });
  console.log("saved", f.file, buf.length, "bytes");
}
fs.writeFileSync(new URL("../.vibe/stage9/screenshots/export-manifest.json", import.meta.url), JSON.stringify({ exportedAt: new Date().toISOString(), items: manifest }, null, 1));
console.log("EXPORT DONE");
