#!/usr/bin/env node
/**
 * Stage 4 builder - "PixelFlow AI" dark-mode creative tool.
 * ==================================================================
 * Autonomous vibe-design build: design decisions are made HERE (tokens,
 * layout ratios, component strategy) and compiled into plugin-op batches.
 * Same guarantees as Stage 3: real nodes only, no IMAGE, no mock, read-back.
 *
 *   node tools/stage4-build.js                    run every stage not done
 *   node tools/stage4-build.js --stage <name>     run one stage
 *   node tools/stage4-build.js --stage all --force
 *   node tools/stage4-build.js --teardown
 * ==================================================================
 */

"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const NODE = process.execPath;
const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "cli", "figma-vibe.js");
const STATE_FILE = path.join(ROOT, ".vibe", "stage4-state.json");
const FONT_FILE = path.join(ROOT, ".vibe", "stage3-font.json"); // same environment probe
const TREE_FILE = path.join(ROOT, ".vibe", "stage4-tree.json");
const BATCH_FILE = path.join(ROOT, ".vibe", "stage4-batch.json");

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
/* design tokens - PixelFlow AI (dark, Linear/Framer direction)        */
/* ================================================================== */

const C = {
  bgPage: "#0A0C10", canvas: "#0E1116", surface: "#14181F", surfaceHi: "#1B2029",
  border: "#262D3A", primary: "#6E7BFF", primarySoft: "#1D2440",
  success: "#3ECF8E", warning: "#F5B84A", danger: "#F26D6D",
  violet: "#9B7BFF", sky: "#5AC8FA", pink: "#F27FB2",
  t1: "#F2F4F8", t2: "#A9B1C0", t3: "#6C7686", white: "#FFFFFF",
};
const RAD = { sm: 6, md: 10, lg: 14, pill: 999 };
const SHADOW_CARD = { x: 0, y: 2, blur: 8, spread: 0, color: "#000000", opacity: 0.3 };
const SHADOW_GLOW = { x: 0, y: 4, blur: 16, spread: 0, color: "#6E7BFF", opacity: 0.22 };

const L = {
  appX: 8000, dsX: 7000, dsW: 940,
  sidebarW: 240, headerH: 64, pad: 24, gap: 20,
  controlsW: 380, rootW: 1440, rootH: 900,
};
L.mainW = L.rootW - L.sidebarW;                       // 1200
L.workH = L.rootH - L.headerH;                        // 836
L.workInnerH = L.workH - L.pad * 2;                   // 788
L.previewW = L.mainW - L.pad * 2 - L.gap - L.controlsW; // 752
const round = (n) => Math.round(n * 100) / 100;

/* ================================================================== */
/* batch recorder (identical core to Stage 3 - proven mechanics)       */
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
// the batch may have run to completion (Stage 3 duplicated a whole DS sheet
// this way), so timeouts surface to the operator instead.
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
/* icons - native stroke vectors, 16px grid inside an 18px slot        */
/* ================================================================== */

const ICON = {
  sparkle: { data: "M 6 0.5 L 7.4 4.6 L 11.5 6 L 7.4 7.4 L 6 11.5 L 4.6 7.4 L 0.5 6 L 4.6 4.6 Z", fill: true },
  folder: { data: "M 2 4.5 C 2 4 2.4 3.5 3 3.5 L 6.5 3.5 L 8.2 5.2 L 13 5.2 C 13.6 5.2 14 5.6 14 6.2 L 14 12 C 14 12.6 13.6 13 13 13 L 3 13 C 2.4 13 2 12.6 2 12 Z" },
  image: { data: "M 2.5 3 L 13.5 3 L 13.5 13 L 2.5 13 Z M 2.5 10.5 L 6 7 L 8.5 9.5 L 10 8 L 13.5 11.5" },
  clock: { data: "M 8 2.5 C 11 2.5 13.5 5 13.5 8 C 13.5 11 11 13.5 8 13.5 C 5 13.5 2.5 11 2.5 8 C 2.5 5 5 2.5 8 2.5 Z M 8 5 L 8 8.2 L 10.2 9.8" },
  sliders: { data: "M 2.5 5 L 13.5 5 M 2.5 11 L 13.5 11" },
  search: { data: "M 6 2 C 8.2 2 10 3.8 10 6 C 10 8.2 8.2 10 6 10 C 3.8 10 2 8.2 2 6 C 2 3.8 3.8 2 6 2 Z M 9 9 L 12 12" },
  bell: { data: "M 8 2.5 C 5.5 2.5 4 4.4 4 6.8 L 4 9.2 L 3 11.2 L 13 11.2 L 12 9.2 L 12 6.8 C 12 4.4 10.5 2.5 8 2.5 Z M 6.5 12.8 C 6.5 13.8 7.2 14.4 8 14.4 C 8.8 14.4 9.5 13.8 9.5 12.8" },
  chevron: { data: "M 3 4.5 L 6 7.5 L 9 4.5" },
  download: { data: "M 7 2 L 7 8.5 M 4.2 6.2 L 7 9 L 9.8 6.2 M 2 11.5 L 12 11.5" },
};

