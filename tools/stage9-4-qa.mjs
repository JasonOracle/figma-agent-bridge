// Stage 9.4 — Frontend QA / Visual Regression / Final Integration
// A. Browser QA (routes + console)  B. Visual regression (6 shots)  C. Geometry audit
// Usage: node tools/stage9-4-qa.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const EXE = "C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const BASE = "http://127.0.0.1:5180";
const OUT = "stage6-element-admin/screenshots/stage9-4";
fs.mkdirSync(OUT, { recursive: true });

const results = { browserQA: {}, console: [], warnings: [], geometry: {}, shots: [] };
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") results.console.push(m.text().slice(0, 300));
  if (m.type() === "warning") results.warnings.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => results.console.push("PAGEERROR: " + String(e).slice(0, 300)));

const routes = [
  ["/dashboard", "dashboard.png"],
  ["/users", "user-list.png"],
  ["/exams", "exam-list.png"],
  ["/exams/E-2001", "exam-detail.png"],
  ["/settings", "settings.png"],
];

const round = (n) => Math.round(n * 10) / 10;

for (const [route, shot] of routes) {
  const entry = { route, loaded: false, chrome: {} };
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(700);
    // A: layout chrome presence
    entry.chrome = await page.evaluate(() => ({
      routerView: !!document.querySelector("main, [class*=main], .router-view") || document.body.innerText.length > 100,
      sidebar: !!document.querySelector("aside, [class*=sidebar]"),
      topbar: !!document.querySelector("header, [class*=topbar], [class*=top-bar]"),
      tagsbar: [...document.querySelectorAll("div")].some((d) => /仪表盘|首页|Dashboard/.test(d.textContent) && d.children.length <= 12 && d.getBoundingClientRect().height < 60 && d.getBoundingClientRect().height > 20),
      pageWidth: Math.round(document.documentElement.clientWidth),
    }));
    entry.loaded = true;
    await page.screenshot({ path: `${OUT}/${shot}` });
    results.shots.push(shot);

    // C: geometry per page
    const g = await page.evaluate(() => {
      const h = (sel) => {
        const el = document.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().height) : null;
      };
      const out = {};
      out.buttons = [...document.querySelectorAll("button")].filter((b) => b.getBoundingClientRect().height > 0).map((b) => Math.round(b.getBoundingClientRect().height));
      out.inputs = [...document.querySelectorAll("input")].filter((i) => i.getBoundingClientRect().height > 0).map((i) => Math.round(i.getBoundingClientRect().height));
      out.selects = [...document.querySelectorAll("select, [class*=select]")].filter((s) => s.getBoundingClientRect().height > 0).map((s) => Math.round(s.getBoundingClientRect().height));
      out.tableHeader = h("thead tr") || h("[class*=table-header]");
      out.tableRows = [...document.querySelectorAll("tbody tr")].slice(0, 5).map((r) => Math.round(r.getBoundingClientRect().height));
      out.cards = [...document.querySelectorAll("[class*=card]")].filter((c) => c.getBoundingClientRect().height > 40).slice(0, 3).map((c) => getComputedStyle(c).borderRadius);
      return out;
    });
    results.geometry[route] = g;
  } catch (e) {
    entry.error = String(e).slice(0, 200);
  }
  results.browserQA[route] = entry;
}

// B-extra: exam-detail scores tab screenshot
try {
  await page.goto(BASE + "/exams/E-2001", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.click("text=考试成绩");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/exam-detail-score.png` });
  results.shots.push("exam-detail-score.png");
  const rows = await page.evaluate(() => [...document.querySelectorAll("tbody tr")].slice(0, 5).map((r) => Math.round(r.getBoundingClientRect().height)));
  results.geometry["/exams/E-2001 (scores tab)"] = { tableRows: rows };
} catch (e) {
  results.scoresTabError = String(e).slice(0, 200);
}

await browser.close();

// C-summary: evaluate pass/fail
const g = results.geometry;
const flat = {
  buttonHeights: [...new Set(Object.values(g).flatMap((v) => v.buttons || []))],
  inputHeights: [...new Set(Object.values(g).flatMap((v) => v.inputs || []))],
  selectHeights: [...new Set(Object.values(g).flatMap((v) => v.selects || []))],
  tableHeaders: [...new Set(Object.values(g).map((v) => v.tableHeader).filter(Boolean))],
  rowHeights: [...new Set(Object.values(g).flatMap((v) => v.tableRows || []))],
  cardRadii: [...new Set(Object.values(g).flatMap((v) => v.cards || []))],
  pageWidths: [...new Set(Object.values(results.browserQA).map((e) => e.chrome.pageWidth).filter(Boolean))],
};
results.geometrySummary = flat;
results.pass = {
  button30: flat.buttonHeights.every((x) => x === 30) && flat.buttonHeights.length > 0,
  input30: flat.inputHeights.every((x) => x === 30) && flat.inputHeights.length > 0,
  select30: flat.selectHeights.length === 0 || flat.selectHeights.every((x) => x === 30),
  header40: flat.tableHeaders.every((x) => x === 40) && flat.tableHeaders.length > 0,
  row44: flat.rowHeights.every((x) => x === 44) && flat.rowHeights.length > 0,
  cardRadius4: flat.cardRadii.every((r) => r === "4px"),
  width1440: flat.pageWidths.every((w) => w === 1440),
  noConsoleError: results.console.length === 0,
  noVueWarning: results.warnings.length === 0,
};

fs.writeFileSync(".vibe/stage9/stage9-4-qa-results.json", JSON.stringify(results, null, 1));
console.log(JSON.stringify({ pass: results.pass, console: results.console.slice(0, 5), warnings: results.warnings.slice(0, 5), shots: results.shots, summary: flat }, null, 1));
