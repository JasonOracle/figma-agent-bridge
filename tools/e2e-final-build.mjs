#!/usr/bin/env node
/* E2E Final — L3 v2：严格 per-op 错误检查版（Semi Bold 字体样式缺失已定位为上轮根因）
 * 修复：① 顶层 ok:false 即抛错（partial:[] 也如实报告）② per-op ok 检查 ③ Semi Bold→Medium
 * ④ mapChildren 找不到即抛错 ⑤ 增量落盘 + 断点续跑 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIR = ROOT + ".vibe/e2e-final/";
const TOKEN = fs.readFileSync(ROOT + ".vibe/token", "utf8").trim();
const API = "http://127.0.0.1:45677/v1/command?token=" + TOKEN;

async function cmd(op, params) {
  const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, params }) });
  const j = await r.json();
  return j.data ?? j;
}

const IDS = {}, LOG = [];
let DONE = new Set();
try {
  Object.assign(IDS, JSON.parse(fs.readFileSync(DIR + "build-ids.json", "utf8")));
  JSON.parse(fs.readFileSync(DIR + "build-log.json", "utf8")).forEach(e => { LOG.push(e); DONE.add(e.batch); });
  console.log(`resume: landed=[${[...DONE].join(",")}]`);
} catch { /* 首跑 */ }
const save = () => {
  fs.writeFileSync(DIR + "build-ids.json", JSON.stringify(IDS, null, 2));
  fs.writeFileSync(DIR + "build-log.json", JSON.stringify(LOG, null, 2));
};

async function batch(label, ops) {
  if (DONE.has(label)) { console.log(`[batch ${label}] skip（已落盘）`); return; }
  if (ops.length > 30) throw new Error(`batch ${label} = ${ops.length} ops（>30 红线）`);
  const t0 = Date.now();
  const data = await cmd("run", { ops: ops.map(o => ({ op: o.op, params: o.params, as: o.as })) });
  if (data.error || data.ok === false) {
    throw new Error(`batch ${label} 顶层失败: ${JSON.stringify(data.error || data).slice(0, 200)}`);
  }
  const got = {}, errs = [];
  (data.ops || []).forEach((r, i) => {
    if (r.ok === false) errs.push(`step${i}(${ops[i].op}): ${JSON.stringify(r.error).slice(0, 150)}`);
    if (ops[i].as && r.data?.created?.id) got[ops[i].as] = r.data.created.id;
  });
  if (errs.length) throw new Error(`batch ${label} per-op 失败:\n  ` + errs.join("\n  "));
  Object.assign(IDS, got);
  const rb = await cmd("get-node", { id: IDS.root, detail: false, depth: 1 });
  LOG.push({ batch: label, ops: ops.length, ms: Date.now() - t0, created: got });
  save();
  console.log(`[batch ${label}] ops=${ops.length} ms=${Date.now() - t0} created={${Object.keys(got).join(",") || "-"}}`);
}

async function mapChildren(id, names) {
  const info = await cmd("get-node", { id, detail: true, depth: 4 });
  const out = {};
  const walk = n => { if (n.name && names.includes(n.name)) (out[n.name] = out[n.name] || []).push(n.id); (n.children || []).forEach(walk); };
  walk(info);
  for (const nm of names) if (!out[nm]?.length) throw new Error(`mapChildren(${id}) 未找到 "${nm}"`);
  return out;
}

const spec = JSON.parse(fs.readFileSync(DIR + "design-system-spec.json", "utf8"));
const tv = p => p.split(".").reduce((a, k) => a[k], spec.tokens).value;
const T = {
  primary: tv("color.brand.primary"), ink: tv("color.text.primary"), ink2: tv("color.text.secondary"),
  ink3: tv("color.text.disabled"), page: tv("color.background.page"), card: tv("color.background.surface"),
  border: tv("color.border.default"), success: tv("color.status.success"), white: "#FFFFFF",
};
const FAM = "Noto Sans SC";
const R = { sm: tv("radius.sm"), md: tv("radius.md") };

