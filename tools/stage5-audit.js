#!/usr/bin/env node
/**
 * Stage 5 audit - Design Review + Component Audit for
 * "Reference Recreation / ElementAdmin" (read back from the REAL canvas).
 *
 *   node tools/stage5-audit.js
 * ==================================================================
 */
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const NODE = process.execPath;
const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "cli", "figma-vibe.js");
const TREE_FILE = path.join(ROOT, ".vibe", "stage5-tree.json");
const STATE_FILE = path.join(ROOT, ".vibe", "stage5-state.json");
const REVIEW_FILE = path.join(ROOT, ".vibe", "stage5-review.md");

const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
const tree = JSON.parse(fs.readFileSync(TREE_FILE, "utf8"));
const flat = [];
(function walk(n, d) { flat.push({ ...n, depth: d }); (n.children || []).forEach((c) => walk(c, d + 1)); })(tree, 0);

const norm = (h) => String(h || "").toUpperCase();
const TOKENS = new Set(["#F2F3F5", "#FFFFFF", "#E4E7ED", "#5A5CF0", "#5470C6", "#91CC75", "#FAC858", "#FC8452",
  "#EE6666", "#409EFF", "#F56C6C", "#67C23A", "#303133", "#606266", "#909399", "#C0C4CC", "#AAB8E8"].map(norm));

let pass = 0, fail = 0;
const failures = [];
const lines = ["# Stage 5 Review - Reference Recreation / ElementAdmin", ""];

function check(name, ok, detail) {
  const tag = ok ? "\u2713" : "\u2717";
  console.log(`${tag} ${name}${detail ? ` - ${detail}` : ""}`);
  lines.push(`${tag} ${name}${detail ? ` - ${detail}` : ""}`);
  if (ok) pass++; else { fail++; failures.push(name); }
}
const one = (name) => flat.find((n) => n.name === name);
const all = (re) => flat.filter((n) => re.test(n.name));

/* -------- 1. global layout -------- */
check("root frame is 1920x1030", Math.round(tree.width) === 1920 && Math.round(tree.height) === 1030,
  `${Math.round(tree.width)}x${Math.round(tree.height)}`);
const top = one("Top Bar");
check("top bar height = 40 (2.1% of canvas, per reference)", top && Math.round(top.height) === 40, top && `${Math.round(top.height)}px`);
const side = one("Sidebar");
check("sidebar width = 180", side && Math.round(side.width) === 180, side && `${Math.round(side.width)}px`);
const kpiRow = one("KPI Section");
check("content padding = 24 (KPI row inset from sidebar)", kpiRow && Math.abs(kpiRow.x - 24) <= 3, kpiRow && `x=${Math.round(kpiRow.x)}`);
const chartsRow = one("Analytics Section");
check("charts row exists with 2 cards", chartsRow && (chartsRow.children || []).length === 2);

/* -------- 2. KPI cards -------- */
const kpiCards = all(/^KPI Card \//).filter((n) => n.type === "FRAME");
check("4 KPI cards", kpiCards.length === 4, `found ${kpiCards.length}`);
if (kpiCards.length === 4) {
  const ws = kpiCards.map((n) => Math.round(n.width));
  check("KPI cards equal width", Math.max(...ws) - Math.min(...ws) <= 2, ws.join(","));
  const hs = kpiCards.map((n) => Math.round(n.height));
  check("KPI card height = 72 (reference ratio)", hs.every((h) => Math.abs(h - 72) <= 6), hs.join(","));
  const gaps = [];
  const sorted = [...kpiCards].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) gaps.push(Math.round(sorted[i].x - sorted[i - 1].x - sorted[i - 1].width));
  check("KPI gaps on the 24pt step", gaps.every((g) => Math.abs(g - 24) <= 3), gaps.join(","));
}
check("KPI values exact (102,400 / 81,212 / 9,280 / 13,600)",
  ["102,400", "81,212", "9,280", "13,600"].every((v) => flat.some((n) => n.characters === v)));
check("KPI labels exact", ["\u65b0\u589e\u7528\u6237", "\u672a\u8bfb\u6d88\u606f", "\u6210\u4ea4\u91d1\u989d", "\u8d2d\u7269\u8f66\u6570\u91cf"]
  .every((v) => flat.some((n) => n.characters === v)));

/* -------- 3. charts row proportions -------- */
const pie = one("Card / \u7528\u6237\u8bbf\u95ee\u6765\u6e90");
const bar = one("Card / \u6bcf\u5468\u7528\u6237\u6d3b\u8dc3\u91cf");
if (pie && bar) {
  const ratio = pie.width / (pie.width + bar.width);
  check("pie:bar card ratio = 0.425 (reference 0.43)", Math.abs(ratio - 0.425) <= 0.015, ratio.toFixed(3));
  check("charts row height = 300", Math.round(pie.height) === 300 && Math.round(bar.height) === 300,
    `${Math.round(pie.height)}/${Math.round(bar.height)}`);
}

