#!/usr/bin/env node
/**
 * Stage 3 builder - "SED" SaaS education dashboard.
 * ==================================================================
 * Compiles the design system and the dashboard into batches of plugin ops
 * and ships them through  CLI -> bridge -> plugin -> Plugin API.
 *
 * Nothing here is a mock. Every node is a real Figma node, every batch comes
 * back with real node ids, and the closing stage reads the canvas back so the
 * result can be audited instead of assumed.
 *
 *   node tools/stage3-build.js                    run every stage that is not done
 *   node tools/stage3-build.js --stage kpi        run one stage
 *   node tools/stage3-build.js --stage all --force
 *   node tools/stage3-build.js --teardown         delete both roots + clear state
 * ==================================================================
 */

"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const NODE = process.execPath;
const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "cli", "figma-vibe.js");
const STATE_FILE = path.join(ROOT, ".vibe", "stage3-state.json");
const FONT_FILE = path.join(ROOT, ".vibe", "stage3-font.json");
const TREE_FILE = path.join(ROOT, ".vibe", "stage3-tree.json");
const BATCH_FILE = path.join(ROOT, ".vibe", "stage3-batch.json");

const argv = process.argv.slice(2);
const hasFlag = (n) => argv.includes("--" + n);
const flagVal = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const RUN_STAGE = flagVal("stage", null);
const FORCE = hasFlag("force");

/* ================================================================== */
/* state + fonts                                                       */
/* ================================================================== */

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
/* design tokens                                                       */
/* ================================================================== */

const C = {
  bgPage: "#FFFFFF", canvas: "#F7F8FA", surface: "#FFFFFF", surfaceAlt: "#F4F6F9",
  border: "#E9ECF1", primary: "#2F6BFF", primarySoft: "#EDF2FF",
  success: "#12A150", successSoft: "#E8F7EF",
  warning: "#D98200", warningSoft: "#FFF4E1",
  danger: "#E5484D", dangerSoft: "#FDEDED",
  violet: "#7C5CFC", sky: "#0EA5E9",
  t1: "#111418", t2: "#5A6270", t3: "#8B93A1", white: "#FFFFFF",
};
const RAD = { sm: 6, md: 10, lg: 14, pill: 999 };
const SHADOW = { x: 0, y: 1, blur: 2, spread: 0, color: "#0B1B33", opacity: 0.06 };

const L = {
  dashX: 5200, dashY: 0, dsX: 4200, dsY: 0, dsW: 940,
  sidebarW: 220, headerH: 64, pad: 32, gap: 16,
  rootW: 1440, rootH: 900,
};
L.mainW = L.rootW - L.sidebarW;              // 1220
L.mainH = L.rootH - L.headerH;               // 836
L.contentW = L.mainW - L.pad * 2;            // 1156
const round = (n) => Math.round(n * 100) / 100;

/* ================================================================== */
/* batch recorder                                                      */
/* ================================================================== */

let OPS = [];
let MARKS = [];
let LOCAL = new Set();
let BATCH_NO = 0;

function op(name, params, key) {
  const step = { op: name, params };
  // `as` is what lets a later step in the SAME batch point at this node with
  // "$key" - and only a creation step can introduce a node, which is also why
  // only creation steps may be recorded in MARKS (flush() reads .created).
  const isCreate = /^(create|duplicate)-/.test(name);
  if (key) {
    if (isCreate) step.as = key;
    LOCAL.add(key);
  }
  OPS.push(step);
  // Record AFTER the push, so the index is the step's real position in OPS.
  // (Recording before the push made the first mark -1 and broke every batch.)
  if (key && isCreate) MARKS.push({ index: OPS.length - 1, key });
}

function makeParams(o) {
  const p = {};
  for (const k of Object.keys(o)) if (o[k] !== undefined) p[k] = o[k];
  return p;
}

/** Reference a node: batch-local if it was just created, else its real id. */
function P(key) { return LOCAL.has(key) ? "$" + key : id(key); }
function id(key) {
  const v = S[key];
  if (!v) throw new Error(`unknown node key "${key}" (build the earlier stage first)`);
  return v;
}

/** Synchronous sleep (no deps): blocks on a SharedArrayBuffer futex. */
function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// The plugin layer occasionally drops a call mid-batch ("Unable to establish
// connection to Figma after 10 seconds" - seen for real during the Stage 3
// probe, then gone on the next run). A build makes hundreds of calls, so one
// blip must not kill a half-built dashboard.
// Transport-level failures only: the command never reached the plugin, so
// re-sending it is safe.
//
// A TIMEOUT is deliberately NOT in this list. When the plugin picks a command
// up but does not answer in time, the batch may well have run to completion -
// `partial: []` there means "no information", not "no side effects". Retrying
// on a timeout re-ran the 365-op tokens batch and left THREE identical
// "Design System / SED" frames on the canvas (seen for real in Stage 3).
// Timeouts are surfaced to the operator instead.
const TRANSIENT = /Unable to establish connection|ECONNRESET|socket hang up|connection refused|EAI_AGAIN/i;

/**
 * Run one CLI invocation, retrying ONLY when it is safe to do so.
 *
 * Safety rule: a batch may only be re-run if the failure produced no side
 * effects at all, i.e. the plugin reported zero completed steps. If any step
 * already ran, re-running the same batch would create every node a second
 * time, so we fail loudly instead and let the operator re-run that stage
 * against the recorded state.
 */
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
      console.log(`  ! ${label}: NOT retrying - ${partial.length} step(s) already ran (${did}); re-running would duplicate nodes`);
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

/** One-off call that does not touch the key map. */
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
/*
 * A batch reference ("$key") only reaches a node that was created earlier in
 * the SAME batch - it cannot reach a *descendant* of that node. Component
 * instances are exactly that case: an instance of `cRow` is created in this
 * batch, but its "Cell/Name" text exists only as a child of the instance, so
 * there is nothing to point at yet.
 *
 * Those edits are therefore collected here and applied in a follow-up call,
 * after the instances are real on the canvas. Each path is resolved by node
 * NAME (segments split on ">"), which keeps the page code readable:
 *     ovr("row0", "Cell/Status>Status/Pill", "set-fill", { color: ... })
 *
 * The underlying capability (overriding text/colour inside a nested instance)
 * is not new - the Stage 3 probe verified it on the real canvas. Only the
 * addressing happens on this side, so no extra plugin op is needed.
 */
let OVR = [];

function ovr(rootKey, path, opName, params) {
  OVR.push({ rootKey, path: String(path || ""), op: opName, params: params || {} });
}

/** Walk down by child name; an empty path means the root node itself. */
function resolvePath(info, path) {
  let cur = info;
  for (const seg of path ? path.split(">") : []) {
    const kid = (cur.children || []).find((c) => c.name === seg);
    if (!kid) return null;
    cur = kid;
  }
  return cur;
}

