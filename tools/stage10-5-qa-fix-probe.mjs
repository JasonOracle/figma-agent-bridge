// 修复 QA 残留问题：
// 1) 顶层残件 "header" (5:164) —— 先读回确认非页面/DS 内容后删除
// 2) StatusBar 电池 #D9D9D9 → 替换为 DS 白名单色
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

// --- 1) 检查残件 5:164 ---
const stray = await cmd("get-node", { id: "5:164", depth: 3, detail: true });
console.log("=== 5:164 ===");
console.log(JSON.stringify({ id: stray.id, name: stray.name, type: stray.type, x: stray.x, y: stray.y, w: stray.width, h: stray.height, children: (stray.children || []).map(c => ({ id: c.id, name: c.name, type: c.type })) }, null, 2));

// --- 2) 找电池节点 ---
const summary = await cmd("get-page-summary", {});
const tops = summary.nodes || summary;
const dsStatus = tops.find(n => n.name === "DS/Navigation/StatusBar");
console.log("DS/StatusBar id:", dsStatus && dsStatus.id);
if (dsStatus) {
  const det = await cmd("get-node", { id: dsStatus.id, depth: 6, detail: true });
  const stack = [det];
  while (stack.length) {
    const n = stack.pop();
    const fill = JSON.stringify(n.fills || n.fill || "");
    if (/d9d9d9/i.test(fill) || /battery/i.test(String(n.name))) {
      console.log("HIT:", JSON.stringify({ id: n.id, name: n.name, type: n.type, fills: n.fills || n.fill }));
    }
    for (const c of n.children || []) stack.push(c);
  }
}
