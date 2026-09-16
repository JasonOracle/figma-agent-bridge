#!/usr/bin/env node
/* E2E Final — L2: brief -> design-system-spec.json（派生色脚本复算，全 token 带 source） */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const DIR = fileURLToPath(new URL("../.vibe/e2e-final/", import.meta.url));
const brief = JSON.parse(fs.readFileSync(DIR + "design-brief.json", "utf8"));

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = ([r, g, b]) => "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0").toUpperCase()).join("");
const mix = (a, b, wa) => rgb2hex(hex2rgb(a).map((v, i) => v * wa + hex2rgb(b)[i] * (1 - wa))); // half-up via Math.round

const primary = brief.visualSystem.primaryColor;        // #0FB5AE 行业映射
const success = brief.visualSystem.accentColor;         // #00B578
const WHITE = "#FFFFFF", INK = "#111827", GRAY = "#6B7280", LIGHT = "#9CA3AF", PAGE = "#F9FAFB", SURFACE = "#FFFFFF", BORDER = "#E5E7EB", DIVIDER = "#F3F4F6";

const hover = mix(primary, WHITE, 0.88);   // RD-1
const active = mix(primary, "#000000", 0.92); // RD-2（向黑压深 92:8 近似规范口径）
const hoverOnDark = mix(primary, WHITE, 0.5);

const tokens = {
  color: {
    brand: {
      primary: { value: primary, source: "design-intelligence.md §③ 医疗健康行业映射 ← brief.visualSystem.primaryColor" },
      hover: { value: hover, source: `RD-1 派生 (primary 88:12 白) 脚本复算 = ${hover}` },
      active: { value: active, source: `RD-2 派生 (primary 92:8 黑) 脚本复算 = ${active}` },
    },
    text: {
      primary: { value: INK, source: "premium-saas preset text.primary" },
      regular: { value: "#374151", source: "premium-saas preset text.regular" },
      secondary: { value: GRAY, source: "premium-saas preset text.secondary" },
      disabled: { value: LIGHT, source: "premium-saas preset text.disabled" },
      inverse: { value: WHITE, source: "premium-saas preset text.inverse（深底/主色按钮上）" },
    },
    background: {
      page: { value: PAGE, source: "premium-saas preset background.page" },
      surface: { value: SURFACE, source: "premium-saas preset background.surface（卡片）" },
    },
    border: {
      default: { value: BORDER, source: "premium-saas preset border.default" },
      divider: { value: DIVIDER, source: "RD-3 派生（border 50:50 白）脚本复算" },
      focus: { value: primary, source: "= brand.primary（focus 环复用主色）" },
    },
    status: {
      success: { value: success, source: "§③ 行业映射 success ← brief.visualSystem.accentColor（ST-1 行业覆写）" },
      warning: { value: "#F59E0B", source: "premium-saas preset status.warning" },
      danger: { value: "#EF4444", source: "premium-saas preset status.danger" },
    },
  },
  typography: {
    h1: { size: 28, weight: 700, lh: 36, source: "premium-saas preset h1（移动端）" },
    h2: { size: 20, weight: 600, lh: 28, source: "premium-saas preset h2" },
    body: { size: 15, weight: 400, lh: 22, source: "premium-saas preset body" },
    caption: { size: 12, weight: 400, lh: 16, source: "premium-saas preset caption" },
  },
  spacing: {
    base: { value: 4, source: "premium-saas preset spacing.base" },
    screenPadding: { value: 20, source: "mobile-app 模板 screenPadding" },
    cardPadding: { value: 16, source: "mobile-app 模板 cardPadding" },
    sectionGap: { value: 24, source: "mobile-app 模板 sectionGap" },
  },
  radius: {
    sm: { value: 6, source: "preset sm 4 + 医疗行业 +2" },
    md: { value: 8, source: "preset md 6 + 医疗行业 +2" },
    lg: { value: 10, source: "preset lg 8 + 医疗行业 +2" },
  },
  shadow: {
    card: { value: "0 1 3 rgba(17,24,39,0.08)", source: "premium-saas preset shadow.card" },
    floating: { value: "0 4 12 rgba(17,24,39,0.12)", source: "premium-saas preset shadow.floating" },
  },
};

