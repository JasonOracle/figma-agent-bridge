/**
 * Stage 9.2-B — Exam List + Exam Detail + Settings (Figma-only).
 * Reuses Stage 9.2-A DS components (instances only, 0 new formal DS components).
 * Zones on Page 1: ExamList y=2360..3260, ExamDetail y=3380..4280, Settings y=4400..5300,
 * specimens at x>=1560. Serial `run` batches; id snapshot after every batch.
 * Known constraint: DS/Table/* are 6-col user-list components; exam table needs 8 cols,
 * so table header/rows are local page frames styled with DS tokens (no new formal components).
 */
import fs from "fs";

const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
const BRIDGE = "http://127.0.0.1:45677/v1/command";
const LOG = [];
const IDS_FILE = new URL("../.vibe/stage9/exam-settings-build-ids.json", import.meta.url);
const IDS = fs.existsSync(IDS_FILE) ? JSON.parse(fs.readFileSync(IDS_FILE, "utf8")) : {};
// preload 9.2-A component/instance ids (DS components live in the same file)
const PREV_IDS = new URL("../.vibe/stage9/user-list-build-ids.json", import.meta.url);
if (fs.existsSync(PREV_IDS)) {
  const prev = JSON.parse(fs.readFileSync(PREV_IDS, "utf8"));
  for (const [k, v] of Object.entries(prev)) if (!(k in IDS)) IDS[k] = v;
}
const SKIP = new Set((process.argv[2] || "").split(",").filter(Boolean));
function saveIds() { fs.writeFileSync(IDS_FILE, JSON.stringify(IDS, null, 1)); }

