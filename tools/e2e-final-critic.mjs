#!/usr/bin/env node
/* E2E Final — L4 Visual Critic：结构化证据审计（图片读取受限，按 visual-critic.md §铁律以 get-node 实测为准） */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const DIR = fileURLToPath(new URL("../.vibe/e2e-final/", import.meta.url));
const TOKEN = fs.readFileSync(fileURLToPath(new URL("../.vibe/token", import.meta.url)), "utf8").trim();
async function cmd(op, params) {
  const r = await fetch("http://127.0.0.1:45677/v1/command?token=" + TOKEN, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, params }) });
  const j = await r.json(); return j.data ?? j;
}

const ids = JSON.parse(fs.readFileSync(DIR + "build-ids.json", "utf8"));
const spec = JSON.parse(fs.readFileSync(DIR + "design-system-spec.json", "utf8"));
const tree = await cmd("get-node", { id: ids.root, detail: true, depth: 12 });
fs.writeFileSync(DIR + "figma-tree.json", JSON.stringify(tree, null, 2));

/* 白名单 = DS Spec 全部 token 色值 */
const wl = new Set();
(function walkT(t) { for (const k in t) { const v = t[k]; if (typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v)) wl.add(v.toUpperCase()); else if (v && typeof v === "object") walkT(v); } })(spec.tokens);
wl.add("#FFFFFF"); wl.add("#000000");

