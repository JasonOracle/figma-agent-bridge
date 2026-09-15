#!/usr/bin/env node
/**
 * Stage 3 probe - answers the two questions that must be settled BEFORE a
 * single pixel of the dashboard is built:
 *
 *   1. Which CJK font can actually be loaded? The whole UI is Chinese; with a
 *      Latin-only font every label would render as tofu boxes.
 *   2. Do the six newly added ops really work on a real canvas?
 *      (create-vector / set-effects / set-text-align / set-text-autoresize /
 *       set-layout-sizing / set-name + create-frame with a parent)
 *
 * Everything it creates is deleted again, so it leaves no trace on the canvas.
 * Touch nothing else: mock results, figma-context MCP and Write-to-Canvas are
 * all out of scope by design.
 */

"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const NODE = process.execPath;
const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "cli", "figma-vibe.js");
const OUT = path.join(ROOT, ".vibe", "stage3-font.json");

let passed = 0;
let failed = 0;
const notes = [];

function check(label, ok, detail) {
  if (ok) {
    passed++;
    console.log(`  \u2713 ${label}${detail ? "  " + detail : ""}`);
  } else {
    failed++;
    console.log(`  \u2717 ${label}${detail ? "  " + detail : ""}`);
  }
  return ok;
}

/**
 * Informational line: does NOT count as a failure. Used for probes whose
 * negative result is an environment fact (e.g. "this font family is not
 * installed here") rather than a broken capability. Only one of the CJK
 * candidates has to exist, so the misses are not defects.
 */
function info(label, detail) {
  console.log(`  \u00b7 ${label}${detail ? "  " + detail : ""}`);
}

function section(title) {
  console.log("\n" + title);
  console.log("-".repeat(title.length));
}

/** Run a batch through the real CLI -> bridge -> plugin path. */
function call(ops, timeoutMs = 40000) {
  const r = spawnSync(
    NODE,
    [CLI, "run", "--ops", JSON.stringify(ops), "--json", "--timeout", String(timeoutMs)],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }
  );
  const out = (r.stdout || "").trim();
  try {
    return JSON.parse(out);
  } catch (_) {
    return { ok: false, error: { code: "NO_JSON", message: (out || r.stderr || "").slice(0, 400) } };
  }
}

/** Pull step results out of a run payload, or throw the plugin's error. */
function steps(body) {
  if (!body || body.ok !== true) {
    const e = (body && body.error) || {};
    throw new Error(`${e.code || "ERROR"}: ${e.message || "unknown"}`);
  }
  return (body.data && body.data.ops) || [];
}

/* ------------------------------------------------------------------ */

const FONT_CANDIDATES = [
  "Noto Sans SC",
  "Noto Sans Simplified Chinese",
  "Source Han Sans SC",
  "Source Han Sans CN",
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "SimHei",
  "Inter",
];

const CJK_STYLE_CANDIDATES = ["Regular", "Medium", "Semi Bold", "Bold"];

