/**
 * Stage 9.2-A — Figma DS Extension + User List builder.
 * Serial `run` batches of atomic ops; read-back between batches.
 * Target: NEW file (Untitled), Page 1 — isolated zones (DS y=0..1200, UserList y>=1300).
 */
import fs from "fs";

const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
const BRIDGE = "http://127.0.0.1:45677/v1/command";
const LOG = [];
const IDS_FILE = new URL("../.vibe/stage9/user-list-build-ids.json", import.meta.url);
const IDS = fs.existsSync(IDS_FILE) ? JSON.parse(fs.readFileSync(IDS_FILE, "utf8")) : {}; // as-name -> real node id
const SKIP = new Set((process.argv[2] || "").split(",").filter(Boolean));
function saveIds() { fs.writeFileSync(IDS_FILE, JSON.stringify(IDS, null, 1)); }

async function cmd(op, params = {}, timeoutMs = 300000) {
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
  if (SKIP.has(label)) { console.log(`[skip ${label}]`); return { data: { ops: [] }, ids: {} }; }
  const payload = ops.map((o) => ({ op: o.op, params: o.params, as: o.as }));
  const t0 = Date.now();
  const data = await cmd("run", { ops: payload });
  const got = {};
  data.ops.forEach((r, i) => {
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
const AL = (id, mode, spacing, p = {}) => ({ op: "set-auto-layout", params: { id, mode, spacing, ...p } });
const PAD = (id, p) => ({ op: "set-padding", params: { id, ...p } });
const RAD = (id, r) => ({ op: "set-corner-radius", params: { id, radius: r } });
const FILL = (id, c, p = {}) => ({ op: "set-fill", params: { id, color: c, ...p } });
const CLEARF = (id) => ({ op: "set-fill", params: { id, clear: true } });
const STR = (id, c, w = 1) => ({ op: "set-stroke", params: { id, color: c, strokeWeight: w } });
const SIZ = (id, h, v) => ({ op: "set-layout-sizing", params: { id, horizontal: h, vertical: v } });
const PAL = (id, a) => ({ op: "set-primary-axis-align", params: { id, align: a } });
const CAL = (id, a) => ({ op: "set-counter-axis-align", params: { id, align: a } });
const COMP = (as, id, name) => ({ op: "create-component", as, params: { id, name } });
const INST = (as, compId, o = {}) => ({ op: "create-instance", as, params: { componentId: compId, parentId: o.parent, x: o.x, y: o.y } });
const CARD_SHADOW = (id) => ({ op: "set-effects", params: { id, effects: [{ type: "DROP_SHADOW", color: "#000000", opacity: 0.06, x: 0, y: 1, blur: 4 }] } });

const FONT = { fam: "Noto Sans SC" };
const INK = { c1: "#303133", c2: "#606266", c3: "#909399", c4: "#C0C4CC" };

/* icon paths (14px grid unless noted) — vectorPaths supports only M/L/Q/C/Z */
const ICON = {
  search: "M11 6.2 C11 8.85 8.85 11 6.2 11 C3.55 11 1.4 8.85 1.4 6.2 C1.4 3.55 3.55 1.4 6.2 1.4 C8.85 1.4 11 3.55 11 6.2 Z M9.7 9.7 L12.8 12.8",
  chevDown: "M3 5 L7 9 L11 5",
  chevDown10: "M2.5 3.5 L5 6 L7.5 3.5",
  plus: "M7 2 L7 12 M2 7 L12 7",
  close: "M2 2 L10 10 M10 2 L2 10",
  burger: "M1.5 3.5 L14.5 3.5 M1.5 7 L14.5 7 M1.5 10.5 L14.5 10.5",
  burger16: "M1.5 4 L14.5 4 M1.5 8 L14.5 8 M1.5 12 L14.5 12",
  house: "M7 1.2 L12.8 6.2 L12.8 12.8 L1.2 12.8 L1.2 6.2 Z",
  grid: "M1.5 1.5 L5.8 1.5 L5.8 5.8 L1.5 5.8 Z M8.2 1.5 L12.5 1.5 L12.5 5.8 L8.2 5.8 Z M1.5 8.2 L5.8 8.2 L5.8 12.5 L1.5 8.2 Z M8.2 8.2 L12.5 8.2 L12.5 12.5 L8.2 12.5 Z",
  doc: "M3 1.5 L8.8 1.5 L12 4.7 L12 12.5 L3 12.5 Z",
  check: "M2.5 7.5 L6 11 L12 3.5",
  warnTri: "M7 1.5 L13 12 L1 12 Z",
  warnLine: "M7 5.2 L7 8.2",
  errCircle: "M12.5 7 C12.5 10.04 10.04 12.5 7 12.5 C3.96 12.5 1.5 10.04 1.5 7 C1.5 3.96 3.96 1.5 7 1.5 C10.04 1.5 12.5 3.96 12.5 7 Z M4.8 4.8 L9.2 9.2 M9.2 4.8 L4.8 9.2",
  emptyBox: "M2 4.5 L4.2 2.5 L9.8 2.5 L12 4.5 L12 11.5 L2 11.5 Z M2 4.5 L12 4.5",
  tri1: "M10 1 L19 18 L1 18 Z",
  tri2: "M12.5 8 L18.5 18 L6.5 18 Z",
};

/* ---------- main ---------- */
async function main() {
  /* Zone labels */
  await runBatch("labels", [
    TX("Stage 9 / Design System Extension — 9.2-A", { x: 0, y: 0, fs: 20, st: "Bold", fill: INK.c1, as: "dsLabel" }),
    TX("Stage 9 / Product — User List (1440×900) + State Specimens", { x: 0, y: 1300, fs: 20, st: "Bold", fill: INK.c1, as: "pLabel" }),
  ]);

  /* Buttons ×4 */
  function buttonOps(name, label, v, x) {
    const as = `btn_${name}`;
    const ops = [
      FR(as, `tmp-${name}`, 80, 30, x, 90, {}),
      AL("$" + as, "horizontal", 6),
      PAD("$" + as, { horizontal: 14, vertical: 5 }),
      RAD("$" + as, 6),
      CAL("$" + as, "CENTER"),
    ];
    if (v === "primary") ops.push(FILL("$" + as, "#5A5CF0"));
    if (v === "secondary") { ops.push(FILL("$" + as, "#FFFFFF"), STR("$" + as, "#E4E7ED", 1)); }
    if (v === "ghost") ops.push(CLEARF("$" + as));
    if (v === "danger") ops.push(FILL("$" + as, "#F56C6C"));
    ops.push(TX(label, { parent: "$" + as, fs: 13, st: "Medium", fill: v === "ghost" ? INK.c2 : v === "secondary" ? INK.c1 : "#FFFFFF" }));
    ops.push(SIZ("$" + as, "HUG", "HUG"));
    ops.push(COMP(`comp_btn_${name}`, "$" + as, `DS/Button/${name}`));
    return ops;
  }
  await runBatch("buttons", [
    ...buttonOps("Primary", "新建用户", "primary", 0),
    ...buttonOps("Secondary", "搜索", "secondary", 140),
    ...buttonOps("Ghost", "重置", "ghost", 250),
    ...buttonOps("Danger", "删除", "danger", 330),
  ]);

  /* Inputs ×3 + Select */
  function inputOps(name, strokeColor, x, w = 240) {
    const as = `inp_${name}`;
    return [
      FR(as, `tmp-input-${name}`, w, 30, x, 200, { fill: "#FFFFFF" }),
      AL("$" + as, "horizontal", 6),
      PAD("$" + as, { horizontal: 12 }),
      RAD("$" + as, 6),
      STR("$" + as, strokeColor, 1),
      CAL("$" + as, "CENTER"),
      VEC(`v_${name}`, "icon-search", ICON.search, 14, 14, { parent: "$" + as, stroke: INK.c3, sw: 1.5 }),
      TX(name === "Default" ? "搜索用户名、邮箱" : "搜索用户名、邮箱", { parent: "$" + as, fs: 13, fill: name === "Default" ? INK.c3 : INK.c2 }),
      COMP(`comp_inp_${name}`, "$" + as, `DS/Input/${name}`),
    ];
  }
  const selectOps = [
    FR("sel", "tmp-select", 160, 30, 0, 290, { fill: "#FFFFFF" }),
    AL("$sel", "horizontal", 6),
    PAD("$sel", { horizontal: 12 }),
    RAD("$sel", 6),
    STR("$sel", "#E4E7ED", 1),
    CAL("$sel", "CENTER"),
    PAL("$sel", "SPACE_BETWEEN"),
    SIZ("$sel", "FIXED", "FIXED"),
    TX("状态", { parent: "$sel", fs: 13, fill: INK.c1 }),
    VEC("v_sel", "icon-chevron-down", ICON.chevDown, 12, 12, { parent: "$sel", stroke: INK.c3, sw: 1.5 }),
    COMP("comp_sel", "$sel", "DS/Select/Default"),
  ];
  await runBatch("inputs", [
    ...inputOps("Default", "#E4E7ED", 0),
    ...inputOps("Focus", "#5A5CF0", 260),
    ...inputOps("Error", "#F56C6C", 520),
    ...selectOps,
  ]);

  /* Badges ×5 */
  function badgeOps(name, color, label, x) {
    const as = `bdg_${name}`;
    return [
      FR(as, `tmp-badge-${name}`, 60, 20, x, 370, {}),
      AL("$" + as, "horizontal", 6),
      CAL("$" + as, "CENTER"),
      EL(`dot_${name}`, "dot", 8, 8, { parent: "$" + as, fill: color }),
      TX(label, { parent: "$" + as, fs: 12, fill: color }),
      SIZ("$" + as, "HUG", "HUG"),
      COMP(`comp_bdg_${name}`, "$" + as, `DS/Badge/${name}`),
    ];
  }
  await runBatch("badges", [
    ...badgeOps("Success", "#67C23A", "启用", 0),
    ...badgeOps("Warning", "#FAC858", "待激活", 120),
    ...badgeOps("Error", "#F56C6C", "禁用", 250),
    ...badgeOps("Info", "#409EFF", "试运行", 370),
    ...badgeOps("Neutral", "#909399", "已锁定", 500),
  ]);

  /* Pagination ×3 */
  function pagOps(name, label, v, x) {
    const as = `pag_${name}`;
    const ops = [
      FR(as, `tmp-pag-${name}`, 24, 24, x, 700),
      AL("$" + as, "horizontal", 0),
      RAD("$" + as, 6),
      PAL("$" + as, "CENTER"),
      CAL("$" + as, "CENTER"),
    ];
    if (v === "active") ops.push(FILL("$" + as, "#5A5CF0"));
    ops.push(TX(label, { parent: "$" + as, fs: 12, fill: v === "active" ? "#FFFFFF" : v === "disabled" ? INK.c4 : INK.c2 }));
    ops.push(COMP(`comp_pag_${name}`, "$" + as, `DS/Pagination/${name}`));
    return ops;
  }
  await runBatch("pagination", [
    ...pagOps("Default", "2", "default", 0),
    ...pagOps("Active", "1", "active", 40),
    ...pagOps("Disabled", "…", "disabled", 80),
  ]);

  /* Table header + Row (base) */
  const COLS = [240, 260, 120, 180, 180, 200];
  const HEADS = ["用户", "邮箱", "状态", "注册时间", "最近登录", "操作"];
  function cellOps(as, name, w, h, parent, fill, children) {
    const ops = [
      FR(as, name, w, h, 0, 0, fill ? { parentId: parent, fill } : { parentId: parent }),
      AL("$" + as, "horizontal", children.spacing ?? 0),
      PAD("$" + as, { horizontal: 12 }),
      CAL("$" + as, "CENTER"),
    ];
    return ops;
  }
  function headerOps() {
    const ops = [FR("hd", "tmp-table-header", 1180, 40, 0, 450, { fill: "#F2F3F5" }), AL("$hd", "horizontal", 0), CAL("$hd", "CENTER"), SIZ("$hd", "FIXED", "FIXED")];
    HEADS.forEach((t, i) => {
      const c = `hc${i}`;
      ops.push(...cellOps(c, `cell-${t}`, COLS[i], 40, "$hd", null, {}));
      if (i === 4) ops.push(SIZ("$" + c, "FILL", "FIXED"));
      ops.push(TX(t, { parent: "$" + c, fs: 12, st: "Medium", fill: INK.c2 }));
    });
    ops.push(COMP("comp_tbl_header", "$hd", "DS/Table/Header"));
    return ops;
  }
  const ROW_USERS = [
    ["林晓", "lin.xiao@example.com", "Success", "2021-03-12", "2026-09-14"],
    ["王强", "wang.qiang@example.com", "Warning", "2022-07-01", "2026-09-13"],
    ["赵敏", "zhao.min@example.com", "Success", "2023-01-15", "2026-09-12"],
    ["陈静", "chen.jing@example.com", "Error", "2020-11-08", "2026-09-11"],
    ["李涛", "li.tao@example.com", "Info", "2024-05-20", "2026-09-10"],
    ["孙丽", "sun.li@example.com", "Success", "2021-09-03", "2026-09-09"],
    ["周杰", "zhou.jie@example.com", "Neutral", "2019-12-25", "2026-09-08"],
    ["吴娜", "wu.na@example.com", "Success", "2022-02-14", "2026-09-07"],
  ];
  function rowOps(name, userData, y, fill) {
    const as = `row_${name}`;
    const ops = [FR(as, `tmp-row-${name}`, 1180, 44, 0, y, fill ? { fill } : {})];
    if (fill) ops.push(STR("$" + as, "#E4E7ED", 1));
    ops.push(AL("$" + as, "horizontal", 0), CAL("$" + as, "CENTER"), SIZ("$" + as, "FIXED", "FIXED"));
    // 用户 cell (avatar + name)
    ops.push(...cellOps(`rc0_${name}`, "cell-user", COLS[0], 44, "$" + as, null, { spacing: 8 }));
    ops.push(EL(`av_${name}`, "avatar", 24, 24, { parent: "$" + `rc0_${name}`, fill: "#AAB8E8" }));
    ops.push(TX(userData[0], { parent: "$" + `rc0_${name}`, fs: 13, fill: INK.c1 }));
    // 邮箱
    ops.push(...cellOps(`rc1_${name}`, "cell-email", COLS[1], 44, "$" + as, null, {}));
    ops.push(TX(userData[1], { parent: "$" + `rc1_${name}`, fs: 13, fill: INK.c1 }));
    // 状态 (badge instance) — 跨批次必须用真实组件 id（$ 引用仅限同批次内）
    ops.push(...cellOps(`rc2_${name}`, "cell-status", COLS[2], 44, "$" + as, null, {}));
    ops.push(INST(`bi_${name}`, IDS[`comp_bdg_${userData[2]}`], { parent: "$" + `rc2_${name}` }));
    // 注册时间 / 最近登录
    for (const [ci, vi] of [[3, 3], [4, 4]]) {
      ops.push(...cellOps(`rc${ci}_${name}`, `cell-${ci}`, COLS[ci], 44, "$" + as, null, {}));
      ops.push(TX(userData[vi], { parent: "$" + `rc${ci}_${name}`, fs: 13, fill: INK.c1 }));
    }
    // 操作
    ops.push(...cellOps(`rc5_${name}`, "cell-actions", COLS[5], 44, "$" + as, null, { spacing: 12 }));
    ops.push(TX("编辑", { parent: "$" + `rc5_${name}`, fs: 12, fill: "#5A5CF0" }));
    ops.push(TX("删除", { parent: "$" + `rc5_${name}`, fs: 12, fill: "#F56C6C" }));
    ops.push(COMP(`comp_row_${name}`, "$" + as, `DS/Table/Row${name === "base" ? "" : "/" + name}`));
    return ops;
  }
  await runBatch("table-header-row", [...(IDS.comp_tbl_header ? [] : headerOps()), ...rowOps("base", ROW_USERS[0], 500, null)]);
  await runBatch("table-hover-selected", [
    ...rowOps("Hover", ROW_USERS[1], 554, "#F2F3F5"),
    ...rowOps("Selected", ROW_USERS[2], 608, "#F0F1FE"),
  ]);

  /* EmptyState + ErrorState (with instance button text override) */
  async function stateOps(kind) {
    const as = `st_${kind}`;
    const icon = kind === "Empty" ? ICON.emptyBox : null;
    const ops = [
      FR(as, `tmp-${kind.toLowerCase()}-state`, 300, 160, kind === "Empty" ? 0 : 1000, 790, kind === "Empty" ? {} : {}),
      AL("$" + as, "vertical", 12),
      PAD("$" + as, { all: 32 }),
      CAL("$" + as, "CENTER"),
      PAL("$" + as, "CENTER"),
    ];
    if (kind === "Empty") {
      ops.push(VEC(`v_${kind}`, "icon-empty-box", ICON.emptyBox, 40, 40, { parent: "$" + as, stroke: INK.c4, sw: 1.5 }));
      ops.push(TX("暂无数据", { parent: "$" + as, fs: 13, fill: INK.c2 }));
    } else {
      ops.push(VEC(`v_${kind}`, "icon-error-circle", ICON.errCircle, 40, 40, { parent: "$" + as, stroke: "#F56C6C", sw: 1.5 }));
      ops.push(TX("加载失败", { parent: "$" + as, fs: 13, fill: INK.c1 }));
      ops.push(TX("网络异常，请稍后重试", { parent: "$" + as, fs: 12, fill: INK.c3 }));
    }
    ops.push(INST(`btn_${kind}`, kind === "Empty" ? IDS.comp_btn_Secondary : IDS.comp_btn_Danger, { parent: "$" + as }));
    ops.push(SIZ("$" + as, "HUG", "HUG"));
    return ops;
  }
  const emptyB = await runBatch("state-empty-frame", await stateOps("Empty"));
  const errorB = await runBatch("state-error-frame", await stateOps("Error"));

  /* Override instance button texts, then convert to components */
  async function overrideAndComp(kind, compName, newText) {
    const instId = IDS[`btn_${kind}`];
    const node = await cmd("get-node", { id: instId, depth: 3 });
    const texts = [];
    (function w(n) {
      if (n.type === "TEXT") texts.push(n.id);
      (n.children || []).forEach(w);
    })(node);
    if (!texts.length) throw new Error(`no TEXT child in ${kind} button instance`);
    const ops = texts.map((tid) => ({ op: "set-text-content", params: { id: tid, text: newText } }));
    ops.push(COMP(`comp_st_${kind}`, IDS[`st_${kind}`], `DS/${compName}`));
    return runBatch(`state-${kind}-finish`, ops);
  }
  await overrideAndComp("Empty", "EmptyState", "清空筛选");
  await overrideAndComp("Error", "ErrorState", "重试");

  /* LoadingState + BaseCard + Breadcrumb */
  await runBatch("misc-ds", [
    FR("ls", "tmp-loading", 560, 140, 360, 790, {}),
    AL("$ls", "vertical", 12),
    PAD("$ls", { all: 16 }),
    { op: "create-rect", as: "sk1", params: { name: "bar-1", width: 528, height: 12, parentId: "$ls", fill: "#F2F3F5", cornerRadius: 4 } },
    SIZ("$sk1", "FILL", "FIXED"),
    { op: "create-rect", as: "sk2", params: { name: "bar-2", width: 528, height: 12, parentId: "$ls", fill: "#F2F3F5", cornerRadius: 4 } },
    SIZ("$sk2", "FILL", "FIXED"),
    { op: "create-rect", as: "sk3", params: { name: "bar-3", width: 528, height: 44, parentId: "$ls", fill: "#F2F3F5", cornerRadius: 4 } },
    SIZ("$sk3", "FILL", "FIXED"),
    COMP("comp_loading", "$ls", "DS/LoadingState"),

    FR("bc0", "tmp-basecard", 560, 160, 0, 950, { fill: "#FFFFFF" }),
    AL("$bc0", "vertical", 12),
    PAD("$bc0", { all: 16 }),
    RAD("$bc0", 4),
    CARD_SHADOW("$bc0"),
    TX("卡片标题", { parent: "$bc0", fs: 16, st: "Medium", fill: INK.c1 }),
    { op: "create-rect", as: "ph", params: { name: "content-slot", width: 528, height: 80, parentId: "$bc0", fill: "#F2F3F5", cornerRadius: 4 } },
    SIZ("$ph", "FILL", "FIXED"),
    SIZ("$bc0", "FIXED", "HUG"),
    COMP("comp_card", "$bc0", "DS/Card/BaseCard"),

    FR("bcB", "tmp-breadcrumb", 160, 20, 0, 1150, {}),
    AL("$bcB", "horizontal", 8),
    CAL("$bcB", "CENTER"),
    TX("首页", { parent: "$bcB", fs: 12, fill: INK.c2 }),
    TX("/", { parent: "$bcB", fs: 12, fill: INK.c4 }),
    TX("用户管理", { parent: "$bcB", fs: 12, st: "Medium", fill: INK.c1 }),
    SIZ("$bcB", "HUG", "HUG"),
    COMP("comp_breadcrumb", "$bcB", "DS/Breadcrumb"),
  ]);

  /* User List shell */
  await runBatch("userlist-shell", [
    FR("ul", "Page/UserList", 1440, 900, 0, 1340, { fill: "#F2F3F5", clips: true }),
    // TopBar
    FR("tb", "UserList/TopBar", 1440, 40, 0, 0, { parentId: "$ul", fill: "#FFFFFF" }),
    AL("$tb", "horizontal", 0),
    FR("lg", "logo", 180, 40, 0, 0, { parentId: "$tb", fill: "#FFFFFF" }),
    AL("$lg", "horizontal", 8),
    PAD("$lg", { left: 14 }),
    CAL("$lg", "CENTER"),
    SIZ("$lg", "FIXED", "FILL"),
    VEC("t1", "logo-tri-1", ICON.tri1, 19, 18, { parent: "$lg", fill: "#5A5CF0" }),
    VEC("t2", "logo-tri-2", ICON.tri2, 12, 11, { parent: "$lg", fill: "#91CC75" }),
    TX("ElementAdmin", { parent: "$lg", fs: 14, st: "Bold", fill: INK.c1 }),
    FR("rt", "topbar-right", 800, 40, 0, 0, { parentId: "$tb", fill: "#FFFFFF" }),
    AL("$rt", "horizontal", 14),
    PAD("$rt", { horizontal: 16 }),
    CAL("$rt", "CENTER"),
    SIZ("$rt", "FILL", "FILL"),
    VEC("b1", "icon-burger", ICON.burger16, 16, 16, { parent: "$rt", stroke: INK.c1, sw: 1.5 }),
    TX("首页", { parent: "$rt", fs: 13, fill: INK.c1 }),
    FR("sp", "spacer", 10, 10, 0, 0, { parentId: "$rt" }),
    CLEARF("$sp"),
    AL("$sp", "horizontal", 0),
    SIZ("$sp", "FILL", "FIXED"),
    TX("全屏切换", { parent: "$rt", fs: 12, fill: INK.c2 }),
    VEC("g1", "icon-gear", "M12.6 8 C12.6 10.54 10.54 12.6 8 12.6 C5.46 12.6 3.4 10.54 3.4 8 C3.4 5.46 5.46 3.4 8 3.4 C10.54 3.4 12.6 5.46 12.6 8 Z M8 0.8 L8 2.4 M8 13.6 L8 15.2 M0.8 8 L2.4 8 M13.6 8 L15.2 8", 16, 16, { parent: "$rt", stroke: INK.c2, sw: 1.5 }),
    EL("av", "avatar", 24, 24, { parent: "$rt", fill: "#AAB8E8" }),
    TX("admin", { parent: "$rt", fs: 12, fill: INK.c3 }),
    // Sidebar
    FR("sb", "UserList/Sidebar", 180, 860, 0, 40, { parentId: "$ul", fill: "#FFFFFF" }),
    AL("$sb", "vertical", 0),
  ]);
  /* menu rows */
  function menuOps(as, label, y, { h = 40, pad = 20, active = false, icon = null } = {}) {
    const ops = [
      FR(as, `menu-${label}`, 180, h, 0, y, { parentId: IDS.sb, fill: active ? "#5A5CF0" : "#FFFFFF" }),
      AL("$" + as, "horizontal", 10),
      PAD("$" + as, { left: pad }),
      CAL("$" + as, "CENTER"),
      SIZ("$" + as, "FILL", "FIXED"),
    ];
    if (icon) ops.push(VEC(`mi_${label}`, `icon-${label}`, ICON[icon], 14, 14, { parent: "$" + as, stroke: active ? "#FFFFFF" : INK.c1, sw: 1.5 }));
    ops.push(TX(label, { parent: "$" + as, fs: 13, st: active ? "Medium" : "Regular", fill: active ? "#FFFFFF" : INK.c1 }));
    return ops;
  }
  await runBatch("userlist-menu", [
    ...menuOps("m0", "首页", 0, { active: true, icon: "house" }),
    ...menuOps("m1", "更多菜单", 0, { icon: "grid" }),
    ...menuOps("m2", "菜单1", 0, { h: 32, pad: 40 }),
    ...menuOps("m3", "菜单1-1", 0, { h: 32, pad: 56 }),
    ...menuOps("m4", "菜单1-2", 0, { h: 32, pad: 56 }),
    ...menuOps("m5", "菜单2", 0, { icon: "doc" }),
  ]);
  /* TagsBar + Content container */
  await runBatch("userlist-tags-content", [
    FR("tg", "UserList/TagsBar", 1260, 36, 180, 40, { parentId: IDS.ul, fill: "#FFFFFF" }),
    AL("$tg", "horizontal", 10),
    PAD("$tg", { horizontal: 12 }),
    CAL("$tg", "CENTER"),
    SIZ("$tg", "FIXED", "FIXED"),
    FR("tag1", "tag-首页", 60, 22, 0, 0, { parentId: "$tg" }),
    AL("$tag1", "horizontal", 6),
    PAD("$tag1", { horizontal: 10 }),
    CAL("$tag1", "CENTER"),
    VEC("th1", "icon-house-s", ICON.house, 11, 11, { parent: "$tag1", stroke: "#5A5CF0", sw: 1.5 }),
    TX("首页", { parent: "$tag1", fs: 12, st: "Medium", fill: "#5A5CF0" }),
    FR("tag2", "tag-首页2", 60, 22, 0, 0, { parentId: "$tg" }),
    AL("$tag2", "horizontal", 6),
    PAD("$tag2", { horizontal: 10 }),
    CAL("$tag2", "CENTER"),
    TX("首页2", { parent: "$tag2", fs: 12, fill: INK.c3 }),
    VEC("tc2", "icon-close-s", ICON.close, 9, 9, { parent: "$tag2", stroke: INK.c4, sw: 1.5 }),
    FR("tsp", "spacer", 10, 10, 0, 0, { parentId: "$tg" }),
    CLEARF("$tsp"),
    AL("$tsp", "horizontal", 0),
    SIZ("$tsp", "FILL", "FIXED"),
    VEC("tb1", "icon-burger-s", ICON.burger, 14, 14, { parent: "$tg", stroke: INK.c3, sw: 1.5 }),
    FR("ct", "UserList/Content", 1260, 824, 180, 76, { parentId: IDS.ul, fill: "#F2F3F5" }),
    AL("$ct", "vertical", 16),
    PAD("$ct", { all: 24 }),
  ]);

  /* User List content (instances) */
  await runBatch("userlist-content", [
    INST("i_bc", IDS.comp_breadcrumb, { parent: IDS.ct }),
    FR("tr", "title-row", 1164, 32, 0, 0, { parentId: IDS.ct }),
    AL("$tr", "horizontal", 0),
    CAL("$tr", "CENTER"),
    PAL("$tr", "SPACE_BETWEEN"),
    SIZ("$tr", "FILL", "HUG"),
    TX("用户管理", { parent: "$tr", fs: 16, st: "Medium", fill: INK.c1 }),
    INST("i_bp", IDS.comp_btn_Primary, { parent: "$tr" }),
    FR("sr", "search-row", 800, 30, 0, 0, { parentId: IDS.ct }),
    AL("$sr", "horizontal", 12),
    CAL("$sr", "CENTER"),
    SIZ("$sr", "HUG", "HUG"),
    INST("i_in", IDS.comp_inp_Default, { parent: "$sr" }),
    INST("i_se", IDS.comp_sel, { parent: "$sr" }),
    INST("i_bs", IDS.comp_btn_Secondary, { parent: "$sr" }),
    INST("i_bg", IDS.comp_btn_Ghost, { parent: "$sr" }),
    FR("cd", "UserList/TableCard", 1164, 500, 0, 0, { parentId: IDS.ct, fill: "#FFFFFF" }),
    AL("$cd", "vertical", 0),
    PAD("$cd", { all: 16 }),
    RAD("$cd", 4),
    CARD_SHADOW("$cd"),
    SIZ("$cd", "FILL", "HUG"),
    INST("i_th", IDS.comp_tbl_header, { parent: "$cd" }),
    ...ROW_USERS.map((u, i) => INST(`i_row${i}`, IDS.comp_row_base, { parent: "$cd" })),
    FR("ft", "table-footer", 1164, 32, 0, 0, { parentId: "$cd" }),
    AL("$ft", "horizontal", 0),
    PAD("$ft", { top: 8 }),
    CAL("$ft", "CENTER"),
    PAL("$ft", "SPACE_BETWEEN"),
    SIZ("$ft", "FILL", "HUG"),
    TX("共 87 条", { parent: "$ft", fs: 12, fill: INK.c3 }),
    FR("pr", "pager", 500, 24, 0, 0, { parentId: "$ft" }),
    AL("$pr", "horizontal", 4),
    CAL("$pr", "CENTER"),
    SIZ("$pr", "HUG", "FIXED"),
    INST("p_d1", IDS.comp_pag_Disabled, { parent: "$pr" }),
    INST("p_a1", IDS.comp_pag_Active, { parent: "$pr" }),
    INST("p_d2", IDS.comp_pag_Default, { parent: "$pr" }),
    INST("p_d3", IDS.comp_pag_Default, { parent: "$pr" }),
    INST("p_d4", IDS.comp_pag_Default, { parent: "$pr" }),
    INST("p_d5", IDS.comp_pag_Disabled, { parent: "$pr" }),
    FR("ps", "page-size", 110, 28, 0, 0, { parentId: "$pr", fill: "#FFFFFF" }),
    AL("$ps", "horizontal", 4),
    PAD("$ps", { horizontal: 10 }),
    RAD("$ps", 6),
    STR("$ps", "#E4E7ED", 1),
    CAL("$ps", "CENTER"),
    PAL("$ps", "SPACE_BETWEEN"),
    SIZ("$ps", "FIXED", "FIXED"),
    TX("10 条/页", { parent: "$ps", fs: 12, fill: INK.c1 }),
    VEC("pcv", "chev", ICON.chevDown10, 10, 10, { parent: "$ps", stroke: INK.c3, sw: 1.5 }),
  ]);

  /* Pager label overrides: ‹ 1 2 3 … › */
  const pagerIds = [IDS.p_d1, IDS.p_a1, IDS.p_d2, IDS.p_d3, IDS.p_d4, IDS.p_d5];
  const pagerTexts = ["‹", "1", "2", "3", "…", "›"];
  const overrideOps = [];
  for (let i = 0; i < pagerIds.length; i++) {
    const n = await cmd("get-node", { id: pagerIds[i], depth: 3 });
    let tid = null;
    (function w(x) { if (x.type === "TEXT" && !tid) tid = x.id; (x.children || []).forEach(w); })(n);
    if (tid) overrideOps.push({ op: "set-text-content", params: { id: tid, text: pagerTexts[i] } });
  }
  await runBatch("pager-overrides", overrideOps);

  /* State specimens */
  await runBatch("specimens", [
    TX("UserList / State / Empty（默认筛选无结果）", { x: 1560, y: 1340, fs: 13, st: "Medium", fill: INK.c2 }),
    FR("spE", "UserList/State/Empty", 420, 260, 1560, 1370, { fill: "#FFFFFF" }),
    AL("$spE", "vertical", 0),
    RAD("$spE", 4),
    CARD_SHADOW("$spE"),
    CAL("$spE", "CENTER"),
    PAL("$spE", "CENTER"),
    INST("i_spE", IDS.comp_st_Empty, { parent: "$spE" }),
    TX("UserList / State / Error（接口失败）", { x: 1560, y: 1690, fs: 13, st: "Medium", fill: INK.c2 }),
    FR("spR", "UserList/State/Error", 420, 260, 1560, 1720, { fill: "#FFFFFF" }),
    AL("$spR", "vertical", 0),
    RAD("$spR", 4),
    CARD_SHADOW("$spR"),
    CAL("$spR", "CENTER"),
    PAL("$spR", "CENTER"),
    INST("i_spR", IDS.comp_st_Error, { parent: "$spR" }),
  ]);

  console.log("BUILD DONE. ids saved.");
  fs.writeFileSync(new URL("../.vibe/stage9/user-list-build-ids.json", import.meta.url), JSON.stringify(IDS, null, 1));
  fs.writeFileSync(new URL("../.vibe/stage9/user-list-build-log.json", import.meta.url), JSON.stringify(LOG, null, 1));
}

main().catch((e) => {
  console.error("BUILD FAILED:", e.message);
  process.exit(1);
});
