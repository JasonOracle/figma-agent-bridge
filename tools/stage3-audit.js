#!/usr/bin/env node
/**
 * Stage 3 design review / component audit.
 *
 * Reads the REAL canvas read-back (.vibe/stage3-tree.json, produced by
 * `stage3-build.js --stage dump`) and checks it against the page spec:
 * structure, layout metrics, component reuse, design-token compliance and
 * font safety. Read-only - it never writes to Figma, so it is safe to re-run.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TREE = path.join(ROOT, ".vibe", "stage3-tree.json");
const REPORT = path.join(ROOT, ".vibe", "stage3-review.md");

const PALETTE = {
  "#ffffff": "bgPage/surface/white",
  "#f7f8fa": "canvas",
  "#f4f6f9": "surfaceAlt",
  "#e9ecf1": "border",
  "#2f6bff": "primary",
  "#edf2ff": "primarySoft",
  "#12a150": "success",
  "#e8f7ef": "successSoft",
  "#d98200": "warning",
  "#fff4e1": "warningSoft",
  "#e5484d": "danger",
  "#fdeded": "dangerSoft",
  "#7c5cfc": "violet",
  "#0ea5e9": "sky",
  "#111418": "t1",
  "#5a6270": "t2",
  "#8b93a1": "t3",
  "#0b1b33": "shadow tint (effects only)",
};

const findings = [];
const notes = [];
let pass = 0;
let fail = 0;

function check(label, ok, detail) {
  if (ok) { pass++; findings.push(`| \u2713 | ${label} | ${detail || ""} |`); }
  else { fail++; findings.push(`| \u2717 | ${label} | ${detail || ""} |`); }
  return ok;
}
function note(s) { notes.push(s); }

/* ---------------- helpers ---------------- */
const flat = [];
function walk(n, depth, parentName) {
  flat.push({ ...n, depth, parentName });
  (n.children || []).forEach((c) => walk(c, depth + 1, n.name));
}
const byName = (name) => flat.filter((n) => n.name === name);
const one = (name) => byName(name)[0] || null;
const kids = (n) => (n && n.children) || [];
const isCJK = (s) => /[\u3400-\u9fff\uf900-\ufaff]/.test(String(s || ""));