async function main() {
  console.log("=".repeat(72));
  console.log("Stage 3 probe - fonts + the six new ops (REAL Figma plugin)");
  console.log("=".repeat(72));

  /* ---- 0. is the real plugin up? --------------------------------- */
  section("0. Plugin identity");
  let ping;
  try {
    ping = steps(call([{ op: "ping", params: {} }]))[0].data;
  } catch (e) {
    check("ping", false, e.message);
    console.log("\nThe plugin is offline - open Figma and run Vibe Bridge (Dev) first.");
    process.exit(1);
  }
  const realPlugin = ping.editorType === "figma" && ping.plugin !== "MOCK";
  check("real Figma plugin is answering", realPlugin,
    `${ping.plugin} | page "${ping.page}" | editorType=${ping.editorType} | documentAccess=${ping.documentAccess}`);
  if (!realPlugin) {
    console.log("Refusing to run: this must be the real plugin, not the mock.");
    process.exit(1);
  }

  /* ---- 1. CJK fonts ---------------------------------------------- */
  section("1. CJK font availability (this decides whether the UI is readable)");
  const available = [];
  for (const family of FONT_CANDIDATES) {
    const ops = [{
      op: "create-text",
      params: { characters: "\u4e2d\u6587", fontFamily: family, fontStyle: "Regular", fontSize: 14 },
    }];
    let body;
    try {
      const s = steps(call(ops));
      body = s[0].data;
    } catch (e) {
      info(`${family} / Regular`, `not available here (${e.message.slice(0, 60)})`);
      continue;
    }
    if (body && body.created) {
      const ok = !String(body.created.id).startsWith("MOCK:");
      check(`${family} / Regular`, ok, `id ${body.created.id}`);
      available.push(family);
      // clean up immediately - the probe must not litter the canvas
      try { call([{ op: "delete-node", params: { id: body.created.id } }]); } catch (_) { /* best effort */ }
    }
  }

  // Prefer a real CJK family for Chinese copy, keep Inter for digits/latin.
  const cjk = available.find((f) => /SC|Chinese|SC\b|YaHei|SimHei|PingFang|Hiragino/i.test(f) && f !== "Inter") || null;
  check("a CJK-capable family is available", !!cjk, cjk || "none found - Chinese would render as tofu");

  let cjkStyles = [];
  if (cjk) {
    section(`1b. Available styles on "${cjk}"`);
    for (const style of CJK_STYLE_CANDIDATES) {
      try {
        const s = steps(call([{
          op: "create-text",
          params: { characters: "\u4e2d\u6587", fontFamily: cjk, fontStyle: style, fontSize: 14 },
        }]));
        const id = s[0].data.created.id;
        check(`${cjk} / ${style}`, true, id);
        cjkStyles.push(style);
        try { call([{ op: "delete-node", params: { id } }]); } catch (_) { /* best effort */ }
      } catch (e) {
        info(`${cjk} / ${style}`, `style not present (${e.message.slice(0, 50)})`);
      }
    }
  }

  const fontPlan = {
    cjk: cjk,
    cjkStyles,
    latin: available.includes("Inter") ? "Inter" : (available[0] || "Inter"),
    allAvailable: available,
    probedAt: new Date().toISOString(),
  };
  fs.writeFileSync(OUT, JSON.stringify(fontPlan, null, 2));

  /* ---- 2. the new ops on a real canvas --------------------------- */
  section("2. New ops on the real canvas");
  //
  // A probe page far away from the dashboard area (which lives at x>=4000).
  //
  let probeFrameId = null;
  try {
    const s1 = steps(call([
      { op: "create-frame", params: { name: "ZZ Probe", width: 260, height: 120, x: -3000, y: -1000, fill: { hex: "#FFFFFF" } } },
      { op: "set-auto-layout", params: { id: "@last", mode: "VERTICAL", spacing: 8, padding: 16 } },
      { op: "set-effects", params: { id: "@last", shadow: { x: 0, y: 1, blur: 2, spread: 0, color: "#000000", opacity: 0.06 } } },
    ]));
    const frame = s1[0].data.created;
    probeFrameId = frame.id;
    check("create-frame accepts fill/parent-less create", true, `${frame.id} ${frame.width}x${frame.height}`);
    check("set-auto-layout on a fresh frame", s1[1].data.updated.layoutMode === "VERTICAL",
      `layoutMode=${s1[1].data.updated.layoutMode} spacing=${s1[1].data.updated.itemSpacing} padding=${JSON.stringify(s1[1].data.updated.padding)}`);
    const eff = s1[2].data.updated.effects;
    check("set-effects wrote a DROP_SHADOW", Array.isArray(eff) && eff[0] && eff[0].type === "DROP_SHADOW",
      JSON.stringify(eff && eff[0]));

    const F = probeFrameId;
    const s2 = steps(call([
      { op: "create-vector", params: { name: "ZZ Probe Vector", points: [[0, 0], [40, 24], [80, 6]], stroke: { hex: "#2F6BFF" }, strokeWeight: 3, parentId: F } },
      { op: "create-text", params: { characters: "\u4e2d\u6587 Probe 123", fontSize: 14, fontFamily: cjk || fontPlan.latin, fontStyle: "Regular", parentId: F } },
      { op: "set-text-align", params: { id: "@last", horizontal: "RIGHT", vertical: "CENTER" } },
      { op: "set-text-autoresize", params: { id: "@last", mode: "HEIGHT", width: 200 } },
      { op: "set-layout-sizing", params: { id: "@last", horizontal: "FILL", vertical: "HUG" } },
      { op: "set-name", params: { id: "@last", name: "ZZ Probe Text" } },
      { op: "get-node", params: { id: F, depth: 3, detail: true } },
    ]));

    const vec = s2[0].data.created;
    check("create-vector produced a VECTOR", vec.type === "VECTOR",
      `${vec.id} ${vec.width}x${vec.height} strokes=${JSON.stringify(vec.strokes)} weight=${vec.strokeWeight}`);

    const aligned = s2[2].data.updated;
    check("set-text-align landed", aligned.textAlign && aligned.textAlign.horizontal === "RIGHT",
      JSON.stringify(aligned.textAlign));

    const auto = s2[3].data.updated;
    check("set-text-autoresize landed", auto.textAutoResize === "HEIGHT",
      `mode=${auto.textAutoResize} width=${auto.width}`);

    const sized = s2[4].data.updated;
    check("set-layout-sizing landed", sized.layoutSizing && sized.layoutSizing.horizontal === "FILL",
      JSON.stringify(sized.layoutSizing));

    const renamed = s2[5].data.updated;
    check("set-name landed", renamed.name === "ZZ Probe Text", `previous="${s2[5].data.previousName}"`);

    // deep read-back: this is also the first real test of get-node depth/detail.
    // The frame's children here are leaves (a VECTOR and a TEXT), so asserting
    // "has grandchildren" would be wrong by construction. What detail:true must
    // guarantee is that every child already carries its full style state; the
    // genuine "depth expands past level 2" assertion lives in section 2b, where
    // nested instances actually provide the depth.
    const deep = s2[6].data;
    const kids = deep.children || [];
    check("get-node depth/detail returns children with full style detail",
      kids.length === 2 && kids.every((c) => !!c.type && Array.isArray(c.fills)),
      `children=${deep.childCount}, style detail on all children=${kids.every((c) => Array.isArray(c.fills))}`);
    const names = (deep.children || []).map((c) => `${c.type}:${c.name}`).join(", ");
    check("frame really contains both probe children", (deep.children || []).length === 2, names);

    /* ---- 2b. components, instances and overrides ------------------ */
    // The page reuses components everywhere, so "can a plugin override the
    // text inside an instance - and inside a NESTED instance?" has to be
    // answered before the build starts, not halfway through it.
    section("2b. Components: instance overrides (incl. a nested instance)");
    const okStyle = cjkStyles[0] || "Regular";
    try {
      const s3 = steps(call([
        { op: "create-frame", params: { name: "ZZ DS", width: 340, height: 260, x: -3000, y: -1400, fill: { hex: "#F7F8FA" } }, as: "ds" },
        { op: "create-frame", params: { name: "ZZ Pill", width: 80, height: 22, fill: { hex: "#E8F7EF" }, parentId: "$ds" }, as: "pillFrame" },
        { op: "set-auto-layout", params: { id: "$pillFrame", mode: "HORIZONTAL", spacing: 6, padding: 8 } },
        { op: "set-layout-sizing", params: { id: "$pillFrame", horizontal: "HUG", vertical: "HUG" } },
        { op: "set-corner-radius", params: { id: "$pillFrame", radius: 6 } },
        { op: "set-counter-axis-align", params: { id: "$pillFrame", align: "center" } },
        { op: "create-text", params: { characters: "\u5df2\u5b8c\u6210", fontSize: 11, fontFamily: cjk || fontPlan.latin, fontStyle: okStyle, parentId: "$pillFrame", name: "Pill/Label" }, as: "pillLabel" },
        { op: "set-text-color", params: { id: "$pillLabel", color: { hex: "#12A150" } } },
        { op: "create-component", params: { id: "$pillFrame", name: "ZZ Pill" }, as: "pill" },

        { op: "create-frame", params: { name: "ZZ Card", width: 200, height: 96, fill: { hex: "#FFFFFF" }, parentId: "$ds" }, as: "cardFrame" },
        { op: "set-auto-layout", params: { id: "$cardFrame", mode: "VERTICAL", spacing: 8, padding: 12 } },
        { op: "create-instance", params: { componentId: "$pill", parentId: "$cardFrame" }, as: "innerPill" },
        { op: "create-component", params: { id: "$cardFrame", name: "ZZ Card" }, as: "card" },

        { op: "create-frame", params: { name: "ZZ Host", width: 300, height: 200, x: -3000, y: -1000, fill: { hex: "#FFFFFF" } }, as: "host" },
        { op: "create-instance", params: { componentId: "$card", parentId: "$host" } },
        { op: "get-node", params: { id: "$host", depth: 6, detail: true } },
      ]));

      const host = s3[s3.length - 1].data;
      check("components created from frames (inside a design-system frame)",
        !!s3[8].data.created.id && !!s3[12].data.created.id,
        `pill=${s3[8].data.created.id} card=${s3[12].data.created.id}`);
      const instanceId = (host.children && host.children[0] && host.children[0].id) || null;
      check("instance landed inside its parent", !!instanceId, `instance=${instanceId}`);

      // walk the instance tree to find the text nested two instances deep
      const flat = [];
      const walk = (n) => { flat.push(n); (n.children || []).forEach(walk); };
      walk(host);
      // host > card instance > pill instance > text label: the read-back really
      // did expand the whole nesting, which is what depth:6 has to deliver.
      check("get-node depth expands past level 2", flat.length >= 4, `nodes in subtree=${flat.length}`);
      const target = flat.find((n) => n.name === "Pill/Label");
      check("nested instance child is reachable by name", !!target, target ? `${target.id} "${target.characters}"` : "not found");

      if (target) {
        const s4 = steps(call([
          { op: "set-text-content", params: { id: target.id, characters: "\u5f85\u53d1\u5e03" } },
          { op: "set-text-color", params: { id: target.id, color: { hex: "#D98200" } } },
          { op: "get-node", params: { id: target.id, depth: 0 } },
        ]));
        const after = s4[2].data;
        check("text override inside a nested instance", after.characters === "\u5f85\u53d1\u5e03",
          `characters="${after.characters}"`);
        check("colour override inside a nested instance",
          Array.isArray(after.fills) && after.fills[0] === "#d98200", JSON.stringify(after.fills));
      }
    } catch (e) {
      check("component / instance / override probe", false, e.message);
      notes.push("the component probe failed - its ZZ nodes may need manual cleanup");
    }

    /* ---- cleanup ------------------------------------------------ */
    section("3. Cleanup");
    try {
      const page0 = steps(call([{ op: "get-page-summary", params: {} }]))[0].data;
      const doomed = (page0.nodes || []).filter((n) => /^ZZ /.test(n.name)).map((n) => n.id);
      if (doomed.length) steps(call(doomed.map((id) => ({ op: "delete-node", params: { id } }))));
      const page = steps(call([{ op: "get-page-summary", params: {} }]))[0].data;
      const leftover = (page.nodes || []).filter((n) => /^ZZ /.test(n.name));
      check("probe nodes removed", leftover.length === 0, `removed=${doomed.length} leftover=${leftover.length}`);
    } catch (e) {
      check("probe cleanup", false, e.message);
    }
  } catch (e) {
    check("new op probe", false, e.message);
    notes.push("a probe failure may have left a 'ZZ Probe' frame behind - safe to delete by hand");
  }

  /* ---- summary --------------------------------------------------- */
  console.log("\n" + "=".repeat(72));
  console.log(`${passed}/${passed + failed} probe checks passed`);
  console.log(`CJK font plan: ${JSON.stringify(fontPlan.cjk)} | styles: ${JSON.stringify(cjkStyles)} | latin: ${fontPlan.latin}`);
  console.log(`written to ${path.relative(ROOT, OUT)}`);
  if (notes.length) notes.forEach((n) => console.log("note: " + n));
  console.log("=".repeat(72));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("probe crashed: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
