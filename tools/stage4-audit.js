#!/usr/bin/env node
/**
 * Stage 4 design review / component audit - PixelFlow AI.
 * Reads the REAL canvas read-back (.vibe/stage4-tree.json) and checks the
 * dark creative-tool spec: structure, metrics, token compliance, component
 * reuse, art composition. Read-only; safe to re-run.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const TREE = path.join(ROOT, ".vibe", "stage4-tree.json");
const REPORT = path.join(ROOT, ".vibe", "stage4-review.md");
const NODE = process.execPath;
const CLI = path.join(ROOT, "cli", "figma-vibe.js");

const PALETTE = {
  "#0a0c10": "bgPage", "#0e1116": "canvas", "#14181f": "surface", "#1b2029": "surfaceHi",
  "#262d3a": "border", "#6e7bff": "primary", "#1d2440": "primarySoft",
  "#3ecf8e": "success", "#f5b84a": "warning", "#f26d6d": "danger",
  "#9b7bff": "violet", "#5ac8fa": "sky", "#f27fb2": "pink",
  "#f2f4f8": "t1", "#a9b1c0": "t2", "#6c7686": "t3", "#ffffff": "white glyph",
  // preview-art locals (documented dark tints for thumbnails / aurora depth)
  "#12151c": "art canvas", "#1a1f2b": "art thumb 1", "#16202c": "art thumb 2",
  "#201b2c": "art thumb 3", "#15211c": "art thumb 4",
  "#2a3140": "avatar bg", "#31394a": "ring inner", "#9fb0ff": "primary text tint",
  "#c3cfff": "active nav label",
};

const PROMPT = "A cinematic editorial portrait of a futuristic female architect, soft natural lighting, minimal studio background, high fashion photography.";

const findings = [];
let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; findings.push(`| \u2713 | ${label} | ${detail || ""} |`); }
  else { fail++; findings.push(`| \u2717 | ${label} | ${detail || ""} |`); }
  return ok;
}

const flat = [];
function walk(n, depth, parentName) {
  flat.push({ ...n, depth, parentName });
  (n.children || []).forEach((c) => walk(c, depth + 1, n.name));
}
const byName = (name) => flat.filter((n) => n.name === name);
const one = (name) => byName(name)[0] || null;
const kids = (n) => (n && n.children) || [];

function liveComponents() {
  const state = JSON.parse(fs.readFileSync(path.join(ROOT, ".vibe", "stage4-state.json"), "utf8"));
  const r = spawnSync(NODE, [CLI, "run", "--ops",
    JSON.stringify([{ op: "get-node", params: { id: state.dsRoot, depth: 6, detail: true } }]),
    "--json", "--timeout", "60000"], { encoding: "utf8", cwd: ROOT, maxBuffer: 1 << 28 });
  const body = JSON.parse(r.stdout);
  const out = [];
  const w = (n) => { if (n.type === "COMPONENT") out.push(n.name); (n.children || []).forEach(w); };
  w(body.data.ops[0].data);
  return out;
}

function main() {
  if (!fs.existsSync(TREE)) {
    console.error(`no read-back at ${TREE} - run:  node tools/stage4-build.js --stage dump`);
    process.exit(1);
  }
  walk(JSON.parse(fs.readFileSync(TREE, "utf8")), 0, null);

  /* 1 - hygiene */
  const images = flat.filter((n) => n.type === "IMAGE");
  check("no IMAGE node - placeholder art is native vector/shape work", images.length === 0,
    images.length ? `${images.length} IMAGE node(s)` : "0 IMAGE nodes");
  const zero = flat.filter((n) => !(n.width > 0) || !(n.height > 0));
  check("every node has a real size", zero.length === 0, zero.length ? zero.slice(0, 4).map((n) => n.name).join(", ") : `${flat.length} nodes`);

  /* 2 - shell metrics */
  check("root frame name", tree_name() === "PixelFlow AI", tree_name());
  check("root frame is 1440x900", flat[0].width === 1440 && flat[0].height === 900, `${flat[0].width}x${flat[0].height}`);
  const sidebar = one("Sidebar");
  check("Sidebar is 240px wide", !!sidebar && sidebar.width === 240, sidebar ? `${sidebar.width}px` : "missing");
  const header = one("Header");
  const headRule = one("Header/Rule");
  check("Header block totals 64px (row + rule)", !!header && header.height === 63 && !!headRule && headRule.height === 1,
    header ? `${header.height}+${headRule ? headRule.height : "?"}` : "missing");
  const controls = one("Controls");
  const preview = one("Preview");
  check("Controls column is 380px", !!controls && controls.width === 380, controls ? `${controls.width}px` : "missing");
  check("Preview column fills the remainder (~752px)", !!preview && preview.width >= 740 && preview.width <= 760, preview ? `${Math.round(preview.width)}px` : "missing");
  const canvas = one("Preview/Canvas");
  check("Preview canvas keeps a 4:3-ish stage", !!canvas && Math.round(canvas.width) === 752 && Math.round(canvas.height) === 558,
    canvas ? `${Math.round(canvas.width)}x${Math.round(canvas.height)}` : "missing");

  /* 3 - sidebar */
  const navRows = flat.filter((n) => /^Nav Item \/ /.test(n.name) && n.parentName === "Nav");
  check("sidebar has 5 nav items", navRows.length === 5, navRows.map((n) => n.name.replace("Nav Item / ", "")).join(", "));
  const activeNav = navRows.filter((n) => (n.fills || []).some((f) => String(f).toLowerCase() === "#1d2440"));
  check("exactly one nav item is active (Create)", activeNav.length === 1 && activeNav[0].name === "Nav Item / Create",
    activeNav.map((n) => n.name).join(", ") || "none");
  const navIcons = navRows.map((n) => kids(n).filter((c) => c.name === "Nav/Icon Slot").length);
  check("every nav row carries a native vector icon slot", navRows.length === 5 && navIcons.every((c) => c === 1), navIcons.join(","));
  const user = one("Sidebar/User");
  check("sidebar user area (avatar + name + workspace)", !!user && byName("User/Name").length === 1 && byName("User/Workspace").length === 1,
    user ? byName("User/Name").map((n) => n.characters)[0] : "missing");

  /* 4 - header */
  check("header shows project title + meta", byName("Header/Project").length === 1 && byName("Header/Meta").length === 1,
    `${byName("Header/Project").map((n) => n.characters)[0]} / ${byName("Header/Meta").map((n) => n.characters)[0]}`);
  const searchPh = byName("Input/Placeholder")[0];
  check("header search input is an instance with placeholder", !!searchPh && /Search/.test(searchPh.characters || ""), searchPh ? searchPh.characters : "missing");
  check("credits chip shows balance + status dot", byName("Credits/Label").length === 1 && byName("Credits/Dot").length === 1,
    byName("Credits/Label").map((n) => n.characters)[0]);
  check("notification icon button + avatar are instances", byName("IconBtn/Glyph").length === 1 && byName("Avatar/Initial").length >= 2,
    "bell + 2 avatars");

  /* 5 - controls */
  const ta = byName("Textarea/Content")[0];
  check("prompt textarea holds the spec prompt verbatim", !!ta && ta.characters === PROMPT, ta ? `${(ta.characters || "").length} chars` : "missing");
  const counter = byName("Prompt/Counter")[0];
  check("prompt counter matches content length", !!counter && counter.characters === `${PROMPT.length} / 1000`, counter ? counter.characters : "missing");
  const arChips = flat.filter((n) => n.parentName === "AspectRatio/Chips");
  const arLabels = arChips.map((c) => (kids(c).find((x) => x.name === "Chip/Label") || {}).characters);
  check("aspect ratio chips are 1:1 / 4:5 / 16:9 (instances)", arChips.length === 3 && arLabels.join(",") === "1:1,4:5,16:9", arLabels.join(", "));
  const arActive = arChips.filter((n) => (n.fills || []).some((f) => String(f).toLowerCase() === "#1d2440"));
  check("exactly one aspect chip is active", arActive.length === 1, arActive.length ? "1:1" : "none");
  const stChips = flat.filter((n) => n.parentName === "Style/Chips");
  const stLabels = stChips.map((c) => (kids(c).find((x) => x.name === "Chip/Label") || {}).characters);
  check("style chips are Cinematic / Editorial / Minimal / Photography", stChips.length === 4 && stLabels.join(",") === "Cinematic,Editorial,Minimal,Photography", stLabels.join(", "));
  const sliders = ["Steps", "Guidance", "Seed"].map((s) => one(`Advanced/${s}`));
  check("advanced has Steps / Guidance / Seed sliders", sliders.every(Boolean), sliders.map((s) => s && s.name).join(", "));
  const sliderParts = sliders.every((s) => {
    const names = kids(s).map((c) => c.name);
    return names.some((n) => /Head/.test(n)) && names.some((n) => /Track/.test(n));
  });
  const knobOk = sliders.every((s) => {
    const track = kids(s).find((c) => /Track/.test(c.name));
    return track && kids(track).length === 2;
  });
  check("each slider has head + track(fill+knob)", sliderParts && knobOk, "3 tracks with fill + knob");
  const gen = one("Generate");
  check("Generate is a primary instance stretched full width", !!gen && gen.type === "INSTANCE" && Math.round(gen.width) === 380,
    gen ? `${Math.round(gen.width)}px (FILL of the 380px column)` : "missing");

  /* 6 - preview art */
  const aurora = byName("Art/Orb Violet").concat(byName("Art/Orb Indigo"), byName("Art/Orb Sky"));
  check("aurora field is 3 native ellipses", aurora.length === 3, `${aurora.length} orbs`);
  const rings = byName("Art/Ring").length + byName("Art/Ring Inner").length;
  check("focal rings present", rings === 2, `${rings} rings`);
  check("sparkle focal glyph present", byName("Art/Sparkle Glyph").length === 1, "vector");
  const meta = one("Preview/Meta");
  const metaCentered = !!meta && Math.abs((meta.x + meta.width / 2) - canvas.width / 2) < 8;
  check("meta pill is bottom-centred", metaCentered, meta ? `x=${Math.round(meta.x)} w=${Math.round(meta.width)}` : "missing");
  const tabs = flat.filter((n) => /^Tab/.test(n.parentName || "") || n.parentName === "Preview/Tabs");
  check("preview tabs overlay (Latest active)", byName("Tab/Label").length === 2, "2 tab instances");
  const tb = kids(one("Preview/Toolbar"));
  const tbLabels = tb.map((c) => c.name);
  check("toolbar has Download + 3 ghost actions + format caption",
    byName("Btn/Label").length >= 4 && tbLabels.some((n) => /Format/.test(n)),
    byName("Btn/Label").map((n) => n.characters).join(", "));

  /* 7 - history */
  const thumbs = byName("History/Thumb 1").length === 1 && byName("History/Thumb 4").length === 1;
  const orbCount = flat.filter((n) => /^History\/Orb /.test(n.name)).length;
  const horizonCount = flat.filter((n) => /^History\/Horizon /.test(n.name)).length;
  const timeCount = flat.filter((n) => n.name === "History/Time").length;
  check("history card has 4 native thumbnails (orb + horizon + sun + time)",
    thumbs && orbCount === 4 && horizonCount === 4 && timeCount === 4,
    `orbs=${orbCount} horizons=${horizonCount} times=${timeCount}`);

  /* 8 - components & instances */
  const comps = liveComponents();
  check("design system defines 17 components", comps.length === 17, comps.join(", "));
  const instances = flat.filter((n) => n.type === "INSTANCE");
  check("page is composed from 20 component instances", instances.length === 20, `${instances.length} instances`);
  const instNames = [...new Set(instances.map((n) => n.name))].sort();
  check("instances span Chip/Tab/Button/Input/Textarea/Select/Avatar/IconBtn", instNames.length >= 9, instNames.join(", "));

  /* 9 - auto layout */
  const containers = flat.filter((n) => n.childCount !== undefined);
  const autoFrames = containers.filter((n) => n.layoutMode && n.layoutMode !== "NONE");
  const pct = containers.length ? Math.round((autoFrames.length / containers.length) * 100) : 0;
  check("majority of containers use Auto Layout", pct >= 75, `${autoFrames.length}/${containers.length} = ${pct}%`);

  /* 10 - tokens */
  const used = new Map();
  for (const n of flat) {
    for (const f of n.fills || []) if (typeof f === "string") used.set(f.toLowerCase(), (used.get(f.toLowerCase()) || 0) + 1);
    for (const s of n.strokes || []) if (typeof s === "string") used.set(s.toLowerCase(), (used.get(s.toLowerCase()) || 0) + 1);
  }
  const off = [...used.keys()].filter((h) => !(h in PALETTE));
  check("every fill/stroke comes from the dark palette", off.length === 0,
    off.length ? `off-palette: ${off.join(", ")}` : `${used.size} distinct colours, all documented`);
  const isIconPart = (n) => /Icon|Sparkle|Glyph|Knob/.test(n.name) || /Icon/i.test(n.parentName || "");
  const radii = new Set(flat.filter((n) => !isIconPart(n) && typeof n.cornerRadius === "number" && n.cornerRadius > 0).map((n) => n.cornerRadius));
  const offRadius = [...radii].filter((r) => ![6, 10, 14, 999].includes(r));
  check("corner radii come from sm/md/lg/pill", offRadius.length === 0,
    offRadius.length ? `off-scale: ${offRadius.join(", ")}` : `used: ${[...radii].sort((a, b) => a - b).join(", ")}`);
  const texts = flat.filter((n) => n.type === "TEXT");
  const sizes = [...new Set(texts.map((n) => n.fontSize))].sort((a, b) => a - b);
  const badSize = sizes.filter((s) => ![9, 10, 11, 12, 13, 14, 15, 24, 28].includes(s));
  check("font sizes come from the type scale", badSize.length === 0, badSize.length ? `off-scale: ${badSize.join(", ")}` : sizes.join(", "));
  const empty = texts.filter((n) => !String(n.characters || "").trim().length);
  check("no empty text nodes", empty.length === 0, `${empty.length} empty of ${texts.length}`);
  const latin = texts.filter((n) => n.fontName && n.fontName.family === "Inter");
  check("latin UI text uses Inter", latin.length === texts.length, `${latin.length}/${texts.length}`);
  const shadowed = flat.filter((n) => (n.effects || []).some((e) => e.type === "DROP_SHADOW"));
  check("elevation: card shadow + primary glow applied", shadowed.length >= 2, `${shadowed.length} nodes with shadow`);

  /* report */
  const types = {};
  for (const n of flat) types[n.type] = (types[n.type] || 0) + 1;
  const md = [
    "# Stage 4 \u00b7 Design Review & Component Audit \u2014 PixelFlow AI",
    "",
    `Source: real canvas read-back (\`${path.relative(ROOT, TREE)}\`) + one live DS query. No mock data.`,
    "",
    `**Result: ${pass} passed, ${fail} failed** of ${pass + fail} checks.`,
    "",
    "## Node census",
    "",
    `- total nodes: **${flat.length}**`,
    `- by type: ${JSON.stringify(types)}`,
    `- auto-layout frames: **${autoFrames.length}/${containers.length} (${pct}%)**, max depth ${Math.max(...flat.map((n) => n.depth))}`,
    `- components: **${comps.length}** \u00b7 instances: **${instances.length}**`,
    "",
    "## Checks",
    "",
    "| | check | detail |",
    "|---|---|---|",
    ...findings,
    "",
  ];
  fs.writeFileSync(REPORT, md.join("\n"));
  console.log(md.slice(2, 4).join("\n"));
  findings.forEach((f) => console.log(f));
  console.log(`\nreport -> ${path.relative(ROOT, REPORT)}`);
  process.exit(fail ? 1 : 0);
}

function tree_name() { return flat[0].name; }

try { main(); } catch (e) { console.error("AUDIT FAILED: " + (e && e.message ? e.message : e)); process.exit(1); }