/** Resolve every queued override and apply them in one batch. */
function applyOverrides(label, timeoutMs = 240000) {
  if (!OVR.length) return 0;
  const queued = OVR.length;
  const trees = new Map();
  const batch = [];
  const misses = [];
  for (const o of OVR) {
    // detail:true is REQUIRED here, not cosmetic: with detail:false nodeInfo
    // returns children as flat {id,name,type} and does not recurse at all
    // (depth is ignored), so a multi-segment path could never resolve.
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
  // create-frame defaults an omitted dimension to 900 - for an auto-layout
  // frame that would silently produce a 900px tall box, so any axis without
  // an explicit size hugs its content instead.
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
  // Unlike frame/rect, create-ellipse was not clearing the fill, so a
  // stroke-only icon circle kept Figma's default grey (#D9D9D9) and rendered
  // as a solid grey disc. Found by the Stage 3 audit.
  if (!o.fill) op("set-fill", { id: P(key), clear: true });
  if (o.stroke) op("set-stroke", { id: P(key), color: { hex: o.stroke }, width: o.strokeW || 1 });
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
  // A fill-only path (the chart area) must have no stroke, otherwise Figma's
  // default 1px black outline shows around the fill. The plugin clears it on
  // create; this op keeps the guarantee explicit in the batch.
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

/** A frame that becomes a COMPONENT: its key ends up holding the component id. */
const componentise = (key, name) => { op("create-component", { id: P(key), name }, key); return key; };

const instance = (key, compKey, parent) => {
  op("create-instance", makeParams({ componentId: P(compKey), parentId: parent ? P(parent) : undefined }), key);
  return key;
};

/* ================================================================== */
/* stage 1 - design system tokens                                      */
/* ================================================================== */

function swatch(parent, ri, ci, label, hex) {
  const k = `sw_${ri}_${ci}`;
  frame(k, `Color/${label}`, { w: 132, parent, fill: null, layout: "VERTICAL", spacing: 5, sizingH: "FIXED" });
  rect(`${k}_c`, `Color/${label} Swatch`, { w: 132, h: 40, parent: k, fill: hex, radius: RAD.sm, stroke: C.border });
  text(`${k}_n`, label, { size: 11, parent: k, name: "Color/Name", color: C.t1, family: LATIN });
  text(`${k}_x`, hex, { size: 10, parent: k, name: "Color/Hex", color: C.t3, family: LATIN });
}

function buildTokens() {
  frame("dsRoot", "Design System / SED", { w: L.dsW, h: 1240, x: L.dsX, y: L.dsY, fill: C.bgPage });
  op("set-auto-layout", { id: P("dsRoot"), mode: "VERTICAL", spacing: 28, padding: 32 });
  op("set-layout-sizing", { id: P("dsRoot"), horizontal: "FIXED", vertical: "FIXED" });

  text("dsTitle", "SED \u00b7 Design System", { size: 24, weight: 600, parent: "dsRoot", name: "DS/Title" });
  text("dsSub", "\u6559\u80b2\u540e\u53f0\u8bbe\u8ba1\u7cfb\u7edf v1.0 \u00b7 11 \u8272 \u00b7 7 \u7ea7\u5b57\u53f7 \u00b7 4 \u7ea7\u5706\u89d2 \u00b7 4/8pt \u95f4\u8ddd", {
    size: 13, parent: "dsRoot", name: "DS/Subtitle", color: C.t3,
  });

  /* 01 colour */
  frame("dsColors", "DS/Color", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsColorsL", "01 / Color", { size: 11, weight: 500, parent: "dsColors", name: "DS/Label", color: C.t3, family: LATIN });
  const palette = [
    ["Background", C.bgPage], ["Surface", C.surface], ["Surface Alt", C.surfaceAlt], ["Border", C.border],
    ["Primary", C.primary], ["Success", C.success], ["Warning", C.warning], ["Danger", C.danger],
    ["Text Primary", C.t1], ["Text Secondary", C.t2], ["Text Muted", C.t3],
  ];
  [palette.slice(0, 6), palette.slice(6)].forEach((row, ri) => {
    const rk = `dsColorRow${ri}`;
    frame(rk, `DS/Color Row ${ri + 1}`, { w: 876, parent: "dsColors", fill: null, layout: "HORIZONTAL", spacing: 12, sizingH: "FIXED" });
    row.forEach(([label, hex], ci) => swatch(rk, ri, ci, label, hex));
  });

  /* 02 typography */
  frame("dsType", "DS/Typography", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsTypeL", "02 / Typography", { size: 11, weight: 500, parent: "dsType", name: "DS/Label", color: C.t3, family: LATIN });
  [
    ["Display", 30, 600], ["Number", 28, 600], ["Heading", 22, 600], ["Title", 16, 600],
    ["Section", 15, 600], ["Body", 13, 400], ["Caption", 12, 400],
  ].forEach(([label, size, weight], i) => {
    const k = `ty${i}`;
    frame(k, `Type/${label}`, { w: 876, parent: "dsType", fill: null, layout: "HORIZONTAL", spacing: 16, counterAlign: "center", sizingH: "FIXED" });
    text(`${k}_m`, `${label} \u00b7 ${size}`, { size: 11, parent: k, name: "Type/Meta", color: C.t3, family: LATIN, width: 110 });
    const sample = label === "Number" ? "12,842" : "\u6559\u80b2\u6570\u636e\u6982\u89c8";
    text(`${k}_s`, sample, {
      size, weight, parent: k, name: "Type/Sample", color: C.t1,
      family: label === "Number" ? LATIN : undefined,
    });
  });

  /* 03 radius */
  frame("dsRadius", "DS/Radius", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsRadiusL", "03 / Radius", { size: 11, weight: 500, parent: "dsRadius", name: "DS/Label", color: C.t3, family: LATIN });
  frame("dsRadiusRow", "DS/Radius Row", { w: 876, parent: "dsRadius", fill: null, layout: "HORIZONTAL", spacing: 16 });
  [["sm", RAD.sm], ["md", RAD.md], ["lg", RAD.lg], ["pill", 12]].forEach(([label, r], i) => {
    const k = `rad${i}`;
    frame(k, `Radius/${label}`, { w: 120, parent: "dsRadiusRow", fill: null, layout: "VERTICAL", spacing: 6, sizingH: "FIXED" });
    rect(`${k}_r`, `Radius/${label} Shape`, { w: 120, h: 44, parent: k, fill: C.primarySoft, radius: r });
    text(`${k}_t`, `${label} \u00b7 ${r}px`, { size: 11, parent: k, name: "Radius/Label", color: C.t2, family: LATIN });
  });

  /* 04 spacing */
  frame("dsSpace", "DS/Spacing", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 12, sizingH: "FIXED" });
  text("dsSpaceL", "04 / Spacing \u00b7 4 / 8 pt", { size: 11, weight: 500, parent: "dsSpace", name: "DS/Label", color: C.t3, family: LATIN });
  frame("dsSpaceRow", "DS/Spacing Row", { w: 876, parent: "dsSpace", fill: null, layout: "HORIZONTAL", spacing: 16, counterAlign: "center" });
  [4, 8, 12, 16, 20, 24, 32].forEach((v, i) => {
    const k = `sp${i}`;
    frame(k, `Spacing/${v}`, { w: 60, parent: "dsSpaceRow", fill: null, layout: "VERTICAL", spacing: 6, sizingH: "FIXED" });
    rect(`${k}_b`, `Spacing/${v} Bar`, { w: v, h: 16, parent: k, fill: C.primary, radius: 2 });
    text(`${k}_t`, `${v}px`, { size: 10, parent: k, name: "Spacing/Label", color: C.t2, family: LATIN });
  });

  frame("dsComp", "DS/Components", { w: 876, parent: "dsRoot", fill: null, layout: "VERTICAL", spacing: 20, sizingH: "FIXED" });
  text("dsCompL", "05 / Components", { size: 11, weight: 500, parent: "dsComp", name: "DS/Label", color: C.t3, family: LATIN });

  flush("design system / tokens");
}

/* ================================================================== */
/* stage 2 - components                                                */
/* ================================================================== */

/** A soft pill: returns the pill key. */
function pill(key, name, parent, o) {
  frame(key, name, { w: 10, parent, fill: null, layout: "HORIZONTAL", spacing: 0, padT: o.padY, padB: o.padY, padL: o.padX, padR: o.padX, counterAlign: "center", sizingH: "HUG", sizingV: "HUG", radius: o.radius });
  op("set-fill", { id: P(key), color: { hex: o.bg } });
  return key;
}

function buildComponents() {
  /* Button/Primary */
  frame("cBtnPrimary", "Button/Primary", { w: 10, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 6, padT: 9, padB: 9, padL: 16, padR: 16, counterAlign: "center", sizingH: "HUG", sizingV: "HUG", radius: RAD.sm });
  op("set-fill", { id: P("cBtnPrimary"), color: { hex: C.primary } });
  text("cBtnPrimaryT", "\u65b0\u5efa\u8003\u8bd5", { size: 13, weight: 500, parent: "cBtnPrimary", name: "Button/Label", color: C.white });

  /* Button/Secondary */
  frame("cBtnSecondary", "Button/Secondary", { w: 10, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 6, padT: 8, padB: 8, padL: 15, padR: 15, counterAlign: "center", sizingH: "HUG", sizingV: "HUG", radius: RAD.sm });
  op("set-stroke", { id: P("cBtnSecondary"), color: { hex: C.border }, width: 1 });
  text("cBtnSecondaryT", "\u5bfc\u51fa\u62a5\u8868", { size: 13, weight: 500, parent: "cBtnSecondary", name: "Button/Label", color: C.t1 });

  /* Button/Ghost */
  frame("cBtnGhost", "Button/Ghost", { w: 10, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 4, padT: 6, padB: 6, padL: 10, padR: 10, counterAlign: "center", sizingH: "HUG", sizingV: "HUG", radius: RAD.sm });
  text("cBtnGhostT", "\u67e5\u770b\u5168\u90e8", { size: 12, weight: 500, parent: "cBtnGhost", name: "Button/Label", color: C.primary });

  /* Badge */
  pill("cBadge", "Badge", "dsComp", { padX: 8, padY: 3, radius: RAD.sm, bg: C.successSoft });
  text("cBadgeT", "\u5df2\u5b8c\u6210", { size: 11, weight: 500, parent: "cBadge", name: "Badge/Label", color: C.success });

  /* Avatar */
  frame("cAvatar", "Avatar", { w: 36, h: 36, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 0, counterAlign: "center", primaryAlign: "center", sizingH: "FIXED", sizingV: "FIXED", radius: RAD.pill });
  op("set-fill", { id: P("cAvatar"), color: { hex: C.primarySoft } });
  text("cAvatarT", "\u9648", { size: 13, weight: 600, parent: "cAvatar", name: "Avatar/Initial", color: C.primary });

  /* KPI Card */
  frame("cKpi", "KPI Card", { w: 274, parent: "dsComp", fill: null, layout: "VERTICAL", spacing: 7, pad: 16, sizingH: "FIXED", sizingV: "HUG", radius: RAD.md, stroke: C.border, shadow: SHADOW });
  text("cKpiL", "\u7d2f\u8ba1\u5b66\u751f", { size: 12, parent: "cKpi", name: "KPI/Label", color: C.t2 });
  text("cKpiV", "12,842", { size: 28, weight: 600, parent: "cKpi", name: "KPI/Value", family: LATIN, color: C.t1 });
  frame("cKpiDelta", "KPI/Delta", { w: 242, parent: "cKpi", fill: null, layout: "HORIZONTAL", spacing: 6, counterAlign: "center" });
  pill("cKpiPill", "KPI/DeltaPill", "cKpiDelta", { padX: 6, padY: 3, radius: RAD.pill, bg: C.successSoft });
  // The placeholder is deliberately CJK: the per-card override writes "+4 \u573a"
  // into this node, and a Latin-only font would render the unit as a tofu box.
  // Setting the family here makes every delta value safe.
  text("cKpiPillT", "+0 \u573a", { size: 11, weight: 600, parent: "cKpiPill", name: "KPI/DeltaValue", color: C.success });
  text("cKpiCap", "\u8f83\u4e0a\u6708", { size: 11, parent: "cKpiDelta", name: "KPI/DeltaCaption", color: C.t3 });

  /* Table Row - columns 236 / 100 / 96 / 96 / 124 = 652 (+24 padding = 676) */
  frame("cRow", "Table Row", { w: 676, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 0, padT: 0, padB: 0, padL: 12, padR: 12, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  text("cRowName", "\u9ad8\u4e8c\u6570\u5b66\u671f\u4e2d\u6d4b\u8bc4", { size: 13, weight: 500, parent: "cRow", name: "Cell/Name", color: C.t1, width: 236 });
  text("cRowPpl", "1,248", { size: 13, parent: "cRow", name: "Cell/Participants", color: C.t2, family: LATIN, width: 100, align: "right" });
  text("cRowAvg", "87.6", { size: 13, weight: 600, parent: "cRow", name: "Cell/Avg", family: LATIN, color: C.t1, width: 96, align: "right" });
  text("cRowPass", "94.2%", { size: 13, parent: "cRow", name: "Cell/Pass", color: C.t2, family: LATIN, width: 96, align: "right" });
  frame("cRowStatus", "Cell/Status", { w: 124, parent: "cRow", fill: null, layout: "HORIZONTAL", spacing: 0, sizingH: "FIXED", sizingV: "FIXED" });
  pill("cRowPill", "Status/Pill", "cRowStatus", { padX: 8, padY: 3, radius: RAD.sm, bg: C.successSoft });
  text("cRowPillT", "\u5df2\u5b8c\u6210", { size: 11, weight: 500, parent: "cRowPill", name: "Status/Label", color: C.success });

  /* Todo Item */
  frame("cTodo", "Todo Item", { w: 364, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 12, padT: 0, padB: 0, padL: 0, padR: 0, primaryAlign: "space-between", counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  frame("cTodoLeft", "Todo/Left", { w: 10, parent: "cTodo", fill: null, layout: "HORIZONTAL", spacing: 10, counterAlign: "center", sizingH: "HUG", sizingV: "HUG" });
  ellipse("cTodoDot", "Todo/Dot", { w: 8, h: 8, parent: "cTodoLeft", fill: C.warning });
  frame("cTodoText", "Todo/Text", { w: 10, parent: "cTodoLeft", fill: null, layout: "VERTICAL", spacing: 3, sizingH: "HUG", sizingV: "HUG" });
  text("cTodoTitle", "\u5f85\u6279\u6539\u8bd5\u5377", { size: 13, weight: 600, parent: "cTodoText", name: "Todo/Title", color: C.t1 });
  text("cTodoSub", "\u9ad8\u4e8c\u6570\u5b66\u671f\u4e2d\u6d4b\u8bc4 \u7b49 3 \u573a", { size: 12, parent: "cTodoText", name: "Todo/Subtitle", color: C.t3 });
  pill("cTodoCount", "Todo/Count", "cTodo", { padX: 8, padY: 3, radius: RAD.pill, bg: C.warningSoft });
  text("cTodoCountT", "3", { size: 11, weight: 600, parent: "cTodoCount", name: "Todo/CountLabel", family: LATIN, color: C.warning });

  /* Nav Item - documented pattern (the 7 live rows carry distinct icons) */
  [["cNav", false], ["cNavActive", true]].forEach(([k, active]) => {
    frame(k, active ? "Nav Item / Active" : "Nav Item", { w: 192, h: 36, parent: "dsComp", fill: null, layout: "HORIZONTAL", spacing: 10, padT: 0, padB: 0, padL: 10, padR: 10, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED", radius: RAD.sm });
    if (active) op("set-fill", { id: P(k), color: { hex: C.primarySoft } });
    frame(`${k}Slot`, "Nav/Icon Slot", { w: 18, h: 18, parent: k, fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });
    rect(`${k}SlotR`, "Nav/Icon Mark", { w: 10, h: 10, x: 4, y: 4, parent: `${k}Slot`, fill: active ? C.primary : C.t2, radius: 3 });
    text(`${k}T`, active ? "\u6210\u7ee9\u5206\u6790" : "\u5b66\u751f\u7ba1\u7406", {
      size: 13, weight: active ? 600 : 500, parent: k, name: "Nav/Label", color: active ? C.primary : C.t2,
    });
  });

  componentise("cBtnPrimary", "Button/Primary");
  componentise("cBtnSecondary", "Button/Secondary");
  componentise("cBtnGhost", "Button/Ghost");
  componentise("cBadge", "Badge");
  componentise("cAvatar", "Avatar");
  componentise("cKpi", "KPI Card");
  componentise("cRow", "Table Row");
  componentise("cTodo", "Todo Item");
  componentise("cNav", "Nav Item");
  componentise("cNavActive", "Nav Item / Active");

  flush("components");
}

/* ================================================================== */
/* stage 3 - page shell: root / sidebar / header / main                */
/* ================================================================== */

function buildShell() {
  frame("root", "SaaS Education Dashboard", { w: L.rootW, h: L.rootH, x: L.dashX, y: L.dashY, fill: C.bgPage });
  frame("sidebar", "Sidebar", { w: L.sidebarW, h: L.rootH, x: 0, y: 0, parent: "root", fill: C.surface, layout: "VERTICAL", spacing: 0, pad: 14, primaryAlign: "space-between", sizingH: "FIXED", sizingV: "FIXED" });
  frame("header", "Header", { w: L.mainW, h: L.headerH, x: L.sidebarW, y: 0, parent: "root", fill: C.surface, layout: "VERTICAL", spacing: 0, pad: 0, sizingH: "FIXED", sizingV: "FIXED" });
  frame("main", "Main", { w: L.mainW, h: L.mainH, x: L.sidebarW, y: L.headerH, parent: "root", fill: C.canvas, clips: false });
  flush("page shell");
}

/* ================================================================== */
/* stage 4 - sidebar                                                   */
/* ================================================================== */

function navIcon(parentKey, kind, color) {
  const k = `${parentKey}_ic`;
  frame(k, `${kind} Icon`, { w: 18, h: 18, parent: parentKey, fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });
  const S_ = { stroke: color, strokeW: 1.5, cap: "ROUND", join: "ROUND" };
  switch (kind) {
    case "home":
      vector(`${k}_v`, "Icon/Home", { ...S_, data: "M 2.6 8.2 L 9 2.8 L 15.4 8.2 L 15.4 15.2 L 2.6 15.2 Z", parent: k });
      break;
    case "users":
      ellipse(`${k}_h1`, "Icon/Head 1", { w: 6, h: 6, x: 3.6, y: 3.4, parent: k, fill: null, stroke: color, strokeW: 1.5 });
      ellipse(`${k}_h2`, "Icon/Head 2", { w: 4.4, h: 4.4, x: 11.4, y: 5.2, parent: k, fill: null, stroke: color, strokeW: 1.4 });
      vector(`${k}_v`, "Icon/Body", { ...S_, data: "M 1.6 15.4 C 1.6 12 3.8 10.4 6.6 10.4 C 9.4 10.4 11.6 12 11.6 15.4", parent: k });
      break;
    case "clipboard":
      rect(`${k}_b`, "Icon/Board", { w: 11, h: 13, x: 3.5, y: 3.6, parent: k, fill: null, radius: 2.4, stroke: color, strokeW: 1.5 });
      rect(`${k}_c`, "Icon/Clip", { w: 5, h: 2, x: 6.5, y: 1.8, parent: k, fill: color, radius: 1 });
      rect(`${k}_l1`, "Icon/Line 1", { w: 6, h: 1.3, x: 6, y: 8.4, parent: k, fill: color, radius: 0.65 });
      rect(`${k}_l2`, "Icon/Line 2", { w: 6, h: 1.3, x: 6, y: 11.4, parent: k, fill: color, radius: 0.65 });
      break;
    case "bars":
      rect(`${k}_1`, "Icon/Bar 1", { w: 3.2, h: 5, x: 2.6, y: 10.4, parent: k, fill: color, radius: 1.6 });
      rect(`${k}_2`, "Icon/Bar 2", { w: 3.2, h: 8.4, x: 7.4, y: 7, parent: k, fill: color, radius: 1.6 });
      rect(`${k}_3`, "Icon/Bar 3", { w: 3.2, h: 11.6, x: 12.2, y: 3.8, parent: k, fill: color, radius: 1.6 });
      break;
    case "stack":
      [2.4, 7.4, 12.4].forEach((y, i) => {
        rect(`${k}_s${i}`, `Icon/Layer ${i + 1}`, { w: 13, h: 3, x: 2.5, y, parent: k, fill: color, radius: 1.5 });
      });
      break;
    case "line":
      vector(`${k}_v`, "Icon/Polyline", { ...S_, data: "M 2.2 13.8 L 6.4 8.8 L 10.2 11.2 L 15.8 4.6", parent: k });
      [[2.2, 13.8], [10.2, 11.2], [15.8, 4.6]].forEach(([x, y], i) => {
        ellipse(`${k}_d${i}`, `Icon/Point ${i + 1}`, { w: 2.6, h: 2.6, x: x - 1.3, y: y - 1.3, parent: k, fill: color });
      });
      break;
    case "sliders":
      rect(`${k}_r1`, "Icon/Track 1", { w: 13, h: 1.5, x: 2.5, y: 5.4, parent: k, fill: color, radius: 0.75 });
      rect(`${k}_r2`, "Icon/Track 2", { w: 13, h: 1.5, x: 2.5, y: 11.4, parent: k, fill: color, radius: 0.75 });
      ellipse(`${k}_k1`, "Icon/Knob 1", { w: 5, h: 5, x: 3.4, y: 3.6, parent: k, fill: color });
      ellipse(`${k}_k2`, "Icon/Knob 2", { w: 5, h: 5, x: 9.6, y: 9.6, parent: k, fill: color });
      break;
    default:
      break;
  }
  return k;
}

const NAV = [
  { label: "\u9996\u9875", kind: "home", active: true },
  { label: "\u5b66\u751f\u7ba1\u7406", kind: "users" },
  { label: "\u8003\u8bd5\u7ba1\u7406", kind: "clipboard" },
  { label: "\u6210\u7ee9\u5206\u6790", kind: "bars" },
  { label: "\u9898\u5e93", kind: "stack" },
  { label: "\u6570\u636e\u62a5\u8868", kind: "line" },
  { label: "\u8bbe\u7f6e", kind: "sliders" },
];

function buildSidebar() {
  frame("sbTop", "Sidebar/Top", { w: 192, parent: "sidebar", fill: null, layout: "VERTICAL", spacing: 20, sizingH: "FIXED" });
  frame("sbBrand", "Brand", { w: 192, h: 34, parent: "sbTop", fill: null, layout: "HORIZONTAL", spacing: 10, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED" });
  frame("sbLogo", "Logo", { w: 30, h: 30, parent: "sbBrand", fill: C.primary, layout: "HORIZONTAL", spacing: 0, counterAlign: "center", primaryAlign: "center", sizingH: "FIXED", sizingV: "FIXED", radius: RAD.md });
  vector("sbLogoMark", "Logo/Mark", { data: "M 1.5 6 L 10 1.8 L 18.5 6 L 10 10.2 Z", x: 6, y: 9, stroke: C.white, strokeW: 1.8, cap: "ROUND", join: "ROUND", parent: "sbLogo" });
  frame("sbBrandText", "Brand/Text", { w: 10, parent: "sbBrand", fill: null, layout: "VERTICAL", spacing: 0, sizingH: "HUG", sizingV: "HUG" });
  text("sbBrandName", "EduOS", { size: 15, weight: 600, parent: "sbBrandText", name: "Brand/Name", family: LATIN, color: C.t1 });
  text("sbBrandTag", "\u6559\u80b2\u7ba1\u7406\u4e91\u5e73\u53f0", { size: 11, parent: "sbBrandText", name: "Brand/Tagline", color: C.t3 });

  frame("sbNav", "Nav", { w: 192, parent: "sbTop", fill: null, layout: "VERTICAL", spacing: 2, sizingH: "FIXED" });
  NAV.forEach((item, i) => {
    const k = `nav${i}`;
    frame(k, `Nav Item / ${item.label}`, { w: 192, h: 36, parent: "sbNav", fill: null, layout: "HORIZONTAL", spacing: 10, padT: 0, padB: 0, padL: 10, padR: 10, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED", radius: RAD.sm });
    if (item.active) op("set-fill", { id: P(k), color: { hex: C.primarySoft } });
    navIcon(k, item.kind, item.active ? C.primary : C.t2);
    text(`${k}_t`, item.label, {
      size: 13, weight: item.active ? 600 : 500, parent: k, name: "Nav/Label",
      color: item.active ? C.primary : C.t2,
    });
  });

  frame("sbUser", "Sidebar/User", { w: 192, h: 52, parent: "sidebar", fill: C.surfaceAlt, layout: "HORIZONTAL", spacing: 10, pad: 8, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED", radius: RAD.md });
  instance("sbUserAvatar", "cAvatar", "sbUser");
  frame("sbUserText", "User/Text", { w: 10, parent: "sbUser", fill: null, layout: "VERTICAL", spacing: 2, sizingH: "HUG", sizingV: "HUG" });
  text("sbUserName", "\u9648\u6653\u96ef", { size: 13, weight: 600, parent: "sbUserText", name: "User/Name", color: C.t1 });
  text("sbUserOrg", "\u542f\u660e\u6559\u80b2\u96c6\u56e2", { size: 11, parent: "sbUserText", name: "User/Org", color: C.t3 });

  // avatar initial must read "\u9648" - it already does in the component, keep it there
  flush("sidebar");
}

/* ================================================================== */
/* stage 5 - header                                                    */
/* ================================================================== */

function buildHeader() {
  frame("hdRow", "Header/Row", { w: L.mainW, h: L.headerH - 1, parent: "header", fill: null, layout: "HORIZONTAL", spacing: 16, padT: 0, padB: 0, padL: 32, padR: 32, primaryAlign: "space-between", counterAlign: "center", sizingH: "FILL", sizingV: "FIXED" });
  rect("hdRule", "Header/Rule", { w: L.mainW, h: 1, parent: "header", fill: C.border, sizingH: "FILL" });

  frame("hdLeft", "Header/Left", { w: 10, parent: "hdRow", fill: null, layout: "HORIZONTAL", spacing: 10, counterAlign: "center", sizingH: "HUG", sizingV: "HUG" });
  text("hdTitle", "\u6559\u5b66\u6982\u89c8", { size: 16, weight: 600, parent: "hdLeft", name: "Page/Title", color: C.t1 });
  instance("hdChip", "cBadge", "hdLeft");
  op("set-fill", { id: "$hdChip", color: { hex: C.primarySoft } });
  ovr("hdChip", "Badge/Label", "set-text-content", { characters: "2026 \u6625\u5b63\u5b66\u671f" });
  ovr("hdChip", "Badge/Label", "set-text-color", { color: { hex: C.primary } });

  frame("hdRight", "Header/Right", { w: 10, parent: "hdRow", fill: null, layout: "HORIZONTAL", spacing: 10, counterAlign: "center", sizingH: "HUG", sizingV: "HUG" });

  frame("hdSearch", "Search", { w: 220, h: 34, parent: "hdRight", fill: C.surfaceAlt, layout: "HORIZONTAL", spacing: 8, padT: 0, padB: 0, padL: 10, padR: 10, counterAlign: "center", sizingH: "FIXED", sizingV: "FIXED", radius: RAD.sm, stroke: C.border });
  frame("hdSearchIcon", "Search/Icon", { w: 14, h: 14, parent: "hdSearch", fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });
  ellipse("hdSearchGlass", "Search/Glass", { w: 9, h: 9, x: 0.4, y: 0.4, parent: "hdSearchIcon", fill: null, stroke: C.t3, strokeW: 1.4 });
  vector("hdSearchHandle", "Search/Handle", { data: "M 9.2 9.2 L 13 13", stroke: C.t3, strokeW: 1.4, cap: "ROUND", parent: "hdSearchIcon" });
  text("hdSearchText", "\u641c\u7d22\u5b66\u751f\u3001\u8003\u8bd5\u6216\u9898\u76ee", { size: 12, parent: "hdSearch", name: "Search/Placeholder", color: C.t3 });

  frame("hdBell", "Icon Button / Notification", { w: 34, h: 34, parent: "hdRight", fill: C.surface, layout: "HORIZONTAL", spacing: 0, counterAlign: "center", primaryAlign: "center", sizingH: "FIXED", sizingV: "FIXED", radius: RAD.sm, stroke: C.border });
  vector("hdBellMark", "Bell", { data: "M 7.5 1.6 C 4.8 1.6 3.2 3.6 3.2 6.3 L 3.2 9.4 L 1.5 11.5 L 13.5 11.5 L 11.8 9.4 L 11.8 6.3 C 11.8 3.6 10.2 1.6 7.5 1.6 Z", x: 2, y: 2, stroke: C.t2, strokeW: 1.4, join: "ROUND", parent: "hdBell" });
  vector("hdBellClap", "Bell/Clapper", { data: "M 5.9 13.1 C 6.2 14.1 6.8 14.6 7.5 14.6 C 8.2 14.6 8.8 14.1 9.1 13.1", x: 2, y: 2, stroke: C.t2, strokeW: 1.4, cap: "ROUND", parent: "hdBell" });

  rect("hdDivider", "Header/Divider", { w: 1, h: 24, parent: "hdRight", fill: C.border });

  frame("hdUser", "Header/User", { w: 10, parent: "hdRight", fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "HUG", sizingV: "HUG" });
  instance("hdUserAvatar", "cAvatar", "hdUser");
  text("hdUserName", "\u7ba1\u7406\u5458", { size: 13, weight: 500, parent: "hdUser", name: "Header/User Name", color: C.t1 });
  vector("hdUserChevron", "Header/Chevron", { data: "M 1 1.4 L 5 5 L 9 1.4", stroke: C.t3, strokeW: 1.4, cap: "ROUND", join: "ROUND", parent: "hdUser" });

  flush("header");
  applyOverrides("header");
}

/* ================================================================== */
/* stage 6 - main content, part 1: welcome + KPI + analytics           */
/* ================================================================== */

function buildTop() {
  /* ---- Welcome ---- */
  frame("welcome", "Welcome", { w: L.contentW, x: L.pad, y: L.pad, parent: "main", fill: null, clips: false, layout: "HORIZONTAL", spacing: 16, primaryAlign: "space-between", counterAlign: "center", sizingH: "FIXED", sizingV: "HUG" });
  frame("welcomeText", "Welcome/Text", { w: 10, parent: "welcome", fill: null, layout: "VERTICAL", spacing: 4, sizingH: "HUG", sizingV: "HUG" });
  text("welcomeTitle", "\u65e9\u4e0a\u597d\uff0c\u7ba1\u7406\u5458", { size: 22, weight: 600, parent: "welcomeText", name: "Welcome/Title", color: C.t1 });
  text("welcomeSub", "\u8fd9\u91cc\u662f\u4eca\u5929\u7684\u6559\u5b66\u6570\u636e\u6982\u89c8\u3002", { size: 13, parent: "welcomeText", name: "Welcome/Subtitle", color: C.t2 });
  frame("welcomeActions", "Welcome/Actions", { w: 10, parent: "welcome", fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "HUG", sizingV: "HUG" });
  frame("welcomeDate", "Chip/Date", { w: 10, parent: "welcomeActions", fill: C.surface, layout: "HORIZONTAL", spacing: 0, padT: 6, padB: 6, padL: 10, padR: 10, counterAlign: "center", sizingH: "HUG", sizingV: "HUG", radius: RAD.sm, stroke: C.border });
  text("welcomeDateT", "2026\u5e749\u670814\u65e5 \u5468\u4e00", { size: 12, parent: "welcomeDate", name: "Chip/Date Label", color: C.t2 });
  instance("welcomeExport", "cBtnSecondary", "welcomeActions");
  instance("welcomeCreate", "cBtnPrimary", "welcomeActions");
  flush("welcome");

  /* ---- KPI section ---- */
  frame("kpiSection", "KPI Section", { w: L.contentW, parent: "main", fill: null, clips: false, layout: "HORIZONTAL", spacing: 20, counterAlign: "min", sizingH: "FIXED", sizingV: "HUG" });
  const KPIS = [
    { label: "\u7d2f\u8ba1\u5b66\u751f", value: "12,842", delta: "+8.2%", cap: "\u8f83\u4e0a\u6708", tone: C.success, bg: C.successSoft },
    { label: "\u4eca\u65e5\u8003\u8bd5", value: "24", delta: "+4 \u573a", cap: "\u8f83\u6628\u65e5", tone: C.success, bg: C.successSoft },
    { label: "\u5e73\u5747\u6210\u7ee9", value: "86.4", delta: "+1.6", cap: "\u8f83\u4e0a\u6708", tone: C.success, bg: C.successSoft },
    { label: "\u901a\u8fc7\u7387", value: "92.8%", delta: "-0.4%", cap: "\u8f83\u4e0a\u5468", tone: C.danger, bg: C.dangerSoft },
  ];
  KPIS.forEach((k, i) => {
    const key = `kpi${i}`;
    instance(key, "cKpi", "kpiSection");
    ovr(key, "KPI/Label", "set-text-content", { characters: k.label });
    ovr(key, "KPI/Value", "set-text-content", { characters: k.value });
    ovr(key, "KPI/Delta>KPI/DeltaPill>KPI/DeltaValue", "set-text-content", { characters: k.delta });
    ovr(key, "KPI/Delta>KPI/DeltaPill>KPI/DeltaValue", "set-text-color", { color: { hex: k.tone } });
    ovr(key, "KPI/Delta>KPI/DeltaPill", "set-fill", { color: { hex: k.bg } });
    ovr(key, "KPI/Delta>KPI/DeltaCaption", "set-text-content", { characters: k.cap });
  });
  flush("kpi section");
  applyOverrides("kpi section");

  /* ---- Analytics ---- */
  frame("analyticsSection", "Analytics Section", { w: L.contentW, parent: "main", fill: null, clips: false, layout: "HORIZONTAL", spacing: 20, counterAlign: "min", sizingH: "FIXED", sizingV: "HUG" });
  buildTrendCard();
  buildSubjectCard();
  flush("analytics section");
}

function buildTrendCard() {
  frame("trendCard", "Trend Chart", { w: 724, h: 204, parent: "analyticsSection", fill: C.surface, layout: "VERTICAL", spacing: 16, pad: 24, sizingH: "FIXED", sizingV: "FIXED", radius: RAD.lg, stroke: C.border, shadow: SHADOW, clips: false });
  frame("trendHead", "Card/Header", { w: 676, parent: "trendCard", fill: null, layout: "HORIZONTAL", spacing: 12, primaryAlign: "space-between", counterAlign: "center", sizingH: "FILL", sizingV: "HUG" });
  frame("trendHeadL", "Header/Left", { w: 10, parent: "trendHead", fill: null, layout: "VERTICAL", spacing: 2, sizingH: "HUG", sizingV: "HUG" });
  text("trendTitle", "\u5b66\u751f\u6210\u7ee9\u8d8b\u52bf", { size: 15, weight: 600, parent: "trendHeadL", name: "Chart/Title", color: C.t1 });
  text("trendSub", "\u8fd1 30 \u5929\u5e73\u5747\u6210\u7ee9\u53d8\u5316", { size: 12, parent: "trendHeadL", name: "Chart/Subtitle", color: C.t3 });
  frame("trendLegend", "Chart/Legend", { w: 10, parent: "trendHead", fill: null, layout: "HORIZONTAL", spacing: 6, counterAlign: "center", sizingH: "HUG", sizingV: "HUG" });
  ellipse("trendLegendDot", "Legend/Dot", { w: 8, h: 8, parent: "trendLegend", fill: C.primary });
  text("trendLegendT", "\u5e73\u5747\u6210\u7ee9", { size: 12, parent: "trendLegend", name: "Legend/Label", color: C.t2 });

  /* the chart itself: absolutely positioned real geometry inside a plain frame */
  frame("chart", "Chart/Plot", { w: 676, h: 104, parent: "trendCard", fill: null, clips: false, sizingH: "FIXED", sizingV: "FIXED" });
  const plotL = 34, plotR = 664, plotT = 10, plotB = 86;
  const vals = [86.2, 87.4, 86.8, 88.1, 87.6, 89.0, 88.3, 90.2, 89.5, 91.4, 90.6, 92.1];
  const vMin = 84, vMax = 93;
  const xAt = (i) => round(plotL + i * ((plotR - plotL) / (vals.length - 1)));
  const yAt = (v) => round(plotB - ((v - vMin) / (vMax - vMin)) * (plotB - plotT));
  const pts = vals.map((v, i) => [xAt(i), yAt(v)]);

  [84, 87, 90, 93].forEach((v, i) => {
    const y = yAt(v);
    rect(`grid${i}`, `Grid/Line ${v}`, { w: plotR - plotL, h: 1, x: plotL, y, parent: "chart", fill: i === 0 ? C.border : C.border });
    text(`gridLbl${i}`, String(v), { size: 10, parent: "chart", name: `Axis/Y ${v}`, color: C.t3, family: LATIN, x: 0, y: Math.max(0, y - 6), width: 28, align: "right" });
  });

  vector("trendArea", "Chart/Area", {
    points: [...pts, [plotR, plotB], [plotL, plotB]], closed: true,
    parent: "chart", fill: C.primary, fillOpacity: 0.07,
  });
  vector("trendLine", "Chart/Line", {
    points: pts, parent: "chart", stroke: C.primary, strokeW: 2, cap: "ROUND", join: "ROUND",
  });
  pts.forEach(([x, y], i) => {
    ellipse(`dot${i}`, `Chart/Point ${i + 1}`, { w: 6, h: 6, x: round(x - 3), y: round(y - 3), parent: "chart", fill: C.primary, stroke: C.white, strokeW: 1.5 });
  });
  ["8/15", "8/22", "8/29", "9/5", "9/12"].forEach((d, i) => {
    text(`xLbl${i}`, d, { size: 10, parent: "chart", name: `Axis/X ${d}`, color: C.t3, family: LATIN, x: round(16 + i * 142), y: 88, width: 36, align: "center" });
  });
}

function buildSubjectCard() {
  frame("subjectCard", "Subject Distribution", { w: 412, h: 204, parent: "analyticsSection", fill: C.surface, layout: "VERTICAL", spacing: 12, pad: 24, sizingH: "FIXED", sizingV: "FIXED", radius: RAD.lg, stroke: C.border, shadow: SHADOW, clips: false });
  frame("subjectHead", "Card/Header", { w: 364, parent: "subjectCard", fill: null, layout: "VERTICAL", spacing: 2, sizingH: "FILL", sizingV: "HUG" });
  text("subjectTitle", "\u5b66\u79d1\u5206\u5e03", { size: 15, weight: 600, parent: "subjectHead", name: "Chart/Title", color: C.t1 });
  text("subjectSub", "\u5404\u5b66\u79d1\u6d4b\u8bc4\u5360\u6bd4", { size: 12, parent: "subjectHead", name: "Chart/Subtitle", color: C.t3 });
  frame("subjectList", "Subject/List", { w: 364, parent: "subjectCard", fill: null, layout: "VERTICAL", spacing: 8, sizingH: "FILL", sizingV: "HUG" });
  const SUBJECTS = [
    ["\u6570\u5b66", 32, C.primary], ["\u8bed\u6587", 26, C.success],
    ["\u82f1\u8bed", 24, C.violet], ["\u79d1\u5b66", 18, C.sky],
  ];
  SUBJECTS.forEach(([name, pct, color], i) => {
    const k = `sub${i}`;
    frame(k, `Subject/${name}`, { w: 364, h: 20, parent: "subjectList", fill: null, layout: "HORIZONTAL", spacing: 12, counterAlign: "center", sizingH: "FILL", sizingV: "FIXED" });
    text(`${k}_n`, name, { size: 12, parent: k, name: "Subject/Name", color: C.t2, width: 52 });
    frame(`${k}_track`, "Subject/Track", { w: 220, h: 8, parent: k, fill: C.surfaceAlt, clips: false, sizingH: "FIXED", sizingV: "FIXED", radius: RAD.pill });
    rect(`${k}_bar`, "Subject/Bar", { w: round(pct * 2.2), h: 8, x: 0, y: 0, parent: `${k}_track`, fill: color, radius: RAD.pill });
    text(`${k}_v`, `${pct}%`, { size: 12, weight: 600, parent: k, name: "Subject/Value", color: C.t1, family: LATIN, width: 44, align: "right" });
  });
}

/* ================================================================== */
/* stage 7 - position the top sections, then measure them              */
/* ================================================================== */

function layoutTop() {
  const hWelcome = readNode(id("welcome"), 0).height;
  const hKpi = readNode(id("kpiSection"), 0).height;
  const hAnalytics = readNode(id("analyticsSection"), 0).height;
  let y = L.pad;
  const moves = [
    { id: id("welcome"), y },
    { id: id("kpiSection"), y: (y += hWelcome + L.gap) },
    { id: id("analyticsSection"), y: (y += hKpi + L.gap) },
  ];
  const bottomTop = Math.round(y + hAnalytics + L.gap);
  flush("position top sections", 60000);
  call(moves.map((m) => ({ op: "move-node", params: { id: m.id, x: L.pad, y: m.y } })));

  const bottomH = L.mainH - L.pad - bottomTop;
  const rowH = Math.floor((bottomH - (24 + 38 + L.gap + 34 + 1)) / 5);
  const itemH = Math.floor((bottomH - (24 + 24 + L.gap + 2)) / 3);
  S.__layout = { hWelcome, hKpi, hAnalytics, bottomTop, bottomH, rowH, itemH };
  saveState();
  console.log(`  layout: welcome=${hWelcome} kpi=${hKpi} analytics=${hAnalytics} -> bottomTop=${bottomTop} bottomH=${bottomH} rowH=${rowH} itemH=${itemH}`);
  if (rowH < 34 || itemH < 56) throw new Error(`layout budget too tight (rowH=${rowH}, itemH=${itemH}) - reduce a section above`);
}

/* ================================================================== */
/* stage 8 - bottom row: recent exams + TODO                           */
/* ================================================================== */

const EXAMS = [
  ["\u9ad8\u4e8c\u6570\u5b66\u671f\u4e2d\u6d4b\u8bc4", "1,248", "87.6", "94.2%", "\u5df2\u5b8c\u6210", "success"],
  ["\u4e5d\u5e74\u7ea7\u82f1\u8bed\u6708\u8003", "986", "84.1", "91.5%", "\u5df2\u5b8c\u6210", "success"],
  ["\u9ad8\u4e00\u7269\u7406\u5355\u5143\u6d4b", "742", "79.8", "86.3%", "\u8fdb\u884c\u4e2d", "primary"],
  ["\u516d\u5e74\u7ea7\u8bed\u6587\u7efc\u5408\u6d4b\u8bc4", "1,530", "88.9", "95.1%", "\u5df2\u5b8c\u6210", "success"],
  ["\u9ad8\u4e09\u5316\u5b66\u6a21\u62df\u8003", "618", "76.4", "81.7%", "\u5f85\u53d1\u5e03", "warning"],
];
const TONES = {
  success: { fg: C.success, bg: C.successSoft },
  primary: { fg: C.primary, bg: C.primarySoft },
  warning: { fg: C.warning, bg: C.warningSoft },
  danger: { fg: C.danger, bg: C.dangerSoft },
};

function buildBottom() {
  const { bottomTop, rowH, itemH, bottomH } = S.__layout;

  frame("exams", "Recent Exams", { w: 724, h: bottomH, x: L.pad, y: bottomTop, parent: "main", fill: C.surface, layout: "VERTICAL", spacing: L.gap, pad: 24, sizingH: "FIXED", sizingV: "FIXED", radius: RAD.lg, stroke: C.border, shadow: SHADOW, clips: false });
  frame("examsHead", "Card/Header", { w: 676, parent: "exams", fill: null, layout: "HORIZONTAL", spacing: 12, primaryAlign: "space-between", counterAlign: "center", sizingH: "FILL", sizingV: "HUG" });
  frame("examsHeadL", "Header/Left", { w: 10, parent: "examsHead", fill: null, layout: "VERTICAL", spacing: 2, sizingH: "HUG", sizingV: "HUG" });
  text("examsTitle", "\u6700\u8fd1\u8003\u8bd5", { size: 15, weight: 600, parent: "examsHeadL", name: "Card/Title", color: C.t1 });
  text("examsSub", "\u672c\u5468 24 \u573a\u8003\u8bd5 \u00b7 1 \u573a\u8fdb\u884c\u4e2d", { size: 12, parent: "examsHeadL", name: "Card/Subtitle", color: C.t3 });
  frame("examsHeadR", "Header/Right", { w: 10, parent: "examsHead", fill: null, layout: "HORIZONTAL", spacing: 8, counterAlign: "center", sizingH: "HUG", sizingV: "HUG" });
  instance("examsBadge", "cBadge", "examsHeadR");
  op("set-fill", { id: "$examsBadge", color: { hex: C.warningSoft } });
  ovr("examsBadge", "Badge/Label", "set-text-content", { characters: "5 \u573a\u5f85\u53d1\u5e03" });
  ovr("examsBadge", "Badge/Label", "set-text-color", { color: { hex: C.warning } });
  instance("examsGhost", "cBtnGhost", "examsHeadR");

  frame("table", "Table", { w: 676, parent: "exams", fill: null, layout: "VERTICAL", spacing: 0, sizingH: "FILL", sizingV: "HUG" });
  frame("tableHead", "Table/Header Row", { w: 676, h: 34, parent: "table", fill: null, layout: "HORIZONTAL", spacing: 0, padT: 0, padB: 0, padL: 12, padR: 12, counterAlign: "center", sizingH: "FILL", sizingV: "FIXED" });
  [["\u8003\u8bd5\u540d\u79f0", 236, "left"], ["\u53c2\u4e0e\u4eba\u6570", 100, "right"], ["\u5e73\u5747\u6210\u7ee9", 96, "right"], ["\u901a\u8fc7\u7387", 96, "right"], ["\u72b6\u6001", 124, "left"]].forEach(([label, w, align], i) => {
    text(`th${i}`, label, { size: 12, weight: 500, parent: "tableHead", name: `Table/Head ${label}`, color: C.t3, width: w, align });
  });
  rect("tableRule", "Table/Rule", { w: 676, h: 1, parent: "table", fill: C.border, sizingH: "FILL" });
  EXAMS.forEach(([name, ppl, avg, pass, status, tone], i) => {
    const key = `row${i}`;
    instance(key, "cRow", "table");
    op("resize-node", { id: `$${key}`, width: 676, height: rowH });
    ovr(key, "Cell/Name", "set-text-content", { characters: name });
    ovr(key, "Cell/Participants", "set-text-content", { characters: ppl });
    ovr(key, "Cell/Avg", "set-text-content", { characters: avg });
    ovr(key, "Cell/Pass", "set-text-content", { characters: pass });
    ovr(key, "Cell/Status>Status/Pill>Status/Label", "set-text-content", { characters: status });
    ovr(key, "Cell/Status>Status/Pill>Status/Label", "set-text-color", { color: { hex: TONES[tone].fg } });
    ovr(key, "Cell/Status>Status/Pill", "set-fill", { color: { hex: TONES[tone].bg } });
  });
  flush("recent exams");
  applyOverrides("recent exams");

  /* ---- TODO ---- */
  frame("todo", "Todo Section", { w: 412, h: bottomH, x: L.pad + 724 + 20, y: bottomTop, parent: "main", fill: C.surface, layout: "VERTICAL", spacing: L.gap, pad: 24, sizingH: "FIXED", sizingV: "FIXED", radius: RAD.lg, stroke: C.border, shadow: SHADOW, clips: false });
  frame("todoHead", "Card/Header", { w: 364, parent: "todo", fill: null, layout: "HORIZONTAL", spacing: 12, primaryAlign: "space-between", counterAlign: "center", sizingH: "FILL", sizingV: "HUG" });
  text("todoTitle", "\u5f85\u5904\u7406\u4e8b\u9879", { size: 15, weight: 600, parent: "todoHead", name: "Card/Title", color: C.t1 });
  instance("todoBadge", "cBadge", "todoHead");
  op("set-fill", { id: "$todoBadge", color: { hex: C.warningSoft } });
  ovr("todoBadge", "Badge/Label", "set-text-content", { characters: "10 \u9879" });
  ovr("todoBadge", "Badge/Label", "set-text-color", { color: { hex: C.warning } });

  frame("todoList", "Todo/List", { w: 364, parent: "todo", fill: null, layout: "VERTICAL", spacing: 0, primaryAlign: "center", sizingH: "FILL", sizingV: "FILL" });
  const TODOS = [
    ["\u5f85\u6279\u6539\u8bd5\u5377", "\u9ad8\u4e8c\u6570\u5b66\u671f\u4e2d\u6d4b\u8bc4 \u7b49 3 \u573a", "3", "warning"],
    ["\u5f02\u5e38\u6210\u7ee9", "\u4e5d\u5e74\u7ea7\u82f1\u8bed\u6708\u8003 2 \u6761\u5f02\u5e38\u8bb0\u5f55", "2", "danger"],
    ["\u5f85\u5ba1\u6838\u9898\u76ee", "\u9ad8\u4e00\u7269\u7406\u5355\u5143\u6d4b 5 \u9053\u5f85\u5ba1", "5", "primary"],
  ];
  TODOS.forEach(([title, sub, count, tone], i) => {
    if (i > 0) rect(`todoRule${i}`, "Todo/Divider", { w: 364, h: 1, parent: "todoList", fill: C.border, sizingH: "FILL" });
    const key = `todoRow${i}`;
    instance(key, "cTodo", "todoList");
    op("resize-node", { id: `$${key}`, width: 364, height: itemH });
    ovr(key, "Todo/Left>Todo/Text>Todo/Title", "set-text-content", { characters: title });
    ovr(key, "Todo/Left>Todo/Text>Todo/Subtitle", "set-text-content", { characters: sub });
    ovr(key, "Todo/Count>Todo/CountLabel", "set-text-content", { characters: count });
    ovr(key, "Todo/Count>Todo/CountLabel", "set-text-color", { color: { hex: TONES[tone].fg } });
    ovr(key, "Todo/Count", "set-fill", { color: { hex: TONES[tone].bg } });
    ovr(key, "Todo/Left>Todo/Dot", "set-fill", { color: { hex: TONES[tone].fg } });
  });
  flush("todo section");
  applyOverrides("todo section");
}

/* ================================================================== */
/* stage 9 - read the canvas back and summarise                        */
/* ================================================================== */

function walk(node, depth, out) {
  out.push({ name: node.name, type: node.type, id: node.id, w: node.width, h: node.height, depth, layoutMode: node.layoutMode, childCount: node.childCount });
  (node.children || []).forEach((c) => walk(c, depth + 1, out));
}

function dump() {
  // detail:true is what makes the read-back recurse at all - with detail:false
  // nodeInfo returns children as a flat {id,name,type} list and ignores depth,
  // so a shallow read would silently report "1 level" for the whole page.
  const tree = readNode(id("root"), 12, true);
  fs.writeFileSync(TREE_FILE, JSON.stringify(tree, null, 2));
  const flat = [];
  walk(tree, 0, flat);
  const byType = {};
  for (const n of flat) byType[n.type] = (byType[n.type] || 0) + 1;
  const autoLayout = flat.filter((n) => n.layoutMode && n.layoutMode !== "NONE").length;
  console.log(`  nodes=${flat.length} types=${JSON.stringify(byType)}`);
  console.log(`  auto-layout frames=${autoLayout}  max depth=${Math.max(...flat.map((n) => n.depth))}`);
  const ds = readNode(id("dsRoot"), 4, true);
  const comps = [];
  walk(ds, 0, comps);
  const names = comps.filter((n) => n.type === "COMPONENT").map((n) => n.name);
  console.log(`  components=${names.length}: ${names.join(", ")}`);
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
  sidebar: buildSidebar,
  header: buildHeader,
  top: buildTop,
  "layout-top": layoutTop,
  bottom: buildBottom,
  dump,
};

function teardown() {
  const page = call([{ op: "get-page-summary", params: {} }])[0].data;
  const doomed = (page.nodes || []).filter((n) => /^(Design System \/ SED|SaaS Education Dashboard)$/.test(n.name));
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