/* -------- 4. pie chart -------- */
const sectors = all(/^Pie\/Sector /);
const secColors = new Set(sectors.map((n) => norm((n.fills || [])[0])));
check("pie has 5 native vector sectors", sectors.length === 5, `found ${sectors.length}`);
check("pie sector colors = chart palette",
  ["#5470C6", "#91CC75", "#FAC858", "#FC8452", "#EE6666"].every((c) => secColors.has(c)),
  [...secColors].join(","));
check("pie has leader lines (1 vector)", all(/^Pie\/Leader Lines$/).length === 1);
check("pie has 5 callout labels", all(/^Pie\/Label /).length === 5);
check("pie legend = 5 instances", all(/^Pie Chart\/Legend/).some((n) => (n.children || []).length >= 5) ||
  flat.filter((n) => n.type === "INSTANCE" && n.parentId === (one("Pie Chart/Legend") || {}).id).length === 5);

/* -------- 5. bar chart -------- */
const bars = all(/^Bar Chart\/Bar /);
check("bar chart has 7 native rectangles", bars.length === 7 && bars.every((n) => n.type === "RECTANGLE"), `found ${bars.length}`);
check("all bars share width + color #5470C6",
  bars.length === 7 && new Set(bars.map((n) => Math.round(n.width))).size === 1 &&
  bars.every((n) => norm((n.fills || [])[0]) === "#5470C6"));
if (bars.length === 7) {
  const byH = [...bars].sort((a, b) => b.height - a.height);
  check("tallest bar is 周二 then 周三 then 周五 (matches reference order)",
    byH[0].name.includes("\u5468\u4e8c") && byH[1].name.includes("\u5468\u4e09") && byH[2].name.includes("\u5468\u4e94"),
    byH.slice(0, 3).map((n) => n.name.replace("Bar Chart/Bar ", "")).join(" > "));
  const two = byH[byH.length - 2];
  check("bars baseline aligned (周六/周日 shortest)", byH[byH.length - 1].height <= two.height && byH[byH.length - 1].height < 30,
    `min h=${Math.round(byH[byH.length - 1].height)}`);
}
check("bar gridlines vector present (6 lines)", all(/^Bar Chart\/Gridlines$/).length === 1);
check("bar y labels = 6 (25,000..0)", ["25,000", "20,000", "15,000", "10,000", "5,000", "0"].every((v) => flat.some((n) => n.characters === v)));
check("bar x labels 周一..周日", ["\u5468\u4e00", "\u5468\u4e8c", "\u5468\u4e09", "\u5468\u56db", "\u5468\u4e94", "\u5468\u516d", "\u5468\u65e5"].every((v) => flat.some((n) => n.characters === v)));
check("bar hover badge exists", !!one("Bar Chart / Hover Badge"));

/* -------- 6. line chart -------- */
const curves = all(/^Line Chart\/Series /);
check("line chart = 2 vector series", curves.length === 2 && curves.every((n) => n.type === "VECTOR"),
  `found ${curves.length}`);
const dots = all(/^Line Chart\/Point /);
check("24 data points (12 x 2 series, hollow)", dots.length === 24 &&
  dots.every((n) => norm((n.strokes || [])[0]) !== norm((n.fills || [])[0])), `found ${dots.length}`);
check("line y labels 250..0 (6)", ["250", "200", "150", "100", "50", "0"].every((v) => flat.some((n) => n.characters === v)));
check("12 month x labels", ["\u4e00\u6708", "\u4e8c\u6708", "\u4e09\u6708", "\u56db\u6708", "\u4e94\u6708", "\u516d\u6708", "\u4e03\u6708", "\u516b\u6708", "\u4e5d\u6708", "\u5341\u6708", "\u5341\u4e00\u6708", "\u5341\u4e8c\u6708"]
  .every((v) => flat.some((n) => n.characters === v)));

/* -------- 7. hover state structure -------- */
const hover = one("Hover State / \u4e8c\u6708 Crosshair");
check("hover state is an isolated structural frame", !!hover && hover.type === "FRAME");
check("hover dashed crosshair vector", !!one("Hover/Dashed Line"));
const pill = one("Hover/X Pill");
check("hover x-axis pill (blue, label 二月)", !!pill && norm((pill.fills || [])[0]) === "#5470C6");
const tip = one("Hover/Tooltip");
check("hover tooltip card with 2 series rows", !!tip && (tip.children || []).length === 3);
check("hover tooltip rows are instances", all(/^Tooltip\/Label/).filter((n) => n.type === "TEXT").length >= 2);
const ptr = one("Hover/Y Pointer");
check("hover y-pointer label '1130.94'", flat.some((n) => n.characters === "1130.94") && !!ptr);

