/**
 * Stage 10.5 — L3 Figma Build: AI 智能健康管理 App（402x874 iPhone 16 Pro 竖屏）
 * 依据 .vibe/stage10-5/design-system-spec.json（L2 唯一输入）。
 * 铁律（Stage 10.1 §2）：READ before WRITE；批 ≤30 ops（发送前断言）；WRITE→READBACK；
 * as: 仅批内有效——跨批父引用一律用落盘真实 id（IDS.*）；NO_RESULT ≠ 未执行（先查再删）。
 * build-ids: .vibe/stage10-5/build-ids.json ｜ build-log: .vibe/stage10-5/build-log.json
 * 用法: node tools/stage10-5-build.mjs [skip-labels,comma]   例: node tools/stage10-5-build.mjs b01,b02
 */
import fs from "fs";

const TOKEN = fs.readFileSync(new URL("../.vibe/token", import.meta.url), "utf8").trim();
const BRIDGE = "http://127.0.0.1:45677/v1/command";
const IDS_FILE = new URL("../.vibe/stage10-5/build-ids.json", import.meta.url);
const LOG_FILE = new URL("../.vibe/stage10-5/build-log.json", import.meta.url);
const IDS = fs.existsSync(IDS_FILE) ? JSON.parse(fs.readFileSync(IDS_FILE, "utf8")) : {};
const LOG = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, "utf8")) : [];
const SKIP = new Set((process.argv[2] || "").split(",").filter(Boolean));
const save = () => { fs.writeFileSync(IDS_FILE, JSON.stringify(IDS, null, 1)); fs.writeFileSync(LOG_FILE, JSON.stringify(LOG, null, 1)); };

