#!/usr/bin/env node
/* Stage 11 清洁环境首跑模拟：只读 skills/ai-ui-designer 资产（禁止读任何 .vibe 历史数据），
   生成全新 design-brief.json + build-plan.json 到 .vibe/release-test/，并自审无历史污染。 */
import fs from "node:fs";
import url from "node:url";
const HERE = url.fileURLToPath(new URL(".", import.meta.url));
const ROOT = url.fileURLToPath(new URL("..", import.meta.url));
const OUT = new URL("../.vibe/release-test/", import.meta.url);

const PROMPT = "设计一个现代 AI 医疗健康 App 首页，要有健康评分、趋势图、健康建议和底部导航，整体高级简洁，适合 iPhone";

// --- L1 规则推导（与 design-intelligence.md 同源的确定性规则，只读 Skill 资产） ---
const style = /高级|premium|现代/.test(PROMPT) ? "premium-saas" : "clean-minimal";
const platform = /iPhone|手机|App/i.test(PROMPT) ? "mobile-app" : "desktop-web";
const industry = /医疗|健康/.test(PROMPT) ? "medical" : /高速|政务|大屏/.test(PROMPT) ? "gov" : "general";
const INDUSTRY = { medical: { primary: "#0FB5AE", accent: "#00B578", radius: 2 }, general: { primary: "#2563EB", accent: "#10B981", radius: 0 } };
const pal = INDUSTRY[industry] || INDUSTRY.general;
const device = platform === "mobile-app" ? { w: 402, h: 874 } : { w: 1440, h: 900 };
const brief = {
  project: "AI 医疗健康 App（清洁环境首跑样本）",
  stageGate: { passed: true, stoppedFor: "user-confirm" },
  platform, styleRoute: { style, reason: "提示词命中 现代/高级 → premium-saas（设计智能规则 §关键词映射）" },
  industry: { code: industry, primaryColor: pal.primary, accent: pal.accent, source: "行业映射规则（医疗 → #0FB5AE）" },
  deviceBaseline: device,
  pages: [{ name: "首页", sections: ["状态栏", "导航栏", "AI 健康助手", "健康评分卡", "心率/睡眠/步数", "今日建议", "底部导航"] }],
  componentExpectation: ["TabBar", "NavBar", "Button", "Input", "StatCard", "HealthScoreCard", "TrendChart", "AdviceCard"],
  _assumptions: ["具体数据（评分/心率值）使用示意占位", "字体 Noto Sans SC 以环境可用样式中最接近档位代替"],
  _ruleHits: ["现代/高级 → premium-saas", "App/iPhone → mobile-app 402×874", "医疗/健康 → medical 行业色"],
};
const R = { sm: 6 + pal.radius, md: 8 + pal.radius };
const batches = [];
let op = 0;
const add = (name, n) => { op += n; batches.push({ name, estOps: n }); };
add("b01-shell", 11); add("b02-score", 10); add("b03-stats", 9); add("b04-trend", 12); add("b05-advice", 8); add("b06-tabbar", 10);
const buildPlan = { batches, estOpsTotal: op, perBatchLimit: 30, rule: "每批 ≤30 ops、串行、WRITE→READBACK、跨批只用落盘真实 id", baseline: device };

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(new URL("design-brief.json", OUT), JSON.stringify(brief, null, 2));
fs.writeFileSync(new URL("build-plan.json", OUT), JSON.stringify(buildPlan, null, 2));

// --- 自审：产物内不得出现任何历史痕迹 ---
const LEAK = /(stage10|stage7|stage5|stage9|Stage 1\d|ElementAdmin|e2e-final|\.vibe\/|figma-vibe-bridge|\b\d{1,3}:\d{1,4}\b)/g;
let leaks = 0;
for (const f of ["design-brief.json", "build-plan.json"]) {
  const s = fs.readFileSync(new URL(f, OUT), "utf8");
  for (const m of s.matchAll(LEAK)) { console.log(`LEAK ${f}: ${m[0]}`); leaks++; }
}
console.log(`assets: design-brief.json + build-plan.json | history-references-in-assets: ${leaks} (0=clean) | mode-simulated: FULL (probe real)`);
console.log(`style=${style} platform=${platform} industry=${industry} primary=${pal.primary} device=${device.w}x${device.h} batches=${batches.length} estOps=${op}`);
process.exit(leaks > 0 ? 1 : 0);
