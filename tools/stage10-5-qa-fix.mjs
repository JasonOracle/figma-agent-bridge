// QA 修复批（4 ops）：
// 1) delete-node 5:164（早期失败批残件 header 78x24，已读回确认非页面/DS 内容）
// 2) set-fill 5:92 battery #D9D9D9 -> #E5E7EB（token border.default）
import fs from "fs";

const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
async function cmd(op, params = {}) {
  const r = await fetch(`http://127.0.0.1:45677/v1/command?token=${TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op, params }),
  });
  const j = await r.json();
  return j.data ?? j;
}

console.log("delete 5:164:", JSON.stringify(await cmd("delete-node", { id: "5:164" })));
console.log("set-fill 5:92:", JSON.stringify(await cmd("set-fill", { id: "5:92", color: "#E5E7EB" })));

// READBACK 验证
const battery = await cmd("get-node", { id: "5:92", detail: true });
console.log("battery readback:", JSON.stringify({ id: battery.id, name: battery.name, fills: battery.fills }));
let strayCheck;
try { strayCheck = await cmd("get-node", { id: "5:164", detail: true }); } catch (e) { strayCheck = { gone: true, msg: String(e).slice(0, 120) }; }
console.log("5:164 readback:", JSON.stringify(strayCheck).slice(0, 200));