async function cmd(op, params = {}) {
  const res = await fetch(`${BRIDGE}?token=${TOKEN}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, params }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`${op} failed: ${JSON.stringify(j).slice(0, 400)}`);
  return j.data ?? j;
}

async function batch(label, ops) {
  if (SKIP.has(label)) { console.log(`[skip ${label}]`); return; }
  if (ops.length > 30) throw new Error(`batch ${label} = ${ops.length} ops（>30 红线，Stage 10.1 §2.2）`);
  const t0 = Date.now();
  const data = await cmd("run", { ops: ops.map((o) => ({ op: o.op, params: o.params, as: o.as })) });
  const got = {};
  (data.ops || []).forEach((r, i) => {
    if (ops[i].as && r.data?.created?.id) got[ops[i].as] = r.data.created.id;
  });
  Object.assign(IDS, got);
  LOG.push({ batch: label, ops: ops.length, ms: Date.now() - t0, created: got });
  save();
  console.log(`[batch ${label}] ops=${ops.length} ms=${Date.now() - t0} created={${Object.keys(got).join(",")}}`);
}

/** 读回子树，按 name 收集实例内子节点真实 id（同名取列表，按文档序） */
async function mapChildren(id, names) {
  const info = await cmd("get-node", { id, detail: true, depth: 4 });
  const out = {};
  const walk = (n) => {
    if (n.name && names.includes(n.name)) (out[n.name] = out[n.name] || []).push(n.id);
    (n.children || []).forEach(walk);
  };
  walk(info);
  return out;
}

/* ---------- tokens（L2 DS Spec 正本，禁止偏离） ---------- */
const T = {
  primary: "#0FB5AE", bg: "#FAFAFA", card: "#FFFFFF",
  ink1: "#111827", ink2: "#6B7280", ink3: "#9CA3AF",
  border: "#E5E7EB", divider: "#F2F3F5",
  success: "#00B578", danger: "#EF4444", info: "#6366F1",
  chart1: "#5A5CF0", white: "#FFFFFF",
};
const FAM = "Noto Sans SC";
const R = { sm: 6, md: 8 };

/* ---------- op builders ---------- */
const FR = (as, name, w, h, x, y, p = {}) => { const { parent, ...extra } = p; return { op: "create-frame", as, params: { name, width: w, height: h, x, y, parentId: parent, ...extra } }; };
const TX = (chars, o = {}) => ({ op: "create-text", as: o.as, params: { characters: chars, fontFamily: FAM, fontStyle: o.st || "Regular", fontSize: o.fs || 14, fill: o.fill || T.ink1, parentId: o.parent, x: o.x, y: o.y, name: o.name } });
const EL = (as, name, w, h, o = {}) => ({ op: "create-ellipse", as, params: { name, width: w, height: h, parentId: o.parent, fill: o.fill, stroke: o.stroke, strokeWeight: o.sw } });
const RC = (as, name, w, h, o = {}) => ({ op: "create-rect", as, params: { name, width: w, height: h, parentId: o.parent, fill: o.fill, cornerRadius: o.rad, stroke: o.stroke, strokeWeight: o.sw } });
const VEC = (as, name, data, w, h, o = {}) => ({ op: "create-vector", as, params: { name, data, width: w, height: h, parentId: o.parent, stroke: o.stroke, strokeWeight: o.sw || 1.5, fill: o.fill } });
const AL = (id, mode, spacing) => ({ op: "set-auto-layout", params: { id, mode, spacing } });
const PAD = (id, p) => ({ op: "set-padding", params: { id, ...p } });
const RAD = (id, r) => ({ op: "set-corner-radius", params: { id, radius: r } });
const FILL = (id, c) => ({ op: "set-fill", params: { id, color: c } });
const STROKE = (id, c, w = 1) => ({ op: "set-stroke", params: { id, color: c, strokeWeight: w } });
const SIZ = (id, h, v) => ({ op: "set-layout-sizing", params: { id, horizontal: h, vertical: v } });
const SPA = (id, a) => ({ op: "set-primary-axis-align", params: { id, align: a } });
const SCA = (id, a) => ({ op: "set-counter-axis-align", params: { id, align: a } });
const INST = (as, compId, o = {}) => ({ op: "create-instance", as, params: { componentId: compId, parentId: o.parent, x: o.x, y: o.y } });
const CC = (as, nodeId, name) => ({ op: "create-component", as, params: { nodeId, name } });
const SHADOW = (id, heavy = false) => ({ op: "set-effects", params: { id, effects: heavy ? [{ type: "DROP_SHADOW", color: "#000000", opacity: 0.04, x: 0, y: 4, blur: 12 }] : [{ type: "DROP_SHADOW", color: "#000000", opacity: 0.04, x: 0, y: 1, blur: 2 }] } });
const TEXTSET = (id, chars) => ({ op: "set-text-content", params: { id, characters: chars } });

/** 页面壳（11 ops）：标签 + 页框 + StatusBar/NavBar/TabBar 实例 + content 容器
 *  DS 组件引用用落盘真实 id（$DS_* as 名跨批失效——b07 实测教训） */
function shellOps(label, x) {
  return [
    TX(`Stage 10.5 / AI Health App — ${label}`, { x, y: -60, fs: 20, st: "Bold", fill: T.ink1 }),
    FR("pg", `AI Health / ${label} (402x874)`, 402, 874, x, 0, { fill: T.bg, clips: true }),
    AL("$pg", "VERTICAL", 0),
    SCA("$pg", "MIN"),
    INST("pg_sb", IDS.DS_StatusBar, { parent: "$pg" }),
    INST("pg_nb", IDS.DS_NavBar, { parent: "$pg" }),
    FR("ct", "content", 402, 686, 0, 0, { parent: "$pg" }),
    AL("$ct", "VERTICAL", 12),
    PAD("$ct", { top: 8, left: 16, right: 16, bottom: 12 }),
    INST("pg_tb", IDS.DS_TabBar, { parent: "$pg" }),
  ];
}

/** AI 建议/分析卡（13 ops）——Local/Common/AdviceCard，两页各自本地构建；parent 传 content 真实 id */
function adviceOps(as, title, lines, parent) {
  return [
    FR(as, "Local/Common/AdviceCard", 370, 128, 0, 0, { parent }),
    FILL(`$${as}`, T.card), RAD(`$${as}`, R.md), SHADOW(`$${as}`, true),
    AL(`$${as}`, "VERTICAL", 8), PAD(`$${as}`, { top: 16, bottom: 16, left: 16, right: 16 }),
    FR(`${as}H`, "header", 338, 24, 0, 0),
    AL(`$${as}H`, "HORIZONTAL", 6), SCA(`$${as}H`, "CENTER"),
    EL(null, "dot", 8, 8, { parent: `$${as}H`, fill: T.primary }),
    TX(title, { parent: `$${as}H`, fs: 16, st: "Medium", fill: T.ink1 }),
    ...lines.map((l, i) => TX(l, { parent: `$${as}`, fs: 13, st: "Regular", fill: T.ink2, name: `line${i}` })),
  ];
}

/** 档案/设置列表行（6 ops）——parent 传容器真实 id */
function listRow(as, name, value, chevron, parent) {
  return [
    FR(as, `row_${name}`, 338, 44, 0, 0, { parent }),
    AL(`$${as}`, "HORIZONTAL", 0), PAD(`$${as}`, { left: 16, right: 16 }), SCA(`$${as}`, "CENTER"), SPA(`$${as}`, "SPACE_BETWEEN"),
    TX(name, { parent: `$${as}`, fs: 14, st: "Regular", fill: T.ink1 }),
    chevron
      ? VEC(null, "chevron", "M1 1 L6 6 L1 11", 8, 12, { parent: `$${as}`, stroke: T.ink3, sw: 1.5 })
      : TX(value, { parent: `$${as}`, fs: 13, st: "Regular", fill: T.ink2 }),
  ];
}

/* ================================================================
 * B01 — DS：StatusBar(15) + NavBar(7) = 22 ops
 * ================================================================ */
await batch("b01-ds-statusbar-nav", [
  FR("sb", "StatusBarFrame", 402, 54, 1600, 0),
  AL("$sb", "HORIZONTAL", 0), PAD("$sb", { left: 24, right: 24 }), SCA("$sb", "CENTER"), SPA("$sb", "SPACE_BETWEEN"),
  TX("9:41", { parent: "$sb", fs: 15, st: "Medium", fill: T.ink1, name: "time" }),
  FR("sbr", "indicators", 72, 12, 0, 0),
  AL("$sbr", "HORIZONTAL", 5), SCA("$sbr", "CENTER"),
  EL(null, "dot1", 4, 4, { parent: "$sbr", fill: T.ink1 }),
  EL(null, "dot2", 4, 4, { parent: "$sbr", fill: T.ink1 }),
  EL(null, "dot3", 4, 4, { parent: "$sbr", fill: T.ink1 }),
  VEC(null, "wifi", "M1 4 C4 1 9 1 12 4 M3.2 6.5 C4.6 5.2 7.4 5.2 8.8 6.5 M5.6 9 C6.2 8.4 6.8 8.4 7.4 9", 13, 10, { parent: "$sbr", stroke: T.ink1, sw: 1.5 }),
  RC(null, "battery", 20, 10, { parent: "$sbr", stroke: T.ink1, sw: 1, rad: 3 }),
  RC(null, "nub", 2, 4, { parent: "$sbr", fill: T.ink1, rad: 1 }),
  CC("DS_StatusBar", "$sb", "DS/Navigation/StatusBar"),
  FR("nb", "NavBarFrame", 402, 44, 1600, 80),
  AL("$nb", "HORIZONTAL", 0), PAD("$nb", { left: 16, right: 16 }), SCA("$nb", "CENTER"), SPA("$nb", "SPACE_BETWEEN"),
  TX("AI Health Assistant", { parent: "$nb", fs: 16, st: "Medium", fill: T.ink1, name: "title" }),
  EL(null, "avatar", 28, 28, { parent: "$nb", fill: T.divider }),
  CC("DS_NavBar", "$nb", "DS/Navigation/NavBar"),
]);

/* ================================================================
 * B02 — DS：TabBar（27）+ DS 区标签（1）= 28 ops
 * ================================================================ */
await batch("b02-ds-tabbar", [
  TX("Stage 10.5 / AI Health App — Design System", { x: 1600, y: -60, fs: 20, st: "Bold", fill: T.ink1 }),
  FR("tb", "TabBarFrame", 402, 90, 1600, 150),
  FILL("$tb", T.card), AL("$tb", "VERTICAL", 0),
  FR("row", "tabs", 402, 56, 0, 0),
  AL("$row", "HORIZONTAL", 0), PAD("$row", { left: 40, right: 40 }), SCA("$row", "CENTER"), SPA("$row", "SPACE_BETWEEN"),
  FR("i1", "TabHome", 48, 44, 0, 0),
  AL("$i1", "VERTICAL", 3), SCA("$i1", "CENTER"), SPA("$i1", "CENTER"),
  VEC("ic1", "icon", "M3 10 L11 3 L19 10 M5.5 8.5 L5.5 19 L16.5 19 L16.5 8.5", 22, 22, { parent: "$i1", stroke: T.primary, sw: 1.8 }),
  TX("首页", { parent: "$i1", fs: 11, st: "Medium", fill: T.primary, name: "label" }),
  FR("i2", "TabData", 48, 44, 0, 0),
  AL("$i2", "VERTICAL", 3), SCA("$i2", "CENTER"), SPA("$i2", "CENTER"),
  VEC("ic2", "icon", "M4 19 L4 11 M11 19 L11 3 M18 19 L18 14", 22, 22, { parent: "$i2", stroke: T.ink3, sw: 1.8 }),
  TX("数据", { parent: "$i2", fs: 11, st: "Regular", fill: T.ink3, name: "label" }),
  FR("i3", "TabMe", 48, 44, 0, 0),
  AL("$i3", "VERTICAL", 3), SCA("$i3", "CENTER"), SPA("$i3", "CENTER"),
  VEC("ic3", "icon", "M11 9.5 C13.5 9.5 15.5 7.5 15.5 5 C15.5 2.5 13.5 0.5 11 0.5 C8.5 0.5 6.5 2.5 6.5 5 C6.5 7.5 8.5 9.5 11 9.5 Z M3 20.5 C3 16 6.5 13 11 13 C15.5 13 19 16 19 20.5", 22, 22, { parent: "$i3", stroke: T.ink3, sw: 1.8 }),
  TX("我的", { parent: "$i3", fs: 11, st: "Regular", fill: T.ink3, name: "label" }),
  RC(null, "safearea", 402, 34, { parent: "$tb", fill: T.card }),
  CC("DS_TabBar", "$tb", "DS/Navigation/TabBar"),
]);

/* ================================================================
 * B01b/B01c — StatusBar/TabBar 重建（首版子框架误建画布根，残缺已删）
 * ================================================================ */
await batch("b01b-ds-statusbar-rebuild", [
  FR("sb", "StatusBarFrame", 402, 54, 1600, 0),
  AL("$sb", "HORIZONTAL", 0), PAD("$sb", { left: 24, right: 24 }), SCA("$sb", "CENTER"), SPA("$sb", "SPACE_BETWEEN"),
  TX("9:41", { parent: "$sb", fs: 15, st: "Medium", fill: T.ink1, name: "time" }),
  FR("sbr", "indicators", 72, 12, 0, 0, { parent: "$sb" }),
  AL("$sbr", "HORIZONTAL", 5), SCA("$sbr", "CENTER"),
  EL(null, "dot1", 4, 4, { parent: "$sbr", fill: T.ink1 }),
  EL(null, "dot2", 4, 4, { parent: "$sbr", fill: T.ink1 }),
  EL(null, "dot3", 4, 4, { parent: "$sbr", fill: T.ink1 }),
  VEC(null, "wifi", "M1 4 C4 1 9 1 12 4 M3.2 6.5 C4.6 5.2 7.4 5.2 8.8 6.5 M5.6 9 C6.2 8.4 6.8 8.4 7.4 9", 13, 10, { parent: "$sbr", stroke: T.ink1, sw: 1.5 }),
  RC(null, "battery", 20, 10, { parent: "$sbr", stroke: T.ink1, sw: 1, rad: 3 }),
  RC(null, "nub", 2, 4, { parent: "$sbr", fill: T.ink1, rad: 1 }),
  CC("DS_StatusBar", "$sb", "DS/Navigation/StatusBar"),
]);
await batch("b01c-ds-tabbar-rebuild", [
  TX("Stage 10.5 / AI Health App — Design System", { x: 1600, y: -60, fs: 20, st: "Bold", fill: T.ink1 }),
  FR("tb", "TabBarFrame", 402, 90, 1600, 150),
  FILL("$tb", T.card), AL("$tb", "VERTICAL", 0),
  FR("row", "tabs", 402, 56, 0, 0, { parent: "$tb" }),
  AL("$row", "HORIZONTAL", 0), PAD("$row", { left: 40, right: 40 }), SCA("$row", "CENTER"), SPA("$row", "SPACE_BETWEEN"),
  FR("i1", "TabHome", 48, 44, 0, 0, { parent: "$row" }),
  AL("$i1", "VERTICAL", 3), SCA("$i1", "CENTER"), SPA("$i1", "CENTER"),
  VEC("ic1", "icon", "M3 10 L11 3 L19 10 M5.5 8.5 L5.5 19 L16.5 19 L16.5 8.5", 22, 22, { parent: "$i1", stroke: T.primary, sw: 1.8 }),
  TX("首页", { parent: "$i1", fs: 11, st: "Medium", fill: T.primary, name: "label" }),
  FR("i2", "TabData", 48, 44, 0, 0, { parent: "$row" }),
  AL("$i2", "VERTICAL", 3), SCA("$i2", "CENTER"), SPA("$i2", "CENTER"),
  VEC("ic2", "icon", "M4 19 L4 11 M11 19 L11 3 M18 19 L18 14", 22, 22, { parent: "$i2", stroke: T.ink3, sw: 1.8 }),
  TX("数据", { parent: "$i2", fs: 11, st: "Regular", fill: T.ink3, name: "label" }),
  FR("i3", "TabMe", 48, 44, 0, 0, { parent: "$row" }),
  AL("$i3", "VERTICAL", 3), SCA("$i3", "CENTER"), SPA("$i3", "CENTER"),
  VEC("ic3", "icon", "M11 9.5 C13.5 9.5 15.5 7.5 15.5 5 C15.5 2.5 13.5 0.5 11 0.5 C8.5 0.5 6.5 2.5 6.5 5 C6.5 7.5 8.5 9.5 11 9.5 Z M3 20.5 C3 16 6.5 13 11 13 C15.5 13 19 16 19 20.5", 22, 22, { parent: "$i3", stroke: T.ink3, sw: 1.8 }),
  TX("我的", { parent: "$i3", fs: 11, st: "Regular", fill: T.ink3, name: "label" }),
  RC(null, "safearea", 402, 34, { parent: "$tb", fill: T.card }),
  CC("DS_TabBar", "$tb", "DS/Navigation/TabBar"),
]);

/* ================================================================
 * B03 — DS：Button Primary/Secondary/Disabled（25 ops）
 * ================================================================ */
await batch("b03-ds-button-1", [
  FR("bp", "ButtonPrimaryFrame", 170, 44, 1600, 280),
  FILL("$bp", T.primary), RAD("$bp", R.sm), AL("$bp", "HORIZONTAL", 8), SPA("$bp", "CENTER"), SCA("$bp", "CENTER"),
  TX("确认", { parent: "$bp", fs: 16, st: "Medium", fill: T.white }),
  CC("DS_BtnPrimary", "$bp", "DS/Form/Button/Primary"),
  FR("bs", "ButtonSecondaryFrame", 170, 44, 1600, 350),
  FILL("$bs", T.card), RAD("$bs", R.sm), STROKE("$bs", T.border, 1), AL("$bs", "HORIZONTAL", 8), SPA("$bs", "CENTER"), SCA("$bs", "CENTER"),
  TX("次要操作", { parent: "$bs", fs: 16, st: "Medium", fill: T.ink1 }),
  CC("DS_BtnSecondary", "$bs", "DS/Form/Button/Secondary"),
  FR("bd", "ButtonDisabledFrame", 170, 44, 1600, 420),
  FILL("$bd", T.divider), RAD("$bd", R.sm), AL("$bd", "HORIZONTAL", 8), SPA("$bd", "CENTER"), SCA("$bd", "CENTER"),
  TX("不可用", { parent: "$bd", fs: 16, st: "Medium", fill: T.ink3 }),
  CC("DS_BtnDisabled", "$bd", "DS/Form/Button/Disabled"),
]);

/* ================================================================
 * B04 — DS：Button Loading(9) + LoadingOverlay(10) = 19 ops
 * ================================================================ */
await batch("b04-ds-button-2-overlay", [
  FR("bl", "ButtonLoadingFrame", 170, 44, 1600, 490),
  FILL("$bl", T.primary), RAD("$bl", R.sm), AL("$bl", "HORIZONTAL", 8), SPA("$bl", "CENTER"), SCA("$bl", "CENTER"),
  EL(null, "spinner", 16, 16, { parent: "$bl", stroke: T.white, sw: 2 }),
  TX("加载中", { parent: "$bl", fs: 16, st: "Medium", fill: T.white }),
  CC("DS_BtnLoading", "$bl", "DS/Form/Button/Loading"),
  FR("lo", "LoadingOverlayFrame", 180, 120, 1600, 560),
  FILL("$lo", T.card), RAD("$lo", R.md), SHADOW("$lo", true),
  AL("$lo", "VERTICAL", 12), SPA("$lo", "CENTER"), SCA("$lo", "CENTER"),
  EL(null, "spin", 28, 28, { parent: "$lo", stroke: T.primary, sw: 3 }),
  TX("AI 分析中…", { parent: "$lo", fs: 13, st: "Regular", fill: T.ink2 }),
  CC("DS_LoadingOverlay", "$lo", "DS/Feedback/LoadingOverlay"),
]);

/* ================================================================
 * B05 — DS：Input Default/Focus/Error（27 ops）
 * ================================================================ */
await batch("b05-ds-input-1", [
  FR("id1", "InputDefaultFrame", 370, 44, 1600, 710),
  FILL("$id1", T.card), RAD("$id1", R.sm), STROKE("$id1", T.border, 1),
  AL("$id1", "HORIZONTAL", 8), PAD("$id1", { left: 16, right: 16 }), SCA("$id1", "CENTER"),
  TX("请输入内容", { parent: "$id1", fs: 14, st: "Regular", fill: T.ink3 }),
  CC("DS_InDefault", "$id1", "DS/Form/Input/Default"),
  FR("if1", "InputFocusFrame", 370, 44, 1600, 780),
  FILL("$if1", T.card), RAD("$if1", R.sm), STROKE("$if1", T.primary, 2),
  AL("$if1", "HORIZONTAL", 8), PAD("$if1", { left: 16, right: 16 }), SCA("$if1", "CENTER"),
  TX("请输入内容", { parent: "$if1", fs: 14, st: "Regular", fill: T.ink2 }),
  CC("DS_InFocus", "$if1", "DS/Form/Input/Focus"),
  FR("ie1", "InputErrorFrame", 370, 44, 1600, 850),
  FILL("$ie1", T.card), RAD("$ie1", R.sm), STROKE("$ie1", T.danger, 2),
  AL("$ie1", "HORIZONTAL", 8), PAD("$ie1", { left: 16, right: 16 }), SCA("$ie1", "CENTER"),
  TX("格式不正确", { parent: "$ie1", fs: 14, st: "Regular", fill: T.ink3 }),
  CC("DS_InError", "$ie1", "DS/Form/Input/Error"),
]);

/* ================================================================
 * B06 — DS：Input Disabled(8) + StatCard(12) = 20 ops
 * ================================================================ */
await batch("b06-ds-input-2-statcard", [
  FR("ix", "InputDisabledFrame", 370, 44, 1600, 920),
  FILL("$ix", T.divider), RAD("$ix", R.sm),
  AL("$ix", "HORIZONTAL", 8), PAD("$ix", { left: 16, right: 16 }), SCA("$ix", "CENTER"),
  TX("不可编辑", { parent: "$ix", fs: 14, st: "Regular", fill: T.ink3 }),
  CC("DS_InDisabled", "$ix", "DS/Form/Input/Disabled"),
  FR("sc", "StatCardFrame", 115, 112, 1600, 990),
  FILL("$sc", T.card), RAD("$sc", R.md), SHADOW("$sc"),
  AL("$sc", "VERTICAL", 6), PAD("$sc", { top: 12, bottom: 12, left: 12, right: 12 }), SCA("$sc", "CENTER"),
  VEC("scIcon", "icon", "M9 15.5 C5 12.5 2 10 2 6.8 C2 4.4 3.9 2.5 6.3 2.5 C7.4 2.5 8.4 3 9 3.8 C9.6 3 10.6 2.5 11.7 2.5 C14.1 2.5 16 4.4 16 6.8 C16 10 13 12.5 9 15.5 Z", 18, 18, { parent: "$sc", stroke: T.danger, sw: 1.6 }),
  TX("72", { parent: "$sc", fs: 16, st: "Medium", fill: T.ink1, name: "value" }),
  TX("心率 bpm", { parent: "$sc", fs: 12, st: "Regular", fill: T.ink2, name: "label" }),
  VEC("scSpark", "spark", "M0 14 L12 10 L25 12 L37 6 L50 9 L62 4 L75 8 L87 5", 87, 20, { parent: "$sc", stroke: T.border, sw: 1.5 }),
  CC("DS_StatCard", "$sc", "DS/DataDisplay/StatCard"),
]);

/* ================================================================
 * B07 — 首页：壳(11) + HealthScoreCard 主体(17) = 28 ops
 * ================================================================ */
await batch("b07-home-shell-score", [
  ...shellOps("Home", 0),
  FR("hs", "Local/Home/HealthScoreCard", 370, 180, 0, 0, { parent: "$ct" }),
  FILL("$hs", T.card), RAD("$hs", R.md), SHADOW("$hs", true),
  AL("$hs", "VERTICAL", 12), PAD("$hs", { top: 16, left: 16, right: 16 }),
  FR("hst", "scoreRow", 338, 72, 0, 0),
  AL("$hst", "HORIZONTAL", 16), SCA("$hst", "CENTER"),
  FR("hsr", "ring", 72, 72, 0, 0),
  EL(null, "ringArc", 72, 72, { parent: "$hsr", stroke: T.primary, sw: 6 }),
  TX("86", { parent: "$hsr", fs: 26, st: "Medium", fill: T.ink1, x: 21, y: 19, name: "score" }),
  FR("hsc", "meta", 220, 60, 0, 0),
  AL("$hsc", "VERTICAL", 4), SCA("$hsc", "MIN"),
  TX("综合健康评分", { parent: "$hsc", fs: 13, st: "Regular", fill: T.ink2 }),
  TX("良好 · 持续观察", { parent: "$hsc", fs: 13, st: "Medium", fill: T.success }),
]);

/* ================================================================
 * B08 — 首页：AI 摘要行(5) + VitalRow 3 实例(9) = 14 ops
 * （$ct 为 B07 的 as 名，跨批失效 → 用落盘 id IDS.ct / IDS.hs）
 * ================================================================ */
await batch("b08-home-vitals-build", [
  FR("hss", "aiRow", 338, 24, 0, 0, { parent: IDS.hs }),
  AL("$hss", "HORIZONTAL", 6), SCA("$hss", "CENTER"),
  EL(null, "aiDot", 8, 8, { parent: "$hss", fill: T.primary }),
  TX("AI：睡眠质量较上周提升 12%，建议保持当前作息", { parent: "$hss", fs: 12, st: "Regular", fill: T.ink2 }),
  FR("vr", "vitalRow", 370, 112, 0, 0, { parent: IDS.ct }),
  AL("$vr", "HORIZONTAL", 12),
  SIZ("$vr", "FILL", "FIXED"),
  INST("h_sc1", IDS.DS_StatCard, { parent: "$vr" }),
  INST("h_sc2", IDS.DS_StatCard, { parent: "$vr" }),
  INST("h_sc3", IDS.DS_StatCard, { parent: "$vr" }),
  SIZ("$h_sc1", "FILL", "FILL"),
  SIZ("$h_sc2", "FILL", "FILL"),
  SIZ("$h_sc3", "FILL", "FILL"),
]);

/* ---- READBACK：首页 3 张 StatCard 实例子节点真实 id ---- */
const hMap = {};
for (const k of ["h_sc1", "h_sc2", "h_sc3"]) {
  hMap[k] = await mapChildren(IDS[k], ["value", "label", "icon", "spark"]);
  Object.assign(IDS, Object.fromEntries(Object.entries(hMap[k]).map(([n, ids]) => [`${k}.${n}`, ids[0]])));
}
save();

/* ================================================================
 * B08b — 首页：StatCard 覆写(8) + AdviceCard(14) = 22 ops
 * ================================================================ */
await batch("b08b-home-overrides-advice", [
  TEXTSET(hMap.h_sc2.value[0], "7h 12m"), TEXTSET(hMap.h_sc2.label[0], "睡眠"),
  FILL(hMap.h_sc2.icon[0], T.info), FILL(hMap.h_sc2.spark[0], T.info),
  TEXTSET(hMap.h_sc3.value[0], "8,432"), TEXTSET(hMap.h_sc3.label[0], "步数"),
  FILL(hMap.h_sc3.icon[0], T.success), FILL(hMap.h_sc3.spark[0], T.success),
  ...adviceOps("ad", "今日建议", [
    "· 午后 20 分钟快走，弥补今日活动缺口",
    "· 23:00 前入睡，维持睡眠节律",
    "· 心率变异性良好，可安排中等强度训练",
  ], IDS.ct),
]);

/* ================================================================
 * B09 — 数据详情：壳(11) + TrendChart 框体(8) = 19 ops
 * ================================================================ */
await batch("b09-detail-shell-trend", [
  ...shellOps("Detail", 502),
  FR("tc", "Local/Detail/TrendChart", 370, 232, 0, 0, { parent: "$ct" }),
  FILL("$tc", T.card), RAD("$tc", R.md), SHADOW("$tc", true),
  AL("$tc", "VERTICAL", 8), PAD("$tc", { top: 16, left: 16, right: 16, bottom: 12 }),
  FR("tch", "header", 338, 24, 0, 0, { parent: "$tc" }),
  FR("tcp", "plot", 338, 140, 0, 0, { parent: "$tc" }),
]);

/* ================================================================
 * B10 — 详情：header 内容(5) + 折线/圆点(8) + MetricsRow(9) = 22 ops
 * （$tch/$tcp 跨批失效 → IDS.tch / IDS.tcp；mr 挂 IDS.ct）
 * ================================================================ */
await batch("b10-detail-trend-metrics", [
  AL(IDS.tch, "HORIZONTAL", 0), SCA(IDS.tch, "CENTER"), SPA(IDS.tch, "SPACE_BETWEEN"),
  TX("本周心率趋势", { parent: IDS.tch, fs: 16, st: "Medium", fill: T.ink1 }),
  TX("9/8 - 9/14", { parent: IDS.tch, fs: 12, st: "Regular", fill: T.ink3 }),
  VEC("tcLine", "polyline", "M14 62 L68 45 L122 75 L176 30 L230 55 L284 40 L330 66", 338, 140, { parent: IDS.tcp, stroke: T.chart1, sw: 2 }),
  EL(null, "p1", 6, 6, { parent: IDS.tcp, fill: T.chart1 }),
  EL(null, "p2", 6, 6, { parent: IDS.tcp, fill: T.chart1 }),
  EL(null, "p3", 6, 6, { parent: IDS.tcp, fill: T.chart1 }),
  EL(null, "p4", 6, 6, { parent: IDS.tcp, fill: T.chart1 }),
  EL(null, "p5", 6, 6, { parent: IDS.tcp, fill: T.chart1 }),
  EL(null, "p6", 6, 6, { parent: IDS.tcp, fill: T.chart1 }),
  EL(null, "p7", 6, 6, { parent: IDS.tcp, fill: T.chart1 }),
  FR("mr", "metricsRow", 370, 128, 0, 0, { parent: IDS.ct }),
  AL("$mr", "HORIZONTAL", 12),
  SIZ("$mr", "FILL", "FIXED"),
  INST("d_sc1", IDS.DS_StatCard, { parent: "$mr" }),
  INST("d_sc2", IDS.DS_StatCard, { parent: "$mr" }),
  INST("d_sc3", IDS.DS_StatCard, { parent: "$mr" }),
  SIZ("$d_sc1", "FILL", "FILL"),
  SIZ("$d_sc2", "FILL", "FILL"),
  SIZ("$d_sc3", "FILL", "FILL"),
]);

/* ---- READBACK：详情页导航标题 + 3 张 StatCard + TabBar 实例子节点 ---- */
const dNb = await mapChildren(IDS.pg_nb, ["title"]);
const dMap = {};
for (const k of ["d_sc1", "d_sc2", "d_sc3"]) {
  dMap[k] = await mapChildren(IDS[k], ["value", "label", "icon", "spark"]);
  Object.assign(IDS, Object.fromEntries(Object.entries(dMap[k]).map(([n, ids]) => [`${k}.${n}`, ids[0]])));
}
const dTb = await mapChildren(IDS.pg_tb, ["icon", "label"]);
save();

/* ================================================================
 * B10b — 详情：标题覆写(1) + 网格/纵轴(5) + 周标签(8)
 *        + 指标覆写(10) + TabBar 激活态(4) = 28 ops
 * ================================================================ */
await batch("b10b-detail-overrides-decor", [
  TEXTSET(dNb.title[0], "数据详情"),
  RC(null, "grid1", 338, 1, { parent: IDS.tcp, fill: T.divider, rad: 0 }),
  RC(null, "grid2", 338, 1, { parent: IDS.tcp, fill: T.divider, rad: 0 }),
  RC(null, "grid3", 338, 1, { parent: IDS.tcp, fill: T.divider, rad: 0 }),
  TX("80", { parent: IDS.tcp, fs: 11, st: "Regular", fill: T.ink3, x: 0, y: 0, name: "ylabel" }),
  TX("60", { parent: IDS.tcp, fs: 11, st: "Regular", fill: T.ink3, x: 0, y: 66, name: "ylabel" }),
  FR("dw", "dayLabels", 338, 16, 0, 0, { parent: IDS.tc }),
  AL("$dw", "HORIZONTAL", 0), SCA("$dw", "CENTER"), SPA("$dw", "SPACE_BETWEEN"),
  TX("一", { parent: "$dw", fs: 11, st: "Regular", fill: T.ink3 }),
  TX("二", { parent: "$dw", fs: 11, st: "Regular", fill: T.ink3 }),
  TX("三", { parent: "$dw", fs: 11, st: "Regular", fill: T.ink3 }),
  TX("四", { parent: "$dw", fs: 11, st: "Regular", fill: T.ink3 }),
  TX("五", { parent: "$dw", fs: 11, st: "Regular", fill: T.ink3 }),
  TX("六", { parent: "$dw", fs: 11, st: "Regular", fill: T.ink3 }),
  TX("日", { parent: "$dw", fs: 11, st: "Regular", fill: T.ink3 }),
  TEXTSET(dMap.d_sc1.value[0], "62"), TEXTSET(dMap.d_sc1.label[0], "静息心率 bpm"),
  TEXTSET(dMap.d_sc2.value[0], "98"), TEXTSET(dMap.d_sc2.label[0], "血氧 %"),
  FILL(dMap.d_sc2.icon[0], T.success), FILL(dMap.d_sc2.spark[0], T.success),
  TEXTSET(dMap.d_sc3.value[0], "48"), TEXTSET(dMap.d_sc3.label[0], "HRV ms"),
  FILL(dMap.d_sc3.icon[0], T.info), FILL(dMap.d_sc3.spark[0], T.info),
]);

/* ================================================================
 * B10c — 详情：TabBar 激活态切换（数据 Tab active）= 4 ops
 * ================================================================ */
await batch("b10c-detail-tabbar-active", [
  FILL(dTb.icon[0], T.ink3), FILL(dTb.label[0], T.ink3),
  FILL(dTb.icon[1], T.primary), FILL(dTb.label[1], T.primary),
]);

/* ================================================================
 * B11 — 个人中心：壳(11) + ProfileCard 主体(14) = 25 ops
 * ================================================================ */
await batch("b11-profile-shell-card", [
  ...shellOps("Profile", 1004),
  FR("pc", "Local/Profile/ProfileCard", 370, 104, 0, 0, { parent: "$ct" }),
  FILL("$pc", T.card), RAD("$pc", R.md), SHADOW("$pc", true),
  AL("$pc", "HORIZONTAL", 14), PAD("$pc", { left: 16, right: 16 }), SCA("$pc", "CENTER"),
  FR("pav", "avatarWrap", 56, 56, 0, 0, { parent: "$pc" }),
  EL(null, "avatar", 56, 56, { parent: "$pav", fill: T.primary }),
  TX("李", { parent: "$pav", fs: 16, st: "Medium", fill: T.white, x: 20, y: 18 }),
  FR("pcol", "meta", 240, 60, 0, 0, { parent: "$pc" }),
  AL("$pcol", "VERTICAL", 6), SCA("$pcol", "MIN"),
  TX("李健康", { parent: "$pcol", fs: 16, st: "Medium", fill: T.ink1 }),
  FR("pch", "chips", 220, 24, 0, 0, { parent: "$pc" }),
  AL("$pch", "HORIZONTAL", 6),
]);

/* ================================================================
 * B12 — 个人中心：chip(9) + HealthRecordList 框(6) + 2 行(12) = 27 ops
 * ================================================================ */
await batch("b12-profile-chip-records", [
  FR("c1", "chip", 110, 24, 0, 0, { parent: IDS.pch }),
  FILL("$c1", T.divider), RAD("$c1", R.sm), AL("$c1", "HORIZONTAL", 4), SPA("$c1", "CENTER"), SCA("$c1", "CENTER"),
  TX("28 岁 · BMI 22.4", { parent: "$c1", fs: 11, st: "Regular", fill: T.ink2 }),
  FR("rc", "Local/Profile/HealthRecordList", 370, 196, 0, 0, { parent: IDS.ct }),
  FILL("$rc", T.card), RAD("$rc", R.md), SHADOW("$rc", true),
  AL("$rc", "VERTICAL", 0), PAD("$rc", { top: 8, bottom: 8, left: 16, right: 16 }),
  ...listRow("rcR1", "血型", "O 型", false, "$rc"), ...listRow("rcR2", "过敏史", "青霉素", false, "$rc"),
]);

/* ================================================================
 * B13 — 个人中心：档案 2 行(12) + SettingsList 框(6) + 1 行(6) = 24 ops
 * （$rc 跨批失效 → IDS.rc）
 * ================================================================ */
await batch("b13-profile-records2-settings", [
  ...listRow("rcR3", "慢性病", "无", false, IDS.rc), ...listRow("rcR4", "紧急联系人", "王芳", false, IDS.rc),
  FR("st", "Local/Profile/SettingsList", 370, 164, 0, 0, { parent: IDS.ct }),
  FILL("$st", T.card), RAD("$st", R.md), SHADOW("$st", true),
  AL("$st", "VERTICAL", 0), PAD("$st", { top: 8, bottom: 8, left: 16, right: 16 }),
  ...listRow("stR1", "健康目标", null, true, "$st"),
]);

/* ================================================================
 * B14 — 个人中心：AI 分析卡(13) + 设置 2 行(12) + TabBar 激活态(4) = 29 ops
 * ================================================================ */
const pTb = await mapChildren(IDS.pg_tb, ["icon", "label"]);
await batch("b14-profile-settings2-tabbar", [
  ...adviceOps("ad2", "AI 分析", [
    "· 静息心率连续 3 日下降，心肺功能改善",
    "· 周三出现一次高强度峰值，注意恢复",
  ], IDS.ct),
  ...listRow("stR2", "数据提醒", null, true, IDS.st), ...listRow("stR3", "隐私设置", null, true, IDS.st),
]);

/* ================================================================
 * B14b — 个人中心：TabBar 激活态（我的 Tab active）= 4 ops
 * ================================================================ */
await batch("b14b-profile-tabbar-active", [
  FILL(pTb.icon[0], T.ink3), FILL(pTb.label[0], T.ink3),
  FILL(pTb.icon[2], T.primary), FILL(pTb.label[2], T.primary),
]);

/* ---- 终验 READ：画布总量与分区清单 ---- */
const summary = await cmd("get-page-summary");
console.log(`\n[L3] BUILD DONE. page nodes=${summary.nodeCount}`);
for (const n of summary.nodes) console.log(`  - ${n.name} (${n.id}, ${n.width}x${n.height})`);