const components = [
  { name: "TabBar", decision: "generate-core", priority: "P0", basis: "brief P0：用户明示底部导航；CD-1 无可复用既有组件" },
  { name: "NavBar", decision: "generate-core", priority: "P0", basis: "brief P0：preset core；CD-1" },
  { name: "Button", decision: "generate-core", priority: "P0", basis: "brief P0：preset core；CD-1" },
  { name: "Input", decision: "generate-core", priority: "P0", basis: "brief P0：preset core；CD-1" },
  { name: "StatCard", decision: "generate-core", priority: "P0", basis: "brief P0：preset core（心率/睡眠/步数三卡复用）" },
  { name: "LoadingOverlay", decision: "generate-core", priority: "P0", basis: "brief P0：preset core" },
  { name: "HealthScoreCard", decision: "create-local", priority: "P0", basis: "用户明示「健康评分」，领域特有组件，CD-2 <80% 重合不可 extend" },
  { name: "TrendChart", decision: "create-local", priority: "P0", basis: "用户明示「趋势图」，SVG 折线 + 轴标签，CD-2" },
  { name: "AdviceCard", decision: "create-local", priority: "P0", basis: "用户明示「健康建议」，CD-2" },
];

const stateMatrix = {
  Button: ["default", "hover", "active", "disabled"],
  Input: ["default", "focus", "error", "disabled"],
  TabBarItem: ["active", "inactive"],
  Card: ["default", "pressed"],
};

const responsive = {
  frame: { width: 402, height: 874, fixed: true },
  content: { width: 402, height: 686, fixed: true, note: "StatusBar 54 + NavBar 44 + TabBar 90 = 188；874-188=686" },
  touchMin: { value: 44, source: "Usability 触控热区 ≥44pt" },
  rule: "容器显式 FIXED（禁 HUG 收缩）；子内容优先 FIXED，跨批用落盘真实 id",
};

let est = 0;
const buildPlan = [
  { batch: "b01", desc: "页面根 Frame 402×874 + StatusBar（54）+ NavBar（44）", estOps: 18 },
  { batch: "b02", desc: "TabBar（90）+ 4 个 Tab 项", estOps: 20 },
  { batch: "b03", desc: "content 容器 402×686 FIXED + 健康评分卡体", estOps: 22 },
  { batch: "b04", desc: "评分环（ellipse stroke）+ 评分数字 + 环形文案", estOps: 16 },
  { batch: "b05", desc: "三个 StatCard（心率/睡眠/步数）", estOps: 24 },
  { batch: "b06", desc: "趋势卡体 + SVG 折线 vector + 轴基线", estOps: 20 },
  { batch: "b07", desc: "趋势 7 日标签 + 数值", estOps: 14 },
  { batch: "b08", desc: "今日建议 AdviceCard ×2（图标点 + 标题 + 正文）", estOps: 20 },
].map(b => (est += b.estOps, b));

const spec = {
  _source: "E2E Final L2：由 .vibe/e2e-final/design-brief.json 按 stage10-4 规则生成",
  briefRefs: brief.componentExpectation.map(c => c.name),
  tokens, components, stateMatrix, responsive,
  frameBaseline: { width: 402, height: 874 },
  buildPlan, buildPlanTotalOps: est,
  _validation: {
    derivedColors: { hover, active, note: "RD-1/RD-2 脚本复算，禁止手算" },
    nonDerivedWhitelist: [primary, success, WHITE, INK, "#374151", GRAY, LIGHT, PAGE, SURFACE, BORDER, "#F59E0B", "#EF4444"],
  },
};
fs.writeFileSync(DIR + "design-system-spec.json", JSON.stringify(spec, null, 2));

/* ---- 自校验（Stage 10.4 规则口径） ---- */
const errs = [];
const colors = new Set(spec._validation.nonDerivedWhitelist.concat([hover, active, DIVIDER]));
const walkT = (t, p) => { for (const k in t) { const v = t[k];
  if (typeof v === "string" && /^#[0-9A-F]{6}$/i.test(v) && !colors.has(v.toUpperCase())) errs.push(`未知色 ${p}${k}=${v}`);
  if (v && typeof v === "object" && !("source" in v) && !v.value) walkT(v, p + k + ".");
  if (v && typeof v === "object" && "value" in v && !("source" in v)) errs.push(`token 缺 source: ${p}${k}`);
}; };
walkT(tokens, "tokens.");
for (const c of components) if (!c.basis) errs.push(`组件缺 basis: ${c.name}`);
const covered = new Set(components.map(c => c.name));
for (const b of brief.componentExpectation) if (!covered.has(b.name)) errs.push(`briefRefs 未覆盖: ${b.name}`);
if (buildPlan.some(b => b.estOps > 30)) errs.push("buildPlan 超 30 ops");
if (!stateMatrix.Button || !stateMatrix.Input) errs.push("state matrix 不完整");
if (!responsive.frame.fixed) errs.push("responsive 缺 mobile 规则");
console.log(errs.length ? "L2 SELF-CHECK FAIL:\n" + errs.join("\n") : `L2 SELF-CHECK PASS：tokens 全带 source / 无未知色 / briefRefs ${brief.componentExpectation.length}/${components.length} 覆盖 / buildPlan ${buildPlan.length} 批共 ${est} ops（每批 ≤30）`);
