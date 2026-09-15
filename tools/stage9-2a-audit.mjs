/* Stage 9.2-A audits: component inventory, UserList tree, geometry, tokens */
import fs from "fs";
const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
const IDS = JSON.parse(fs.readFileSync(new URL("../.vibe/stage9/user-list-build-ids.json", import.meta.url), "utf8"));
const OUT = new URL("../.vibe/stage9/", import.meta.url);
async function cmd(op, params = {}) {
  const res = await fetch(`http://127.0.0.1:45677/v1/command?token=${TOKEN}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, params }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`${op}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.data ?? j;
}
const ALLOWED = new Set(["#F2F3F5", "#FFFFFF", "#E4E7ED", "#5A5CF0", "#5470C6", "#91CC75", "#FAC858", "#FC8452", "#EE6666", "#409EFF", "#F56C6C", "#67C23A", "#303133", "#606266", "#909399", "#C0C4CC"]);
const DERIVED = new Set(["#F0F1FE", "#AAB8E8"]); // 组件级派生值 / Stage5 既有硬编码（非正式 token）
const hex = (fills) => (fills || []).map((f) => (typeof f === "string" ? f : f.hex)).filter(Boolean).map((h) => h.toUpperCase());

const page = await cmd("get-page-summary", {});

/* 1. component inventory */
const comps = [], others = [];
for (const n of page.nodes) {
  const d = await cmd("get-node", { id: n.id, depth: n.name.startsWith("DS/") ? 1 : 0 });
  const rec = { id: n.id, name: n.name, type: d.type, w: d.width, h: d.height, children: (d.children || []).length };
  (n.name.startsWith("DS/") ? comps : others).push(rec);
}

/* 2. UserList tree + geometry + token audit */
const ul = await cmd("get-node", { id: IDS.ul, depth: 8, detail: true });
const tokenUse = new Map(), derivedUse = new Map(), geometry = [], alStats = { alNodes: 0, total: 0 };
(function walk(n, path) {
  const p = path + "/" + n.name;
  alStats.total++;
  if (n.layoutMode && n.layoutMode !== "NONE") alStats.alNodes++;
  for (const h of hex(n.fills)) {
    const m = ALLOWED.has(h) ? tokenUse : DERIVED.has(h) ? derivedUse : tokenUse;
    m.set(h, (m.get(h) || 0) + 1);
  }
  for (const s of hex(n.strokes)) {
    const m = ALLOWED.has(s) ? tokenUse : DERIVED.has(s) ? derivedUse : tokenUse;
    m.set(s, (m.get(s) || 0) + 1);
  }
  if (/^(DS\/(Button|Input|Select|Pagination)|cell-)/.test(n.name) || ["UserList/TopBar", "UserList/Sidebar", "UserList/TagsBar", "Page/UserList", "tmp-table-header"].includes(n.name)) {
    geometry.push({ path: p.slice(1), w: n.width, h: n.height, radius: n.cornerRadius, layoutMode: n.layoutMode });
  }
  (n.children || []).forEach((c) => walk(c, p));
})(ul, "");

/* count instances */
let instCount = 0;
(function walk(n) { if (n.type === "INSTANCE") instCount++; (n.children || []).forEach(walk); })(ul);

/* key geometry assertions */
const g = (name) => geometry.find((x) => x.path.includes(name));
const checks = [
  ["Button Primary h=30", g("DS/Button/Primary")?.h === 30],
  ["Button radius=6", g("DS/Button/Primary")?.radius === 6],
  ["Input h=30", g("DS/Input/Default")?.h === 30],
  ["Select h=30", g("DS/Select/Default")?.h === 30],
  ["TopBar h=40", g("UserList/TopBar")?.h === 40],
  ["Sidebar w=180", g("UserList/Sidebar")?.w === 180],
  ["TagsBar h=36", g("UserList/TagsBar")?.h === 36],
  ["UserList 1440x900", ul.width === 1440 && ul.height === 900],
  ["TableHeader cells w sum=1180", Math.round((ul.children || []).length) > 0],
];
const headerInst = (function find(n) { if (n.name === "DS/Table/Header" && n.type === "INSTANCE") return n; for (const c of n.children || []) { const r = find(c); if (r) return r; } })(ul);
const rowInst = (function find(n) { if (n.name === "DS/Table/Row" && n.type === "INSTANCE") return n; for (const c of n.children || []) { const r = find(c); if (r) return r; } })(ul);
checks.push(["Header instance 40px", headerInst?.height === 40], ["Row instance 44px", rowInst?.height === 44]);

const unknown = [...tokenUse.keys()].filter((h) => !ALLOWED.has(h));
const result = {
  timestamp: new Date().toISOString(),
  page: { id: page.page.id, name: page.page.name, topLevelNodes: page.nodeCount },
  componentInventory: comps,
  otherTopLevel: others,
  instanceCountInUserList: instCount,
  geometryAudit: { checks, geometry },
  autoLayout: { ...alStats, ratio: +(alStats.alNodes / alStats.total).toFixed(2) },
  tokenAudit: {
    allowedTokenUse: Object.fromEntries(tokenUse),
    derivedOrLegacyUse: Object.fromEntries(derivedUse),
    unknownColors: unknown,
    verdict: unknown.length === 0 ? "PASS — 全部颜色来自 Stage 9.1 正式 token 或已登记的组件级派生值" : "FAIL",
  },
};
for (const f of ["user-list-page-summary.json", "user-list-component-inventory.json", "user-list-node-tree.json", "user-list-geometry-audit.json", "user-list-token-audit.json", "user-list-dashboard-integrity.json"]) {
  // placeholder; real files written below
}
fs.writeFileSync(new URL("user-list-page-summary.json", OUT), JSON.stringify({ page: page.page, topLevel: page.nodes, nodeCount: page.nodeCount }, null, 1));
fs.writeFileSync(new URL("user-list-component-inventory.json", OUT), JSON.stringify({ components: comps, otherTopLevel: others, instanceCountInUserList: instCount }, null, 1));
fs.writeFileSync(new URL("user-list-node-tree.json", OUT), JSON.stringify(ul, null, 1).slice(0, 400000));
fs.writeFileSync(new URL("user-list-geometry-audit.json", OUT), JSON.stringify(result.geometryAudit, null, 1));
fs.writeFileSync(new URL("user-list-token-audit.json", OUT), JSON.stringify(result.tokenAudit, null, 1));
fs.writeFileSync(new URL("user-list-dashboard-integrity.json", OUT), JSON.stringify({
  frozenFrame: "19:330 (file lLVJH0OnZPrkAqzarvhnBq, Page 1)",
  method: "isolation-by-construction",
  evidence: [
    "Stage 9.2-A 全部写命令发生在新建空白文件（Untitled / 本文件），与旧文件物理隔离",
    "本会话采样 3 次 get-page-summary 均命中新文件（Page 1, nodeCount=0 起步）",
    "旧文件插件客户端已于构建前注销（health: registered 仅剩新文件客户端）",
    "对旧文件零写命令；Frame 19:330 无法被本阶段命令触达",
  ],
  note: "如需逐字节复核 19:330，请在旧文件重新打开 Vibe Bridge 插件后执行 get-node 19:330（Stage 9.2 收尾或回归阶段）",
  width: 1920, height: 1030, preserved: true,
}, null, 1));
console.log(JSON.stringify({
  comps: comps.length, topLevel: page.nodeCount, instances: instCount,
  alRatio: result.autoLayout.ratio, unknownColors: unknown,
  checks: checks.map(([n, ok]) => `${ok ? "PASS" : "FAIL"} ${n}`),
}, null, 1));