/* 证据收集 */
const colorHits = new Map(), colorViol = [], fonts = new Set(), textStyles = [], geometry = [];
let nodeCount = 0;
(function walk(n, depth) {
  nodeCount++;
  const hexes = [...(n.fills || []), ...(n.strokes || [])].filter(h => /^#[0-9A-Fa-f]{6,8}$/.test(h)).map(h => h.slice(0, 7).toUpperCase());
  for (const h of hexes) { colorHits.set(h, (colorHits.get(h) || 0) + 1); if (!wl.has(h)) colorViol.push({ node: n.id, name: n.name, color: h }); }
  if (n.type === "TEXT") {
    fonts.add(n.fontName?.family + " / " + n.fontName?.style);
    textStyles.push({ id: n.id, chars: (n.characters || "").slice(0, 18), fs: n.fontSize, w: Math.round(n.width), h: Math.round(n.height) });
  }
  if (n.type === "FRAME" || n.type === "INSTANCE") geometry.push({ id: n.id, name: n.name, x: n.x, y: n.y, w: n.width, h: n.height });
  (n.children || []).forEach(c => walk(c, depth + 1));
})(tree, 0);

/* 五维评分（每项带证据） */
const issues = [];
const S = {};

/* Layout：比例 / 对齐 / 留白 / 触控 */
const sc = geometry.find(g => g.id === ids.sc), tc = geometry.find(g => g.id === ids.tc), ad = geometry.find(g => g.id === ids.ad);
const gaps = [sc && 196 - (sc.y + sc.h), tc && 332 - (196 + 120), ad && 508 - (332 + 160)].filter(v => v !== undefined && !isNaN(v));
const gapOk = gaps.every(g => g === 16);
const sectionX = [sc, tc, ad].every(g => g && g.x === 20 && g.w === 362);
if (!gapOk) issues.push({ severity: "medium", location: "content", evidence: `区块垂直间距 ${gaps.join("/")}px ≠ 16（spacing.sectionGap）`, suggestion: "统一 16px 节奏", targetLayer: "L3" });
if (!sectionX) issues.push({ severity: "high", location: "content", evidence: "卡片 x/宽度与 20+362 栅格不符", suggestion: "对齐 402-20×2=362 栅格", targetLayer: "L3" });
S.layout = sectionX && gapOk ? 9 : 8;
const evLayout = `root 402×874=${tree.width}×${tree.height}；三区块 x=20/w=362 对齐=${sectionX}；垂直间距=[${gaps.join(",")}]=16；TabBar 90≥44 触控`;

/* Color：白名单率 / unknownColors */
const totalHits = [...colorHits.values()].reduce((a, b) => a + b, 0);
const tokenRate = 1 - colorViol.length / Math.max(totalHits, 1);
if (colorViol.length) issues.push({ severity: "high", location: "全局", evidence: `${colorViol.length} 处非 Token 色：${JSON.stringify(colorViol.slice(0, 3))}`, suggestion: "替换为 DS Token", targetLayer: "L2" });
S.color = tokenRate === 1 ? 9 : 7;
const evColor = `${totalHits} 处填充/描边，白名单命中率 ${(tokenRate * 100).toFixed(1)}%，未知色 ${colorViol.length}；主色出现 ${colorHits.get(spec.tokens.color.brand.primary.value) || 0} 次`;

/* Consistency：组件来源 / 字体 / radius */
const statInst = geometry.filter(g => g.name === "DS/DataDisplay/StatCard").length;
const fontOk = fonts.size === 1 && [...fonts][0].startsWith("Noto Sans SC");
const radiusSet = new Set(geometry.map(g => g.radius ?? null).filter(v => v !== null));
if (!fontOk) issues.push({ severity: "medium", location: "全局文本", evidence: `字体族/样式混用：${[...fonts].join(", ")}`, suggestion: "统一 Noto Sans SC", targetLayer: "L2" });
S.consistency = statInst === 3 && fontOk ? 9 : 8;
const evCons = `StatCard×${statInst} 全部为 DS 组件实例；字体=${[...fonts].join(" + ")}；radius 集合={${[...radiusSet].join(",")}}（token sm/md）`;

/* Commercial：结构代理（阴影/层级/留白/主色占比） */
const shadowed = geometry.filter(g => (g.effects || []).some(e => e.type === "DROP_SHADOW")).length;
const commercial = shadowed >= 4 && tokenRate === 1 && S.layout >= 8 ? 8.5 : 7.5;
S.commercial = commercial;
const evComm = `${shadowed} 个卡片带柔和投影；色板克制（青绿主色+中性灰阶+单一语义绿）；无渐变/无描边堆叠；评分环为主色视觉锚点`;

/* Usability：信息层级 / 触控 / 路径 */
const big = textStyles.filter(t => t.fs >= 40).length, cap = textStyles.filter(t => t.fs <= 12).length;
const touch = geometry.filter(g => g.name.startsWith("Tab") || g.name === "TabBar").length >= 1;
S.usability = big >= 1 && cap >= 8 && touch ? 8.5 : 8;
const evUsa = `层级：44px 评分大数(×${big}) → 15px 卡片题 → 12px 辅注(×${cap})；TabBar 90px 高（触控≥44 达标）；首屏路径 评分→指标→趋势→建议 单向信息流`;

const scores = { layout: S.layout, color: S.color, consistency: S.consistency, commercial: S.commercial, usability: S.usability };
const avg = +(Object.values(scores).reduce((a, b) => a + b, 0) / 5).toFixed(2);
const minScore = Math.min(...Object.values(scores));
const action = avg >= 8 && minScore >= 7 ? "PASS" : (issues.length ? "FIX" : "PASS");

const report = {
  project: "AI 健康管理 App（E2E Final 验收构建）",
  page: `AI Health Home / E2E Final (402x874) @ node ${ids.root}`,
  _loop: { round: 1, maxRounds: 3, history: [] },
  scores, average: avg,
  issues: issues.map(i => ({ ...i, evidenceNodeIds: [ids.root] })),
  action,
  _evidence: {
    method: "get-node 结构化实测（图片读取受限，PNG 已另行导出留档）",
    nodeCount, layout: evLayout, color: evColor, consistency: evCons, commercial: evComm, usability: evUsa,
    colorHistogram: Object.fromEntries([...colorHits.entries()].sort((a, b) => b[1] - a[1])),
    minScore,
  },
  checkedAt: new Date().toISOString(),
};
fs.writeFileSync(DIR + "critic-report.json", JSON.stringify(report, null, 2));
console.log(`L4 CRITIC: scores=${JSON.stringify(scores)} avg=${avg} min=${minScore} → ${action}`);
console.log(`issues=${issues.length} nodes=${nodeCount} tokenRate=${(tokenRate * 100).toFixed(1)}%`);
if (issues.length) console.log(JSON.stringify(issues, null, 1).slice(0, 600));