const FR = (as, name, w, h, x, y, p = {}) => { const { parent, ...extra } = p; return { op: "create-frame", as, params: { name, width: w, height: h, x, y, parentId: parent, ...extra } }; };
const TX = (chars, o = {}) => ({ op: "create-text", as: o.as, params: { characters: chars, fontFamily: FAM, fontStyle: o.st || "Regular", fontSize: o.fs || 14, fill: o.fill || T.ink, parentId: o.parent, x: o.x, y: o.y, name: o.name } });
const EL = (as, name, w, h, o = {}) => ({ op: "create-ellipse", as, params: { name, width: w, height: h, parentId: o.parent, fill: o.fill } });
const RC = (as, name, w, h, o = {}) => ({ op: "create-rect", as, params: { name, width: w, height: h, parentId: o.parent, fill: o.fill, cornerRadius: o.rad } });
const VEC = (as, name, data, w, h, o = {}) => ({ op: "create-vector", as, params: { name, data, width: w, height: h, parentId: o.parent, stroke: o.stroke, strokeWeight: o.sw || 1.5 } });
const INST = (as, compId, o = {}) => ({ op: "create-instance", as, params: { componentId: compId, parentId: o.parent, x: o.x, y: o.y } });
const RAD = (id, r) => ({ op: "set-corner-radius", params: { id, radius: r } });
const FILL = (id, c) => ({ op: "set-fill", params: { id, color: c } });
const FILLCLR = id => ({ op: "set-fill", params: { id, clear: true } });
const STROKE = (id, c, w = 1) => ({ op: "set-stroke", params: { id, color: c, strokeWeight: w } });
const SIZ = (id, h, v) => ({ op: "set-layout-sizing", params: { id, horizontal: h, vertical: v } });
const SHADOW = id => ({ op: "set-effects", params: { id, effects: [{ type: "DROP_SHADOW", color: "#000000", opacity: 0.05, x: 0, y: 1, blur: 3 }] } });
const TEXTSET = (id, chars) => ({ op: "set-text-content", params: { id, characters: chars } });
const RESIZE = (id, w, h) => ({ op: "resize-node", params: { id, width: w, height: h } });

const DS = { StatusBar: "5:94", NavBar: "3:15", TabBar: "5:108", StatCard: "3:64" };