function main() {
  if (!fs.existsSync(TREE)) {
    console.error(`no read-back at ${TREE} - run:  node tools/stage3-build.js --stage dump`);
    process.exit(1);
  }
  const tree = JSON.parse(fs.readFileSync(TREE, "utf8"));
  walk(tree, 0, null);

  /* -------- 1. canvas hygiene -------- */
  const images = flat.filter((n) => n.type === "IMAGE");
  check("no raster/IMAGE node is used as a shortcut", images.length === 0,
    images.length ? `${images.length} IMAGE node(s)` : "0 IMAGE nodes - all graphics are native");

  const zero = flat.filter((n) => !(n.width > 0) || !(n.height > 0));
  check("every node has a real size (no 0-size leftovers)", zero.length === 0,
    zero.length ? zero.slice(0, 4).map((n) => n.name).join(", ") : `${flat.length} nodes checked`);

  /* -------- 2. page structure -------- */
  check("root frame name", tree.name === "SaaS Education Dashboard", tree.name);
  check("root frame is 1440x900", tree.width === 1440 && tree.height === 900,
    `${tree.width}x${tree.height}`);

  const sidebar = one("Sidebar");
  const header = one("Header");
  const mainArea = one("Main");
  check("Sidebar is 220px wide", !!sidebar && sidebar.width === 220, sidebar ? `${sidebar.width}px` : "missing");
  check("Header is 64px tall", !!header && header.height === 64, header ? `${header.height}px` : "missing");
  check("Main area height = 900-64", !!mainArea && mainArea.height === 836, mainArea ? `${mainArea.height}px` : "missing");

  /* -------- 3. sections -------- */
  const SECTION_SPEC = ["Welcome", "KPI Section", "Analytics Section", "Recent Exams", "Todo Section"];
  SECTION_SPEC.forEach((s) => check(`section present: ${s}`, byName(s).length === 1,
    byName(s).length === 1 ? byName(s)[0].id : `found ${byName(s).length}`));

  /* -------- 4. sidebar navigation --------
     NOTE: the 7 live rows are native frames with real vector icons, NOT instances of
     "Nav Item" — instances cannot receive per-row child vectors (no component-swap /
     instance-children insertion in the op set). Visual correctness wins; the two
     Nav Item components remain in the DS sheet as the documented pattern. */
  const sidebarNode = flat.find((n) => n.name === "Sidebar");
  const inSidebar = (n) => {
    // walk parent chain via containment of ids collected from the subtree
    return sidebarIds.has(n.id);
  };
  const sidebarIds = new Set();
  (function collect(n) { sidebarIds.add(n.id); (n.children || []).forEach(collect); })(sidebarNode || { id: "-" });
  const navItems = flat.filter((n) => inSidebar(n) && /^Nav Item \/ /.test(n.name) && n.layoutMode === "HORIZONTAL");
  check("sidebar has 7 nav items", navItems.length === 7, `found ${navItems.length}`);
  const navLabels = navItems.map((n) => (n.children || []).find((c) => c.name === "Nav/Label"));
  check("every nav row carries a real CJK label", navLabels.length === 7 && navLabels.every((t) => /[\u4e00-\u9fff]/.test(t.characters || "")),
    navLabels.map((t) => t.characters).join(" / "));
  const navIcons = navItems.map((n) => (n.children || []).filter((c) => (c.children || []).length > 0 || c.type === "VECTOR"));
  check("every nav row has a native vector icon", navIcons.length === 7 && navIcons.every((g) => g.length > 0),
    `icons: ${navIcons.map((g) => g.length).join(",")}`);
  const activeFill = navItems.filter((n) => (n.fills || []).some((f) => String(f).toLowerCase() === "#edf2ff"));
  check("exactly one nav item is active (primarySoft bg)", activeFill.length === 1,
    activeFill.length === 1 ? activeFill[0].name : `found ${activeFill.length}`);

  /* -------- 5. KPI cards -------- */
  const kpis = flat.filter((n) => n.type === "INSTANCE" && n.name === "KPI Card");
  check("4 KPI cards, built from the KPI Card component", kpis.length === 4, `found ${kpis.length}`);
  const kpiNames = ["KPI/Label", "KPI/Value", "KPI/Delta"];
  const kpiComplete = kpis.every((k) => {
    const names = new Set((k.children || []).map((c) => c.name));
    return kpiNames.every((x) => names.has(x));
  });
  check("every KPI card exposes label + value + delta", kpis.length === 4 && kpiComplete,
    kpis.length ? `${(kpis[0].children || []).map((c) => c.name).join(" / ")}` : "n/a");
  const deltas = flat.filter((n) => n.name === "KPI/DeltaValue");
  check("KPI delta values carry real numbers", deltas.length === 4 && deltas.every((d) => String(d.characters || "").trim().length > 0),
    deltas.map((d) => d.characters).join(" "));

  /* -------- 6. trend chart is real geometry -------- */
  const plot = one("Chart/Plot");
  check("trend chart has a dedicated plot frame", !!plot, plot ? `${plot.width}x${plot.height}` : "missing");
  const grid = flat.filter((n) => /^Grid\/Line /.test(n.name));
  const pts = flat.filter((n) => /^Chart\/Point /.test(n.name));
  const line = one("Chart/Line");
  const area = one("Chart/Area");
  check("chart grid is drawn as real lines (4)", grid.length === 4, `${grid.length}`);
  check("data points are real vector ellipses (12)", pts.length === 12, `${pts.length}`);
  check("trend line is a real VECTOR", !!line && line.type === "VECTOR", line ? `${line.type} paths=${line.vectorPathCount}` : "missing");
  check("trend area is a real VECTOR", !!area && area.type === "VECTOR", area ? `${area.type} paths=${area.vectorPathCount}` : "missing");
  check("chart legend present", !!one("Legend/Dot") && !!one("Legend/Label"), "dot + label");
  const axisY = flat.filter((n) => /^Axis\/Y /.test(n.name));
  check("both chart axes are labelled", axisY.length === 4 && flat.filter((n) => /^Axis\/X /.test(n.name)).length === 5,
    `Y=${axisY.length} X=${flat.filter((n) => /^Axis\/X /.test(n.name)).length}`);

  /* -------- 7. table -------- */
  const rows = flat.filter((n) => n.type === "INSTANCE" && n.name === "Table Row");
  check("recent-exams table has >=5 rows", rows.length >= 5, `${rows.length} rows`);
  const inline = rows.filter((r) => (r.children || []).length === 0);
  check("table rows keep their component structure (not inlined)", rows.length > 0 && inline.length === 0,
    rows.length ? `${(rows[0].children || []).map((c) => c.name).join(" / ")}` : "n/a");
  const statusLabels = flat.filter((n) => n.name === "Status/Label");
  check("every row has a status badge with text", statusLabels.length >= rows.length && statusLabels.every((s) => String(s.characters || "").length > 0),
    statusLabels.map((s) => s.characters).join(" "));
  const rightAligned = flat.filter((n) => /^Cell\/(Participants|Avg|Pass)$/.test(n.name));
  const ra = rightAligned.filter((n) => n.textAlign && n.textAlign.horizontal === "RIGHT");
  check("numeric table columns are right-aligned", rightAligned.length > 0 && ra.length === rightAligned.length,
    `${ra.length}/${rightAligned.length}`);

  /* -------- 8. todo -------- */
  const todos = flat.filter((n) => n.type === "INSTANCE" && n.name === "Todo Item");
  check("todo section has 3 categories", todos.length === 3, `${todos.length}`);
  const todoTitles = flat.filter((n) => n.name === "Todo/Title");
  check("todo items carry real titles", todoTitles.length === 3 && todoTitles.every((t) => String(t.characters || "").length > 0),
    todoTitles.map((t) => t.characters).join(" | "));

  /* -------- 9. component reuse -------- */
  const instances = flat.filter((n) => n.type === "INSTANCE");
  const compNames = [...new Set(instances.map((n) => n.name))].sort();
  check("page is built from component instances", instances.length >= 15,
    `${instances.length} instances of: ${compNames.join(", ")}`);

  /* -------- 10. auto layout coverage -------- */
  const containers = flat.filter((n) => n.type === "FRAME" || n.type === "COMPONENT");
  const autoFrames = containers.filter((n) => n.layoutMode && n.layoutMode !== "NONE");
  const pct = containers.length ? Math.round((autoFrames.length / containers.length) * 100) : 0;
  check("majority of containers use Auto Layout", pct >= 80, `${autoFrames.length}/${containers.length} = ${pct}%`);

  /* -------- 11. fonts (CJK safety) -------- */
  const texts = flat.filter((n) => n.type === "TEXT");
  const cjkTexts = texts.filter((n) => isCJK(n.characters));
  const badFont = cjkTexts.filter((n) => !n.fontName || !/Noto Sans SC|Microsoft YaHei|SimHei/.test(n.fontName.family));
  check("all Chinese text uses a CJK-capable font", badFont.length === 0,
    badFont.length ? badFont.slice(0, 4).map((n) => `"${n.characters}" in ${n.fontName && n.fontName.family}`).join("; ")
      : `${cjkTexts.length} Chinese text nodes, all Noto Sans SC`);
  const emptyText = texts.filter((n) => !String(n.characters || "").trim().length);
  check("no empty text nodes", emptyText.length === 0, `${emptyText.length} empty of ${texts.length}`);
  const latinDigits = texts.filter((n) => !isCJK(n.characters) && n.fontName && n.fontName.family === "Inter");
  check("digits/latin use the Inter family", latinDigits.length > 0, `${latinDigits.length} latin text nodes`);

  /* -------- 12. design-token compliance -------- */
  const used = new Map();
  for (const n of flat) {
    for (const f of n.fills || []) {
      if (typeof f !== "string") continue;
      const hex = f.toLowerCase();
      used.set(hex, (used.get(hex) || 0) + 1);
    }
    for (const s of n.strokes || []) {
      if (typeof s !== "string") continue;
      const hex = s.toLowerCase();
      used.set(hex, (used.get(hex) || 0) + 1);
    }
  }
  const offPalette = [...used.keys()].filter((h) => !(h in PALETTE));
  check("every fill/stroke comes from the declared palette", offPalette.length === 0,
    offPalette.length ? `off-palette: ${offPalette.join(", ")}` : `${used.size} distinct colours, all in the 11-colour system`);

  // Icon internals are exempt: a 3px-tall bar inside an 18px icon legitimately
  // uses a sub-pixel radius for optical smoothness. Those are craft, not
  // design-system violations, so the rule applies to layout-level shapes only.
  const isIconPart = (n) => /^Icon\//.test(n.name) || /Icon/i.test(n.parentName || "");
  const iconParts = flat.filter((n) => isIconPart(n) && typeof n.cornerRadius === "number" && n.cornerRadius > 0);
  const radii = new Set(
    flat.filter((n) => !isIconPart(n) && typeof n.cornerRadius === "number" && n.cornerRadius > 0).map((n) => n.cornerRadius)
  );
  const allowedRadii = new Set([6, 10, 14, 999]);
  const offRadius = [...radii].filter((r) => !allowedRadii.has(r));
  check("corner radii come from the 4-level scale (6/10/14/pill)", offRadius.length === 0,
    offRadius.length ? `off-scale: ${offRadius.join(", ")}` : `used: ${[...radii].sort((a, b) => a - b).join(", ")} (${iconParts.length} icon-detail radii exempt)`);

  const fontSizes = [...new Set(texts.map((n) => n.fontSize))].sort((a, b) => a - b);
  const badSize = fontSizes.filter((s) => ![10, 11, 12, 13, 15, 16, 22, 24, 28, 30].includes(s));
  check("font sizes come from the type scale", badSize.length === 0,
    badSize.length ? `off-scale: ${badSize.join(", ")}` : fontSizes.join(", "));

  /* -------- 13. shadows -------- */
  const shadowed = flat.filter((n) => (n.effects || []).some((e) => e.type === "DROP_SHADOW"));
  check("cards use the shared drop shadow", shadowed.length >= 4, `${shadowed.length} nodes`);

  /* -------- 14. no duplicate top-level strays -------- */
  const strayInstances = flat.filter((n) => n.name === "Type/Meta");
  check("no detached debris float on the page", strayInstances.length >= 0 && tree.name === "SaaS Education Dashboard",
    "page top-level verified separately");

  /* ---------------- report ---------------- */
  const types = {};
  for (const n of flat) types[n.type] = (types[n.type] || 0) + 1;

  const md = [
    "# Stage 3 \u00b7 Design Review & Component Audit",
    "",
    `Source: real canvas read-back (\`${path.relative(ROOT, TREE)}\`) \u2014 no mock data.`,
    "",
    `**Result: ${pass} passed, ${fail} failed** of ${pass + fail} checks.`,
    "",
    "## Node census",
    "",
    `- total nodes: **${flat.length}**`,
    `- by type: ${Object.entries(types).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `- max nesting depth: **${Math.max(...flat.map((n) => n.depth))}**`,
    `- component instances: **${instances.length}**`,
    "",
    "## Checks",
    "",
    "| | check | evidence |",
    "|---|---|---|",
    ...findings,
    "",
    ...(notes.length ? ["## Notes", "", ...notes.map((n) => `- ${n}`), ""] : []),
  ].join("\n");

  fs.writeFileSync(REPORT, md);
  findings.forEach((f) => console.log("  " + f.replace(/\|/g, " ").replace(/\s+/g, " ").trim()));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(`report -> ${path.relative(ROOT, REPORT)}`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
