// Stage 10.5 L5 Export：导出 3 页 SVG + 构建 export-manifest.json
// 页内映射用实时 READBACK（build-ids 壳层键跨批被同名覆盖，不可信 —— 与 pg_nb 覆盖事故同类）
import fs from "fs";

const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
async function cmd(op, params = {}) {
  const r = await fetch(`http://127.0.0.1:45677/v1/command?token=${TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op, params }),
  });
  const j = await r.json();
  if (j.ok === false) throw new Error(`${op}: ${JSON.stringify(j.error).slice(0, 200)}`);
  return j.data ?? j;
}

const PAGES = [
  { key: "home", node: "5:110", name: "AI Health / Home (402x874)", frontendComponent: "HomeView", route: "/home" },
  { key: "detail", node: "5:183", name: "AI Health / Detail (402x874)", frontendComponent: "DetailView", route: "/stats" },
  { key: "profile", node: "5:239", name: "AI Health / Profile (402x874)", frontendComponent: "ProfileView", route: "/profile" },
];

// --- 1) 实时读回每页直接子节点（StatusBar/NavBar/content/TabBar 按高度识别） ---
const nodeMapping = {};
for (const p of PAGES) {
  const det = await cmd("get-node", { id: p.node, depth: 1, detail: true });
  const kids = det.children || [];
  const find = (h, type) => {
    const hit = kids.find(c => c.type === type && Math.round(c.height) === h);
    return hit ? hit.id : null;
  };
  nodeMapping[p.key] = {
    pageFrame: p.node,
    statusBar: find(54, "INSTANCE") || find(54, "FRAME"),
    navBar: find(44, "INSTANCE") || find(44, "FRAME"),
    content: kids.find(c => Math.round(c.height) === 686)?.id || null,
    tabBar: find(90, "INSTANCE") || find(90, "FRAME"),
    readbackAt: new Date().toISOString(),
  };
  console.log(`readback ${p.key}:`, JSON.stringify(nodeMapping[p.key]));
}

// --- 2) SVG 导出（依赖插件已重载 v3：format 参数 + svg 原文返回） ---
const svgResults = [];
for (const p of PAGES) {
  const res = await cmd("export-node", { id: p.node, scale: 2, format: "SVG" });
  if (res.format !== "SVG") throw new Error(`SVG export failed for ${p.node}: ${JSON.stringify(res).slice(0, 200)}`);
  if (res.v !== 4) throw new Error(`插件仍在运行旧代码（响应缺 v:4 标记）。请在 Figma 重载插件后重试。`);
  if (!res.svg) throw new Error(`SVG 文本为空: ${JSON.stringify(res).slice(0, 200)}`);
  const out = new URL(`../.vibe/stage10-5/screenshots/${p.key}.svg`, import.meta.url);
  fs.writeFileSync(out, res.svg, "utf8");
  const bytes = fs.statSync(out).size;
  svgResults.push({ node: p.node, name: p.name, file: `.vibe/stage10-5/screenshots/${p.key}.svg`, bytes, scale: 2 });
  console.log(`SVG OK (v4): ${p.key}.svg (${bytes} bytes)`);
}

// --- 3) 构建 export-manifest.json ---
const spec = JSON.parse(fs.readFileSync(new URL("../.vibe/stage10-5/design-system-spec.json", import.meta.url), "utf8"));
const png = JSON.parse(fs.readFileSync(new URL("../.vibe/stage10-5/export-png.json", import.meta.url), "utf8"));

// DS 组件真实 id（构建期 WRITE→READBACK 验证过的落盘值，build-ids DS_* 键未发生覆盖）
const DS_FIGMA_IDS = {
  "DS/Navigation/StatusBar": "5:94",
  "DS/Navigation/NavBar": "3:15",
  "DS/Navigation/TabBar": "5:108",
  "DS/Form/Button/Primary": "3:32",
  "DS/Form/Button/Secondary": "3:35",
  "DS/Form/Button/Disabled": "3:38",
  "DS/Form/Button/Loading": "3:42",
  "DS/Feedback/LoadingOverlay": "3:46",
  "DS/Form/Input/Default": "3:49",
  "DS/Form/Input/Focus": "3:52",
  "DS/Form/Input/Error": "3:55",
  "DS/Form/Input/Disabled": "3:58",
  "DS/DataDisplay/StatCard": "3:64",
};

// create-local 组件 → 页内本地 Frame 代表节点（构建期验证值）
const LOCAL_FIGMA_IDS = {
  HealthScoreCard: "5:136",
  TrendChart: "5:209",
  VitalChart: "3:63",
  AdviceCard: "6:301",
  ProfileCard: "5:265",
  HealthRecordList: "5:274",
  SettingsList: "5:287",
};
const LOCAL_NOTES = {
  VitalChart: "sparkline 子节点（DS/StatCard 组件内部 3:63），页面内经实例覆写出现（如 I5:223;3:63）",
};

const dsMapping = spec.components.map(c => {
  if (c.decision === "generate-core") {
    const base = c.figmaNaming; // 如 DS/Form/Button（4 个状态组件）
    const states = Object.entries(DS_FIGMA_IDS).filter(([k]) => k.startsWith(base + "/")).map(([k, v]) => ({ state: k.split("/").pop(), figmaComponentId: v }));
    const exact = DS_FIGMA_IDS[c.figmaNaming];
    return {
      name: c.name, figmaNaming: c.figmaNaming, decision: c.decision, priority: c.priority,
      frontendComponent: `Ds${c.name}`,
      figmaComponentId: exact || (states.length ? states[0].figmaComponentId : null),
      ...(states.length > 1 ? { stateComponents: states } : {}),
      source: c.basis ? String(c.basis).split("：")[0] : null,
    };
  }
  return {
    name: c.name, figmaNaming: c.figmaNaming, decision: c.decision, priority: c.priority,
    frontendComponent: c.name,
    figmaComponentId: LOCAL_FIGMA_IDS[c.name] || null,
    ...(LOCAL_NOTES[c.name] ? { note: LOCAL_NOTES[c.name] } : { note: "create-local：页内本地 Frame，非 DS 组件" }),
    source: c.basis ? String(c.basis).split("：")[0] : null,
  };
});

let tokenCount = 0;
(function walkTokens(o) {
  for (const v of Object.values(o || {})) {
    if (typeof v === "object" && v) {
      if (typeof v.value === "string") tokenCount++;
      else walkTokens(v);
    }
  }
})(spec.tokens);

const manifest = {
  _stage: "Stage 10.5 L5 Export",
  _fileKey: "RupGQGcwLGupuhMw4j3rqH",
  generatedAt: new Date().toISOString(),
  pages: PAGES.map(({ key, node, name, frontendComponent, route }) => ({ key, figmaNode: node, name, frontendComponent, route })),
  exports: {
    png: png.map(e => ({ node: e.node, name: e.name, file: e.png, bytes: e.bytes, scale: 2 })),
    svg: svgResults,
  },
  figmaNodeMapping: { ...nodeMapping, note: "实时 READBACK 自 Figma 画布（按高度 54/44/686/90 识别）；build-ids.json 壳层键跨批覆盖不可信" },
  dsMapping,
  tokens: { source: ".vibe/stage10-5/design-system-spec.json §tokens", brand: spec.tokens.color.brand.primary.value, count: tokenCount },
  frontendComponentMapping: {
    framework: "Vue3 + Tailwind（10.7 L5 交付物；本阶段仅登记映射，不落地代码）",
    rule: "generate-core ↔ Vue Ds<Component>；create-local ↔ 页面子组件",
    pages: [
      { route: "/home", view: "HomeView", children: ["HealthScoreCard", "VitalCard x3 (StatCard 实例)", "AdviceCard"] },
      { route: "/stats", view: "DetailView", children: ["TrendChart", "VitalCard x3 (StatCard 实例)", "AdviceCard(AI 分析)"] },
      { route: "/profile", view: "ProfileView", children: ["ProfileCard", "HealthRecordList", "SettingsList"] },
    ],
  },
};

fs.writeFileSync(new URL("../.vibe/stage10-5/export-manifest.json", import.meta.url), JSON.stringify(manifest, null, 2));
console.log("export-manifest.json written.");
console.log(JSON.stringify({ dsMapped: dsMapping.filter(m => m.figmaComponentId || m.stateComponents).length, dsTotal: dsMapping.length, svg: svgResults.length, tokens: tokenCount }, null, 2));
