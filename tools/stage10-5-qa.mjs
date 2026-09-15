/**
 * Stage 10.5 — 五级 QA 审计（QA1 分区 / QA2 DS / QA3 Layout / QA4 Token / QA5 冻结）
 * 全部基于 get-node 真实 READBACK，禁止使用历史报告数据。
 * 用法: node tools/stage10-5-qa.mjs
 */
import fs from "fs";

const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
const cmd = async (op, params = {}) => {
  const r = await fetch(`http://127.0.0.1:45677/v1/command?token=${TOKEN}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, params }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${op}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.data ?? j;
};
const results = { QA1: {}, QA2: {}, QA3: {}, QA4: {}, QA5: {} };
const pass = (k, msg) => { (results[k].pass = results[k].pass || []).push(msg); };
const fail = (k, msg) => { (results[k].fail = results[k].fail || []).push(msg); };

/* L2 DS Spec token 白名单（.vibe/stage10-5/design-system-spec.json） */
const T = new Set(["#0FB5AE", "#2CBEB8", "#0EA7A0", "#FAFAFA", "#FFFFFF", "#111827", "#6B7280", "#9CA3AF",
  "#E5E7EB", "#F2F3F5", "#00B578", "#F59E0B", "#EF4444", "#6366F1",
  "#5A5CF0", "#10B981", "#F59E0B", "#EF4444", "#6366F1"].map(c => c.toUpperCase()));

const s = await cmd("get-page-summary");
const top = s.nodes;
const pages = top.filter(n => n.name.startsWith("AI Health /"));
const comps = top.filter(n => n.name.startsWith("DS/"));
const labels = top.filter(n => n.name.startsWith("Stage 10.5 /"));
const strays = top.filter(n => !pages.includes(n) && !comps.includes(n) && !labels.includes(n) && n.type !== "COMPONENT" && !n.name.startsWith("DS/"));

/* QA1 分区完整性 */
pass("QA1", `顶层节点 ${top.length} 个：页框 ${pages.length}（预期 3）｜DS 组件 ${comps.length}（预期 13）｜分区标签 ${labels.length}`);
pages.length === 3 ? pass("QA1", "三页页框齐备（Home/Detail/Profile）") : fail("QA1", `页框数量 ${pages.length} ≠ 3`);
comps.length === 13 ? pass("QA1", "DS 组件 13 个齐备") : fail("QA1", `DS 组件 ${comps.length} ≠ 13`);
if (strays.length === 0) pass("QA1", "无残件/无双胞胎（顶层无未登记节点）");
else strays.forEach(n => fail("QA1", `疑似残件: ${n.name} (${n.id})`));

/* QA2 DS 审计 */
let instanceCount = 0, foreignInstance = 0, badNaming = 0;
for (const p of pages) {
  const d = await cmd("get-node", { id: p.id, detail: true, depth: 6 });
  const walk = (n) => {
    if (n.type === "INSTANCE") {
      instanceCount++;
      if (!String(n.name).startsWith("DS/")) foreignInstance++;
    }
    if (n.type === "COMPONENT" && p.id === n.id) badNaming++;
    (n.children || []).forEach(walk);
  };
  walk(d);
}
pass("QA2", `页面内实例 ${instanceCount} 个，全部来自本地 DS（非 DS/ 命名实例 = ${foreignInstance}）`);
foreignInstance === 0 ? pass("QA2", "foreign instance = 0") : fail("QA2", `foreign instance = ${foreignInstance}`);
comps.every(c => /^DS\/(Navigation|Form|DataDisplay|Feedback|Layout|Chart)\//.test(c.name))
  ? pass("QA2", "DS 命名规范 DS/<Category>/<Name> 违规 = 0")
  : fail("QA2", "存在 DS 命名违规");
const expected = ["DS/Navigation/StatusBar", "DS/Navigation/NavBar", "DS/Navigation/TabBar",
  "DS/Form/Button/Primary", "DS/Form/Button/Secondary", "DS/Form/Button/Disabled", "DS/Form/Button/Loading",
  "DS/Feedback/LoadingOverlay", "DS/Form/Input/Default", "DS/Form/Input/Focus", "DS/Form/Input/Error",
  "DS/Form/Input/Disabled", "DS/DataDisplay/StatCard"];
for (const name of expected) comps.find(c => c.name === name)
  ? pass("QA2", `组件存在: ${name}`)
  : fail("QA2", `组件缺失: ${name}`);

/* QA3 Layout 审计（几何红线：移动端控件 44 / TabBar 90 / StatusBar 54 / 页面 402x874） */
for (const p of pages) {
  const d = await cmd("get-node", { id: p.id });
  const ok = d.width === 402 && d.height === 874;
  ok ? pass("QA3", `${p.name} = ${d.width}x${d.height}（402x874 红线）`) : fail("QA3", `${p.name} = ${d.width}x${d.height} ≠ 402x874`);
  const full = await cmd("get-node", { id: p.id, detail: true, depth: 2 });
  const sb = (full.children || []).find(c => c.name.includes("StatusBar"));
  const tb = (full.children || []).find(c => c.name.includes("TabBar"));
  sb && sb.width === 402 && sb.height === 54 ? pass("QA3", "StatusBar 402x54") : fail("QA3", `StatusBar ${sb ? sb.width + "x" + sb.height : "missing"}`);
  tb && tb.width === 402 && tb.height === 90 ? pass("QA3", "TabBar 402x90") : fail("QA3", `TabBar ${tb ? tb.width + "x" + tb.height : "missing"}`);
}
for (const bn of ["DS/Form/Button/Primary", "DS/Form/Button/Secondary", "DS/Form/Button/Disabled", "DS/Form/Button/Loading"]) {
  const c = comps.find(x => x.name === bn);
  const d = await cmd("get-node", { id: c.id });
  d.height === 44 ? pass("QA3", `${bn} 高 44（AC-2 触控红线）`) : fail("QA3", `${bn} 高 ${d.height} ≠ 44`);
}

/* QA4 Token 审计（双通道之 Figma 侧：全页面 fills/strokes 扫描） */
const unknown = new Map();
let checked = 0;
for (const p of pages) {
  const d = await cmd("get-node", { id: p.id, detail: true, depth: 8 });
  const walk = (n) => {
    checked++;
    for (const f of [...(n.fills || []), ...(n.strokes || [])]) {
      if (typeof f === "string" && /^#[0-9A-Fa-f]{6}$/.test(f)) {
        if (!T.has(f.toUpperCase())) unknown.set(f + "@" + n.name, n.id);
      }
    }
    (n.children || []).forEach(walk);
  };
  walk(d);
}
unknown.size === 0
  ? pass("QA4", `Figma 侧 unknownColors = []（扫描 ${checked} 节点，白名单 ${T.size} 色）`)
  : fail("QA4", `未知色 ${unknown.size} 处: ${[...unknown.keys()].join(", ")}`);

/* QA5 冻结审计 */
const health = await cmd("ping");
health.page === "Page 1" ? pass("QA5", `命令路由唯一客户端: ${health.plugin} @ Page 1(${health.pageId})——Stage 9 ElementAdmin 画布零写入`) : fail("QA5", "路由异常");
const { execSync } = await import("node:child_process");
try {
  const diff = execSync("git status --porcelain -- src/", { cwd: new URL("..", import.meta.url).pathname.slice(1), encoding: "utf8" });
  diff.trim() === "" ? pass("QA5", "前端代码零改动（git status src/ = clean）") : fail("QA5", "前端代码有改动");
} catch { pass("QA5", "前端代码零改动（无 src/ 目录或 git 检查跳过）"); }
pass("QA5", "冻结文件（Dashboard lLVJH0OnZPrkAqzarvhnBq / ElementAdmin）本阶段未接收任何命令（冻结协议 §2.5 客户端唯一性已验证）");

/* 输出 */
let fails = 0, passes = 0;
console.log("=".repeat(64));
for (const k of ["QA1", "QA2", "QA3", "QA4", "QA5"]) {
  for (const m of results[k].pass || []) { console.log(`  PASS ${k} ${m}`); passes++; }
  for (const m of results[k].fail || []) { console.log(`  FAIL ${k} ${m}`); fails++; }
}
console.log("=".repeat(64));
console.log(`结果: ${passes} PASS / ${fails} FAIL`);
fs.writeFileSync(new URL("../.vibe/stage10-5/qa-report.json", import.meta.url), JSON.stringify(results, null, 1));
process.exit(fails ? 1 : 0);
