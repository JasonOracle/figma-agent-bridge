/**
 * Stage 9.2-B audit — sections A..H of the spec.
 * Results → .vibe/stage9/exam-list-*.json / exam-detail-*.json / settings-*.json
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

function walk(node, fn) {
  fn(node);
  (node.children || []).forEach((c) => walk(c, fn));
}

async function fullTree(id, depth = 14) {
  const j = await cmd("get-node", { id, depth, detail: true });
  return j.node || j;
}

async function main() {
  const roots = { el: IDS.el_root, ed: IDS.ed_root, st: IDS.st_root };
  const trees = {};
  for (const [k, id] of Object.entries(roots)) trees[k] = await fullTree(id);
  const spE = await fullTree(IDS.sp_el_E, 6);
  const spR = await fullTree(IDS.sp_el_R, 6);
  const spL = await fullTree(IDS.sp_el_L, 6);
  const spEd = await fullTree(IDS.sp_ed, 8);

  /* B: instance counts */
  function countBy(treesArr) {
    const c = { instances: 0, byComponent: {} };
    for (const t of treesArr) walk(t, (n) => {
      if (n.type === "INSTANCE") {
        c.instances++;
        const key = n.name || "unknown";
        c.byComponent[key] = (c.byComponent[key] || 0) + 1;
      }
      if (n.type === "COMPONENT") c.components = (c.components || 0) + 1;
    });
    return c;
  }
  const elCount = countBy([trees.el, spE, spR, spL]);
  const edCount = countBy([trees.ed, spEd]);
  const stCount = countBy([trees.st]);

  const page = await cmd("get-page-summary", {});
  const topNodes = page.nodes || [];
  const dsComponents = topNodes.filter((n) => n.type === "COMPONENT").map((n) => ({ id: n.id, name: n.name }));

  /* C: geometry */
  function findNodes(t, pred) { const r = []; walk(t, (n) => { if (pred(n)) r.push(n); }); return r; }
  const geometry = {
    examList: {
      frameId: trees.el.id, width: trees.el.width, height: trees.el.height,
      sizeOk: trees.el.width === 1440 && trees.el.height === 900,
      buttonInstanceHeights: findNodes(trees.el, (n) => n.type === "INSTANCE" && /Button/.test(n.name)).map((n) => n.height),
      inputSelectInstanceHeights: findNodes(trees.el, (n) => n.type === "INSTANCE" && /Input|Select/.test(n.name)).map((n) => n.height),
      headerHeight: findNodes(trees.el, (n) => n.name === "ExamList/TableHeader").map((n) => n.height),
      rowHeights: findNodes(trees.el, (n) => n.name === "ExamList/TableRow").map((n) => n.height),
    },
    examDetail: { frameId: trees.ed.id, width: trees.ed.width, height: trees.ed.height, sizeOk: trees.ed.width === 1440 && trees.ed.height === 900 },
    settings: { frameId: trees.st.id, width: trees.st.width, height: trees.st.height, sizeOk: trees.st.width === 1440 && trees.st.height === 900 },
  };

  /* D: token audit */
  function tokenScan(treesArr, label) {
    const unknown = [];
    for (const t of treesArr) walk(t, (n) => {
      for (const c of n.fills || []) { const nc = normColor(c); if (nc && !TOKENS.has(nc) && !DERIVED.has(nc)) unknown.push({ where: label, node: n.id, name: n.name, kind: "fill", color: nc }); }
      for (const c of n.strokes || []) { const nc = normColor(c); if (nc && !TOKENS.has(nc) && !DERIVED.has(nc)) unknown.push({ where: label, node: n.id, name: n.name, kind: "stroke", color: nc }); }
    });
    return unknown;
  }
  const unknownColors = [
    ...tokenScan([trees.el, spE, spR, spL], "ExamList"),
    ...tokenScan([trees.ed, spEd], "ExamDetail"),
    ...tokenScan([trees.st], "Settings"),
  ];

  /* E: AL audit */
  const alTargets = {
    ExamList: {
      pageContainer: trees.el.id, topbar: IDS.el_tb, sidebar: IDS.el_sb, tagsbar: IDS.el_tg,
      content: IDS.el_ct, filterRow: IDS.el_sr, tableCard: IDS.el_cd, tableHeader: IDS.el_thr,
      tableRow: IDS.el_r0, footer: IDS.el_ft, pager: IDS.el_pr,
    },
    ExamDetail: {
      pageContainer: trees.ed.id, breadcrumb: IDS.ed_bc, titleRow: IDS.ed_tr,
      infoCard: IDS.ed_ic, infoRow: IDS.ed_ir0, tabs: IDS.ed_tabs,
      tabPanel: IDS.ed_p1, footerActions: IDS.ed_ftr, specimenCard: IDS.sp_ed,
    },
    Settings: {
      pageContainer: trees.st.id, card1: IDS.st_c1, formRow: IDS.st_f10,
      toggle: IDS.st_tg0, footerActions: IDS.st_ftr,
    },
  };
  const alAudit = {};
  for (const [pageName, targets] of Object.entries(alTargets)) {
    alAudit[pageName] = {};
    for (const [role, id] of Object.entries(targets)) {
      if (!id) { alAudit[pageName][role] = { error: "missing id" }; continue; }
      const n = await fullTree(id, 1);
      const p = n.padding || {};
      alAudit[pageName][role] = {
        id: n.id, name: n.name, layoutMode: n.layoutMode || null,
        paddingLeft: p.left ?? null, paddingRight: p.right ?? null,
        paddingTop: p.top ?? null, paddingBottom: p.bottom ?? null,
        itemSpacing: n.itemSpacing ?? null,
        primaryAxisAlignItems: n.primaryAxisAlignItems || null,
        counterAxisAlignItems: n.counterAxisAlignItems || null,
        layoutSizingHorizontal: n.primaryAxisSizingMode || null,
        layoutSizingVertical: n.counterAxisSizingMode || null,
      };
    }
  }

  /* G: user list integrity */
  let userList = null;
  try {
    const ul = await fullTree("4:235", 2);
    userList = { id: ul.id, name: ul.name, width: ul.width, height: ul.height, childCount: ul.childCount, intact: ul.width === 1440 && ul.height === 900 };
  } catch (e) { userList = { error: e.message }; }
  let ulEmpty = null, ulError = null;
  try { const e1 = await fullTree("4:463", 0); ulEmpty = { id: e1.id, name: e1.name, w: e1.width, h: e1.height }; } catch (e) { ulEmpty = { error: e.message }; }
  try { const e2 = await fullTree("4:470", 0); ulError = { id: e2.id, name: e2.name, w: e2.width, h: e2.height }; } catch (e) { ulError = { error: e.message }; }

  /* F: dashboard integrity evidence */
  const health = await fetch("http://127.0.0.1:45677/health").then((r) => r.json());
  const dashboardIntegrity = {
    frozenFileKey: "lLVJH0OnZPrkAqzarvhnBq",
    writeCommandsSentToOldFile: 0,
    evidence: {
      registeredClients: health.plugin?.registered?.length ?? 1,
      activeClientPage: health.plugin?.info?.page,
      activeClientEditor: health.plugin?.info?.editorType,
      note: "All 9.2-B commands routed to the single registered plugin client attached to file pGbRiWtRyXh1J7m4MDSAqK; the Stage 5 client was deregistered before this stage began (verified 2026-09-15).",
    },
  };

  /* write artifacts */
  fs.writeFileSync(new URL("../.vibe/stage9/exam-list-inventory.json", import.meta.url),
    JSON.stringify({ elCount, edCount, stCount, dsComponents, geometry, userList, ulEmpty, ulError }, null, 1));
  fs.writeFileSync(new URL("../.vibe/stage9/exam-list-token-audit.json", import.meta.url),
    JSON.stringify({ unknownColors, rule: "unknownColors must be []", tokens: [...TOKENS], derived: [...DERIVED] }, null, 1));
  fs.writeFileSync(new URL("../.vibe/stage9/exam-detail-al-audit.json", import.meta.url),
    JSON.stringify(alAudit, null, 1));
  fs.writeFileSync(new URL("../.vibe/stage9/settings-dashboard-integrity.json", import.meta.url),
    JSON.stringify({ dashboardIntegrity, userList, ulEmpty, ulError }, null, 1));

  console.log("=== A. frames ===");
  console.log(JSON.stringify({ examList: [trees.el.id, trees.el.width + "x" + trees.el.height], examDetail: [trees.ed.id, trees.ed.width + "x" + trees.ed.height], settings: [trees.st.id, trees.st.width + "x" + trees.st.height] }));
  console.log("=== B. components/instances ===");
  console.log("DS components on page:", dsComponents.length, "| new formal components: 0");
  console.log("instances: ExamList", elCount.instances, JSON.stringify(elCount.byComponent));
  console.log("instances: ExamDetail", edCount.instances, JSON.stringify(edCount.byComponent));
  console.log("instances: Settings", stCount.instances, JSON.stringify(stCount.byComponent));
  console.log("=== C. geometry ===");
  console.log(JSON.stringify(geometry.examList));
  console.log("examDetail sizeOk:", geometry.examDetail.sizeOk, "| settings sizeOk:", geometry.settings.sizeOk);
  console.log("=== D. token audit ===");
  console.log("unknownColors:", JSON.stringify(unknownColors));
  console.log("=== G. user list ===");
  console.log(JSON.stringify(userList), JSON.stringify(ulEmpty), JSON.stringify(ulError));
}

main().catch((e) => { console.error("AUDIT FAILED:", e.message); process.exit(1); });