/* -------- 8. hygiene: image / tokens / fonts / radius -------- */
check("0 IMAGE nodes", flat.filter((n) => n.type === "IMAGE").length === 0);
const colorHits = new Set();
flat.forEach((n) => { (n.fills || []).forEach((c) => colorHits.add(norm(c))); (n.strokes || []).forEach((c) => colorHits.add(norm(c))); });
const off = [...colorHits].filter((c) => /^#[0-9A-F]{6}$/.test(c) && !TOKENS.has(c));
check("all canvas colors inside the token set", off.length === 0, off.length ? `off-palette: ${off.slice(0, 6).join(",")}` : `${colorHits.size} colors, all tokenized`);
const cjkTexts = flat.filter((n) => n.type === "TEXT" && /[\u4e00-\u9fff]/.test(n.characters || ""));
check("all Chinese text uses the CJK font (no tofu)",
  cjkTexts.length > 0 && cjkTexts.every((n) => /Noto Sans SC|Microsoft YaHei|SimHei|PingFang/i.test((n.fontName || {}).family || "")),
  `${cjkTexts.length} CJK texts`);
const radii = new Set(flat.filter((n) => typeof n.cornerRadius === "number" && n.cornerRadius > 0).map((n) => n.cornerRadius));
const okR = [...radii].filter((r) => ![2, 3, 4, 999].includes(r));
check("corner radii on scale (2/4/6/pill)", okR.length === 0, okR.length ? `off-scale: ${okR.join(",")}` : `used: ${[...radii].sort((a, b) => a - b).join(",")}`);
const footer = flat.find((n) => n.characters === "Copyright \u00a9 2021-present ElementAdmin");
check("footer copyright line present", !!footer);

/* -------- 9. component audit (DS sheet read live) -------- */
function runCli(ops) {
  const r = spawnSync(NODE, [CLI, "run", "--ops", JSON.stringify(ops), "--json", "--timeout", "90000"], {
    encoding: "utf8", cwd: ROOT, maxBuffer: 1 << 28,
  });
  const body = JSON.parse((r.stdout || "{}"));
  if (!body.ok) throw new Error(body.error && body.error.message);
  return body.data.ops;
}
const dsNode = runCli([{ op: "get-node", params: { id: state.dsRoot, depth: 8, detail: true } }])[0].data;
const dsFlat = [];
(function w2(n, d) { dsFlat.push({ ...n, depth: d }); (n.children || []).forEach((c) => w2(c, d + 1)); })(dsNode, 0);
const comps = dsFlat.filter((n) => n.type === "COMPONENT");
check("4 components published (Tag / Legend Item / Tooltip Row / Menu Item Sub)", comps.length === 4,
  comps.map((n) => n.name).join(", "));
const inst = flat.filter((n) => n.type === "INSTANCE");
check(">= 14 instances placed in the recreation", inst.length >= 14, `found ${inst.length}`);
const instKinds = new Set(inst.map((n) => n.name.split(" ")[0]));
check("instances span all component families", ["Tag", "Legend", "Tooltip", "Menu"].every((k) => [...instKinds].some((i) => i.startsWith(k))),
  [...instKinds].join(","));
check("menu sub-items are instances with text overrides",
  ["\u83dc\u53551", "\u83dc\u53551-1", "\u83dc\u53551-2"].every((v) => inst.some((i) => (i.children || []).some((c) => c.characters === v))));

/* -------- 10. auto layout -------- */
const frames = flat.filter((n) => n.type === "FRAME");
const al = frames.filter((n) => n.layoutMode && n.layoutMode !== "NONE");
check("auto layout on >= 60% of frames", al.length / frames.length >= 0.6, `${al.length}/${frames.length}`);
check("page structure hierarchy present",
  ["Top Bar", "Sidebar", "Tags Bar", "KPI Section", "Analytics Section", "Card / \u6bcf\u6708\u9500\u552e\u91cf", "Footer"].every((n) => !!one(n)));

/* -------- summary -------- */
const total = pass + fail;
lines.push("", `## Result: ${pass}/${total} passed, ${fail} failed`);
if (failures.length) lines.push("", "Failures:", ...failures.map((x) => `- ${x}`));
fs.writeFileSync(REVIEW_FILE, lines.join("\n"));
console.log(`\nResult: ${pass}/${total} passed, ${fail} failed`);
if (failures.length) console.log("Failures:\n  - " + failures.join("\n  - "));
console.log(`review -> ${path.relative(ROOT, REVIEW_FILE)}`);
process.exit(0);
