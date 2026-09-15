/**
 * Stage 9.2-C consolidation audit.
 * 1. Page 1 zone integrity  2. DS audit  3. Layout audit
 * Artifacts → .vibe/stage9/consolidation-*.json
 */
import fs from "fs";

const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
const BRIDGE = "http://127.0.0.1:45677/v1/command";
const IDS = JSON.parse(fs.readFileSync(new URL("../.vibe/stage9/exam-settings-build-ids.json", import.meta.url), "utf8"));

async function cmd(op, params = {}) {
  const res = await fetch(`${BRIDGE}?token=${TOKEN}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, params }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`${op} failed: ${JSON.stringify(j).slice(0, 300)}`);
  return j.data ?? j;
}

const TOKENS = new Set([
  "#F2F3F5", "#FFFFFF", "#E4E7ED", "#5A5CF0", "#303133", "#606266", "#909399", "#C0C4CC",
  "#409EFF", "#F56C6C", "#67C23A", "#5470C6", "#91CC75", "#FAC858", "#FC8452", "#EE6666",
]);
const DERIVED = new Set(["#F0F1FE", "#AAB8E8"]);

const EXPECTED_DS = [
  "DS/Button/Primary", "DS/Button/Secondary", "DS/Button/Ghost", "DS/Button/Danger",
  "DS/Input/Default", "DS/Input/Focus", "DS/Input/Error",
  "DS/Select/Default",
  "DS/Badge/Success", "DS/Badge/Warning", "DS/Badge/Error", "DS/Badge/Info", "DS/Badge/Neutral",
  "DS/Table/Header", "DS/Table/Row", "DS/Table/Row/Hover", "DS/Table/Row/Selected",
  "DS/Pagination/Default", "DS/Pagination/Active", "DS/Pagination/Disabled",
  "DS/EmptyState", "DS/LoadingState", "DS/ErrorState",
  "DS/Card/BaseCard", "DS/Breadcrumb",
];

function normColor(c) {
  if (!c) return null;
  if (typeof c === "string") return c.toUpperCase();
  if (Array.isArray(c)) {
    const [r, g, b] = c;
    const hex = (x) => Math.round(x * 255).toString(16).padStart(2, "0").toUpperCase();
    return "#" + hex(r) + hex(g) + hex(b);
  }
  return JSON.stringify(c).slice(0, 60);
}
function walk(node, fn) { fn(node); (node.children || []).forEach((c) => walk(c, fn)); }
function findNodes(t, pred) { const r = []; walk(t, (n) => { if (pred(n)) r.push(n); }); return r; }
async function fullTree(id, depth = 14) {
  const j = await cmd("get-node", { id, depth, detail: true });
  return j.node || j;
}

async function main() {
  /* ---- 1. Page 1 zone integrity ---- */
  const page = await cmd("get-page-summary", {});
  const top = page.nodes || [];
  const zones = {
    dsZone: {
      range: "y 0..1200",
      components: top.filter((n) => n.type === "COMPONENT" && n.y < 1200).map((n) => ({ id: n.id, name: n.name, y: n.y })),
    },
    userList: top.filter((n) => n.name === "Page/UserList").map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.width, h: n.height }))[0] || null,
    examList: top.filter((n) => n.name === "Page/ExamList").map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.width, h: n.height }))[0] || null,
    examDetail: top.filter((n) => n.name === "Page/ExamDetail").map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.width, h: n.height }))[0] || null,
    settings: top.filter((n) => n.name === "Page/Settings").map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.width, h: n.height }))[0] || null,
    specimens: top.filter((n) => n.x >= 1560).map((n) => ({ id: n.id, name: n.name, x: n.x, y: n.y })),
    topLevelCount: top.length,
  };

  /* ---- 2. DS audit ---- */
  const found = zones.dsZone.components.map((c) => c.name);
  const missing = EXPECTED_DS.filter((n) => !found.includes(n));
  const badNaming = found.filter((n) => !n.startsWith("DS/"));
  const existence = [];
  for (const c of zones.dsZone.components) {
    const j = await cmd("get-node", { id: c.id, depth: 0 });
    const n = j.node || j;
    existence.push({ id: c.id, name: n.name, type: n.type, exists: n.type === "COMPONENT" });
  }

  const roots = [
    ["ExamList", [IDS.el_root, IDS.sp_el_E, IDS.sp_el_R, IDS.sp_el_L]],
    ["ExamDetail", [IDS.ed_root, IDS.sp_ed]],
    ["Settings", [IDS.st_root]],
    ["UserList", ["4:235"]],
  ];
  const dsIds = new Set(zones.dsZone.components.map((c) => c.id));
  const instanceAudit = {};
  for (const [pageName, ids] of roots) {
    const per = { instances: 0, byComponent: {}, foreign: [] };
    for (const id of ids) {
      let t;
      try { t = await fullTree(id); } catch (e) { per.foreign.push({ id, error: e.message }); continue; }
      walk(t, (n) => {
        if (n.type === "INSTANCE") {
          per.instances++;
          per.byComponent[n.name] = (per.byComponent[n.name] || 0) + 1;
          if (!n.name.startsWith("DS/")) per.foreign.push({ id: n.id, name: n.name, note: "instance name not DS/*" });
        }
      });
    }
    instanceAudit[pageName] = per;
  }

  /* ---- 3. Layout audit ---- */
  const trees = {
    el: await fullTree(IDS.el_root), ed: await fullTree(IDS.ed_root),
    st: await fullTree(IDS.st_root), ul: await fullTree("4:235", 2),
  };
  const frames = {
    UserList: { id: trees.ul.id, w: trees.ul.width, h: trees.ul.height, ok: trees.ul.width === 1440 && trees.ul.height === 900 },
    ExamList: { id: trees.el.id, w: trees.el.width, h: trees.el.height, ok: trees.el.width === 1440 && trees.el.height === 900 },
    ExamDetail: { id: trees.ed.id, w: trees.ed.width, h: trees.ed.height, ok: trees.ed.width === 1440 && trees.ed.height === 900 },
    Settings: { id: trees.st.id, w: trees.st.width, h: trees.st.height, ok: trees.st.width === 1440 && trees.st.height === 900 },
  };
  const geometryChecks = {
    examListButtonHeights: findNodes(trees.el, (n) => n.type === "INSTANCE" && /Button/.test(n.name)).map((n) => n.height),
    examListInputSelectHeights: findNodes(trees.el, (n) => n.type === "INSTANCE" && /Input|Select/.test(n.name)).map((n) => n.height),
    examListHeaderHeights: findNodes(trees.el, (n) => n.name === "ExamList/TableHeader").map((n) => n.height),
    examListRowHeights: findNodes(trees.el, (n) => n.name === "ExamList/TableRow").map((n) => n.height),
  };
  const unknownColors = [];
  for (const [label, t] of Object.entries({ ExamList: trees.el, ExamDetail: trees.ed, Settings: trees.st, UserList: trees.ul })) {
    walk(t, (n) => {
      for (const c of n.fills || []) { const nc = normColor(c); if (nc && !TOKENS.has(nc) && !DERIVED.has(nc)) unknownColors.push({ where: label, node: n.id, name: n.name, kind: "fill", color: nc }); }
      for (const c of n.strokes || []) { const nc = normColor(c); if (nc && !TOKENS.has(nc) && !DERIVED.has(nc)) unknownColors.push({ where: label, node: n.id, name: n.name, kind: "stroke", color: nc }); }
    });
  }
  const alTargets = {
    ExamList: { page: trees.el.id, topbar: IDS.el_tb, sidebar: IDS.el_sb, tagsbar: IDS.el_tg, content: IDS.el_ct, tableCard: IDS.el_cd, tableHeader: IDS.el_thr, tableRow: IDS.el_r0, footer: IDS.el_ft },
    ExamDetail: { page: trees.ed.id, breadcrumb: IDS.ed_bc, infoCard: IDS.ed_ic, tabs: IDS.ed_tabs, tabPanel: IDS.ed_p1, footerActions: IDS.ed_ftr },
    Settings: { page: trees.st.id, card1: IDS.st_c1, formRow: IDS.st_f10, footerActions: IDS.st_ftr },
  };
  const autoLayout = {};
  for (const [pageName, targets] of Object.entries(alTargets)) {
    autoLayout[pageName] = {};
    for (const [role, id] of Object.entries(targets)) {
      const n = await fullTree(id, 1);
      const p = n.padding || {};
      autoLayout[pageName][role] = {
        id: n.id, layoutMode: n.layoutMode || null,
        padding: [p.left ?? null, p.right ?? null, p.top ?? null, p.bottom ?? null],
        itemSpacing: n.itemSpacing ?? null,
        primaryAxis: n.primaryAxisAlignItems || null, counterAxis: n.counterAxisAlignItems || null,
      };
    }
  }

  /* ---- artifacts ---- */
  const out = (name, data) => fs.writeFileSync(new URL(`../.vibe/stage9/${name}`, import.meta.url), JSON.stringify(data, null, 1));
  out("consolidation-zones.json", zones);
  out("consolidation-ds-audit.json", {
    expectedCount: EXPECTED_DS.length, foundCount: found.length,
    missing, badNaming, existence,
    instances: Object.fromEntries(Object.entries(instanceAudit).map(([k, v]) => [k, { instances: v.instances, byComponent: v.byComponent }])),
    foreignInstances: Object.fromEntries(Object.entries(instanceAudit).map(([k, v]) => [k, v.foreign])),
    method: "instance→component attribution via instance name (Figma default = component name); all DS components are named DS/*",
  });
  out("consolidation-layout-audit.json", { frames, geometryChecks, unknownColors, autoLayout, tokens: [...TOKENS], derived: [...DERIVED] });

  /* ---- console ---- */
  console.log("== 1. zones ==");
  console.log("DS components:", zones.dsZone.components.length, "| top-level nodes:", zones.topLevelCount);
  for (const z of ["userList", "examList", "examDetail", "settings"]) console.log(z + ":", JSON.stringify(zones[z]));
  console.log("specimens:", zones.specimens.length);
  console.log("== 2. DS audit ==");
  console.log("missing:", JSON.stringify(missing), "| badNaming:", JSON.stringify(badNaming));
  console.log("existence all COMPONENT:", existence.every((e) => e.exists));
  for (const [k, v] of Object.entries(instanceAudit)) console.log(`instances ${k}:`, v.instances, "| foreign:", v.foreign.length);
  console.log("== 3. layout ==");
  console.log("frames:", JSON.stringify(frames));
  console.log("unknownColors:", JSON.stringify(unknownColors));
  console.log("AUDIT DONE");
}

main().catch((e) => { console.error("AUDIT FAILED:", e.message); process.exit(1); });