async function main() {
  /* b01/b01b 已落盘（壳层保留）。b02 起： */
  /* ---- b02 健康评分卡（9 ops）---- */
  await batch("b02", [
    FR("sc", "Local/HealthScoreCard", 362, 160, 20, 20, { parent: IDS.ct, fill: T.card }),
    RAD("$sc", R.md), SHADOW("$sc"),
    TX("今日健康评分", { as: "sc_t", parent: "$sc", x: 16, y: 16, fs: 12, fill: T.ink2 }),
    TX("92", { as: "sc_v", parent: "$sc", x: 16, y: 36, fs: 44, st: "Bold", fill: T.primary }),
    TX("状态良好", { as: "sc_s", parent: "$sc", x: 16, y: 100, fs: 15, st: "Medium" }),
    TX("优于最近 7 天 86% 的记录", { as: "sc_m", parent: "$sc", x: 16, y: 124, fs: 12, fill: T.ink2 }),
    TX("较昨日 ↑ 3 分", { as: "sc_c", parent: "$sc", x: 16, y: 142, fs: 12, fill: T.success }),
  ]);
  await batch("b02b", [RESIZE(IDS.sc_v, 60, 52)]);

  /* ---- b03 评分环（4 ops）---- */
  await batch("b03", [
    EL("ring", "score-ring", 72, 72, { parent: IDS.sc, x: 274, y: 22, fill: T.white }),
    FILLCLR("$ring"),
    STROKE("$ring", T.primary, 6),
    TX("优", { as: "ring_t", parent: IDS.sc, x: 296, y: 46, fs: 18, st: "Bold", fill: T.primary }),
  ]);

  /* ---- b04 三 StatCard 实例（3 ops）---- */
  await batch("b04", [
    INST("st1", DS.StatCard, { parent: IDS.ct, x: 20, y: 196 }),
    INST("st2", DS.StatCard, { parent: IDS.ct, x: 146, y: 196 }),
    INST("st3", DS.StatCard, { parent: IDS.ct, x: 272, y: 196 }),
  ]);
  /* ---- b04b 实例覆写（9 ops）---- */
  const DATA = [
    { id: "st1", label: "心率 bpm", value: "72", delta: "静息正常", dc: T.success },
    { id: "st2", label: "睡眠", value: "7h12m", delta: "深睡 1h48m", dc: T.primary },
    { id: "st3", label: "步数", value: "8,432", delta: "达标 112%", dc: T.success },
  ];
  const overrideOps = [];
  for (const d of DATA) {
    const kids = await mapChildren(IDS[d.id], ["value", "label"]);
    overrideOps.push(TEXTSET(kids.value[0], d.value));
    overrideOps.push(TEXTSET(kids.label[0], d.label));
    overrideOps.push(TX(d.delta, { parent: IDS.ct, x: {st1:32,st2:158,st3:284}[d.id], y: 290, fs: 12, fill: d.dc }));
  }
  await batch("b04b", overrideOps);

  /* ---- b05 趋势卡（7 ops）---- */
  await batch("b05", [
    FR("tc", "Local/TrendChart", 362, 160, 20, 332, { parent: IDS.ct, fill: T.card }),
    RAD("$tc", R.md), SHADOW("$tc"),
    TX("睡眠趋势 · 近 7 天", { as: "tc_t", parent: "$tc", x: 16, y: 14, fs: 15, st: "Medium" }),
    RC("axis", "axis", 330, 1, { parent: "$tc", x: 16, y: 120, fill: T.border }),
    VEC("line", "trend-line", "M0 45 L55 22 L110 4 L165 28 L220 0 L275 15 L330 21", 330, 46, { parent: "$tc", x: 16, y: 67, stroke: T.primary, sw: 2 }),
  ]);

  /* ---- b06 7 日标签（7 ops）---- */
  const days = ["一", "二", "三", "四", "五", "六", "日"];
  await batch("b06", days.map((d, i) => TX(d, { parent: IDS.tc, x: 10 + i * 55, y: 132, fs: 12, fill: T.ink3 })));

  /* ---- b07 今日 AI 建议（11 ops）---- */
  await batch("b07", [
    FR("ad", "Local/AdviceCard", 362, 150, 20, 508, { parent: IDS.ct, fill: T.card }),
    RAD("$ad", R.md), SHADOW("$ad"),
    TX("今日 AI 建议", { as: "ad_t", parent: "$ad", x: 16, y: 14, fs: 15, st: "Medium" }),
    EL("dot1", "dot", 8, 8, { parent: "$ad", x: 16, y: 47, fill: T.success }),
    TX("保持当前睡眠节奏", { parent: "$ad", x: 34, y: 44, fs: 14, st: "Medium" }),
    TX("昨晚深睡 24%，建议今晚 23:00 前入睡", { parent: "$ad", x: 34, y: 68, fs: 12, fill: T.ink2 }),
    EL("dot2", "dot", 8, 8, { parent: "$ad", x: 16, y: 95, fill: T.primary }),
    TX("补水与拉伸", { parent: "$ad", x: 34, y: 92, fs: 14, st: "Medium" }),
    TX("今日步数 8,432，睡前 10 分钟拉伸", { parent: "$ad", x: 34, y: 116, fs: 12, fill: T.ink2 }),
  ]);

  /* ---- 终验 READBACK ---- */
  const final = await cmd("get-node", { id: IDS.root, detail: true, depth: 4 });
  const countIds = s => (s.match(/"id":"/g) || []).length;
  console.log("FINAL TREE depth2:", (final.children || []).map(c => `${c.name}(${c.width}x${c.height},ch=${(c.children || []).length})`).join(" | "));
  IDS.finalNodeCount = countIds(JSON.stringify(final));
  save();
  console.log(`build v2 done: 累计 ${LOG.length} 批，root 子树节点约 ${IDS.finalNodeCount}`);
}
main().catch(e => { console.error("BUILD FAILED:", e.message); save(); process.exit(1); });
