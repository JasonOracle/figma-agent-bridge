#!/usr/bin/env node
/**
 * Stage 5 builder - "Reference Recreation / ElementAdmin"
 * ==================================================================
 * High-fidelity rebuild of a REFERENCE SCREENSHOT (no written spec):
 * every dimension / color / ratio below was derived by measuring the
 * reference image (1080x577 -> x1.778 => 1920x1026 canvas).
 *
 *   node tools/stage5-build.js                    run every stage not done
 *   node tools/stage5-build.js --stage <name>     run one stage
 *   node tools/stage5-build.js --stage all --force
 *   node tools/stage5-build.js --teardown
 * ==================================================================
 */

"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const NODE = process.execPath;
const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "cli", "figma-vibe.js");
const STATE_FILE = path.join(ROOT, ".vibe", "stage5-state.json");
const FONT_FILE = path.join(ROOT, ".vibe", "stage3-font.json");
const TREE_FILE = path.join(ROOT, ".vibe", "stage5-tree.json");
const BATCH_FILE = path.join(ROOT, ".vibe", "stage5-batch.json");

const argv = process.argv.slice(2);
const hasFlag = (n) => argv.includes("--" + n);
const flagVal = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const RUN_STAGE = flagVal("stage", null);
const FORCE = hasFlag("force");

let S = {};
try { S = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch (_) { S = {}; }
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(S, null, 2));

const FONT = (() => { try { return JSON.parse(fs.readFileSync(FONT_FILE, "utf8")); } catch (_) { return {}; } })();
const CJK = FONT.cjk || FONT.latin || "Inter";
const LATIN = FONT.latin || "Inter";
const STYLES = FONT.cjkStyles && FONT.cjkStyles.length ? FONT.cjkStyles : ["Regular"];