function icon(key, name, kind, o) {
  const spec = ICON[kind];
  if (spec.fill) {
    vector(key, name, { data: spec.data, closed: true, x: o.x, y: o.y, w: o.w || 12, h: o.w || 12, fill: o.color, parent: o.parent });
  } else {
    vector(key, name, { data: spec.data, x: o.x, y: o.y, w: o.w || 14, h: o.w || 14, stroke: o.color, strokeW: 1.4, cap: "ROUND", join: "ROUND", parent: o.parent });
  }
  if (kind === "sliders") { // knobs for the settings glyph
    ellipse(`${key}_k1`, `${name}/Knob1`, { w: 4, h: 4, x: o.x + 8, y: o.y + 3, fill: o.color, parent: o.parent });
    ellipse(`${key}_k2`, `${name}/Knob2`, { w: 4, h: 4, x: o.x + 3.5, y: o.y + 9, fill: o.color, parent: o.parent });
  }
  return key;
}

/* ================================================================== */
/* stage 1 - design system sheet                                       */
/* ================================================================== */

function swatch(parent, label, hex) {
  const k = `sw_${label.replace(/[^a-z0-9]/gi, "")}`;
  frame(k, `Color/${label}`, { w: 132, parent, fill: null, layout: "VERTICAL", spacing: 5, sizingH: "FIXED" });
  rect(`${k}_c`, `Color/${label} Swatch`, { w: 132, h: 40, parent: k, fill: hex, radius: RAD.sm, stroke: C.border });
  text(`${k}_n`, label, { size: 11, parent: k, name: "Color/Name", color: C.t1, family: LATIN });
  text(`${k}_x`, hex, { size: 10, parent: k, name: "Color/Hex", color: C.t3, family: LATIN });
}

