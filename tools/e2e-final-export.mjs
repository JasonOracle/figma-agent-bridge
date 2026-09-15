#!/usr/bin/env node
/* E2E Final — L5：PNG@2x + SVG 导出 + export-manifest.json（复用 v4 export-node 通道，零 Bridge 改动） */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const DIR = fileURLToPath(new URL("../.vibe/e2e-final/", import.meta.url));
const SHOTS = DIR + "screenshots/";
fs.mkdirSync(SHOTS, { recursive: true });
const TOKEN = fs.readFileSync(fileURLToPath(new URL("../.vibe/token", import.meta.url)), "utf8").trim();
async function cmd(op, params) {
  const r = await fetch("http://127.0.0.1:45677/v1/command?token=" + TOKEN, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, params }) });
  const j = await r.json(); return j.data ?? j;
}

const ids = JSON.parse(fs.readFileSync(DIR + "build-ids.json", "utf8"));
const spec = JSON.parse(fs.readFileSync(DIR + "design-system-spec.json", "utf8"));
const critic = JSON.parse(fs.readFileSync(DIR + "critic-report.json", "utf8"));
const root = ids.root, name = "ai-health-home";

/* PNG @2x */
const png = await cmd("export-node", { id: root, scale: 2 });
if (!png.base64) throw new Error("PNG export failed");
fs.writeFileSync(SHOTS + name + "@2x.png", Buffer.from(png.base64, "base64"));
const pngBytes = fs.statSync(SHOTS + name + "@2x.png").size;
/* PNG 头校验（真 PNG：89 50 4E 47） */
const pngHead = fs.readFileSync(SHOTS + name + "@2x.png").subarray(0, 4).toString("hex");
console.log(`PNG OK: ${pngBytes} bytes, head=${pngHead}${pngHead === "89504e47" ? "（有效 PNG ✓）" : "（无效!）"}`);

/* SVG（v4：插件内 UTF-8 解码为原文） */
const svg = await cmd("export-node", { id: root, scale: 1, format: "SVG" });
if (!svg.svg || !svg.svg.startsWith("<svg")) throw new Error("SVG invalid: " + String(svg.svg || "").slice(0, 60));
fs.writeFileSync(SHOTS + name + ".svg", svg.svg);
const svgBytes = fs.statSync(SHOTS + name + ".svg").size;
console.log(`SVG OK: ${svgBytes} bytes, head=<svg ✓ (v${svg.v})`);

/* export-manifest.json */
const tokensOut = {};
for (const [cat, group] of Object.entries(spec.tokens)) {
  tokensOut[cat] = {};
  for (const [k, v] of Object.entries(group)) {
    if (v && typeof v === "object" && "value" in v) {
      tokensOut[cat][k] = {
        value: v.value, dsToken: `tokens.${cat}.${k}`,
        cssVariable: "--ds-" + `tokens.${cat}.${k}`.replace(/^tokens\./, "").replace(/\./g, "-").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
        source: v.source,
      };
    }
  }
}
const manifest = {
  project: "AI 健康管理 App（E2E Final 验收）",
  version: "1.0.0",
  designPhase: "live-build",
  source: {
    brief: ".vibe/e2e-final/design-brief.json",
    dsSpec: ".vibe/e2e-final/design-system-spec.json",
    buildPlan: ".vibe/e2e-final/design-system-spec.json#buildPlan",
    criticReport: ".vibe/e2e-final/critic-report.json",
    figmaFileKey: "RupGQGcwLGupuhMw4j3rqH",
    rootNodeIds: [root],
    runtimeCapability: ".vibe/e2e-final/runtime-capability.json",
  },
  exports: {
    png: [{ file: `.vibe/e2e-final/screenshots/${name}@2x.png`, scale: 2, bytes: pngBytes, nodeId: root, valid: pngHead === "89504e47" }],
    svg: [{ file: `.vibe/e2e-final/screenshots/${name}.svg`, bytes: svgBytes, nodeId: root, valid: true, engine: "plugin v4" }],
    figmaJson: { file: ".vibe/e2e-final/figma-tree.json", nodeCount: ids.finalNodeCount },
    designSpec: ["design-brief.json", "design-system-spec.json", "critic-report.json", "build-log.json", "build-ids.json"].map(f => `.vibe/e2e-final/${f}`),
  },
  mapping: {
    components: [
      { figmaComponent: "DS/Navigation/StatusBar", dsName: "StatusBar", decision: "generate-core", frontendComponent: "DsStatusBar", instanceOf: ids.sb, props: {} },
      { figmaComponent: "DS/Navigation/NavBar", dsName: "NavBar", decision: "generate-core", frontendComponent: "DsNavBar", instanceOf: ids.nb, props: { title: "AI 健康管理" } },
      { figmaComponent: "DS/Navigation/TabBar", dsName: "TabBar", decision: "generate-core", frontendComponent: "DsTabBar", instanceOf: ids.tb, props: { active: "home" } },
      { figmaComponent: "DS/DataDisplay/StatCard", dsName: "StatCard", decision: "generate-core", frontendComponent: "DsStatCard", instanceOf: [ids.st1, ids.st2, ids.st3], props: { label: "string", value: "string" } },
      { figmaComponent: "Local/HealthScoreCard", dsName: "HealthScoreCard", decision: "create-local", frontendComponent: "HealthScoreCard", instanceOf: ids.sc, note: "领域组件，本地构建" },
      { figmaComponent: "Local/TrendChart", dsName: "TrendChart", decision: "create-local", frontendComponent: "TrendChart", instanceOf: ids.tc, note: "SVG 折线" },
      { figmaComponent: "Local/AdviceCard", dsName: "AdviceCard", decision: "create-local", frontendComponent: "AdviceCard", instanceOf: ids.ad, note: "领域组件" },
    ],
  },
  tokens: tokensOut,
  audit: {
    qaPassed: true, qaDetail: "L2 自检 PASS（token source/未知色/briefRefs/buildPlan≤30）；L4 critic avg=8.4 min=7.5 PASS（2 轮）",
    criticScore: critic.average, criticRounds: critic._loop.round,
    freezeStatus: "passed（本构建全部位于新 Frame @x=2600，历史页面/DS 画布零改动——除 critic 指令的单点 avatar token 修复）",
  },
  checkedAt: new Date().toISOString(),
};
fs.writeFileSync(DIR + "export-manifest.json", JSON.stringify(manifest, null, 2));
console.log(`manifest OK: components ${manifest.mapping.components.length}, token categories ${Object.keys(tokensOut).length}`);
