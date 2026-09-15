/* One-off: rebuild DS/Table/Row/Selected (split into small batches to dodge flaky NO_RESULT) */
import fs from "fs";
const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
const IDS = JSON.parse(fs.readFileSync(new URL("../.vibe/stage9/user-list-build-ids.json", import.meta.url), "utf8"));
async function cmd(op, params = {}) {
  const res = await fetch(`http://127.0.0.1:45677/v1/command?token=${TOKEN}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, params }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`${op}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.data ?? j;
}
const COLS = [240, 260, 120, 180, 180, 200];
const user = ["赵敏", "zhao.min@example.com", "Success", "2023-01-15", "2026-09-12"];
const S = "$" + "sr";
let ops = [
  { op: "create-frame", as: "sr", params: { name: "tmp-row-Selected", width: 1180, height: 44, x: 0, y: 608, fill: "#F0F1FE" } },
  { op: "set-stroke", params: { id: S, color: "#E4E7ED", strokeWeight: 1 } },
  { op: "set-auto-layout", params: { id: S, mode: "horizontal", spacing: 0 } },
  { op: "set-counter-axis-align", params: { id: S, align: "CENTER" } },
  { op: "set-layout-sizing", params: { id: S, horizontal: "FIXED", vertical: "FIXED" } },
];
function cell(as, name, w) {
  ops.push(
    { op: "create-frame", as, params: { name, width: w, height: 44, parentId: S } },
    { op: "set-auto-layout", params: { id: "$" + as, mode: "horizontal", spacing: 0 } },
    { op: "set-padding", params: { id: "$" + as, horizontal: 12 } },
    { op: "set-counter-axis-align", params: { id: "$" + as, align: "CENTER" } },
  );
}
// 用户
cell("c0", "cell-user", COLS[0]);
ops.push({ op: "set-item-spacing", params: { id: "$c0", spacing: 8 } });
ops.push({ op: "create-ellipse", params: { name: "avatar", width: 24, height: 24, parentId: "$c0", fill: "#AAB8E8" } });
ops.push({ op: "create-text", params: { characters: user[0], fontFamily: "Noto Sans SC", fontSize: 13, fill: "#303133", parentId: "$c0" } });
// 邮箱
cell("c1", "cell-email", COLS[1]);
ops.push({ op: "create-text", params: { characters: user[1], fontFamily: "Noto Sans SC", fontSize: 13, fill: "#303133", parentId: "$c1" } });
// 状态
cell("c2", "cell-status", COLS[2]);
ops.push({ op: "create-instance", params: { componentId: IDS.comp_bdg_Success, parentId: "$c2" } });
// 时间×2
for (const [i, v] of [[3, user[3]], [4, user[4]]]) {
  cell(`c${i}`, `cell-${i}`, COLS[i]);
  ops.push({ op: "create-text", params: { characters: v, fontFamily: "Noto Sans SC", fontSize: 13, fill: "#303133", parentId: `$c${i}` } });
}
// 操作
cell("c5", "cell-actions", COLS[5]);
ops.push({ op: "set-item-spacing", params: { id: "$c5", spacing: 12 } });
ops.push({ op: "create-text", params: { characters: "编辑", fontFamily: "Noto Sans SC", fontSize: 12, fill: "#5A5CF0", parentId: "$c5" } });
ops.push({ op: "create-text", params: { characters: "删除", fontFamily: "Noto Sans SC", fontSize: 12, fill: "#F56C6C", parentId: "$c5" } });

console.log("batch A (frame+cells):", (await cmd("run", { ops })).status);
// verify then convert
const n = await cmd("get-node", { id: IDS.sr ?? "$sr" }).catch(() => null);
// get actual id: re-read page summary to find tmp-row-Selected
const s = await cmd("get-page-summary", {});
const tmp = s.nodes.find((x) => x.name === "tmp-row-Selected");
const full = await cmd("get-node", { id: tmp.id, depth: 1 });
console.log("cells:", full.children.length);
if (full.children.length !== 6) throw new Error("incomplete selected row: " + full.children.length);
console.log("batch B (convert):", JSON.stringify(await cmd("create-component", { id: tmp.id, name: "DS/Table/Row/Selected" })).slice(0, 160));
// record id
const sum2 = await cmd("get-page-summary", {});
const comp = sum2.nodes.find((x) => x.name === "DS/Table/Row/Selected");
IDS.comp_row_Selected = comp.id;
fs.writeFileSync(new URL("../.vibe/stage9/user-list-build-ids.json", import.meta.url), JSON.stringify(IDS, null, 1));
console.log("Selected component:", comp.id);