async function cmd(op, params = {}) {
  const res = await fetch(`${BRIDGE}?token=${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, params }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`${op} failed: ${JSON.stringify(j).slice(0, 500)}`);
  return j.data ?? j;
}

async function runBatch(label, ops) {
  if (SKIP.has(label)) { console.log(`[skip ${label}]`); return { ids: {} }; }
  const payload = ops.map((o) => ({ op: o.op, params: o.params, as: o.as }));
  const t0 = Date.now();
  const data = await cmd("run", { ops: payload });
  const got = {};
  (data.ops || []).forEach((r, i) => {
    if (ops[i].as && r.data && r.data.created && r.data.created.id) got[ops[i].as] = r.data.created.id;
  });
  Object.assign(IDS, got);
  saveIds();
  const line = `[batch ${label}] ops=${ops.length} ms=${Date.now() - t0} ids={${Object.keys(got).join(",")}}`;
  console.log(line);
  LOG.push(line);
  return { data, ids: got };
}

/* ---------- op builders ---------- */
const FR = (as, name, w, h, x, y, p = {}) => ({ op: "create-frame", as, params: { name, width: w, height: h, x, y, ...p } });
const TX = (chars, o = {}) => ({
  op: "create-text", as: o.as,
  params: { characters: chars, fontFamily: o.fam || "Noto Sans SC", fontStyle: o.st || "Regular", fontSize: o.fs || 13, fill: o.fill || "#303133", parentId: o.parent, x: o.x, y: o.y, name: o.name },
});
const VEC = (as, name, data, w, h, o = {}) => ({ op: "create-vector", as, params: { name, data, width: w, height: h, parentId: o.parent, stroke: o.stroke, strokeWeight: o.sw || 1.5, fill: o.fill } });
const EL = (as, name, w, h, o = {}) => ({ op: "create-ellipse", as, params: { name, width: w, height: h, parentId: o.parent, fill: o.fill } });
const RC = (as, name, w, h, o = {}) => ({ op: "create-rect", as, params: { name, width: w, height: h, parentId: o.parent, fill: o.fill, cornerRadius: o.rad } });
const AL = (id, mode, spacing, p = {}) => ({ op: "set-auto-layout", params: { id, mode, spacing, ...p } });
const PAD = (id, p) => ({ op: "set-padding", params: { id, ...p } });
const RAD = (id, r) => ({ op: "set-corner-radius", params: { id, radius: r } });
const FILL = (id, c, p = {}) => ({ op: "set-fill", params: { id, color: c, ...p } });
const CLEARF = (id) => ({ op: "set-fill", params: { id, clear: true } });
const STR = (id, c, w = 1) => ({ op: "set-stroke", params: { id, color: c, strokeWeight: w } });
const SIZ = (id, h, v) => ({ op: "set-layout-sizing", params: { id, horizontal: h, vertical: v } });
const PAL = (id, a) => ({ op: "set-primary-axis-align", params: { id, align: a } });
const CAL = (id, a) => ({ op: "set-counter-axis-align", params: { id, align: a } });
const INST = (as, compId, o = {}) => ({ op: "create-instance", as, params: { componentId: compId, parentId: o.parent, x: o.x, y: o.y } });
const DEL = (id) => ({ op: "delete-node", params: { id } });
const CARD_SHADOW = (id) => ({ op: "set-effects", params: { id, effects: [{ type: "DROP_SHADOW", color: "#000000", opacity: 0.06, x: 0, y: 1, blur: 4 }] } });

const FONT = { fam: "Noto Sans SC" };
const INK = { c1: "#303133", c2: "#606266", c3: "#909399", c4: "#C0C4CC" };
const PRI = "#5A5CF0", STROKE = "#E4E7ED", SURFACE = "#FFFFFF", PAGE_BG = "#F2F3F5";

const ICON = {
  search: "M11 6.2 C11 8.85 8.85 11 6.2 11 C3.55 11 1.4 8.85 1.4 6.2 C1.4 3.55 3.55 1.4 6.2 1.4 C8.85 1.4 11 3.55 11 6.2 Z M9.7 9.7 L12.8 12.8",
  chevDown: "M3 5 L7 9 L11 5",
  chevDown10: "M2.5 3.5 L5 6 L7.5 3.5",
  close: "M2 2 L10 10 M10 2 L2 10",
  burger: "M1.5 3.5 L14.5 3.5 M1.5 7 L14.5 7 M1.5 10.5 L14.5 10.5",
  burger16: "M1.5 4 L14.5 4 M1.5 8 L14.5 8 M1.5 12 L14.5 12",
  house: "M7 1.2 L12.8 6.2 L12.8 12.8 L1.2 12.8 L1.2 6.2 Z",
  grid: "M1.5 1.5 L5.8 1.5 L5.8 5.8 L1.5 5.8 Z M8.2 1.5 L12.5 1.5 L12.5 5.8 L8.2 5.8 Z M1.5 8.2 L5.8 8.2 L5.8 12.5 L1.5 8.2 Z M8.2 8.2 L12.5 8.2 L12.5 12.5 L8.2 12.5 Z",
  doc: "M3 1.5 L8.8 1.5 L12 4.7 L12 12.5 L3 12.5 Z",
  arrowLeft: "M12 7 L2 7 M6 3 L2 7 L6 11",
  gear: "M12.6 8 C12.6 10.54 10.54 12.6 8 12.6 C5.46 12.6 3.4 10.54 3.4 8 C3.4 5.46 5.46 3.4 8 3.4 C10.54 3.4 12.6 5.46 12.6 8 Z M8 0.8 L8 2.4 M8 13.6 L8 15.2 M0.8 8 L2.4 8 M13.6 8 L15.2 8",
  tri1: "M10 1 L19 18 L1 18 Z",
  tri2: "M12.5 8 L18.5 18 L6.5 18 Z",
};

/* ---------- generic shell (TopBar + Sidebar), mirrors 9.2-A UserList ---------- */
function shellOps(p, rootName, y, { topbarCrumb, activeMenu }) {
  const R = "$" + p + "_root";
  const ops = [
    FR(p + "_root", rootName, 1440, 900, 0, y, { fill: PAGE_BG, clips: true }),
    // TopBar
    FR(p + "_tb", rootName.replace("Page/", "") + "/TopBar", 1440, 40, 0, 0, { parentId: R, fill: SURFACE }),
    AL("$" + p + "_tb", "horizontal", 0),
    FR(p + "_lg", "logo", 180, 40, 0, 0, { parentId: "$" + p + "_tb", fill: SURFACE }),
    AL("$" + p + "_lg", "horizontal", 8),
    PAD("$" + p + "_lg", { left: 14 }),
    CAL("$" + p + "_lg", "CENTER"),
    SIZ("$" + p + "_lg", "FIXED", "FILL"),
    VEC(p + "_t1", "logo-tri-1", ICON.tri1, 19, 18, { parent: "$" + p + "_lg", fill: PRI }),
    VEC(p + "_t2", "logo-tri-2", ICON.tri2, 12, 11, { parent: "$" + p + "_lg", fill: "#91CC75" }),
    TX("ElementAdmin", { parent: "$" + p + "_lg", fs: 14, st: "Bold", fill: INK.c1 }),
    FR(p + "_rt", "topbar-right", 800, 40, 0, 0, { parentId: "$" + p + "_tb", fill: SURFACE }),
    AL("$" + p + "_rt", "horizontal", 14),
    PAD("$" + p + "_rt", { horizontal: 16 }),
    CAL("$" + p + "_rt", "CENTER"),
    SIZ("$" + p + "_rt", "FILL", "FILL"),
    VEC(p + "_b1", "icon-burger", ICON.burger16, 16, 16, { parent: "$" + p + "_rt", stroke: INK.c1, sw: 1.5 }),
    TX(topbarCrumb, { parent: "$" + p + "_rt", fs: 13, fill: INK.c1 }),
    FR(p + "_sp", "spacer", 10, 10, 0, 0, { parentId: "$" + p + "_rt" }),
    CLEARF("$" + p + "_sp"),
    AL("$" + p + "_sp", "horizontal", 0),
    SIZ("$" + p + "_sp", "FILL", "FIXED"),
    TX("全屏切换", { parent: "$" + p + "_rt", fs: 12, fill: INK.c2 }),
    VEC(p + "_g1", "icon-gear", ICON.gear, 16, 16, { parent: "$" + p + "_rt", stroke: INK.c2, sw: 1.5 }),
    EL(p + "_av", "avatar", 24, 24, { parent: "$" + p + "_rt", fill: PRI }),
    TX("admin", { parent: "$" + p + "_rt", fs: 12, fill: INK.c3 }),
    // Sidebar
    FR(p + "_sb", rootName.replace("Page/", "") + "/Sidebar", 180, 860, 0, 40, { parentId: R, fill: SURFACE }),
    AL("$" + p + "_sb", "vertical", 0),
  ];
  return ops;
}
function menuOps(p, as, label, { h = 40, pad = 20, active = false, icon = null } = {}) {
  const ref = "$" + p + "_" + as;
  const ops = [
    FR(p + "_" + as, `menu-${label}`, 180, h, 0, 0, { parentId: IDS[p + "_sb"], fill: active ? PRI : SURFACE }),
    AL(ref, "horizontal", 10),
    PAD(ref, { left: pad }),
    CAL(ref, "CENTER"),
    SIZ(ref, "FILL", "FIXED"),
  ];
  if (icon) ops.push(VEC(p + "_mi_" + label, `icon-${label}`, ICON[icon], 14, 14, { parent: ref, stroke: active ? "#FFFFFF" : INK.c1, sw: 1.5 }));
  ops.push(TX(label, { parent: ref, fs: 13, st: active ? "Medium" : "Regular", fill: active ? "#FFFFFF" : INK.c1 }));
  return ops;
}
function tagsContentOps(p, rootName, tagLabel) {
  const short = rootName.replace("Page/", "");
  return [
    FR(p + "_tg", short + "/TagsBar", 1260, 36, 180, 40, { parentId: IDS[p + "_root"], fill: SURFACE }),
    AL("$" + p + "_tg", "horizontal", 10),
    PAD("$" + p + "_tg", { horizontal: 12 }),
    CAL("$" + p + "_tg", "CENTER"),
    SIZ("$" + p + "_tg", "FIXED", "FIXED"),
    FR(p + "_tag1", "tag-首页", 60, 22, 0, 0, { parentId: "$" + p + "_tg" }),
    AL("$" + p + "_tag1", "horizontal", 6),
    PAD("$" + p + "_tag1", { horizontal: 10 }),
    CAL("$" + p + "_tag1", "CENTER"),
    VEC(p + "_th1", "icon-house-s", ICON.house, 11, 11, { parent: "$" + p + "_tag1", stroke: PRI, sw: 1.5 }),
    TX("首页", { parent: "$" + p + "_tag1", fs: 12, st: "Medium", fill: PRI }),
    FR(p + "_tag2", `tag-${tagLabel}`, 80, 22, 0, 0, { parentId: "$" + p + "_tg" }),
    AL("$" + p + "_tag2", "horizontal", 6),
    PAD("$" + p + "_tag2", { horizontal: 10 }),
    CAL("$" + p + "_tag2", "CENTER"),
    TX(tagLabel, { parent: "$" + p + "_tag2", fs: 12, fill: INK.c3 }),
    VEC(p + "_tc2", "icon-close-s", ICON.close, 9, 9, { parent: "$" + p + "_tag2", stroke: INK.c4, sw: 1.5 }),
    FR(p + "_tsp", "spacer", 10, 10, 0, 0, { parentId: "$" + p + "_tg" }),
    CLEARF("$" + p + "_tsp"),
    AL("$" + p + "_tsp", "horizontal", 0),
    SIZ("$" + p + "_tsp", "FILL", "FIXED"),
    VEC(p + "_tb1", "icon-burger-s", ICON.burger, 14, 14, { parent: "$" + p + "_tg", stroke: INK.c3, sw: 1.5 }),
    FR(p + "_ct", short + "/Content", 1260, 824, 180, 76, { parentId: IDS[p + "_root"], fill: PAGE_BG }),
    AL("$" + p + "_ct", "vertical", 16),
    PAD("$" + p + "_ct", { all: 24 }),
  ];
}

/* ---------- exam table (local frames, DS tokens, 8 cols, inner 1180) ---------- */
const ECOLS = [
  { name: "考试名称", w: 260 }, { name: "考试类型", w: 130 }, { name: "题目数量", w: 100 },
  { name: "考试时长", w: 110 }, { name: "参与人数", w: 110 }, { name: "状态", w: 110 },
  { name: "创建时间", w: 130 }, { name: "操作", w: 230 },
];
const EXAM_ROWS = [
  ["期中数学模拟考", "高中数学", "35", "120分钟", "128", "Success", "2026-09-10"],
  ["英语四级模拟测试", "英语", "50", "90分钟", "256", "Neutral", "2026-09-08"],
  ["消防安全知识测试", "安全知识", "40", "60分钟", "98", "Warning", "2026-09-05"],
  ["期末物理模拟考", "高中物理", "45", "100分钟", "87", "Success", "2026-09-03"],
  ["新员工入职培训测试", "企业培训", "30", "45分钟", "142", "Neutral", "2026-08-28"],
  ["数据分析能力测评", "综合测评", "25", "40分钟", "63", "Warning", "2026-08-25"],
];
function cellFrame(p, as, w, parent, { h = 44, header = false } = {}) {
  const ref = "$" + p + "_" + as;
  return [
    FR(p + "_" + as, header ? "th-" : "td-", w, h, 0, 0, { parentId: parent }),
    AL(ref, "horizontal", 0),
    PAD(ref, { left: 12, right: 12, vertical: 10 }),
    CAL(ref, "CENTER"),
    SIZ(ref, "FIXED", "FILL"),
  ];
}
function examHeaderOps(p, parent, cols = ECOLS, rowRef = null) {
  if (rowRef) {
    // append cells to an existing header row (cross-batch real id)
    const ops = [];
    cols.forEach((c, i) => {
      ops.push(...cellFrame(p, `hc${ECOLS.indexOf(c)}`, c.w, rowRef, { h: 40, header: true }));
      ops.push(TX(c.name, { parent: "$" + p + `_hc${ECOLS.indexOf(c)}`, fs: 12, st: "Medium", fill: INK.c2 }));
    });
    return ops;
  }
  const ops = [
    FR(p + "_thr", "ExamList/TableHeader", 1180, 40, 0, 0, { parentId: parent, fill: PAGE_BG }),
    AL("$" + p + "_thr", "horizontal", 0),
    CAL("$" + p + "_thr", "CENTER"),
    SIZ("$" + p + "_thr", "FILL", "FIXED"),
  ];
  cols.forEach((c, i) => {
    ops.push(...cellFrame(p, `hc${i}`, c.w, "$" + p + "_thr", { h: 40, header: true }));
    ops.push(TX(c.name, { parent: "$" + p + `_hc${i}`, fs: 12, st: "Medium", fill: INK.c2 }));
  });
  return ops;
}
function examRowOps(p, as, rowData, parent, colIdxs, rowRef = null) {
  let ops = [];
  if (!rowRef) {
    const ref = "$" + p + "_" + as;
    ops = [
      FR(p + "_" + as, "ExamList/TableRow", 1180, 44, 0, 0, { parentId: parent, fill: SURFACE }),
      AL(ref, "horizontal", 0),
      CAL(ref, "CENTER"),
      SIZ(ref, "FILL", "FIXED"),
      STR(ref, STROKE, 1),
    ];
  }
  colIdxs.forEach((ci) => {
    const cref = "$" + p + `_${as}c${ci}`;
    if (ci === 5) {
      ops.push(...cellFrame(p, `${as}c5`, ECOLS[5].w, rowRef || "$" + p + "_" + as));
      ops.push(INST(p + "_" + as + "_bdg", IDS[`comp_bdg_${rowData[5]}`], { parent: cref }));
      return;
    }
    ops.push(...cellFrame(p, `${as}c${ci}`, ECOLS[ci].w, rowRef || "$" + p + "_" + as));
    if (ci === 7) {
      ops.push(AL(cref, "horizontal", 12));
      ops.push(TX("查看", { parent: cref, fs: 12, fill: PRI }));
      ops.push(TX("编辑", { parent: cref, fs: 12, fill: PRI }));
    } else {
      ops.push(TX(rowData[ci], { parent: cref, fs: 13, fill: INK.c1 }));
    }
  });
  return ops;
}
/* footer: 共 N 条 + pager instances + 10 条/页 */
function footerOps(p, parent, total) {
  return [
    FR(p + "_ft", "table-footer", 1180, 32, 0, 0, { parentId: parent }),
    AL("$" + p + "_ft", "horizontal", 0),
    PAD("$" + p + "_ft", { top: 8 }),
    CAL("$" + p + "_ft", "CENTER"),
    PAL("$" + p + "_ft", "SPACE_BETWEEN"),
    SIZ("$" + p + "_ft", "FILL", "HUG"),
    TX(`共 ${total} 条`, { parent: "$" + p + "_ft", fs: 12, fill: INK.c3 }),
    FR(p + "_pr", "pager", 500, 24, 0, 0, { parentId: "$" + p + "_ft" }),
    AL("$" + p + "_pr", "horizontal", 4),
    CAL("$" + p + "_pr", "CENTER"),
    SIZ("$" + p + "_pr", "HUG", "FIXED"),
    INST(p + "_pd1", IDS.comp_pag_Disabled, { parent: "$" + p + "_pr" }),
    INST(p + "_pa1", IDS.comp_pag_Active, { parent: "$" + p + "_pr" }),
    INST(p + "_pd2", IDS.comp_pag_Default, { parent: "$" + p + "_pr" }),
    INST(p + "_pd3", IDS.comp_pag_Default, { parent: "$" + p + "_pr" }),
    INST(p + "_pd4", IDS.comp_pag_Default, { parent: "$" + p + "_pr" }),
    INST(p + "_pd5", IDS.comp_pag_Disabled, { parent: "$" + p + "_pr" }),
    FR(p + "_ps", "page-size", 110, 28, 0, 0, { parentId: "$" + p + "_pr", fill: SURFACE }),
    AL("$" + p + "_ps", "horizontal", 4),
    PAD("$" + p + "_ps", { horizontal: 10 }),
    RAD("$" + p + "_ps", 6),
    STR("$" + p + "_ps", STROKE, 1),
    CAL("$" + p + "_ps", "CENTER"),
    PAL("$" + p + "_ps", "SPACE_BETWEEN"),
    SIZ("$" + p + "_ps", "FIXED", "FIXED"),
    TX("10 条/页", { parent: "$" + p + "_ps", fs: 12, fill: INK.c1 }),
    VEC(p + "_pcv", "chev", ICON.chevDown10, 10, 10, { parent: "$" + p + "_ps", stroke: INK.c3, sw: 1.5 }),
  ];
}
/* local card (white / radius4 / shadow / pad16) */
function cardOps(p, as, name, parent, w) {
  const ref = "$" + p + "_" + as;
  return [
    FR(p + "_" + as, name, w, 200, 0, 0, { parentId: parent, fill: SURFACE }),
    AL(ref, "vertical", 12),
    PAD(ref, { all: 16 }),
    RAD(ref, 4),
    CARD_SHADOW(ref),
    SIZ(ref, w ? "FIXED" : "FILL", "HUG"),
  ];
}
/* toggle (on/off) — 原生 Frame+ellipse，非正式 DS 组件 */
function toggleOps(p, as, on, parent) {
  const ref = "$" + p + "_" + as;
  return [
    FR(p + "_" + as, on ? "toggle-on" : "toggle-off", 40, 22, 0, 0, { parentId: parent, fill: on ? PRI : INK.c4 }),
    AL(ref, "horizontal", 0),
    PAD(ref, { all: 2 }),
    RAD(ref, 11),
    PAL(ref, on ? "MAX" : "MIN"),
    CAL(ref, "CENTER"),
    SIZ(ref, "FIXED", "FIXED"),
    EL(p + "_" + as + "_knob", "knob", 18, 18, { parent: ref, fill: SURFACE }),
  ];
}
/* form row: label(140) + control */
function formRowOps(p, as, label, parent) {
  const ref = "$" + p + "_" + as;
  return [
    FR(p + "_" + as, `form-${label}`, 1100, 30, 0, 0, { parentId: parent }),
    AL(ref, "horizontal", 16),
    CAL(ref, "CENTER"),
    SIZ(ref, "FILL", "HUG"),
    FR(p + "_" + as + "_lbl", "label", 140, 20, 0, 0, { parentId: ref }),
    AL("$" + p + "_" + as + "_lbl", "horizontal", 0),
    CAL("$" + p + "_" + as + "_lbl", "CENTER"),
    SIZ("$" + p + "_" + as + "_lbl", "FIXED", "HUG"),
    TX(label, { parent: "$" + p + "_" + as + "_lbl", fs: 13, fill: INK.c2 }),
  ];
}

/* ---------- helpers: instance text overrides (cross-batch, real ids) ---------- */
async function textsOf(nodeId, depth = 4) {
  const node = await cmd("get-node", { id: nodeId, depth });
  const out = [];
  (function w(n) {
    if (n.type === "TEXT") out.push({ id: n.id, text: n.characters });
    (n.children || []).forEach(w);
  })(node);
  return out;
}
async function overrideTexts(instId, newTexts, label) {
  const ts = await textsOf(instId);
  if (ts.length < newTexts.length) throw new Error(`${label}: instance has ${ts.length} texts, need ${newTexts.length}`);
  const ops = newTexts.map((t, i) => ({ op: "set-text-content", params: { id: ts[i].id, text: t } }));
  return runBatch(`ovr-${label}`, ops);
}
/* pager ‹ 1 2 3 … › */
async function overridePager(p) {
  const ids = [IDS[p + "_pd1"], IDS[p + "_pa1"], IDS[p + "_pd2"], IDS[p + "_pd3"], IDS[p + "_pd4"], IDS[p + "_pd5"]];
  const texts = ["‹", "1", "2", "3", "…", "›"];
  const ops = [];
  for (let i = 0; i < ids.length; i++) {
    const ts = await textsOf(ids[i], 3);
    if (ts[0]) ops.push({ op: "set-text-content", params: { id: ts[0].id, text: texts[i] } });
  }
  return runBatch(`ovr-${p}-pager`, ops);
}

/* ================================================================ */
async function main() {
  /* 0. cleanup: 9.2-A stray tmp nodes in DS zone (outside UserList) */
  if (!SKIP.has("cleanup")) {
    await runBatch("cleanup", [DEL("3:17"), DEL("4:142"), DEL("4:160"), DEL("4:177")]);
  }

  /* 1. zone labels */
  await runBatch("labels", [
    TX("Stage 9 / Product — Exam List (1440×900)", { x: 0, y: 2330, fs: 20, st: "Bold", fill: INK.c1, as: "lb_el" }),
    TX("Stage 9 / Product — Exam Detail (1440×900)", { x: 0, y: 3350, fs: 20, st: "Bold", fill: INK.c1, as: "lb_ed" }),
    TX("Stage 9 / Product — Settings (1440×900)", { x: 0, y: 4370, fs: 20, st: "Bold", fill: INK.c1, as: "lb_st" }),
  ]);

  /* ================= Exam List (y=2360) ================= */
  await runBatch("el-shell", shellOps("el", "Page/ExamList", 2360, { topbarCrumb: "考试管理", activeMenu: null }));
  await runBatch("el-menu", [
    ...menuOps("el", "m0", "首页", { icon: "house" }),
    ...menuOps("el", "m1", "更多菜单", { icon: "grid" }),
    ...menuOps("el", "m2", "菜单1", { h: 32, pad: 40 }),
    ...menuOps("el", "m3", "菜单1-1", { h: 32, pad: 56, active: true }),
    ...menuOps("el", "m4", "菜单1-2", { h: 32, pad: 56 }),
    ...menuOps("el", "m5", "菜单2", { icon: "doc" }),
  ]);
  await runBatch("el-tags-content", tagsContentOps("el", "Page/ExamList", "考试管理"));

  /* header: breadcrumb inst + title row + filter row */
  await runBatch("el-header", [
    INST("el_bc", IDS.comp_breadcrumb, { parent: IDS.el_ct }),
    FR("el_tr", "title-row", 1164, 32, 0, 0, { parentId: IDS.el_ct }),
    AL("$el_tr", "horizontal", 0),
    CAL("$el_tr", "CENTER"),
    PAL("$el_tr", "SPACE_BETWEEN"),
    SIZ("$el_tr", "FILL", "HUG"),
    TX("考试管理", { parent: "$el_tr", fs: 16, st: "Medium", fill: INK.c1 }),
    INST("el_bp", IDS.comp_btn_Primary, { parent: "$el_tr" }),
    FR("el_sr", "filter-row", 1100, 30, 0, 0, { parentId: IDS.el_ct }),
    AL("$el_sr", "horizontal", 12),
    CAL("$el_sr", "CENTER"),
    SIZ("$el_sr", "HUG", "HUG"),
    INST("el_in", IDS.comp_inp_Default, { parent: "$el_sr" }),
    INST("el_se1", IDS.comp_sel, { parent: "$el_sr" }),
    INST("el_se2", IDS.comp_sel, { parent: "$el_sr" }),
    INST("el_se3", IDS.comp_sel, { parent: "$el_sr" }),
    INST("el_bs", IDS.comp_btn_Secondary, { parent: "$el_sr" }),
    INST("el_bg", IDS.comp_btn_Ghost, { parent: "$el_sr" }),
  ]);

  /* table card + header (split small batches) */
  await runBatch("el-card", cardOps("el", "cd", "ExamList/TableCard", IDS.el_ct, null));
  await runBatch("el-th0", examHeaderOps("el", IDS.el_cd, ECOLS.slice(0, 4)));
  await runBatch("el-th1", examHeaderOps("el", null, ECOLS.slice(4), IDS.el_thr));
  for (const [ri, row] of EXAM_ROWS.entries()) {
    const as = `r${ri}`;
    await runBatch(`el-${as}a`, examRowOps("el", as, row, IDS.el_cd, [0, 1, 2, 3]));
    await runBatch(`el-${as}b`, examRowOps("el", as, row, null, [4, 5, 6], IDS[`el_${as}`]));
    await runBatch(`el-${as}c`, examRowOps("el", as, row, null, [7], IDS[`el_${as}`]));
  }
  await runBatch("el-footer", footerOps("el", IDS.el_cd, 128));
  await overridePager("el");

  /* ExamList instance text overrides */
  await overrideTexts(IDS.el_bp, ["+ 新建考试"], "el-btn-primary");
  await overrideTexts(IDS.el_in, ["搜索考试名称"], "el-input");
  await overrideTexts(IDS.el_se1, ["考试状态"], "el-sel1");
  await overrideTexts(IDS.el_se2, ["考试类型"], "el-sel2");
  await overrideTexts(IDS.el_se3, ["创建时间"], "el-sel3");
  await overrideTexts(IDS.el_bs, ["搜索"], "el-btn-search");
  await overrideTexts(IDS.el_bg, ["重置"], "el-btn-reset");
  await overrideTexts(IDS.el_bc, ["首页", "考试管理"], "el-breadcrumb");

  /* ExamList state specimens at x=1560 */
  await runBatch("el-specimens", [
    TX("ExamList / State / Empty（无匹配考试）", { x: 1560, y: 2360, fs: 13, st: "Medium", fill: INK.c2 }),
    FR("sp_el_E", "ExamList/State/Empty", 420, 260, 1560, 2390, { fill: SURFACE }),
    AL("$sp_el_E", "vertical", 0),
    RAD("$sp_el_E", 4),
    CARD_SHADOW("$sp_el_E"),
    CAL("$sp_el_E", "CENTER"),
    PAL("$sp_el_E", "CENTER"),
    INST("i_sp_el_E", IDS.comp_st_Empty, { parent: "$sp_el_E" }),
    TX("ExamList / State / Error（加载失败）", { x: 1560, y: 2700, fs: 13, st: "Medium", fill: INK.c2 }),
    FR("sp_el_R", "ExamList/State/Error", 420, 260, 1560, 2730, { fill: SURFACE }),
    AL("$sp_el_R", "vertical", 0),
    RAD("$sp_el_R", 4),
    CARD_SHADOW("$sp_el_R"),
    CAL("$sp_el_R", "CENTER"),
    PAL("$sp_el_R", "CENTER"),
    INST("i_sp_el_R", IDS.comp_st_Error, { parent: "$sp_el_R" }),
    TX("ExamList / State / Loading（加载中，复用 DS/LoadingState）", { x: 1560, y: 3040, fs: 13, st: "Medium", fill: INK.c2 }),
    FR("sp_el_L", "ExamList/State/Loading", 620, 180, 1560, 3070, { fill: SURFACE }),
    AL("$sp_el_L", "vertical", 0),
    PAD("$sp_el_L", { all: 24 }),
    RAD("$sp_el_L", 4),
    CARD_SHADOW("$sp_el_L"),
    CAL("$sp_el_L", "CENTER"),
    PAL("$sp_el_L", "CENTER"),
    INST("i_sp_el_L", IDS.comp_loading, { parent: "$sp_el_L" }),
  ]);

  /* ================= Exam Detail (y=3380) ================= */
  await runBatch("ed-shell", shellOps("ed", "Page/ExamDetail", 3380, { topbarCrumb: "考试管理", activeMenu: null }));
  await runBatch("ed-menu", [
    ...menuOps("ed", "m0", "首页", { icon: "house" }),
    ...menuOps("ed", "m1", "更多菜单", { icon: "grid" }),
    ...menuOps("ed", "m2", "菜单1", { h: 32, pad: 40 }),
    ...menuOps("ed", "m3", "菜单1-1", { h: 32, pad: 56, active: true }),
    ...menuOps("ed", "m4", "菜单1-2", { h: 32, pad: 56 }),
    ...menuOps("ed", "m5", "菜单2", { icon: "doc" }),
  ]);
  await runBatch("ed-tags-content", tagsContentOps("ed", "Page/ExamDetail", "考试管理"));

  /* header: 3-level breadcrumb (local) + title + 编辑/返回 */
  await runBatch("ed-header", [
    FR("ed_bc", "ExamDetail/Breadcrumb", 400, 20, 0, 0, { parentId: IDS.ed_ct }),
    AL("$ed_bc", "horizontal", 8),
    CAL("$ed_bc", "CENTER"),
    SIZ("$ed_bc", "HUG", "HUG"),
    TX("首页", { parent: "$ed_bc", fs: 12, fill: INK.c2 }),
    TX("/", { parent: "$ed_bc", fs: 12, fill: INK.c4 }),
    TX("考试管理", { parent: "$ed_bc", fs: 12, fill: INK.c2 }),
    TX("/", { parent: "$ed_bc", fs: 12, fill: INK.c4 }),
    TX("期中数学模拟考", { parent: "$ed_bc", fs: 12, st: "Medium", fill: INK.c1 }),
    FR("ed_tr", "title-row", 1164, 32, 0, 0, { parentId: IDS.ed_ct }),
    AL("$ed_tr", "horizontal", 12),
    CAL("$ed_tr", "CENTER"),
    PAL("$ed_tr", "SPACE_BETWEEN"),
    SIZ("$ed_tr", "FILL", "HUG"),
    TX("期中数学模拟考", { parent: "$ed_tr", fs: 16, st: "Medium", fill: INK.c1 }),
    FR("ed_act", "actions", 300, 30, 0, 0, { parentId: "$ed_tr" }),
    AL("$ed_act", "horizontal", 12),
    CAL("$ed_act", "CENTER"),
    SIZ("$ed_act", "HUG", "HUG"),
    INST("ed_be", IDS.comp_btn_Secondary, { parent: "$ed_act" }),
    INST("ed_br", IDS.comp_btn_Ghost, { parent: "$ed_act" }),
  ]);
  await overrideTexts(IDS.ed_be, ["编辑"], "ed-btn-edit");
  await overrideTexts(IDS.ed_br, ["返回"], "ed-btn-back");

  /* info card (2 rows of label/value) + tabs */
  function infoItem(p, as, label, parent) {
    return [
      FR(p + "_" + as, `info-${label}`, 200, 44, 0, 0, { parentId: parent }),
      AL("$" + p + "_" + as, "vertical", 4),
      SIZ("$" + p + "_" + as, "HUG", "HUG"),
      TX(label, { parent: "$" + p + "_" + as, fs: 12, fill: INK.c3 }),
    ];
  }
  await runBatch("ed-card1", [
    ...cardOps("ed", "ic", "ExamDetail/InfoCard", IDS.ed_ct, null),
    FR("ed_ir0", "info-row-1", 1100, 48, 0, 0, { parentId: "$ed_ic" }),
    AL("$ed_ir0", "horizontal", 48),
    CAL("$ed_ir0", "CENTER"),
    SIZ("$ed_ir0", "FILL", "HUG"),
    ...infoItem("ed", "ii00", "考试名称", "$ed_ir0"),
    TX("期中数学模拟考", { parent: "$ed_ii00", fs: 13, st: "Medium", fill: INK.c1 }),
    ...infoItem("ed", "ii01", "考试类型", "$ed_ir0"),
    TX("高中数学", { parent: "$ed_ii01", fs: 13, fill: INK.c1 }),
    ...infoItem("ed", "ii02", "考试时长", "$ed_ir0"),
    TX("120分钟", { parent: "$ed_ii02", fs: 13, fill: INK.c1 }),
    ...infoItem("ed", "ii03", "题目数量", "$ed_ir0"),
    TX("35题", { parent: "$ed_ii03", fs: 13, fill: INK.c1 }),
  ]);
  await runBatch("ed-info2", [
    FR("ed_ir1", "info-row-2", 1100, 48, 0, 0, { parentId: IDS.ed_ic }),
    AL("$ed_ir1", "horizontal", 48),
    CAL("$ed_ir1", "CENTER"),
    SIZ("$ed_ir1", "FILL", "HUG"),
    ...infoItem("ed", "ii10", "参与人数", "$ed_ir1"),
    TX("128人", { parent: "$ed_ii10", fs: 13, fill: INK.c1 }),
    ...infoItem("ed", "ii11", "状态", "$ed_ir1"),
    INST("ed_bdg", IDS.comp_bdg_Success, { parent: "$ed_ii11" }),
    ...infoItem("ed", "ii12", "创建时间", "$ed_ir1"),
    TX("2026-09-15", { parent: "$ed_ii12", fs: 13, fill: INK.c1 }),
  ]);
  await runBatch("ed-tabs", [
    FR("ed_tabs", "ExamDetail/Tabs", 400, 36, 0, 0, { parentId: IDS.ed_ct }),
    AL("$ed_tabs", "horizontal", 24),
    CAL("$ed_tabs", "CENTER"),
    SIZ("$ed_tabs", "HUG", "HUG"),
    FR("ed_tab1", "tab-考试信息-selected", 90, 32, 0, 0, { parentId: "$ed_tabs" }),
    AL("$ed_tab1", "vertical", 6),
    CAL("$ed_tab1", "CENTER"),
    SIZ("$ed_tab1", "HUG", "HUG"),
    TX("考试信息", { parent: "$ed_tab1", fs: 14, st: "Medium", fill: PRI }),
    RC("ed_tab1u", "underline", 56, 2, { parent: "$ed_tab1", fill: PRI }),
    SIZ("$ed_tab1u", "FILL", "FIXED"),
    FR("ed_tab2", "tab-考试成绩", 90, 32, 0, 0, { parentId: "$ed_tabs" }),
    AL("$ed_tab2", "vertical", 6),
    CAL("$ed_tab2", "CENTER"),
    SIZ("$ed_tab2", "HUG", "HUG"),
    TX("考试成绩", { parent: "$ed_tab2", fs: 14, fill: INK.c2 }),
  ]);

  /* tab panel 1: 考试信息 */
  await runBatch("ed-panel1", [
    ...cardOps("ed", "p1", "ExamDetail/TabPanel-考试信息", IDS.ed_ct, null),
    FR("ed_pr0", "row-考试说明", 1100, 20, 0, 0, { parentId: "$ed_p1" }),
    AL("$ed_pr0", "horizontal", 16),
    SIZ("$ed_pr0", "FILL", "HUG"),
    TX("考试说明", { parent: "$ed_pr0", fs: 13, fill: INK.c3, name: "lbl" }),
    TX("覆盖本学期第 1–6 章内容，重点考查函数与几何。", { parent: "$ed_pr0", fs: 13, fill: INK.c1 }),
    FR("ed_pr1", "row-考试规则", 1100, 20, 0, 0, { parentId: "$ed_p1" }),
    AL("$ed_pr1", "horizontal", 16),
    SIZ("$ed_pr1", "FILL", "HUG"),
    TX("考试规则", { parent: "$ed_pr1", fs: 13, fill: INK.c3, name: "lbl" }),
    TX("闭卷考试，独立完成，禁止携带计算器。", { parent: "$ed_pr1", fs: 13, fill: INK.c1 }),
  ]);
  await runBatch("ed-panel1b", [
    FR("ed_pr2", "row-开始时间", 1100, 20, 0, 0, { parentId: IDS.ed_p1 }),
    AL("$ed_pr2", "horizontal", 16),
    SIZ("$ed_pr2", "FILL", "HUG"),
    TX("开始时间", { parent: "$ed_pr2", fs: 13, fill: INK.c3, name: "lbl" }),
    TX("2026-09-20 09:00", { parent: "$ed_pr2", fs: 13, fill: INK.c1 }),
    FR("ed_pr3", "row-结束时间", 1100, 20, 0, 0, { parentId: IDS.ed_p1 }),
    AL("$ed_pr3", "horizontal", 16),
    SIZ("$ed_pr3", "FILL", "HUG"),
    TX("结束时间", { parent: "$ed_pr3", fs: 13, fill: INK.c3, name: "lbl" }),
    TX("2026-09-20 11:00", { parent: "$ed_pr3", fs: 13, fill: INK.c1 }),
    FR("ed_ftr", "ExamDetail/FooterActions", 1100, 30, 0, 0, { parentId: IDS.ed_ct }),
    AL("$ed_ftr", "horizontal", 12),
    CAL("$ed_ftr", "CENTER"),
    PAL("$ed_ftr", "MAX"),
    SIZ("$ed_ftr", "FILL", "HUG"),
    INST("ed_fb", IDS.comp_btn_Secondary, { parent: "$ed_ftr" }),
    INST("ed_fp", IDS.comp_btn_Primary, { parent: "$ed_ftr" }),
  ]);
  await overrideTexts(IDS.ed_fb, ["返回"], "ed-footer-back");
  await overrideTexts(IDS.ed_fp, ["编辑考试"], "ed-footer-edit");

  /* 成绩 tab specimen (x=1560): score table 5 cols × 5 rows */
  const SCOLS = [
    { name: "考生", w: 240 }, { name: "得分", w: 160 }, { name: "正确题数", w: 200 },
    { name: "用时", w: 200 }, { name: "状态", w: 180 },
  ];
  const SCORE_ROWS = [
    ["张伟", "92", "33", "88分钟", "Success"],
    ["李娜", "85", "30", "95分钟", "Success"],
    ["王强", "58", "20", "110分钟", "Error"],
    ["刘洋", "76", "27", "102分钟", "Success"],
    ["陈静", "45", "15", "118分钟", "Error"],
  ];
  function scoreCell(p, as, w, parent, { header = false, h = 44 } = {}) {
    return [
      FR(p + "_" + as, header ? "th-" : "td-", w, h, 0, 0, { parentId: parent }),
      AL("$" + p + "_" + as, "horizontal", 0),
      PAD("$" + p + "_" + as, { left: 12, right: 12, vertical: 10 }),
      CAL("$" + p + "_" + as, "CENTER"),
      SIZ("$" + p + "_" + as, "FIXED", "FILL"),
    ];
  }
  await runBatch("ed-sp0", [
    TX("ExamDetail / Tab / 考试成绩（静态 specimen，无 Prototype）", { x: 1560, y: 3380, fs: 13, st: "Medium", fill: INK.c2 }),
    FR("sp_ed", "ExamDetail/Tab/考试成绩", 1012, 400, 1560, 3410, { fill: SURFACE }),
    AL("$sp_ed", "vertical", 0),
    PAD("$sp_ed", { all: 16 }),
    RAD("$sp_ed", 4),
    CARD_SHADOW("$sp_ed"),
    SIZ("$sp_ed", "FIXED", "HUG"),
    FR("ed_sthr", "Scores/TableHeader", 980, 40, 0, 0, { parentId: "$sp_ed", fill: PAGE_BG }),
    AL("$ed_sthr", "horizontal", 0),
    CAL("$ed_sthr", "CENTER"),
    SIZ("$ed_sthr", "FILL", "FIXED"),
    ...scoreCell("ed", "sh0", SCOLS[0].w, "$ed_sthr", { header: true, h: 40 }),
    TX(SCOLS[0].name, { parent: "$ed_sh0", fs: 12, st: "Medium", fill: INK.c2 }),
    ...scoreCell("ed", "sh1", SCOLS[1].w, "$ed_sthr", { header: true, h: 40 }),
    TX(SCOLS[1].name, { parent: "$ed_sh1", fs: 12, st: "Medium", fill: INK.c2 }),
  ]);
  await runBatch("ed-sp1", [
    ...scoreCell("ed", "sh2", SCOLS[2].w, IDS.ed_sthr, { header: true, h: 40 }),
    TX(SCOLS[2].name, { parent: "$ed_sh2", fs: 12, st: "Medium", fill: INK.c2 }),
    ...scoreCell("ed", "sh3", SCOLS[3].w, IDS.ed_sthr, { header: true, h: 40 }),
    TX(SCOLS[3].name, { parent: "$ed_sh3", fs: 12, st: "Medium", fill: INK.c2 }),
    ...scoreCell("ed", "sh4", SCOLS[4].w, IDS.ed_sthr, { header: true, h: 40 }),
    TX(SCOLS[4].name, { parent: "$ed_sh4", fs: 12, st: "Medium", fill: INK.c2 }),
  ]);
  for (const [ri, row] of SCORE_ROWS.entries()) {
    await runBatch(`ed-sr${ri}a`, [
      FR(`ed_sr${ri}`, "Scores/TableRow", 980, 44, 0, 0, { parentId: IDS.sp_ed, fill: SURFACE }),
      AL("$ed_sr" + ri, "horizontal", 0),
      CAL("$ed_sr" + ri, "CENTER"),
      SIZ("$ed_sr" + ri, "FILL", "FIXED"),
      STR("$ed_sr" + ri, STROKE, 1),
      ...scoreCell("ed", `sr${ri}c0`, SCOLS[0].w, "$ed_sr" + ri),
      TX(row[0], { parent: "$ed_sr" + ri + "c0", fs: 13, fill: INK.c1 }),
      ...scoreCell("ed", `sr${ri}c1`, SCOLS[1].w, "$ed_sr" + ri),
      TX(row[1], { parent: "$ed_sr" + ri + "c1", fs: 13, fill: INK.c1 }),
      ...scoreCell("ed", `sr${ri}c2`, SCOLS[2].w, "$ed_sr" + ri),
      TX(row[2], { parent: "$ed_sr" + ri + "c2", fs: 13, fill: INK.c1 }),
    ]);
    await runBatch(`ed-sr${ri}b`, [
      ...scoreCell("ed", `sr${ri}c3`, SCOLS[3].w, IDS[`ed_sr${ri}`]),
      TX(row[3], { parent: "$ed_sr" + ri + "c3", fs: 13, fill: INK.c1 }),
      ...scoreCell("ed", `sr${ri}c4`, SCOLS[4].w, IDS[`ed_sr${ri}`]),
      INST(`ed_sb${ri}`, IDS[`comp_bdg_${row[4]}`], { parent: "$ed_sr" + ri + "c4" }),
    ]);
  }

  /* ================= Settings (y=4400) ================= */
  await runBatch("st-shell", shellOps("st", "Page/Settings", 4400, { topbarCrumb: "系统设置", activeMenu: null }));
  await runBatch("st-menu", [
    ...menuOps("st", "m0", "首页", { icon: "house" }),
    ...menuOps("st", "m1", "更多菜单", { icon: "grid" }),
    ...menuOps("st", "m2", "菜单1", { h: 32, pad: 40 }),
    ...menuOps("st", "m3", "菜单1-1", { h: 32, pad: 56 }),
    ...menuOps("st", "m4", "菜单1-2", { h: 32, pad: 56 }),
    ...menuOps("st", "m5", "菜单2", { icon: "doc", active: true }),
  ]);
  await runBatch("st-tags-content", tagsContentOps("st", "Page/Settings", "系统设置"));

  await runBatch("st-header", [
    INST("st_bc", IDS.comp_breadcrumb, { parent: IDS.st_ct }),
    FR("st_tr", "title-row", 1164, 32, 0, 0, { parentId: IDS.st_ct }),
    AL("$st_tr", "horizontal", 0),
    CAL("$st_tr", "CENTER"),
    SIZ("$st_tr", "FILL", "HUG"),
    TX("系统设置", { parent: "$st_tr", fs: 16, st: "Medium", fill: INK.c1 }),
  ]);
  await overrideTexts(IDS.st_bc, ["首页", "系统设置"], "st-breadcrumb");

  /* card 1: 基础设置 (2 inputs + 2 selects) */
  await runBatch("st-card1a", [
    ...cardOps("st", "c1", "Settings/基础设置", IDS.st_ct, null),
    TX("基础设置", { parent: "$st_c1", fs: 16, st: "Medium", fill: INK.c1 }),
    ...formRowOps("st", "f10", "系统名称", "$st_c1"),
    INST("st_i10", IDS.comp_inp_Default, { parent: "$st_f10" }),
    ...formRowOps("st", "f11", "管理员邮箱", "$st_c1"),
    INST("st_i11", IDS.comp_inp_Default, { parent: "$st_f11" }),
  ]);
  await runBatch("st-card1b", [
    ...formRowOps("st", "f12", "默认语言", IDS.st_c1),
    INST("st_s12", IDS.comp_sel, { parent: "$st_f12" }),
    ...formRowOps("st", "f13", "时区", IDS.st_c1),
    INST("st_s13", IDS.comp_sel, { parent: "$st_f13" }),
  ]);
  /* card 2: 考试设置 (2 inputs + toggle on) */
  await runBatch("st-card2a", [
    ...cardOps("st", "c2", "Settings/考试设置", IDS.st_ct, null),
    TX("考试设置", { parent: "$st_c2", fs: 16, st: "Medium", fill: INK.c1 }),
    ...formRowOps("st", "f20", "默认考试时长", "$st_c2"),
    INST("st_i20", IDS.comp_inp_Default, { parent: "$st_f20" }),
    ...formRowOps("st", "f21", "默认题目数量", "$st_c2"),
    INST("st_i21", IDS.comp_inp_Default, { parent: "$st_f21" }),
  ]);
  await runBatch("st-card2b", [
    ...formRowOps("st", "f22", "允许重复考试", IDS.st_c2),
    ...toggleOps("st", "tg0", true, "$st_f22"),
  ]);
  /* card 3: 通知设置 (toggle on + toggle off) + footer buttons */
  await runBatch("st-card3a", [
    ...cardOps("st", "c3", "Settings/通知设置", IDS.st_ct, null),
    TX("通知设置", { parent: "$st_c3", fs: 16, st: "Medium", fill: INK.c1 }),
    ...formRowOps("st", "f30", "考试完成通知", "$st_c3"),
    ...toggleOps("st", "tg1", true, "$st_f30"),
  ]);
  await runBatch("st-card3b", [
    ...formRowOps("st", "f31", "系统通知", IDS.st_c3),
    ...toggleOps("st", "tg2", false, "$st_f31"),
    FR("st_ftr", "Settings/FooterActions", 1100, 30, 0, 0, { parentId: IDS.st_ct }),
    AL("$st_ftr", "horizontal", 12),
    CAL("$st_ftr", "CENTER"),
    PAL("$st_ftr", "MIN"),
    SIZ("$st_ftr", "FILL", "HUG"),
    INST("st_fp", IDS.comp_btn_Primary, { parent: "$st_ftr" }),
    INST("st_fg", IDS.comp_btn_Ghost, { parent: "$st_ftr" }),
  ]);
  console.log("BUILD DONE. ids saved.");
  fs.writeFileSync(new URL("../.vibe/stage9/exam-settings-build-log.json", import.meta.url), JSON.stringify(LOG, null, 1));
}

main().catch((e) => {
  console.error("BUILD FAILED:", e.message);
  fs.writeFileSync(new URL("../.vibe/stage9/exam-settings-build-log.json", import.meta.url), JSON.stringify(LOG, null, 1));
  process.exit(1);
});
