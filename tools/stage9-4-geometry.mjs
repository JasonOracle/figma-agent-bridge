// Stage 9.4 — C. Geometry Audit (scoped to DS components only)
// DsButton root: button.h-[30px] | DsInput root: div.inline-flex.h-[30px] | DsSelect root: div.inline-flex.h-[30px] (with chevron)
import { chromium } from "playwright";
import fs from "node:fs";

const EXE = "C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const BASE = "http://127.0.0.1:5180";
const routes = ["/dashboard", "/users", "/exams", "/exams/E-2001", "/settings"];
const browser = await chromium.launch({ executablePath: EXE });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();

const report = {};
for (const route of routes) {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  report[route] = await page.evaluate(() => {
    const hs = (sel) => [...document.querySelectorAll(sel)].map((el) => Math.round(el.getBoundingClientRect().height)).filter((h) => h > 0);
    return {
      dsButton: hs("button.h-\\[30px\\]"),
      dsInput: hs("div.h-\\[30px\\].inline-flex, div.inline-flex.h-\\[30px\\]"),
      thead: hs("thead tr"),
      rows: hs("tbody tr").slice(0, 8),
      cardRadius: [...document.querySelectorAll("[class*=card], [class*=Card]")].filter((c) => c.getBoundingClientRect().height > 40).slice(0, 2).map((c) => getComputedStyle(c).borderRadius),
      pageWidth: document.documentElement.clientWidth,
    };
  });
}
await browser.close();

const all = Object.values(report);
const uniq = (arrs) => [...new Set(arrs.flat())];
const summary = {
  dsButtonHeights: uniq(all.map((r) => r.dsButton)),
  dsInputHeights: uniq(all.map((r) => r.dsInput)),
  tableHeaders: uniq(all.map((r) => r.thead)),
  rowHeights: uniq(all.map((r) => r.rows)),
  cardRadii: uniq(all.map((r) => r.cardRadius)),
  pageWidths: uniq(all.map((r) => r.pageWidth)),
  perRouteCounts: Object.fromEntries(Object.entries(report).map(([k, v]) => [k, { buttons: v.dsButton.length, inputs: v.dsInput.length, rows: v.rows.length }])),
};
summary.pass = {
  button30: summary.dsButtonHeights.length > 0 && summary.dsButtonHeights.every((h) => h === 30),
  input30: summary.dsInputHeights.length > 0 && summary.dsInputHeights.every((h) => h === 30),
  header40: summary.tableHeaders.length > 0 && summary.tableHeaders.every((h) => h === 40),
  row44: summary.rowHeights.length > 0 && summary.rowHeights.every((h) => h === 44),
  cardRadius4: summary.cardRadii.every((r) => r === "4px"),
  width1440: summary.pageWidths.every((w) => w === 1440),
};
fs.writeFileSync(".vibe/stage9/stage9-4-geometry-scoped.json", JSON.stringify({ report, summary }, null, 1));
console.log(JSON.stringify(summary, null, 1));
