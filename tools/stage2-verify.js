#!/usr/bin/env node
/**
 * stage2-verify.js - REAL Figma verification for the stage-2 atomics
 * ==================================================================
 * Drives the real CLI against the real bridge and the REAL Figma plugin,
 * then reads the canvas back to prove every property actually landed.
 *
 * Unlike tools/selftest.js (mock plugin, protocol only), this script
 * REQUIRES a running Figma plugin and only ever reports real Figma node
 * ids - a "MOCK:" id cannot appear here because no mock is in the loop.
 *
 * Asserted, per the stage-2 acceptance criteria:
 *   - returned node ids are real Figma ids (no MOCK: prefix)
 *   - parentId is the frame we asked for
 *   - the nodes really exist on the canvas (read back by id)
 *   - the frame really contains its children
 *   - auto layout properties really landed on the frame
 *
 *   node tools/stage2-verify.js [--port 45677] [--x 1700]
 * ==================================================================
 */

"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const NODE = process.execPath;
const CLI = path.join(ROOT, "cli", "figma-vibe.js");

const argv = process.argv.slice(2);
function flag(name, dflt) {
  const i = argv.indexOf("--" + name);
  if (i === -1) return dflt;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}
const PORT = String(flag("port", "45677"));
const OFFSET_X = Number(flag("x", 1700));

const results = [];
const pass = (l, d) => { results.push(true); console.log(`  \u2713 ${l}${d ? "  " + d : ""}`); };
const fail = (l, d) => { results.push(false); console.log(`  \u2717 ${l}${d ? "  " + d : ""}`); };
const check = (l, cond, d) => (cond ? pass(l, d) : fail(l, d));

/** Run one CLI call and return { exit, body, raw }. */
function call(args, timeoutMs = 20000) {
  const r = spawnSync(
    NODE,
    [CLI, "--port", PORT, ...args, "--json", "--timeout", String(timeoutMs)],
    { encoding: "utf8", timeout: timeoutMs + 20000 }
  );
  const raw = `${r.stdout || ""}${r.stderr || ""}`.trim();
  let body = null;
  try { body = JSON.parse(raw); } catch (_) { /* usage errors are not JSON */ }
  return { exit: r.status, body, raw };
}

/** Run one op; on failure print the real error and return null. */
function op(label, args) {
  const r = call(args);
  const err = r.body && r.body.error;
  if (!r.body || r.body.ok !== true) {
    fail(label, `${(err && err.code) || "NO_RESPONSE"}  ${(err && err.message) || r.raw.slice(0, 200)}`);
    return null;
  }
  return r.body.data || {};
}

const notMock = (id) => typeof id === "string" && id.length > 1 && !id.startsWith("MOCK:");
const ledger = [];