const isCJK = (s) => /[\u3400-\u9fff\uf900-\ufaff]/.test(String(s));
function pickStyle(weight) {
  const want = { 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Bold", 900: "Bold" }[weight] || "Regular";
  const alts = {
    400: ["Regular", "Medium", "Bold"],
    500: ["Medium", "Semi Bold", "Regular", "Bold"],
    600: ["Semi Bold", "SemiBold", "Bold", "Medium"],
    700: ["Bold", "Semi Bold"],
  }[weight] || [];
  if (STYLES.includes(want)) return want;
  for (const a of alts) if (STYLES.includes(a)) return a;
  return STYLES[0] || "Regular";
}

/* ================================================================== */
/* design tokens - derived from the reference screenshot (Element UI)  */
/* ================================================================== */

const C = {
  bg: "#F2F3F5", surface: "#FFFFFF", border: "#E4E7ED",
  menu: "#5A5CF0",                                   // active sidebar row / logo / tags
  chartBlue: "#5470C6", chartGreen: "#91CC75", chartYellow: "#FAC858",
  chartOrange: "#FC8452", chartRed: "#EE6666",
  kpiBlue: "#409EFF", kpiRed: "#F56C6C", kpiGreen: "#67C23A",
  t1: "#303133", t2: "#606266", t3: "#909399", t4: "#C0C4CC", white: "#FFFFFF",
};
const RAD = { xs: 2, sm: 4, md: 6, pill: 999 };
const SHADOW_CARD = { x: 0, y: 1, blur: 4, spread: 0, color: "#000000", opacity: 0.06 };
const SHADOW_TIP = { x: 0, y: 2, blur: 12, spread: 0, color: "#000000", opacity: 0.18 };

const L = {
  dsX: 11500, appX: 12500, dsW: 940,
  rootW: 1920, rootH: 1030,
  topH: 40, sideW: 180, tagsH: 36, pad: 24, gap: 24,
  kpiH: 72, chartsH: 300, lineH: 352,
};
L.mainW = L.rootW - L.sideW;                    // 1740
L.contentW = L.mainW - L.pad * 2;               // 1692
L.kpiW = Math.round((L.contentW - L.gap * 3) / 4);          // 405
L.pieW = 717; L.barW = L.contentW - L.pieW - L.gap;         // 951
const f = (n) => Math.round(n * 100) / 100;

/* chart data - measured off the reference image */
const PIE = [
  ["直接访问", 40, C.chartBlue],
  ["邮件营销", 22, C.chartGreen],
  ["联盟广告", 16, C.chartYellow],
  ["视频广告", 12, C.chartOrange],
  ["搜索引擎", 10, C.chartRed],
];
const BAR = { labels: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"], values: [13500, 30500, 23000, 12800, 21500, 2400, 2100], vmax: 30500, axisMax: 25000 };
const LINE = {
  months: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
  s1: { name: "一月", color: C.chartBlue, values: [115, 120, 138, 145, 150, 155, 150, 128, 175, 200, 152, 148] },
  s2: { name: "三月", color: C.chartGreen, values: [105, 82, 130, 148, 150, 152, 150, 242, 200, 95, 112, 150] },
  vmax: 250,
};

/* ================================================================== */
/* batch recorder (same proven core as stages 3/4)                     */
/* ================================================================== */

let OPS = [];
let MARKS = [];
let LOCAL = new Set();
let BATCH_NO = 0;

function op(name, params, key) {
  const step = { op: name, params };
  const isCreate = /^(create|duplicate)-/.test(name);
  if (key) {
    if (isCreate) step.as = key;
    LOCAL.add(key);
  }
  OPS.push(step);
  if (key && isCreate) MARKS.push({ index: OPS.length - 1, key });
}

function makeParams(o) {
  const p = {};
  for (const k of Object.keys(o)) if (o[k] !== undefined) p[k] = o[k];
  return p;
}

function P(key) { return LOCAL.has(key) ? "$" + key : id(key); }
function id(key) {
  const v = S[key];
  if (!v) throw new Error(`unknown node key "${key}" (build the earlier stage first)`);
  return v;
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Transport-level failures only. A TIMEOUT is deliberately NOT retryable:
// the batch may have run to completion (Stage 3 duplicated a DS sheet this way).
const TRANSIENT = /Unable to establish connection|ECONNRESET|socket hang up|connection refused|EAI_AGAIN/i;

function runCli(targetArgs, timeoutMs, label) {
  const maxAttempts = 3;
  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = spawnSync(NODE, [CLI, ...targetArgs, "--json", "--timeout", String(timeoutMs)], {
      encoding: "utf8", cwd: ROOT, maxBuffer: 256 * 1024 * 1024,
    });
    const out = (r.stdout || "").trim();
    let body = null;
    try { body = JSON.parse(out); } catch (_) { body = null; }
    if (body && body.ok === true) return { ok: true, body };

    const e = (body && body.error) || { code: "NO_JSON", message: (out || r.stderr || "").slice(0, 700) };
    const partial = (body && body.error && body.error.partial) || [];
    const msg = `${e.code}: ${e.message}`;
    last = { e, partial, msg };

    const nothingHappened = partial.length === 0;
    const looksTransient = e.code === "NO_JSON" || TRANSIENT.test(msg);
    if (attempt < maxAttempts && nothingHappened && looksTransient) {
      const wait = 1200 * attempt;
      console.log(`  ! ${label}: ${msg.slice(0, 80)} -> retry ${attempt + 1}/${maxAttempts} in ${wait}ms`);
      sleepMs(wait);
      continue;
    }
    if (!nothingHappened) {
      const did = partial.map((s) => `${s.step}:${s.op}`).join(" ");
      console.log(`  ! ${label}: NOT retrying - ${partial.length} step(s) already ran (${did})`);
    }
    break;
  }
  return { ok: false, e: last.e, partial: last.partial, msg: last.msg };
}

function flush(label, timeoutMs = 420000) {
  if (!OPS.length) return [];
  BATCH_NO++;
  fs.writeFileSync(BATCH_FILE, JSON.stringify(OPS, null, 0));
  const t0 = Date.now();
  const res = runCli(["run", BATCH_FILE], timeoutMs, `batch "${label}"`);
  if (!res.ok) {
    const e = res.e;
    const did = res.partial.map((s) => `${s.step}:${s.op}`).join(" ");
    throw new Error(`batch "${label}" failed -> ${e.code}: ${e.message}${did ? `\n  ok before that: ${did}` : ""}`);
  }
  const results = (res.body.data && res.body.data.ops) || [];
  for (const m of MARKS) {
    const step = results[m.index];
    if (!step || !step.data || !step.data.created) {
      throw new Error(`batch "${label}": step ${m.index} (${step && step.op}) created nothing for key "${m.key}"`);
    }
    S[m.key] = step.data.created.id;
  }
  saveState();
  console.log(`  [${String(BATCH_NO).padStart(2, "0")}] ${label}: ${OPS.length} ops -> ${results.length} results, ${Date.now() - t0}ms`);
  const n = OPS.length;
  OPS = []; MARKS = []; LOCAL = new Set();
  return results.length ? results : new Array(n);
}

function call(ops, timeoutMs = 240000) {
  const payload = ops.length ? ops : [{ op: "get-page-summary", params: {} }];
  const res = runCli(["run", "--ops", JSON.stringify(payload)], timeoutMs, "call");
  if (!res.ok) throw new Error(res.msg);
  return (res.body.data && res.body.data.ops) || [];
}
const readNode = (nodeId, depth = 0, detail = false) =>
  call([{ op: "get-node", params: { id: nodeId, depth, detail } }])[0].data;

/* ================================================================== */
/* deferred overrides on nested instance children                      */
/* ================================================================== */

let OVR = [];

function ovr(rootKey, path, opName, params) {
  OVR.push({ rootKey, path: String(path || ""), op: opName, params: params || {} });
}

function resolvePath(info, path) {
  let cur = info;
  for (const seg of path ? path.split(">") : []) {
    const kid = (cur.children || []).find((c) => c.name === seg);
    if (!kid) return null;
    cur = kid;
  }
  return cur;
}

function applyOverrides(label, timeoutMs = 240000) {
  if (!OVR.length) return 0;
  const queued = OVR.length;
  const trees = new Map();
  const batch = [];
  const misses = [];
  for (const o of OVR) {
    if (!trees.has(o.rootKey)) trees.set(o.rootKey, readNode(id(o.rootKey), 8, true));
    const target = resolvePath(trees.get(o.rootKey), o.path);
    if (!target) { misses.push(`${o.rootKey}>${o.path}`); continue; }
    batch.push({ op: o.op, params: Object.assign({ id: target.id }, o.params) });
  }
  OVR = [];
  if (misses.length) {
    throw new Error(`overrides for "${label}": ${misses.length}/${queued} path(s) not found -> ${misses.slice(0, 6).join(", ")}`);
  }
  call(batch, timeoutMs);
  console.log(`  [${String(BATCH_NO).padStart(2, "0")}] overrides / ${label}: ${batch.length} nested-instance edits applied`);
  return batch.length;
}

/* ================================================================== */
/* element helpers                                                     */
/* ================================================================== */

function frame(key, name, o) {
  let sizingH = o.sizingH;
  let sizingV = o.sizingV;
  if (o.layout) {
    if (o.w === undefined) sizingH = sizingH || "HUG";
    if (o.h === undefined) sizingV = sizingV || "HUG";
  }
  op("create-frame", makeParams({
    name, width: o.w, height: o.h, x: o.x, y: o.y,
    parentId: o.parent ? P(o.parent) : undefined,
    fill: o.fill === null ? undefined : { hex: o.fill === undefined ? C.surface : o.fill },
    clips: o.clips,
  }), key);
  if (o.fill === null) op("set-fill", { id: P(key), clear: true });
  if (o.radius !== undefined) op("set-corner-radius", { id: P(key), radius: o.radius });
  if (o.stroke) op("set-stroke", { id: P(key), color: { hex: o.stroke }, width: o.strokeW || 1 });
  if (o.shadow) op("set-effects", { id: P(key), shadow: o.shadow });
  if (o.opacity !== undefined) op("set-opacity", { id: P(key), opacity: o.opacity });
  if (o.layout) {
    op("set-auto-layout", makeParams({ id: P(key), mode: o.layout, spacing: o.spacing, padding: o.pad }));
    if (o.padT !== undefined || o.padB !== undefined || o.padL !== undefined || o.padR !== undefined) {
      op("set-padding", makeParams({ id: P(key), top: o.padT, bottom: o.padB, left: o.padL, right: o.padR }));
    }
    if (o.primaryAlign) op("set-primary-axis-align", { id: P(key), align: o.primaryAlign });
    if (o.counterAlign) op("set-counter-axis-align", { id: P(key), align: o.counterAlign });
    if (sizingH || sizingV) op("set-layout-sizing", makeParams({ id: P(key), horizontal: sizingH, vertical: sizingV }));
  }
  return key;
}

function rect(key, name, o) {
  op("create-rect", makeParams({
    name, width: o.w, height: o.h, x: o.x, y: o.y,
    parentId: o.parent ? P(o.parent) : undefined,
    fill: o.fill === null ? undefined : { hex: o.fill },
    cornerRadius: o.radius,
  }), key);
  if (o.fill === null) op("set-fill", { id: P(key), clear: true });
  if (o.stroke) op("set-stroke", { id: P(key), color: { hex: o.stroke }, width: o.strokeW || 1 });
  if (o.opacity !== undefined) op("set-opacity", { id: P(key), opacity: o.opacity });
  if (o.sizingH || o.sizingV) op("set-layout-sizing", makeParams({ id: P(key), horizontal: o.sizingH, vertical: o.sizingV }));
  return key;
}

function ellipse(key, name, o) {
  op("create-ellipse", makeParams({
    name, width: o.w, height: o.h, x: o.x, y: o.y,
    parentId: o.parent ? P(o.parent) : undefined,
    fill: o.fill ? { hex: o.fill } : undefined,
  }), key);
  if (!o.fill) op("set-fill", { id: P(key), clear: true });
  if (o.stroke) op("set-stroke", { id: P(key), color: { hex: o.stroke }, width: o.strokeW || 1 });
  if (o.opacity !== undefined) op("set-opacity", { id: P(key), opacity: o.opacity });
  return key;
}

function vector(key, name, o) {
  op("create-vector", makeParams({
    name, points: o.points, data: o.data, closed: o.closed,
    x: o.x, y: o.y, width: o.w, height: o.h,
    parentId: o.parent ? P(o.parent) : undefined,
    stroke: o.stroke ? { hex: o.stroke } : undefined,
    strokeWeight: o.strokeW,
    strokeCap: o.cap, strokeJoin: o.join,
    fill: o.fill ? { hex: o.fill, opacity: o.fillOpacity } : undefined,
  }), key);
  if (o.fill && !o.stroke) op("set-stroke", { id: P(key), clear: true });
  return key;
}

function text(key, content, o) {
  const cjk = isCJK(content);
  op("create-text", makeParams({
    characters: content,
    fontSize: o.size,
    fontFamily: o.family || (cjk ? CJK : LATIN),
    fontStyle: cjk ? pickStyle(o.weight || 400) : "Regular",
    parentId: o.parent ? P(o.parent) : undefined,
    name: o.name || String(content),
    x: o.x, y: o.y,
  }), key);
  if (!cjk && (o.weight || 400) !== 400) op("set-font-weight", { id: P(key), weight: o.weight });
  op("set-text-color", { id: P(key), color: { hex: o.color || C.t1 } });
  if (o.align || o.valign) op("set-text-align", makeParams({ id: P(key), horizontal: o.align, vertical: o.valign }));
  op("set-text-autoresize", makeParams({
    id: P(key), mode: o.autoResize || (o.width !== undefined ? "none" : "width_and_height"), width: o.width, height: o.height,
  }));
  if (o.sizingH || o.sizingV) op("set-layout-sizing", makeParams({ id: P(key), horizontal: o.sizingH, vertical: o.sizingV }));
  return key;
}

const componentise = (key, name) => { op("create-component", { id: P(key), name }, key); return key; };
const instance = (key, compKey, parent) => {
  op("create-instance", makeParams({ componentId: P(compKey), parentId: parent ? P(parent) : undefined }), key);
  return key;
};

/* ================================================================== */
/* icons - 14px stroke/fill vectors, coordinates in parent space       */
/* ================================================================== */

const ICON = {
  house: { data: "M 2 6.2 L 7 2.2 L 12 6.2 M 3.4 5.4 L 3.4 12 L 10.6 12 L 10.6 5.4" },
  grid: { data: "M 2 2 L 6 2 L 6 6 L 2 6 Z M 8 2 L 12 2 L 12 6 L 8 6 Z M 2 8 L 6 8 L 6 12 L 2 12 Z M 8 8 L 12 8 L 12 12 L 8 12 Z", fill: true },
  doc: { data: "M 3.5 1.8 L 9 1.8 L 11 3.8 L 11 12.2 L 3.5 12.2 Z M 5.2 5.4 L 9.4 5.4 M 5.2 7.6 L 9.4 7.6 M 5.2 9.8 L 7.8 9.8" },
  burger: { data: "M 1.5 3.2 L 12.5 3.2 M 1.5 7 L 12.5 7 M 1.5 10.8 L 12.5 10.8" },
  fullscreen: { data: "M 2 5 L 2 2 L 5 2 M 9 2 L 12 2 L 12 5 M 12 9 L 12 12 L 9 12 M 5 12 L 2 12 L 2 9" },
  gear: { data: "M 7 4.4 C 8.4 4.4 9.6 5.6 9.6 7 C 9.6 8.4 8.4 9.6 7 9.6 C 5.6 9.6 4.4 8.4 4.4 7 C 4.4 5.6 5.6 4.4 7 4.4 Z M 7 1.6 L 7 3 M 7 11 L 7 12.4 M 1.6 7 L 3 7 M 11 7 L 12.4 7" },
  people: {
    data: "M 5.2 2.1 C 6.6 2.1 7.7 3.2 7.7 4.6 C 7.7 6 6.6 7.1 5.2 7.1 C 3.8 7.1 2.7 6 2.7 4.6 C 2.7 3.2 3.8 2.1 5.2 2.1 Z M 10.9 3 C 12 3 12.9 3.9 12.9 5 C 12.9 6.1 12 7 10.9 7 C 9.8 7 8.9 6.1 8.9 5 C 8.9 3.9 9.8 3 10.9 3 Z M 5.2 8.1 C 7.7 8.1 9.6 9.3 9.6 10.9 L 9.6 12.6 L 0.8 12.6 L 0.8 10.9 C 0.8 9.3 2.7 8.1 5.2 8.1 Z M 10.9 8.3 C 12.8 8.4 14 9.4 14 10.7 L 14 12.6 L 10.8 12.6 L 10.8 10.9 C 10.8 9.9 11 9 10.9 8.3 Z",
    fill: true,
  },
  chat: { data: "M 1.5 2.5 L 14.5 2.5 L 14.5 11 L 7.2 11 L 4 13.6 L 4 11 L 1.5 11 Z", fill: true },
  cart: {
    data: "M 1 1.8 L 3.1 1.8 L 4.7 9.4 L 12.7 9.4 L 14.2 3.8 L 4.3 3.8 Z M 5 11.2 C 5.9 11.2 6.6 11.9 6.6 12.8 C 6.6 13.7 5.9 14.4 5 14.4 C 4.1 14.4 3.4 13.7 3.4 12.8 C 3.4 11.9 4.1 11.2 5 11.2 Z M 11 11.2 C 11.9 11.2 12.6 11.9 12.6 12.8 C 12.6 13.7 11.9 14.4 11 14.4 C 10.1 14.4 9.4 13.7 9.4 12.8 C 9.4 11.9 10.1 11.2 11 11.2 Z",
    fill: true,
  },
};

function icon(key, name, kind, o) {
  const spec = ICON[kind];
  if (spec.fill) {
    vector(key, name, { data: spec.data, closed: true, x: o.x, y: o.y, w: o.w || 14, h: o.w || 14, fill: o.color, parent: o.parent });
  } else {
    vector(key, name, { data: spec.data, x: o.x, y: o.y, w: o.w || 14, h: o.w || 14, stroke: o.color, strokeW: o.strokeW || 1.4, cap: "ROUND", join: "ROUND", parent: o.parent });
  }
  if (kind === "chat") { // white message dots on the bubble
    ellipse(`${key}_d1`, `${name}/Dot1`, { w: 2.4, h: 2.4, x: (o.x || 0) + 5.2, y: (o.y || 0) + 5.8, fill: C.white, parent: o.parent });
    ellipse(`${key}_d2`, `${name}/Dot2`, { w: 2.4, h: 2.4, x: (o.x || 0) + 9.4, y: (o.y || 0) + 5.8, fill: C.white, parent: o.parent });
  }
  return key;
}

/* ================================================================== */
/* chart math                                                          */
/* ================================================================== */

// closed sector path (angles rad, screen coords y-down), arcs as cubics
function arcSectorPath(cx, cy, r, a0, a1) {
  const segs = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / 2)));
  const pt = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [sx, sy] = pt(a0);
  let d = `M ${f(cx)} ${f(cy)} L ${f(sx)} ${f(sy)}`;
  let prev = a0;
  for (let i = 1; i <= segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs;
    const [px, py] = pt(prev);
    const [qx, qy] = pt(a);
    const k = (4 / 3) * Math.tan((a - prev) / 4);
    const c1 = [px + k * r * -Math.sin(prev), py + k * r * Math.cos(prev)];
    const c2 = [qx - k * r * -Math.sin(a), qy - k * r * Math.cos(a)];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(qx)} ${f(qy)}`;
    prev = a;
  }
  return d + " Z";
}

// Catmull-Rom -> cubic bezier smooth line through points
function smoothPath(pts) {
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

const gridPath = (x0, x1, ys) => ys.map((y) => `M ${f(x0)} ${f(y)} L ${f(x1)} ${f(y)}`).join(" ");
const dashPath = (x, y0, y1, dash = 5, gap = 5) => {
  const parts = [];
  for (let y = y0; y < y1; y += dash + gap) parts.push(`M ${f(x)} ${f(y)} L ${f(x)} ${f(Math.min(y + dash, y1))}`);
  return parts.join(" ");
};

/* ================================================================== */
/* stage 1 - design system sheet                                       */
/* ================================================================== */

function swatch(parent, label, hex) {
  const k = `sw_${label.replace(/[^a-z0-9]/gi, "")}`;
  frame(k, `Color/${label}`, { w: 150, parent, fill: null, layout: "VERTICAL", spacing: 5 });
  rect(`${k}_c`, `Color/${label} Swatch`, { w: 150, h: 36, parent: k, fill: hex, radius: RAD.sm, stroke: C.border });
  text(`${k}_n`, label, { size: 11, parent: k, name: "Color/Name", color: C.t1, width: 150 });
  text(`${k}_x`, hex, { size: 10, parent: k, name: "Color/Hex", color: C.t3, family: LATIN });
}

function buildTokens() {
  frame("dsRoot", "Design System / ElementAdmin", { w: L.dsW, h: 1240, x: L.dsX, y: 0, fill: C.white });
  op("set-auto-layout", { id: P("dsRoot"), mode: "VERTICAL", spacing: 28, padding: 32 });
  op("set-layout-sizing", { id: P("dsRoot"), horizontal: "FIXED", vertical: "FIXED" });

  text("dsTitle", "ElementAdmin \u00b7 Design System", { size: 22, weight: 700, parent: "dsRoot", name: "DS/Title", color: C.t1 });
  text("dsSub", "\u53c2\u8003\u56fe\u8fd8\u539f \u00b7 15 \u8272 \u00b7 5 \u5b57\u9636 \u00b7 \u5706\u89d2 2/4/6 \u00b7 4/8pt \u95f4\u8ddd", {
    size: 13, parent: "dsRoot", name: "DS/Subtitle", color: C.t3,
  });

  frame("dsColors", "DS/Color", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsColorsL", "01 / Color", { size: 11, weight: 500, parent: "dsColors", name: "DS/Label", color: C.t3 });
  const palette = [
    ["Background", C.bg], ["Surface", C.surface], ["Border", C.border],
    ["Menu Primary", C.menu], ["Chart Blue", C.chartBlue], ["Chart Green", C.chartGreen],
    ["Chart Yellow", C.chartYellow], ["Chart Orange", C.chartOrange], ["Chart Red", C.chartRed],
    ["KPI Blue", C.kpiBlue], ["KPI Red", C.kpiRed], ["KPI Green", C.kpiGreen],
    ["Text Primary", C.t1], ["Text Regular", C.t2], ["Text Secondary", C.t3],
  ];
  [palette.slice(0, 5), palette.slice(5, 10), palette.slice(10)].forEach((row, ri) => {
    const rk = `dsColorRow${ri}`;
    frame(rk, `DS/Color Row ${ri + 1}`, { w: 876, parent: "dsColors", fill: null, layout: "HORIZONTAL", spacing: 12, sizingH: "FIXED" });
    row.forEach(([label, hex]) => swatch(rk, label, hex));
  });

  frame("dsType", "DS/Typography", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsTypeL", "02 / Typography", { size: 11, weight: 500, parent: "dsType", name: "DS/Label", color: C.t3 });
  [
    ["Display/Numeric", 26, 700], ["Heading", 16, 500], ["Body", 13, 400], ["Caption", 12, 400], ["Axis", 11, 400],
  ].forEach(([label, size, weight], i) => {
    const k = `ty${i}`;
    frame(k, `Type/${label}`, { w: 876, parent: "dsType", fill: null, layout: "HORIZONTAL", spacing: 16, counterAlign: "center", sizingH: "FIXED" });
    text(`${k}_m`, `${label} \u00b7 ${size}/${weight}`, { size: 11, parent: k, name: "Type/Meta", color: C.t3, family: LATIN, width: 130 });
    const sample = label.startsWith("Display") ? "102,400" : label === "Heading" ? "\u7528\u6237\u8bbf\u95ee\u6765\u6e90" : "\u8fd1 30 \u5929\u65b0\u589e\u7528\u6237\u8d8b\u52bf";
    text(`${k}_s`, sample, { size, weight, parent: k, name: "Type/Sample", color: C.t1 });
  });

  frame("dsRadius", "DS/Radius", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsRadiusL", "03 / Radius", { size: 11, weight: 500, parent: "dsRadius", name: "DS/Label", color: C.t3 });
  frame("dsRadiusRow", "DS/Radius Row", { w: 876, parent: "dsRadius", fill: null, layout: "HORIZONTAL", spacing: 16 });
  [["xs", RAD.xs], ["sm", RAD.sm], ["md", RAD.md], ["pill", 8]].forEach(([label, r], i) => {
    const k = `rad${i}`;
    frame(k, `Radius/${label}`, { w: 120, parent: "dsRadiusRow", fill: null, layout: "VERTICAL", spacing: 6, sizingH: "FIXED" });
    rect(`${k}_r`, `Radius/${label} Shape`, { w: 120, h: 40, parent: k, fill: C.kpiBlue, radius: r === 8 ? 999 : r });
    text(`${k}_t`, `${label} \u00b7 ${r === 8 ? "pill" : r + "px"}`, { size: 11, parent: k, name: "Radius/Label", color: C.t2 });
  });

  frame("dsSpace", "DS/Spacing", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsSpaceL", "04 / Spacing \u00b7 4 / 8 pt", { size: 11, weight: 500, parent: "dsSpace", name: "DS/Label", color: C.t3 });
  frame("dsSpaceRow", "DS/Spacing Row", { w: 876, parent: "dsSpace", fill: null, layout: "HORIZONTAL", spacing: 16, counterAlign: "center" });
  [4, 8, 12, 16, 24, 32].forEach((v, i) => {
    const k = `sp${i}`;
    frame(k, `Spacing/${v}`, { w: 60, parent: "dsSpaceRow", fill: null, layout: "VERTICAL", spacing: 6, sizingH: "FIXED" });
    rect(`${k}_r`, `Spacing/${v} Bar`, { w: v * 4, h: 12, parent: k, fill: C.menu, radius: 2 });
    text(`${k}_t`, String(v), { size: 11, parent: k, name: "Spacing/Label", color: C.t2 });
  });

  flush("tokens");
}

/* ================================================================== */
/* stage 2 - components (icon-uniform, text/color-overridable only)    */
/* ================================================================== */

function buildComponents() {
  frame("dsComp", "DS/Components", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 18, sizingH: "FIXED" });
  text("dsCompL", "05 / Components", { size: 11, weight: 500, parent: "dsComp", name: "DS/Label", color: C.t3 });

  /* Tag - breadcrumb row chip (both instances share the same house icon) */
  frame("cTag", "Tag", { parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 5, padT: 4, padB: 4, padL: 8, padR: 8, counterAlign: "center", radius: RAD.xs });
  icon("cTagI", "Tag/Icon", "house", { x: 0, y: 0, w: 12, strokeW: 1.3, color: C.menu, parent: "cTag" });
  text("cTagT", "\u9996\u9875", { size: 12, parent: "cTag", name: "Tag/Label", color: C.menu });

  /* Legend Item - pie/line legends (fill + text overridable) */
  frame("cLegend", "Legend Item", { parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 6, counterAlign: "center" });
  rect("cLegendS", "Legend/Square", { w: 10, h: 10, parent: "cLegend", fill: C.chartBlue, radius: RAD.xs });
  text("cLegendT", "\u76f4\u63a5\u8bbf\u95ee", { size: 12, parent: "cLegend", name: "Legend/Label", color: C.t2 });

  /* Tooltip Row - chart tooltip line (dot + label) */
  frame("cTipRow", "Tooltip Row", { parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 6, counterAlign: "center" });
  ellipse("cTipRowD", "Tooltip/Dot", { w: 8, h: 8, parent: "cTipRow", fill: C.chartBlue });
  text("cTipRowT", "\u4e00\u6708: 120", { size: 12, parent: "cTipRow", name: "Tooltip/Label", color: C.t2 });

  /* Menu Item/Sub - third-level plain rows (text override only) */
  frame("cMenuSub", "Menu Item / Sub", { w: 180, h: 32, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 0, padT: 0, padB: 0, padL: 40, padR: 8, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  text("cMenuSubT", "\u83dc\u53551", { size: 13, parent: "cMenuSub", name: "Menu/Label", color: C.t1 });

  componentise("cTag", "Tag");
  componentise("cLegend", "Legend Item");
  componentise("cTipRow", "Tooltip Row");
  componentise("cMenuSub", "Menu Item / Sub");

  flush("components");
}

/* ================================================================== */
/* stage 3 - shell: topbar(+logo), sidebar, tags bar, card frames      */
/* ================================================================== */

function buildShell() {
  frame("root", "Reference Recreation / ElementAdmin", { w: L.rootW, h: L.rootH, x: L.appX, y: 0, fill: C.bg, layout: "VERTICAL", spacing: 0 });
  op("set-layout-sizing", { id: P("root"), horizontal: "FIXED", vertical: "FIXED" });

  /* ---- top bar (logo block occupies the sidebar column) ---- */
  frame("top", "Top Bar", { w: L.rootW, h: L.topH, parent: "root", fill: C.surface, layout: "HORIZONTAL", spacing: 0, sizingH: "FIXED", sizingV: "FIXED" });
  frame("logo", "Logo", { w: L.sideW, h: L.topH, parent: "top", fill: null, layout: "HORIZONTAL", spacing: 8, padL: 14, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  frame("logoMark", "Logo/Mark", { w: 20, h: 20, parent: "logo", fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });
  vector("logoT1", "Logo/Triangle A", { data: "M 10 1 L 19 18 L 1 18 Z", closed: true, x: 0, y: 1, w: 18, h: 17, fill: C.menu, parent: "logoMark" });
  vector("logoT2", "Logo/Triangle B", { data: "M 13.5 8.5 L 19 18 L 8 18 Z", closed: true, x: 0, y: 1, w: 11, h: 9.5, fill: C.chartGreen, parent: "logoMark" });
  text("logoName", "ElementAdmin", { size: 14, weight: 700, parent: "logo", name: "Logo/Name", color: C.t1, family: LATIN });

  frame("topRest", "Top Bar/Right Zone", { parent: "top", fill: null, layout: "HORIZONTAL", spacing: 14, padL: 16, padR: 16, counterAlign: "center", sizingH: "FILL", sizingV: "FILL" });
  icon("topBurger", "Top/Burger", "burger", { x: 0, y: 0, w: 14, color: C.t1, parent: "topRest" });
  text("topCrumb", "\u9996\u9875", { size: 13, parent: "topRest", name: "Top/Crumb", color: C.t1 });
  rect("topSp", "Top/Spacer", { w: 10, h: 4, parent: "topRest", fill: null, sizingH: "FILL" });
  icon("topFull", "Top/Fullscreen", "fullscreen", { x: 0, y: 0, w: 14, color: C.t2, parent: "topRest" });
  text("topFullT", "\u5168\u5c4f\u5207\u6362", { size: 12, parent: "topRest", name: "Top/Fullscreen Label", color: C.t2 });
  icon("topGear", "Top/Gear", "gear", { x: 0, y: 0, w: 14, color: C.t2, parent: "topRest" });
  ellipse("topAvatar", "Top/Avatar", { w: 24, h: 24, fill: "#AAB8E8", parent: "topRest" });
  text("topUser", "admin", { size: 12, parent: "topRest", name: "Top/User", color: C.t2, family: LATIN });

  /* ---- body: sidebar + main ---- */
  frame("body", "Body", { parent: "root", fill: null, layout: "HORIZONTAL", spacing: 0, sizingH: "FILL", sizingV: "FILL" });

  frame("sidebar", "Sidebar", { w: L.sideW, parent: "body", fill: C.surface, layout: "VERTICAL", spacing: 0, padT: 8, padB: 8, sizingH: "FIXED", sizingV: "FILL" });

  // active row (distinct icon -> native, capability gap documented)
  frame("navActive", "Nav Item / \u9996\u9875 (Active)", { w: L.sideW, h: 40, parent: "sidebar", fill: C.menu, layout: "HORIZONTAL", spacing: 10, padL: 20, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  icon("navActiveI", "Nav/Icon", "house", { x: 0, y: 0, w: 14, color: C.white, parent: "navActive" });
  text("navActiveT", "\u9996\u9875", { size: 13, weight: 500, parent: "navActive", name: "Nav/Label", color: C.white });

  frame("navMore", "Nav Item / \u66f4\u591a\u83dc\u5355", { w: L.sideW, h: 40, parent: "sidebar", fill: null, layout: "HORIZONTAL", spacing: 10, padL: 20, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  icon("navMoreI", "Nav/Icon", "grid", { x: 0, y: 0, w: 14, color: C.t1, parent: "navMore" });
  text("navMoreT", "\u66f4\u591a\u83dc\u5355", { size: 13, parent: "navMore", name: "Nav/Label", color: C.t1 });

  // sub items via Menu Item / Sub instances (text + padding overrides deferred)
  instance("navSub1", "cMenuSub", "sidebar");
  ovr("navSub1", "Menu/Label", "set-text-content", { text: "\u83dc\u53551" });
  instance("navSub2", "cMenuSub", "sidebar");
  ovr("navSub2", "Menu/Label", "set-text-content", { text: "\u83dc\u53551-1" });
  ovr("navSub2", "", "set-padding", { left: 56 });
  instance("navSub3", "cMenuSub", "sidebar");
  ovr("navSub3", "Menu/Label", "set-text-content", { text: "\u83dc\u53551-2" });
  ovr("navSub3", "", "set-padding", { left: 56 });

  frame("navTwo", "Nav Item / \u83dc\u53552", { w: L.sideW, h: 40, parent: "sidebar", fill: null, layout: "HORIZONTAL", spacing: 10, padL: 20, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  icon("navTwoI", "Nav/Icon", "doc", { x: 0, y: 0, w: 14, color: C.t1, parent: "navTwo" });
  text("navTwoT", "\u83dc\u53552", { size: 13, parent: "navTwo", name: "Nav/Label", color: C.t1 });

  /* ---- main column ---- */
  frame("main", "Main", { parent: "body", fill: null, layout: "VERTICAL", spacing: 0, sizingH: "FILL", sizingV: "FILL" });

  /* tags bar */
  frame("tags", "Tags Bar", { w: L.mainW, h: L.tagsH, parent: "main", fill: C.surface, layout: "HORIZONTAL", spacing: 10, padL: 12, padR: 12, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  instance("tag1", "cTag", "tags");
  ovr("tag1", "Tag/Label", "set-text-content", { text: "\u9996\u9875" });
  instance("tag2", "cTag", "tags");
  ovr("tag2", "Tag/Label", "set-text-content", { text: "\u9996\u98752" });
  ovr("tag2", "Tag/Icon", "set-stroke", { color: { hex: C.t4 }, width: 1.3 });
  ovr("tag2", "Tag/Label", "set-text-color", { color: { hex: C.t3 } });
  rect("tagsSp", "Tags/Spacer", { w: 10, h: 4, parent: "tags", fill: null, sizingH: "FILL" });
  icon("tagsBurger", "Tags/Burger", "burger", { x: 0, y: 0, w: 14, color: C.t3, parent: "tags" });

  /* content column */
  frame("content", "Content", { parent: "main", fill: null, layout: "VERTICAL", spacing: L.gap, pad: L.pad, sizingH: "FILL", sizingV: "FILL" });

  /* KPI row skeleton */
  frame("kpiRow", "KPI Section", { parent: "content", fill: null, layout: "HORIZONTAL", spacing: L.gap, sizingH: "FILL", sizingV: "HUG" });

  /* charts row skeleton */
  frame("chartsRow", "Analytics Section", { parent: "content", fill: null, layout: "HORIZONTAL", spacing: L.gap, sizingH: "FILL", sizingV: "HUG" });
  frame("pieCard", "Card / \u7528\u6237\u8bbf\u95ee\u6765\u6e90", { w: L.pieW, h: L.chartsH, parent: "chartsRow", fill: C.surface, layout: "VERTICAL", spacing: 0, pad: 16, radius: RAD.sm, shadow: SHADOW_CARD, sizingH: "FIXED", sizingV: "FIXED" });
  frame("barCard", "Card / \u6bcf\u5468\u7528\u6237\u6d3b\u8dc3\u91cf", { w: L.barW, h: L.chartsH, parent: "chartsRow", fill: C.surface, layout: "VERTICAL", spacing: 0, pad: 16, radius: RAD.sm, shadow: SHADOW_CARD, sizingH: "FIXED", sizingV: "FIXED" });

  /* line chart card skeleton */
  frame("lineCard", "Card / \u6bcf\u6708\u9500\u552e\u91cf", { w: L.contentW, h: L.lineH, parent: "content", fill: C.surface, layout: "VERTICAL", spacing: 0, pad: 16, radius: RAD.sm, shadow: SHADOW_CARD, sizingH: "FIXED", sizingV: "FIXED" });

  /* footer */
  frame("footer", "Footer", { parent: "content", fill: null, layout: "HORIZONTAL", spacing: 0, padT: 16, primaryAlign: "center", counterAlign: "center", sizingH: "FILL", sizingV: "HUG" });
  text("footerT", "Copyright \u00a9 2021-present ElementAdmin", { size: 12, parent: "footer", name: "Footer/Text", color: C.t3, family: LATIN });

  flush("shell");
  applyOverrides("shell menu/tags");
}

/* ================================================================== */
/* stage 4 - KPI cards                                                 */
/* ================================================================== */

const KPIS = [
  ["kpi1", "\u65b0\u589e\u7528\u6237", "102,400", "people", C.kpiBlue],
  ["kpi2", "\u672a\u8bfb\u6d88\u606f", "81,212", "chat", C.kpiBlue],
  ["kpi3", "\u6210\u4ea4\u91d1\u989d", "9,280", "yen", C.kpiRed],
  ["kpi4", "\u8d2d\u7269\u8f66\u6570\u91cf", "13,600", "cart", C.kpiGreen],
];

function buildKpi() {
  for (const [key, label, value, kind, color] of KPIS) {
    frame(key, `KPI Card / ${label}`, { w: L.kpiW, h: L.kpiH, parent: "kpiRow", fill: C.surface, layout: "HORIZONTAL", spacing: 12, padL: 20, padR: 20, counterAlign: "center", radius: RAD.sm, shadow: SHADOW_CARD, sizingH: "FIXED", sizingV: "FIXED" });
    frame(`${key}Icon`, "KPI/Icon Slot", { w: 30, h: 30, parent: key, fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });
    if (kind === "yen") {
      text(`${key}Yen`, "\u00a5", { size: 26, weight: 700, x: 4, y: 0, parent: `${key}Icon`, name: "KPI/Yen", color, family: LATIN });
    } else {
      icon(`${key}Glyph`, "KPI/Glyph", kind, { x: 1, y: 1, w: kind === "chat" ? 15 : 14, color, parent: `${key}Icon` });
    }
    rect(`${key}Sp`, "KPI/Spacer", { w: 10, h: 4, parent: key, fill: null, sizingH: "FILL" });
    frame(`${key}Col`, "KPI/Text Block", { parent: key, fill: null, layout: "VERTICAL", spacing: 2, counterAlign: "max", sizingH: "HUG" });
    text(`${key}L`, label, { size: 13, parent: `${key}Col`, name: "KPI/Label", color: C.t3 });
    text(`${key}V`, value, { size: 26, weight: 700, parent: `${key}Col`, name: "KPI/Value", color: C.t1, family: LATIN });
  }
  flush("kpi");
}

/* ================================================================== */
/* stage 5 - pie + bar charts                                          */
/* ================================================================== */

function chartTitle(parent, key, label) {
  frame(`${key}Head`, "Chart/Title Row", { w: undefined, parent, fill: null, layout: "HORIZONTAL", spacing: 0, primaryAlign: "center", sizingH: "FILL" });
  text(`${key}T`, label, { size: 16, weight: 500, parent: `${key}Head`, name: "Chart/Title", color: C.t1 });
}

function buildCharts() {
  /* ---------------- pie card ---------------- */
  chartTitle("pieCard", "pie", "\u7528\u6237\u8bbf\u95ee\u6765\u6e90");
  frame("piePlot", "Pie Chart / Plot", { w: L.pieW - 32, h: 244, parent: "pieCard", fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });

  const pcx = 250, pcy = 118, pr = 72;
  let a = -Math.PI / 2;
  const mids = [];
  for (const [label, pct, color] of PIE) {
    const span = (pct / 100) * Math.PI * 2;
    vector(`pieSec${mids.length}`, `Pie/Sector ${label}`, {
      data: arcSectorPath(pcx, pcy, pr, a, a + span), closed: true, x: 0, y: 0, fill: color, parent: "piePlot",
    });
    mids.push(a + span / 2);
    a += span;
  }

  // leader lines (one multi-segment vector) + callout labels
  const segs = [];
  PIE.forEach(([label], i) => {
    const mid = mids[i];
    const x1 = pcx + (pr + 5) * Math.cos(mid), y1 = pcy + (pr + 5) * Math.sin(mid);
    const x2 = pcx + (pr + 20) * Math.cos(mid), y2 = pcy + (pr + 20) * Math.sin(mid);
    segs.push(`M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}`);
    const lx = pcx + (pr + 26) * Math.cos(mid), ly = pcy + (pr + 26) * Math.sin(mid);
    const right = Math.cos(mid) >= 0;
    text(`pieLab${i}`, label, {
      size: 11, parent: "piePlot", name: `Pie/Label ${label}`, color: C.t1,
      x: right ? lx + 3 : lx - 87, y: ly - 7, width: 84, align: right ? "LEFT" : "RIGHT",
    });
  });
  vector("pieLeader", "Pie/Leader Lines", { data: segs.join(" "), x: 0, y: 0, stroke: C.t3, strokeW: 1, parent: "piePlot" });

  // legend, bottom-left vertical
  frame("pieLegend", "Pie Chart/Legend", { x: 12, y: 122, parent: "piePlot", fill: null, layout: "VERTICAL", spacing: 7, sizingH: "HUG" });
  PIE.forEach(([label, , color], i) => {
    instance(`pieLeg${i}`, "cLegend", "pieLegend");
    ovr(`pieLeg${i}`, "Legend/Square", "set-fill", { color: { hex: color } });
    ovr(`pieLeg${i}`, "Legend/Label", "set-text-content", { text: label });
  });

  /* ---------------- bar card ---------------- */
  chartTitle("barCard", "bar", "\u6bcf\u5468\u7528\u6237\u6d3b\u8dc3\u91cf");
  frame("barPlot", "Bar Chart / Plot", { w: L.barW - 32, h: 244, parent: "barCard", fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });

  const gx0 = 52, gx1 = L.barW - 32;               // grid span
  const yFor = (v) => 232 - (v / BAR.vmax) * 208;
  const gys = [0, 5000, 10000, 15000, 20000, 25000].map(yFor);
  vector("barGrid", "Bar Chart/Gridlines", { data: gridPath(gx0, gx1, gys), x: 0, y: 0, stroke: C.border, strokeW: 1, parent: "barPlot" });
  [25000, 20000, 15000, 10000, 5000, 0].forEach((v, i) => {
    text(`barYl${i}`, v.toLocaleString("en-US"), {
      size: 11, parent: "barPlot", name: "Bar Chart/Y Label", color: C.t3, family: LATIN,
      x: 0, y: yFor(v) - 7, width: 44, align: "RIGHT",
    });
  });
  const slot = (gx1 - gx0) / BAR.values.length;
  BAR.values.forEach((v, i) => {
    const bw = 44, bx = gx0 + slot * i + (slot - bw) / 2, by = yFor(v);
    rect(`bar${i}`, `Bar Chart/Bar ${BAR.labels[i]}`, { w: bw, h: f(232 - by), x: f(bx), y: f(by), fill: C.chartBlue, parent: "barPlot" });
    text(`barXl${i}`, BAR.labels[i], { size: 12, parent: "barPlot", name: "Bar Chart/X Label", color: C.t3, x: f(gx0 + slot * i + slot / 2 - 20), y: 238, width: 40, align: "CENTER" });
  });

  // hover badge from the reference (top-right floating metric)
  frame("barTip", "Bar Chart / Hover Badge", { x: gx1 - 118, y: 30, parent: "barPlot", fill: C.surface, layout: "VERTICAL", spacing: 2, pad: 6, radius: RAD.xs, stroke: C.border, shadow: SHADOW_TIP });
  text("barTipG", "7,600 KBa", { size: 10, parent: "barTip", name: "Badge/Value", color: C.kpiGreen, family: LATIN });
  text("barTipR", "+15.2 KBa", { size: 10, parent: "barTip", name: "Badge/Delta", color: C.kpiRed, family: LATIN });

  flush("charts");
  applyOverrides("pie legend");
}

/* ================================================================== */
/* stage 6 - line chart + hover state                                  */
/* ================================================================== */

function buildLine() {
  // centered title + inline legend
  frame("lineHead", "Chart/Title Row", { parent: "lineCard", fill: null, layout: "HORIZONTAL", spacing: 24, primaryAlign: "center", counterAlign: "center", sizingH: "FILL" });
  text("lineT", "\u6bcf\u6708\u9500\u552e\u91cf", { size: 16, weight: 500, parent: "lineHead", name: "Chart/Title", color: C.t1 });
  frame("lineLegend", "Line Chart/Legend", { parent: "lineHead", fill: null, layout: "HORIZONTAL", spacing: 12, counterAlign: "center" });
  [LINE.s1, LINE.s2].forEach((s, i) => {
    instance(`lineLeg${i}`, "cLegend", "lineLegend");
    ovr(`lineLeg${i}`, "Legend/Square", "set-fill", { color: { hex: s.color } });
    ovr(`lineLeg${i}`, "Legend/Label", "set-text-content", { text: s.name });
  });

  frame("linePlot", "Line Chart / Plot", { w: L.contentW - 32, h: 248, parent: "lineCard", fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });

  const gx0 = 44, gx1 = L.contentW - 32;
  const yFor = (v) => 232 - (v / LINE.vmax) * 222;
  const slot = (gx1 - gx0) / 12;
  const xFor = (i) => gx0 + slot * i + slot / 2;
  const gys = [0, 50, 100, 150, 200, 250].map(yFor);
  vector("lineGrid", "Line Chart/Gridlines", { data: gridPath(gx0, gx1, gys), x: 0, y: 0, stroke: C.border, strokeW: 1, parent: "linePlot" });
  [250, 200, 150, 100, 50, 0].forEach((v, i) => {
    text(`lineYl${i}`, String(v), {
      size: 11, parent: "linePlot", name: "Line Chart/Y Label", color: C.t3, family: LATIN,
      x: 0, y: yFor(v) - 7, width: 36, align: "RIGHT",
    });
  });
  LINE.months.forEach((m, i) => {
    text(`lineXl${i}`, m, { size: 12, parent: "linePlot", name: "Line Chart/X Label", color: C.t3, x: f(xFor(i) - 20), y: 238, width: 40, align: "CENTER" });
  });

  // two smooth series + hollow data points
  [[LINE.s1, "S1"], [LINE.s2, "S2"]].forEach(([s, suffix], si) => {
    const pts = s.values.map((v, i) => [f(xFor(i)), f(yFor(v))]);
    vector(`lineCurve${si}`, `Line Chart/Series ${s.name}`, { data: smoothPath(pts), x: 0, y: 0, stroke: s.color, strokeW: 2, parent: "linePlot" });
    pts.forEach(([px, py], i) => {
      ellipse(`dot${si}_${i}`, `Line Chart/Point ${s.name} ${LINE.months[i]}`, {
        w: 8, h: 8, x: f(px - 4), y: f(py - 4), fill: C.surface, stroke: s.color, strokeW: 2, parent: "linePlot",
      });
    });
  });

  /* ---- hover state at 二月 (structure expresses the state) ---- */
  frame("hover", "Hover State / \u4e8c\u6708 Crosshair", { x: 0, y: 0, w: L.contentW - 32, h: 248, parent: "linePlot", fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });
  const hx = f(xFor(1));
  vector("hoverDash", "Hover/Dashed Line", { data: dashPath(hx, 10, 232), x: 0, y: 0, stroke: C.t4, strokeW: 1, parent: "hover" });
  frame("hoverPill", "Hover/X Pill", { w: 44, h: 20, x: f(hx - 22), y: 234, parent: "hover", fill: C.chartBlue, layout: "HORIZONTAL", spacing: 0, counterAlign: "center", primaryAlign: "center", radius: 3, sizingH: "FIXED", sizingV: "FIXED" });
  text("hoverPillT", "\u4e8c\u6708", { size: 11, parent: "hoverPill", name: "Pill/Label", color: C.white });
  frame("hoverTip", "Hover/Tooltip", { w: 124, h: 78, x: f(hx + 24), y: 148, parent: "hover", fill: C.surface, layout: "VERTICAL", spacing: 5, pad: 10, radius: RAD.xs, stroke: C.border, shadow: SHADOW_TIP, sizingH: "FIXED", sizingV: "FIXED" });
  text("hoverTipT", "\u4e8c\u6708", { size: 12, weight: 700, parent: "hoverTip", name: "Tooltip/Title", color: C.t1 });
  instance("hoverRow1", "cTipRow", "hoverTip");
  ovr("hoverRow1", "Tooltip/Dot", "set-fill", { color: { hex: LINE.s1.color } });
  ovr("hoverRow1", "Tooltip/Label", "set-text-content", { text: "\u4e00\u6708: 120" });
  instance("hoverRow2", "cTipRow", "hoverTip");
  ovr("hoverRow2", "Tooltip/Dot", "set-fill", { color: { hex: LINE.s2.color } });
  ovr("hoverRow2", "Tooltip/Label", "set-text-content", { text: "\u4e09\u6708: 82" });
  frame("hoverPointer", "Hover/Y Pointer", { w: 52, h: 18, x: 0, y: f(yFor(LINE.s1.values[0]) - 9), parent: "hover", fill: C.chartBlue, layout: "HORIZONTAL", spacing: 0, counterAlign: "center", primaryAlign: "center", radius: RAD.xs, sizingH: "FIXED", sizingV: "FIXED" });
  text("hoverPointerT", "1130.94", { size: 10, parent: "hoverPointer", name: "Pointer/Value", color: C.white, family: LATIN });

  flush("line");
  applyOverrides("line legend + tooltip");
}

/* ================================================================== */
/* stage 7 - read the canvas back                                      */
/* ================================================================== */

function walk(node, depth, out) {
  out.push({ name: node.name, type: node.type, id: node.id, w: node.width, h: node.height, depth, layoutMode: node.layoutMode, childCount: node.childCount, fills: node.fills, characters: node.characters, fontSize: node.fontSize, fontName: node.fontName, cornerRadius: node.cornerRadius, strokes: node.strokes, strokeWeight: node.strokeWeight, parentId: node.parentId });
  (node.children || []).forEach((c) => walk(c, depth + 1, out));
}

function dump() {
  const tree = readNode(id("root"), 12, true);
  fs.writeFileSync(TREE_FILE, JSON.stringify(tree, null, 2));
  const flat = [];
  walk(tree, 0, flat);
  const byType = {};
  for (const n of flat) byType[n.type] = (byType[n.type] || 0) + 1;
  const autoLayout = flat.filter((n) => n.layoutMode && n.layoutMode !== "NONE").length;
  console.log(`  nodes=${flat.length} types=${JSON.stringify(byType)}`);
  console.log(`  auto-layout frames=${autoLayout}  max depth=${Math.max(...flat.map((n) => n.depth))}`);
  const page = call([{ op: "get-page-summary", params: {} }])[0].data;
  console.log(`  page top-level: ${(page.nodes || []).map((n) => `${n.name}(${n.type})`).join(" | ")}`);
  console.log(`  tree -> ${path.relative(ROOT, TREE_FILE)}`);
}

/* ================================================================== */
/* runner                                                              */
/* ================================================================== */

const STAGES = {
  tokens: buildTokens,
  components: buildComponents,
  shell: buildShell,
  kpi: buildKpi,
  charts: buildCharts,
  line: buildLine,
  dump,
};

function teardown() {
  const page = call([{ op: "get-page-summary", params: {} }])[0].data;
  const doomed = (page.nodes || []).filter((n) => /^(Design System \/ ElementAdmin|Reference Recreation \/ ElementAdmin)$/.test(n.name));
  if (doomed.length) call(doomed.map((n) => ({ op: "delete-node", params: { id: n.id } })), 180000);
  for (const k of Object.keys(S)) delete S[k];
  saveState();
  console.log(`teardown: removed ${doomed.length} root frame(s), state cleared`);
}

function main() {
  if (hasFlag("teardown")) return teardown();
  console.log(`fonts: cjk=${CJK} latin=${LATIN} styles=${JSON.stringify(STYLES)}`);
  const wanted = RUN_STAGE && RUN_STAGE !== "all" ? [RUN_STAGE] : Object.keys(STAGES);
  for (const name of wanted) {
    const fn = STAGES[name];
    if (!fn) throw new Error(`unknown stage "${name}". Known: ${Object.keys(STAGES).join(", ")}`);
    if (RUN_STAGE !== name && !FORCE && S[`__done_${name}`]) { console.log(`- skip ${name} (done)`); continue; }
    console.log(`\n== stage: ${name} ==`);
    fn();
    if (RUN_STAGE !== name) { S[`__done_${name}`] = true; saveState(); }
  }
  console.log("\nstate -> " + path.relative(ROOT, STATE_FILE));
}

try {
  main();
} catch (e) {
  console.error("\nBUILD FAILED: " + (e && e.message ? e.message : e));
  process.exit(1);
}