function buildTokens() {
  frame("dsRoot", "Design System / PixelFlow", { w: L.dsW, h: 1400, x: L.dsX, y: 0, fill: C.bgPage });
  op("set-auto-layout", { id: P("dsRoot"), mode: "VERTICAL", spacing: 28, padding: 32 });
  op("set-layout-sizing", { id: P("dsRoot"), horizontal: "FIXED", vertical: "FIXED" });

  text("dsTitle", "PixelFlow AI \u00b7 Design System", { size: 24, weight: 600, parent: "dsRoot", name: "DS/Title" });
  text("dsSub", "Dark creative tool \u00b7 16 colors \u00b7 7 type sizes \u00b7 4 radii \u00b7 4/8pt spacing", {
    size: 13, parent: "dsRoot", name: "DS/Subtitle", color: C.t3,
  });

  frame("dsColors", "DS/Color", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsColorsL", "01 / Color", { size: 11, weight: 500, parent: "dsColors", name: "DS/Label", color: C.t3, family: LATIN });
  const palette = [
    ["Background", C.bgPage], ["Canvas", C.canvas], ["Surface", C.surface], ["Surface Elevated", C.surfaceHi],
    ["Border", C.border], ["Primary", C.primary], ["Primary Soft", C.primarySoft],
    ["Success", C.success], ["Warning", C.warning], ["Danger", C.danger],
    ["Accent Violet", C.violet], ["Accent Sky", C.sky], ["Accent Pink", C.pink],
    ["Text Primary", C.t1], ["Text Secondary", C.t2], ["Text Muted", C.t3],
  ];
  [palette.slice(0, 6), palette.slice(6, 11), palette.slice(11)].forEach((row, ri) => {
    const rk = `dsColorRow${ri}`;
    frame(rk, `DS/Color Row ${ri + 1}`, { w: 876, parent: "dsColors", fill: null, layout: "HORIZONTAL", spacing: 12, sizingH: "FIXED" });
    row.forEach(([label, hex]) => swatch(rk, label, hex));
  });

  frame("dsType", "DS/Typography", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsTypeL", "02 / Typography", { size: 11, weight: 500, parent: "dsType", name: "DS/Label", color: C.t3, family: LATIN });
  [
    ["Display", 28, 600], ["Heading", 18, 600], ["Body", 13, 400], ["Body Strong", 13, 600],
    ["Caption", 11, 400], ["Numeric", 13, 600],
  ].forEach(([label, size, weight], i) => {
    const k = `ty${i}`;
    frame(k, `Type/${label}`, { w: 876, parent: "dsType", fill: null, layout: "HORIZONTAL", spacing: 16, counterAlign: "center", sizingH: "FIXED" });
    text(`${k}_m`, `${label} \u00b7 ${size}/${weight}`, { size: 11, parent: k, name: "Type/Meta", color: C.t3, family: LATIN, width: 120 });
    const sample = label === "Numeric" ? "1,024 \u00d7 1,024" : "Generate something impossible";
    text(`${k}_s`, sample, { size, weight, parent: k, name: "Type/Sample", color: C.t1, family: LATIN });
  });

  frame("dsRadius", "DS/Radius", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsRadiusL", "03 / Radius", { size: 11, weight: 500, parent: "dsRadius", name: "DS/Label", color: C.t3, family: LATIN });
  frame("dsRadiusRow", "DS/Radius Row", { w: 876, parent: "dsRadius", fill: null, layout: "HORIZONTAL", spacing: 16 });
  [["sm", RAD.sm], ["md", RAD.md], ["lg", RAD.lg], ["pill", 12]].forEach(([label, r], i) => {
    const k = `rad${i}`;
    frame(k, `Radius/${label}`, { w: 120, parent: "dsRadiusRow", fill: null, layout: "VERTICAL", spacing: 6, sizingH: "FIXED" });
    rect(`${k}_r`, `Radius/${label} Shape`, { w: 120, h: 44, parent: k, fill: C.primarySoft, radius: r });
    text(`${k}_t`, `${label} \u00b7 ${r === 999 ? "pill" : r + "px"}`, { size: 11, parent: k, name: "Radius/Label", color: C.t2, family: LATIN });
  });

  frame("dsSpace", "DS/Spacing", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsSpaceL", "04 / Spacing \u00b7 4 / 8 pt", { size: 11, weight: 500, parent: "dsSpace", name: "DS/Label", color: C.t3, family: LATIN });
  frame("dsSpaceRow", "DS/Spacing Row", { w: 876, parent: "dsSpace", fill: null, layout: "HORIZONTAL", spacing: 16, counterAlign: "center" });
  [4, 8, 12, 16, 20, 24, 32].forEach((v, i) => {
    const k = `sp${i}`;
    frame(k, `Spacing/${v}`, { w: 60, parent: "dsSpaceRow", fill: null, layout: "VERTICAL", spacing: 6, sizingH: "FIXED" });
    rect(`${k}_r`, `Spacing/${v} Bar`, { w: v * 4, h: 12, parent: k, fill: C.primary, radius: 2 });
    text(`${k}_t`, String(v), { size: 11, parent: k, name: "Spacing/Label", color: C.t2, family: LATIN });
  });

  flush("tokens");
}

/* ================================================================== */
/* stage 2 - components                                                */
/* ================================================================== */

function buildComponents() {
  frame("dsComp", "DS/Components", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 18, sizingH: "FIXED" });
  text("dsCompL", "05 / Components", { size: 11, weight: 500, parent: "dsComp", name: "DS/Label", color: C.t3, family: LATIN });

  /* Button/Primary - Generate */
  frame("cBtnP", "Button/Primary", { h: 44, parent: "dsComp", fill: C.primary, layout: "HORIZONTAL", spacing: 8, padT: 0, padB: 0, padL: 20, padR: 20, counterAlign: "center", primaryAlign: "center", radius: RAD.md, sizingH: "HUG" });
  icon("cBtnPI", "Btn/Icon", "sparkle", { x: 0, y: 0, color: C.white, parent: "cBtnP" });
  text("cBtnPT", "Generate", { size: 14, weight: 600, parent: "cBtnP", name: "Btn/Label", color: C.white });

  /* Button/Secondary - Download */
  frame("cBtnS", "Button/Secondary", { h: 36, parent: "dsComp", fill: C.surfaceHi, layout: "HORIZONTAL", spacing: 6, padT: 0, padB: 0, padL: 14, padR: 14, counterAlign: "center", primaryAlign: "center", radius: RAD.md, stroke: C.border, sizingH: "HUG" });
  icon("cBtnSI", "Btn/Icon", "download", { x: 0, y: 1, w: 14, color: C.t1, parent: "cBtnS" });
  text("cBtnST", "Download", { size: 12, weight: 500, parent: "cBtnS", name: "Btn/Label", color: C.t1 });

  /* Button/Ghost */
  frame("cBtnG", "Button/Ghost", { h: 36, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 6, padT: 0, padB: 0, padL: 14, padR: 14, counterAlign: "center", primaryAlign: "center", radius: RAD.md, sizingH: "HUG" });
  text("cBtnGT", "Edit", { size: 12, weight: 500, parent: "cBtnG", name: "Btn/Label", color: C.t2 });

  /* Icon Button - bell */
  frame("cIconBtn", "Icon Button", { w: 36, h: 36, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 0, counterAlign: "center", primaryAlign: "center", radius: RAD.md, stroke: C.border, sizingH: "FIXED", sizingV: "FIXED" });
  icon("cIconBtnI", "IconBtn/Glyph", "bell", { x: 1, y: 1, w: 14, color: C.t2, parent: "cIconBtn" });

  /* Input - search */
  frame("cInput", "Input", { w: 240, h: 36, parent: "dsComp", fill: C.surface, layout: "HORIZONTAL", spacing: 8, padT: 0, padB: 0, padL: 12, padR: 12, counterAlign: "center", radius: RAD.md, stroke: C.border, sizingH: "FIXED", sizingV: "FIXED" });
  icon("cInputI", "Input/Icon", "search", { x: 0, y: 0, w: 14, color: C.t3, parent: "cInput" });
  text("cInputT", "Search images, projects\u2026", { size: 12, parent: "cInput", name: "Input/Placeholder", color: C.t3 });

  /* Textarea - prompt */
  frame("cTextarea", "Textarea", { w: 320, h: 104, parent: "dsComp", fill: C.surface, layout: "VERTICAL", spacing: 8, pad: 12, radius: RAD.md, stroke: C.border, sizingH: "FIXED", sizingV: "FIXED" });
  text("cTextareaT", "A cinematic editorial portrait of a futuristic female architect, soft natural lighting, minimal studio background, high fashion photography.", { size: 13, parent: "cTextarea", name: "Textarea/Content", color: C.t1, width: 296 });

  /* Select - image size */
  frame("cSelect", "Select", { w: 320, h: 36, parent: "dsComp", fill: C.surface, layout: "HORIZONTAL", spacing: 8, padT: 0, padB: 0, padL: 12, padR: 12, counterAlign: "center", radius: RAD.md, stroke: C.border, sizingH: "FIXED", sizingV: "FIXED" });
  text("cSelectT", "1024 px", { size: 13, parent: "cSelect", name: "Select/Value", color: C.t1, family: LATIN });
  rect("cSelectSp", "Select/Spacer", { w: 10, h: 4, parent: "cSelect", fill: null, sizingH: "FILL" });
  icon("cSelectC", "Select/Chevron", "chevron", { x: 0, y: 1, w: 12, color: C.t3, parent: "cSelect" });

  /* Chip + Chip/Active */
  [["cChip", "Chip", "Cinematic", false], ["cChipA", "Chip / Active", "Cinematic", true]].forEach(([k, name, label, active]) => {
    frame(k, name, { parent: "dsComp", fill: active ? C.primarySoft : null, layout: "HORIZONTAL", spacing: 4, padT: 5, padB: 5, padL: 12, padR: 12, counterAlign: "center", primaryAlign: "center", radius: RAD.pill, stroke: active ? undefined : C.border });
    text(`${k}T`, label, { size: 12, weight: active ? 600 : 400, parent: k, name: "Chip/Label", color: active ? "#9FB0FF" : C.t2 });
  });

  /* Tab + Tab/Active */
  [["cTab", "Tab", "Variations", false], ["cTabA", "Tab / Active", "Latest", true]].forEach(([k, name, label, active]) => {
    frame(k, name, { parent: "dsComp", fill: active ? C.surfaceHi : null, layout: "HORIZONTAL", spacing: 4, padT: 6, padB: 6, padL: 12, padR: 12, counterAlign: "center", primaryAlign: "center", radius: 8 });
    text(`${k}T`, label, { size: 12, weight: active ? 600 : 400, parent: k, name: "Tab/Label", color: active ? C.t1 : C.t2 });
  });

  /* Slider - pattern component (instances can't resize the fill bar) */
  frame("cSlider", "Slider", { w: 316, parent: "dsComp", fill: null, layout: "VERTICAL", spacing: 8, sizingH: "FIXED" });
  frame("cSliderHead", "Slider/Head", { parent: "cSlider", fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "FILL" });
  text("cSliderL", "Steps", { size: 12, parent: "cSliderHead", name: "Slider/Label", color: C.t2 });
  rect("cSliderSp", "Slider/Spacer", { w: 10, h: 4, parent: "cSliderHead", fill: null, sizingH: "FILL" });
  text("cSliderV", "32", { size: 12, weight: 600, parent: "cSliderHead", name: "Slider/Value", color: C.t1, family: LATIN });
  frame("cSliderTrack", "Slider/Track", { w: 316, h: 4, parent: "cSlider", fill: C.surfaceHi, clips: false, sizingH: "FIXED", sizingV: "FIXED", radius: RAD.pill });
  rect("cSliderFill", "Slider/Fill", { w: 190, h: 4, x: 0, y: 0, parent: "cSliderTrack", fill: C.primary, radius: RAD.pill });
  ellipse("cSliderKnob", "Slider/Knob", { w: 12, h: 12, x: 184, y: -4, fill: C.t1, parent: "cSliderTrack" });

  /* Card - pattern */
  frame("cCard", "Card", { w: 320, h: 120, parent: "dsComp", fill: C.surface, layout: "VERTICAL", spacing: 10, pad: 16, radius: RAD.lg, stroke: C.border, shadow: SHADOW_CARD, sizingH: "FIXED", sizingV: "FIXED" });
  text("cCardT", "Card pattern - page cards add children natively", { size: 12, parent: "cCard", name: "Card/Note", color: C.t3 });

  /* Badge */
  frame("cBadge", "Badge", { parent: "dsComp", fill: C.primarySoft, layout: "HORIZONTAL", spacing: 4, padT: 3, padB: 3, padL: 8, padR: 8, counterAlign: "center", primaryAlign: "center", radius: RAD.pill });
  text("cBadgeT", "BETA", { size: 10, weight: 600, parent: "cBadge", name: "Badge/Label", color: "#9FB0FF" });

  /* Avatar */
  frame("cAvatar", "Avatar", { w: 32, h: 32, parent: "dsComp", fill: "#2A3140", layout: "HORIZONTAL", spacing: 0, counterAlign: "center", primaryAlign: "center", radius: RAD.pill, sizingH: "FIXED", sizingV: "FIXED" });
  text("cAvatarT", "A", { size: 13, weight: 600, parent: "cAvatar", name: "Avatar/Initial", color: "#C3CFFF" });

  /* Nav Item + Active - documented pattern (live rows carry distinct icons) */
  [["cNav", "Nav Item", false], ["cNavA", "Nav Item / Active", true]].forEach(([k, name, active]) => {
    frame(k, name, { w: 208, h: 36, parent: "dsComp", fill: active ? C.primarySoft : null, layout: "HORIZONTAL", spacing: 10, padT: 0, padB: 0, padL: 10, padR: 10, counterAlign: "center", radius: RAD.sm, sizingH: "FIXED", sizingV: "FIXED" });
    frame(`${k}Slot`, "Nav/Icon Slot", { w: 18, h: 18, parent: k, fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });
    icon(`${k}SlotI`, "Nav/Icon Mark", "sparkle", { x: 3, y: 3, w: 12, color: active ? "#9FB0FF" : C.t3, parent: `${k}Slot` });
    text(`${k}T`, active ? "Create" : "Projects", { size: 13, weight: active ? 600 : 500, parent: k, name: "Nav/Label", color: active ? "#C3CFFF" : C.t2 });
  });

  componentise("cBtnP", "Button/Primary");
  componentise("cBtnS", "Button/Secondary");
  componentise("cBtnG", "Button/Ghost");
  componentise("cIconBtn", "Icon Button");
  componentise("cInput", "Input");
  componentise("cTextarea", "Textarea");
  componentise("cSelect", "Select");
  componentise("cChip", "Chip");
  componentise("cChipA", "Chip / Active");
  componentise("cTab", "Tab");
  componentise("cTabA", "Tab / Active");
  componentise("cSlider", "Slider");
  componentise("cCard", "Card");
  componentise("cBadge", "Badge");
  componentise("cAvatar", "Avatar");
  componentise("cNav", "Nav Item");
  componentise("cNavA", "Nav Item / Active");

  flush("components");
}

/* ================================================================== */
/* stage 3 - shell: app frame, sidebar, header                         */
/* ================================================================== */

function buildShell() {
  frame("root", "PixelFlow AI", { w: L.rootW, h: L.rootH, x: L.appX, y: 0, fill: C.bgPage, layout: "HORIZONTAL", spacing: 0 });
  op("set-layout-sizing", { id: P("root"), horizontal: "FIXED", vertical: "FIXED" });

  /* ---- sidebar ---- */
  frame("sidebar", "Sidebar", { w: L.sidebarW, parent: "root", fill: C.surface, layout: "VERTICAL", spacing: 20, pad: 16, sizingH: "FIXED", sizingV: "FILL" });

  frame("brand", "Brand", { parent: "sidebar", fill: null, layout: "HORIZONTAL", spacing: 10, counterAlign: "center", sizingH: "FILL" });
  frame("brandMark", "Brand/Mark", { w: 28, h: 28, parent: "brand", fill: C.primary, layout: "HORIZONTAL", spacing: 0, counterAlign: "center", primaryAlign: "center", radius: 8, sizingH: "FIXED", sizingV: "FIXED" });
  icon("brandSpark", "Brand/Spark", "sparkle", { x: 8, y: 8, w: 12, color: C.white, parent: "brandMark" });
  frame("brandText", "Brand/Text", { parent: "brand", fill: null, layout: "VERTICAL", spacing: 1, sizingH: "HUG" });
  text("brandName", "PixelFlow", { size: 15, weight: 600, parent: "brandText", name: "Brand/Name", family: LATIN, color: C.t1 });
  text("brandTag", "AI IMAGE STUDIO", { size: 9, weight: 600, parent: "brandText", name: "Brand/Tagline", family: LATIN, color: C.t3 });

  /* ---- divider between sidebar and main ---- */
  rect("sideRule", "Sidebar/Rule", { w: 1, h: L.rootH, parent: "root", fill: C.border, sizingV: "FILL" });

  /* ---- main column ---- */
  frame("main", "Main", { parent: "root", fill: null, layout: "VERTICAL", spacing: 0, sizingH: "FILL", sizingV: "FILL" });

  /* header row + bottom rule */
  frame("header", "Header", { w: L.mainW, h: L.headerH - 1, parent: "main", fill: C.bgPage, layout: "HORIZONTAL", spacing: 12, padL: 24, padR: 24, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  rect("headRule", "Header/Rule", { w: L.mainW, h: 1, parent: "main", fill: C.border, sizingH: "FIXED" });

  frame("headTitle", "Header/TitleBlock", { parent: "header", fill: null, layout: "VERTICAL", spacing: 2, sizingH: "HUG" });
  text("headTitleT", "Nightfall Series", { size: 15, weight: 600, parent: "headTitle", name: "Header/Project", family: LATIN, color: C.t1 });
  text("headTitleS", "Flux v2 \u00b7 24 images", { size: 11, parent: "headTitle", name: "Header/Meta", family: LATIN, color: C.t3 });
  rect("headSp", "Header/Spacer", { w: 10, h: 4, parent: "header", fill: null, sizingH: "FILL" });
  instance("headSearch", "cInput", "header");
  frame("credits", "Header/Credits", { parent: "header", fill: C.surface, layout: "HORIZONTAL", spacing: 6, padT: 6, padB: 6, padL: 12, padR: 12, counterAlign: "center", radius: RAD.pill, stroke: C.border });
  ellipse("creditsDot", "Credits/Dot", { w: 6, h: 6, fill: C.success, parent: "credits" });
  text("creditsT", "142 credits", { size: 12, parent: "credits", name: "Credits/Label", family: LATIN, color: C.t2 });
  instance("headBell", "cIconBtn", "header");
  instance("headAvatar", "cAvatar", "header");

  /* ---- workspace ---- */
  frame("work", "Workspace", { parent: "main", fill: null, layout: "HORIZONTAL", spacing: L.gap, pad: L.pad, sizingH: "FILL", sizingV: "FILL" });

  flush("shell");
}

/* ================================================================== */
/* stage 4 - controls column                                           */
/* ================================================================== */

const PROMPT = "A cinematic editorial portrait of a futuristic female architect, soft natural lighting, minimal studio background, high fashion photography.";

function sectionLabel(key, label, hint) {
  frame(`${key}Sec`, `Controls/${label}`, { parent: "controls", fill: null, layout: "VERTICAL", spacing: 10, sizingH: "FILL" });
  frame(`${key}Head`, `${label}/Head`, { parent: `${key}Sec`, fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "FILL" });
  text(`${key}L`, label, { size: 12, weight: 500, parent: `${key}Head`, name: "Section/Label", family: LATIN, color: C.t2 });
  rect(`${key}Sp`, "Section/Spacer", { w: 10, h: 4, parent: `${key}Head`, fill: null, sizingH: "FILL" });
  if (hint) text(`${key}H`, hint, { size: 11, parent: `${key}Head`, name: "Section/Hint", family: LATIN, color: C.t3 });
  return `${key}Sec`;
}

function sliderRow(i, label, value, pct) {
  const k = `advSlider${i}`;
  frame(k, `Advanced/${label}`, { parent: "advBody", fill: null, layout: "VERTICAL", spacing: 8, sizingH: "FILL" });
  frame(`${k}Head`, `${label}/Head`, { parent: k, fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "FILL" });
  text(`${k}L`, label, { size: 12, parent: `${k}Head`, name: "Slider/Label", family: LATIN, color: C.t2 });
  rect(`${k}Sp`, "Slider/Spacer", { w: 10, h: 4, parent: `${k}Head`, fill: null, sizingH: "FILL" });
  text(`${k}V`, value, { size: 12, weight: 600, parent: `${k}Head`, name: "Slider/Value", family: LATIN, color: C.t1 });
  const trackW = 316;
  frame(`${k}Track`, `${label}/Track`, { w: trackW, h: 4, parent: k, fill: C.surfaceHi, clips: false, sizingH: "FIXED", sizingV: "FIXED", radius: RAD.pill });
  rect(`${k}Fill`, `${label}/Fill`, { w: Math.round(trackW * pct), h: 4, x: 0, y: 0, parent: `${k}Track`, fill: C.primary, radius: RAD.pill });
  ellipse(`${k}Knob`, `${label}/Knob`, { w: 12, h: 12, x: Math.round(trackW * pct) - 6, y: -4, fill: C.t1, parent: `${k}Track` });
}

function buildControls() {
  frame("controls", "Controls", { w: L.controlsW, parent: "work", fill: null, layout: "VERTICAL", spacing: 18, sizingH: "FIXED", sizingV: "FILL" });

  /* 1 - prompt card */
  frame("promptCard", "Prompt Card", { parent: "controls", fill: C.surface, layout: "VERTICAL", spacing: 10, pad: 16, radius: RAD.lg, stroke: C.border, sizingH: "FILL" });
  frame("promptHead", "Prompt/Head", { parent: "promptCard", fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "FILL" });
  text("promptL", "Prompt", { size: 12, weight: 500, parent: "promptHead", name: "Prompt/Label", family: LATIN, color: C.t2 });
  rect("promptSp", "Prompt/Spacer", { w: 10, h: 4, parent: "promptHead", fill: null, sizingH: "FILL" });
  text("promptCount", `${PROMPT.length} / 1000`, { size: 11, parent: "promptHead", name: "Prompt/Counter", family: LATIN, color: C.t3 });
  instance("promptArea", "cTextarea", "promptCard");
  op("set-layout-sizing", { id: "$promptArea", horizontal: "FILL", vertical: "FIXED" });

  /* 2 - aspect ratio chips */
  sectionLabel("ar", "Aspect Ratio", null);
  frame("arRow", "AspectRatio/Chips", { parent: "arSec", fill: null, layout: "HORIZONTAL", spacing: 8, sizingH: "FILL" });
  [["1:1", true], ["4:5", false], ["16:9", false]].forEach(([label, active], i) => {
    const k = `arChip${i}`;
    instance(k, active ? "cChipA" : "cChip", "arRow");
    ovr(k, "Chip/Label", "set-text-content", { characters: label });
  });

  /* 3 - image size select */
  sectionLabel("sz", "Image Size", "px");
  instance("szSelect", "cSelect", "szSec");
  op("set-layout-sizing", { id: "$szSelect", horizontal: "FILL", vertical: "FIXED" });

  /* 4 - style chips */
  sectionLabel("st", "Style", null);
  frame("stRow", "Style/Chips", { parent: "stSec", fill: null, layout: "HORIZONTAL", spacing: 6, sizingH: "FILL" });
  [["Cinematic", true], ["Editorial", false], ["Minimal", false], ["Photography", false]].forEach(([label, active], i) => {
    const k = `stChip${i}`;
    instance(k, active ? "cChipA" : "cChip", "stRow");
    ovr(k, "Chip/Label", "set-text-content", { characters: label });
  });

  /* 5 - advanced sliders */
  frame("advCard", "Advanced Card", { parent: "controls", fill: C.surface, layout: "VERTICAL", spacing: 14, pad: 16, radius: RAD.lg, stroke: C.border, sizingH: "FILL" });
  frame("advHead", "Advanced/Head", { parent: "advCard", fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "FILL" });
  text("advL", "Advanced", { size: 12, weight: 500, parent: "advHead", name: "Advanced/Label", family: LATIN, color: C.t2 });
  rect("advSp", "Advanced/Spacer", { w: 10, h: 4, parent: "advHead", fill: null, sizingH: "FILL" });
  frame("advBody", "Advanced/Body", { parent: "advCard", fill: null, layout: "VERTICAL", spacing: 14, sizingH: "FILL" });
  sliderRow(0, "Steps", "32", 0.6);
  sliderRow(1, "Guidance", "7.5", 0.45);
  sliderRow(2, "Seed", "42", 0.32);

  /* 6 - generate */
  instance("genBtn", "cBtnP", "controls");
  op("set-layout-sizing", { id: "$genBtn", horizontal: "FILL", vertical: "FIXED" });
  op("set-effects", { id: "$genBtn", shadow: SHADOW_GLOW });

  flush("controls");
  applyOverrides("controls");
}

/* ================================================================== */
/* stage 5 - preview column                                            */
/* ================================================================== */

function historyThumb(i, bg, accent, timeLabel) {
  const k = `hist${i}`;
  frame(k, `History/Item ${i + 1}`, { w: 168, parent: "histRow", fill: null, layout: "VERTICAL", spacing: 6, sizingH: "FIXED" });
  frame(`${k}Art`, `History/Thumb ${i + 1}`, { w: 168, h: 78, parent: k, fill: bg, clips: true, radius: RAD.md, sizingH: "FIXED", sizingV: "FIXED" });
  ellipse(`${k}Glow`, `History/Orb ${i + 1}`, { w: 74, h: 74, x: 92 + (i % 2) * 14, y: -18 - (i % 2) * 10, fill: accent, parent: `${k}Art` });
  op("set-opacity", { id: P(`${k}Glow`), opacity: 0.55 });
  rect(`${k}Horizon`, `History/Horizon ${i + 1}`, { w: 168, h: 30, x: 0, y: 56, parent: `${k}Art`, fill: C.bgPage, opacity: 0.72 });
  ellipse(`${k}Sun`, `History/Sun ${i + 1}`, { w: 16, h: 16, x: 26 + i * 10, y: 34, fill: accent, parent: `${k}Art` });
  op("set-opacity", { id: P(`${k}Sun`), opacity: 0.9 });
  text(`${k}T`, timeLabel, { size: 10, parent: k, name: "History/Time", family: LATIN, color: C.t3, width: 168, align: "left" });
}

function buildPreview() {
  frame("preview", "Preview", { parent: "work", fill: null, layout: "VERTICAL", spacing: 16, sizingH: "FILL", sizingV: "FILL" });

  /* canvas card - plain frame, absolute art composition */
  frame("canvas", "Preview/Canvas", { w: L.previewW, h: 558, parent: "preview", fill: "#12151C", clips: true, radius: RAD.lg, stroke: C.border, shadow: SHADOW_CARD, sizingH: "FIXED", sizingV: "FIXED" });

  /* aurora field - native ellipses, restrained opacity */
  ellipse("aurA", "Art/Orb Violet", { w: 420, h: 420, x: 440, y: -130, fill: C.violet, parent: "canvas" });
  op("set-opacity", { id: P("aurA"), opacity: 0.26 });
  ellipse("aurB", "Art/Orb Indigo", { w: 380, h: 380, x: -110, y: 320, fill: C.primary, parent: "canvas" });
  op("set-opacity", { id: P("aurB"), opacity: 0.18 });
  ellipse("aurC", "Art/Orb Sky", { w: 300, h: 300, x: 270, y: 190, fill: C.sky, parent: "canvas" });
  op("set-opacity", { id: P("aurC"), opacity: 0.14 });

  /* focal ring + sparkle = the "generated subject" placeholder */
  ellipse("ring", "Art/Ring", { w: 340, h: 340, x: 206, y: 109, stroke: C.border, strokeW: 1.2, parent: "canvas" });
  ellipse("ring2", "Art/Ring Inner", { w: 220, h: 220, x: 266, y: 169, stroke: "#31394A", strokeW: 1, parent: "canvas" });
  frame("sparkle", "Art/Sparkle", { w: 36, h: 36, x: 358, y: 261, parent: "canvas", fill: null, clips: false });
  icon("sparkleV", "Art/Sparkle Glyph", "sparkle", { x: 6, y: 6, w: 24, color: C.white, parent: "sparkle" });
  op("set-opacity", { id: P("sparkleV"), opacity: 0.92 });

  /* tabs overlay (top-left) */
  frame("tabsRow", "Preview/Tabs", { x: 16, y: 16, parent: "canvas", fill: null, layout: "HORIZONTAL", spacing: 4, pad: 4, radius: RAD.md });
  op("set-fill", { id: P("tabsRow"), color: { hex: C.bgPage, opacity: 0.7 } });
  op("set-stroke", { id: P("tabsRow"), color: { hex: C.border }, width: 1 });
  instance("tabA", "cTabA", "tabsRow");
  instance("tabB", "cTab", "tabsRow");
  ovr("tabB", "Tab/Label", "set-text-content", { characters: "Variations" });

  /* meta pill (bottom center) */
  frame("metaPill", "Preview/Meta", { w: 264, h: 30, x: round((L.previewW - 264) / 2), y: 512, parent: "canvas", fill: C.bgPage, layout: "HORIZONTAL", spacing: 6, counterAlign: "center", primaryAlign: "center", radius: RAD.pill, stroke: C.border });
  text("metaT", "Seed 42 \u00b7 Steps 32 \u00b7 Guidance 7.5", { size: 11, parent: "metaPill", name: "Meta/Label", family: LATIN, color: C.t2, width: 240, align: "center" });

  /* toolbar */
  frame("toolbar", "Preview/Toolbar", { parent: "preview", fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "FILL" });
  instance("dlBtn", "cBtnS", "toolbar");
  ovr("dlBtn", "Btn/Label", "set-text-content", { characters: "Download" });
  ["Edit", "Variation", "Upscale"].forEach((label, i) => {
    const k = `ghost${i}`;
    instance(k, "cBtnG", "toolbar");
    ovr(k, "Btn/Label", "set-text-content", { characters: label });
  });
  rect("tbSp", "Toolbar/Spacer", { w: 10, h: 4, parent: "toolbar", fill: null, sizingH: "FILL" });
  text("tbMeta", "1024 \u00d7 1024 \u00b7 PNG", { size: 12, parent: "toolbar", name: "Toolbar/Format", family: LATIN, color: C.t3 });

  /* history */
  frame("histCard", "History Card", { parent: "preview", fill: C.surface, layout: "VERTICAL", spacing: 10, pad: 14, radius: RAD.lg, stroke: C.border, sizingH: "FILL" });
  frame("histHead", "History/Head", { parent: "histCard", fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "FILL" });
  text("histL", "Generation History", { size: 13, weight: 600, parent: "histHead", name: "History/Title", family: LATIN, color: C.t1 });
  rect("histSp", "History/Spacer", { w: 10, h: 4, parent: "histHead", fill: null, sizingH: "FILL" });
  text("histAll", "View all", { size: 12, weight: 500, parent: "histHead", name: "History/ViewAll", family: LATIN, color: "#9FB0FF" });
  frame("histRow", "History/Thumbs", { parent: "histCard", fill: null, layout: "HORIZONTAL", spacing: 10, sizingH: "FILL" });
  historyThumb(0, "#1A1F2B", C.violet, "12:04 \u00b7 Flux v2");
  historyThumb(1, "#16202C", C.sky, "11:37 \u00b7 Flux v2");
  historyThumb(2, "#201B2C", C.pink, "10:52 \u00b7 Flux v1");
  historyThumb(3, "#15211C", C.success, "09:18 \u00b7 Flux v1");

  flush("preview");
  applyOverrides("preview");
}

/* ================================================================== */
/* stage 3b - sidebar navigation + user area                           */
/* ================================================================== */

const NAV = [
  ["Create", "sparkle", true],
  ["Projects", "folder", false],
  ["Assets", "image", false],
  ["History", "clock", false],
  ["Settings", "sliders", false],
];

function buildSidebarNav() {
  // component-audit fix: tabs used an off-scale 8px radius; normalise to sm(6)
  op("set-corner-radius", { id: P("cTabA"), radius: RAD.sm });
  op("set-corner-radius", { id: P("cTab"), radius: RAD.sm });

  frame("navList", "Nav", { parent: "sidebar", fill: null, layout: "VERTICAL", spacing: 2, sizingH: "FILL" });
  NAV.forEach(([label, kind, active], i) => {
    const k = `nav${i}`;
    frame(k, `Nav Item / ${label}`, { h: 36, parent: "navList", fill: active ? C.primarySoft : null, layout: "HORIZONTAL", spacing: 10, padT: 0, padB: 0, padL: 10, padR: 10, counterAlign: "center", radius: RAD.sm, sizingH: "FILL", sizingV: "FIXED" });
    frame(`${k}Slot`, "Nav/Icon Slot", { w: 18, h: 18, parent: k, fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });
    icon(`${k}I`, "Nav/Icon", kind, { x: 2, y: 2, w: 14, color: active ? "#9FB0FF" : C.t3, parent: `${k}Slot` });
    text(`${k}T`, label, { size: 13, weight: active ? 600 : 500, parent: k, name: "Nav/Label", family: LATIN, color: active ? "#C3CFFF" : C.t2 });
  });

  rect("sideSp", "Sidebar/Spacer", { w: 10, h: 10, parent: "sidebar", fill: null, sizingH: "FILL", sizingV: "FILL" });

  frame("userCard", "Sidebar/User", { parent: "sidebar", fill: C.canvas, layout: "HORIZONTAL", spacing: 10, pad: 8, counterAlign: "center", radius: RAD.md, sizingH: "FILL" });
  instance("userAvatar", "cAvatar", "userCard");
  frame("userText", "User/Text", { parent: "userCard", fill: null, layout: "VERTICAL", spacing: 2, sizingH: "HUG" });
  text("userName", "Aria Chen", { size: 13, weight: 600, parent: "userText", name: "User/Name", family: LATIN, color: C.t1 });
  text("userOrg", "Acme Workspace", { size: 11, parent: "userText", name: "User/Workspace", family: LATIN, color: C.t3 });

  flush("sidebar nav");
}

/* ================================================================== */
/* stage 5b - polish: audit-driven in-place fixes (no regeneration)    */
/* ================================================================== */

function buildPolish() {
  // 1. off-scale radius on the brand tile -> md(10)
  op("set-corner-radius", { id: P("brandMark"), radius: RAD.md });

  // 2. meta pill: normalise to its designed 264x30 and re-centre on the canvas
  op("resize-node", { id: P("metaPill"), width: 264, height: 30 });
  op("move-node", { id: P("metaPill"), x: round((L.previewW - 264) / 2), y: 512 });

  // 3. semantic instance names (layer hygiene; audit looks these up by name)
  const RENAMES = [
    ["headSearch", "Search"],
    ["headBell", "Notifications"],
    ["headAvatar", "User Avatar"],
    ["promptArea", "Prompt Editor"],
    ["szSelect", "Image Size Select"],
    ["arChip0", "Chip 1:1"], ["arChip1", "Chip 4:5"], ["arChip2", "Chip 16:9"],
    ["stChip0", "Chip Cinematic"], ["stChip1", "Chip Editorial"],
    ["stChip2", "Chip Minimal"], ["stChip3", "Chip Photography"],
    ["genBtn", "Generate"],
    ["dlBtn", "Download"],
    ["ghost0", "Edit"], ["ghost1", "Variation"], ["ghost2", "Upscale"],
    ["tabA", "Tab Latest"], ["tabB", "Tab Variations"],
    ["userAvatar", "Sidebar User Avatar"],
  ];
  for (const [key, name] of RENAMES) op("set-name", { id: P(key), name });

  flush("polish");
}

/* ================================================================== */
/* stage 6 - read the canvas back                                      */
/* ================================================================== */

function walk(node, depth, out) {
  out.push({ name: node.name, type: node.type, id: node.id, w: node.width, h: node.height, depth, layoutMode: node.layoutMode, childCount: node.childCount });
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
  "sidebar-nav": buildSidebarNav,
  controls: buildControls,
  preview: buildPreview,
  polish: buildPolish,
  dump,
};

function teardown() {
  const page = call([{ op: "get-page-summary", params: {} }])[0].data;
  const doomed = (page.nodes || []).filter((n) => /^(Design System \/ PixelFlow|PixelFlow AI)$/.test(n.name));
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