function main() {
  console.log("\n" + "=".repeat(74));
  console.log("Vibe Bridge - REAL Figma verification (stage 2 atomics)");
  console.log("=".repeat(74));

  /* ---- 0. the plugin must be genuine ------------------------------ */
  console.log("\n0. Plugin identity");
  const p = call(["ping"]);
  if (!p.body || p.body.ok !== true) {
    fail("plugin reachable", "start Figma Desktop and run Plugins > Development > Vibe Bridge (Dev)");
    return finish();
  }
  check("plugin is real Figma, not the mock", p.body.data.editorType === "figma",
    `${p.body.data.plugin} \u00b7 page "${p.body.data.page}" \u00b7 ${p.body.data.documentAccess}`);

  /* ---- 1. required: create-frame / create-rect / create-text ------ */
  console.log("\n1. Node creation (real canvas)");
  const F = op("create-frame 600x400", ["create-frame", "--name", "Vibe Stage 2 Test",
    "--width", "600", "--height", "400", "--x", String(OFFSET_X), "--y", "0"]);
  if (!F) return finish();
  const frameId = F.created.id;
  ledger.push(["create-frame", frameId, `${F.created.width}x${F.created.height}`]);
  check("frame id is a real Figma id", notMock(frameId), frameId);
  check("frame size is 600x400", F.created.width === 600 && F.created.height === 400,
    `${F.created.width}x${F.created.height}`);

  const R = op("create-rect 200x120 inside frame", ["create-rect", "--name", "Stage2 Rect",
    "--width", "200", "--height", "120", "--x", "40", "--y", "40", "--parent", frameId, "--hex", "#E8E8E8"]);
  if (!R) return finish();
  const rectId = R.created.id;
  ledger.push(["create-rect", rectId, `${R.created.width}x${R.created.height}`]);
  check("rect id is a real Figma id", notMock(rectId), rectId);
  check("rect parentId is the new frame", R.created.parentId === frameId, R.created.parentId);

  const T = op("create-text inside frame", ["create-text", "--text", "Stage 2 Atomics",
    "--size", "24", "--x", "40", "--y", "220", "--parent", frameId]);
  if (!T) return finish();
  const textId = T.created.id;
  ledger.push(["create-text", textId, JSON.stringify(T.created.characters)]);
  check("text id is a real Figma id", notMock(textId), textId);
  check("text parentId is the new frame", T.created.parentId === frameId, T.created.parentId);

  /* ---- 2. required: set-fill / corner radius / font size ---------- */
  console.log("\n2. Style + text writes");
  const SF = op("set-fill rect #4a6cff", ["set-fill", rectId, "--hex", "#4a6cff"]);
  if (SF) {
    ledger.push(["set-fill", rectId, JSON.stringify(SF.updated.fills)]);
    check("rect fill really is #4a6cff", SF.updated.fills && SF.updated.fills[0] === "#4a6cff",
      JSON.stringify(SF.updated.fills));
  }

  const CR = op("set-corner-radius rect 16", ["set-corner-radius", rectId, "--radius", "16"]);
  if (CR) {
    ledger.push(["set-corner-radius", rectId, "cornerRadius=" + CR.updated.cornerRadius]);
    check("rect cornerRadius really is 16", CR.updated.cornerRadius === 16, String(CR.updated.cornerRadius));
  }

  const FS = op("set-font-size text 32", ["set-font-size", textId, "--size", "32"]);
  if (FS) {
    ledger.push(["set-font-size", textId, "fontSize=" + FS.updated.fontSize]);
    check("text fontSize really is 32", FS.updated.fontSize === 32, String(FS.updated.fontSize));
  }

  /* ---- 3. required: append-child --------------------------------- */
  console.log("\n3. Structure");
  const E = op("create-ellipse (loose, on the page)", ["create-ellipse", "--name", "Stage2 Ellipse",
    "--width", "120", "--height", "120", "--x", String(OFFSET_X), "--y", "520", "--hex", "#FF8800"]);
  if (!E) return finish();
  const ellipseId = E.created.id;
  ledger.push(["create-ellipse", ellipseId, "loose on page"]);
  check("ellipse starts outside the frame", E.created.parentId !== frameId, E.created.parentId);

  const AC = op("append-child ellipse -> frame", ["append-child", ellipseId, "--parent", frameId]);
  if (AC) {
    ledger.push(["append-child", ellipseId, "parentId=" + AC.updated.parentId]);
    check("append-child moved the ellipse into the frame", AC.updated.parentId === frameId, AC.updated.parentId);
  }

  /* ---- 4. required: set-auto-layout ------------------------------ */
  console.log("\n4. Auto layout");
  const AL = op("set-auto-layout frame vertical", ["set-auto-layout", frameId,
    "--mode", "vertical", "--spacing", "24", "--padding", "32"]);
  if (AL) {
    ledger.push(["set-auto-layout", frameId, `${AL.updated.layoutMode} spacing=${AL.updated.itemSpacing} padding=${JSON.stringify(AL.updated.padding)}`]);
    check("frame layoutMode really is VERTICAL", AL.updated.layoutMode === "VERTICAL", String(AL.updated.layoutMode));
    check("frame itemSpacing really is 24", AL.updated.itemSpacing === 24, String(AL.updated.itemSpacing));
    check("frame padding really is 32 on all sides",
      AL.updated.padding && AL.updated.padding.top === 32 && AL.updated.padding.right === 32 &&
      AL.updated.padding.bottom === 32 && AL.updated.padding.left === 32,
      JSON.stringify(AL.updated.padding));
  }

  /* ---- 5. read everything back from the canvas ------------------- */
  console.log("\n5. Read back from the canvas (independent confirmation)");
  const N = op("get-node frame", ["node", frameId]);
  if (N) {
    const kids = N.children || [];
    check("frame really contains 3 children", N.childCount === 3, `childCount=${N.childCount}`);
    const kidIds = kids.map((k) => k.id);
    check("rect / text / ellipse are all inside the frame",
      kidIds.includes(rectId) && kidIds.includes(textId) && kidIds.includes(ellipseId),
      kidIds.join(", "));
    check("auto layout survived the round trip",
      N.layoutMode === "VERTICAL" && N.itemSpacing === 24 && N.padding && N.padding.top === 32,
      `${N.layoutMode} spacing=${N.itemSpacing} padding=${JSON.stringify(N.padding)}`);

    // Every child must report the same parentId - the strongest available
    // proof that nesting really happened on the canvas.
    for (const kid of kids) {
      const c = op(`  child ${kid.name} (${kid.id})`, ["node", kid.id]);
      if (!c) continue;
      check(`  ${kid.name}: parentId === frame`, c.parentId === frameId, c.parentId);
    }
  }

  const page = op("get-page-summary", ["page"]);
  if (page) {
    const names = (page.nodes || []).map((n) => `${n.type} ${n.id} "${n.name}"`);
    check("both test frames are on the page", names.length >= 2, names.join(" | "));
  }

  /* ---- 6. extra coverage: the riskier APIs ------------------------ */
  // Not part of the minimum acceptance list, but these are the calls most
  // likely to break subtly: font-style probing, the component APIs, and
  // the per-axis auto layout setters. They run AFTER the read-back above,
  // because some of them (create-component) consume their source node.
  console.log("\n6. Extra coverage (font weight, stroke, layout setters, components)");

  const FW = op("set-font-weight text -> 700", ["set-font-weight", textId, "--weight", "700"]);
  if (FW) {
    ledger.push(["set-font-weight", textId, JSON.stringify(FW.updated.fontName)]);
    check("text style resolved to a bold variant", /bold/i.test((FW.updated.fontName || {}).style || ""),
      JSON.stringify(FW.updated.fontName));
  }

  const TC = op("set-text-content", ["set-text-content", textId, "--text", "Stage 2 Atomics OK"]);
  if (TC) check("characters really changed", TC.updated.characters === "Stage 2 Atomics OK",
    JSON.stringify(TC.updated.characters));

  const ST = op("set-stroke rect 2px", ["set-stroke", rectId, "--hex", "#1a1a1a", "--width", "2"]);
  if (ST) check("stroke colour and weight really landed",
    ST.updated.strokes && ST.updated.strokes[0] === "#1a1a1a" && ST.updated.strokeWeight === 2,
    `${JSON.stringify(ST.updated.strokes)} @ ${ST.updated.strokeWeight}`);

  const OPA = op("set-opacity rect 0.8", ["set-opacity", rectId, "--opacity", "0.8"]);
  if (OPA) check("opacity really is 0.8", OPA.updated.opacity === 0.8, String(OPA.updated.opacity));

  // The frame itself sits on the page root, so it can be moved and resized
  // freely - a child of the auto layout frame could not be.
  const MV = op("move-node frame by dx/dy +30/+30", ["move-node", frameId, "--dx", "30", "--dy", "30"]);
  if (MV) {
    const dx = Math.round(MV.updated.x - MV.movedFrom.x);
    const dy = Math.round(MV.updated.y - MV.movedFrom.y);
    check("move-node moved by exactly +30/+30", dx === 30 && dy === 30, `${dx}/${dy}`);
  }

  const RS = op("resize-node frame 640x480", ["resize-node", frameId, "--width", "640", "--height", "480"]);
  if (RS) check("resize really applied", RS.updated.width === 640 && RS.updated.height === 480,
    `${RS.updated.width}x${RS.updated.height}`);

  const DU = op("duplicate-node text", ["duplicate-node", textId, "--name", "Stage2 Text Copy"]);
  if (DU) {
    ledger.push(["duplicate-node", DU.created.id, "copy of " + textId]);
    check("duplicate is a new real node", notMock(DU.created.id) && DU.created.id !== textId, DU.created.id);
  }

  const PAD = op("set-padding frame h24/v16", ["set-padding", frameId, "--horizontal", "24", "--vertical", "16"]);
  if (PAD) check("per-axis padding really landed",
    PAD.updated.padding && PAD.updated.padding.left === 24 && PAD.updated.padding.right === 24 &&
    PAD.updated.padding.top === 16 && PAD.updated.padding.bottom === 16,
    JSON.stringify(PAD.updated.padding));

  const SPACING = op("set-item-spacing frame 12", ["set-item-spacing", frameId, "--spacing", "12"]);
  if (SPACING) check("itemSpacing really is 12", SPACING.updated.itemSpacing === 12, String(SPACING.updated.itemSpacing));

  const PA = op("set-primary-axis-align frame space-between",
    ["set-primary-axis-align", frameId, "--align", "space-between"]);
  if (PA) check("primaryAxisAlignItems really is SPACE_BETWEEN", PA.updated.primaryAxisAlignItems === "SPACE_BETWEEN",
    String(PA.updated.primaryAxisAlignItems));

  const CA = op("set-counter-axis-align frame center", ["set-counter-axis-align", frameId, "--align", "center"]);
  if (CA) check("counterAxisAlignItems really is CENTER", CA.updated.counterAxisAlignItems === "CENTER",
    String(CA.updated.counterAxisAlignItems));

  // The component source must live OUTSIDE the auto layout frame: turning a
  // layout child into a component would fight with the layout engine.
  const CRA = op("create-rect (component source, on the page)", ["create-rect", "--name", "Stage2 Component Source",
    "--width", "160", "--height", "80", "--x", String(OFFSET_X + 700), "--y", "0", "--hex", "#8b5cf6"]);
  if (CRA) {
    const srcId = CRA.created.id;
    const CP = op("create-component from that rect", ["create-component", srcId, "--name", "Stage2 Component"]);
    if (CP) {
      const componentId = CP.created.id;
      ledger.push(["create-component", componentId, CP.created.type]);
      check("create-component returned a real COMPONENT", CP.created.type === "COMPONENT" && notMock(componentId),
        `${CP.created.type} ${componentId}`);

      const IN = op("create-instance", ["create-instance", componentId,
        "--x", String(OFFSET_X + 900), "--y", "0"]);
      if (IN) {
        ledger.push(["create-instance", IN.created.id, "of " + componentId]);
        check("create-instance returned a real INSTANCE", IN.created.type === "INSTANCE" && notMock(IN.created.id),
          `${IN.created.type} ${IN.created.id}`);
      }
    }
  }

  return finish();
}

function finish() {
  const okCount = results.filter(Boolean).length;
  const bad = results.length - okCount;

  console.log("\n" + "-".repeat(74));
  console.log("Ledger - every id below is a real Figma node id");
  console.log("-".repeat(74));
  for (const [what, id, extra] of ledger) {
    console.log(`  ${what.padEnd(20)} ${id.padEnd(10)} ${extra || ""}`);
  }

  console.log("\n" + "=".repeat(74));
  console.log(`${okCount}/${results.length} real-canvas checks passed${bad ? `  (${bad} FAILED)` : ""}`);
  if (bad) console.log("This run did NOT fully pass - see the \u2717 lines above.");
  console.log("These results come from the real Figma plugin reading its own canvas.");
  console.log("=".repeat(74));
  process.exit(bad ? 1 : 0);
}

main();
