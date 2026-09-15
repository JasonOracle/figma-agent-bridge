/**
 * Stage 9.3 QA — 页面截图 + DOM Geometry Audit（Playwright Chromium, 1440×900, DPR=1）
 * 输出：stage6-element-admin/screenshots/*.png + screenshots/geometry-audit.json
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:5180";
const OUT = path.resolve("stage6-element-admin", "screenshots");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { file: "user-list.png", url: "/users" },
  { file: "exam-list.png", url: "/exams" },
  { file: "exam-detail.png", url: "/exams/E-2001" },
  { file: "settings.png", url: "/settings" },
];

const browser = await chromium.launch({
  executablePath: "C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe",
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const geometry = {};
for (const p of PAGES) {
  await page.goto(BASE + p.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, p.file) });

  geometry[p.url] = await page.evaluate(() => {
    const h = (sel) => [...document.querySelectorAll(sel)].map((el) => Math.round(el.getBoundingClientRect().height));
    const frame = document.querySelector("main")?.closest("body > div");
    return {
      viewport: [window.innerWidth, window.innerHeight],
      buttons30: h("button.inline-flex.h-\\[30px\\]").length + " buttons @h30",
      input30: h("div.inline-flex.h-\\[30px\\]").length + " inputs @h30",
      tableHeader40: h("thead tr").slice(0, 1),
      tableRow44: h("tbody tr").slice(0, 3),
      breadcrumb: !!document.querySelector("nav"),
      badges: document.querySelectorAll("span.inline-flex.items-center.gap-1\\.5").length,
    };
  });
  console.log("shot:", p.file, JSON.stringify(geometry[p.url]));
}
fs.writeFileSync(path.join(OUT, "geometry-audit.json"), JSON.stringify(geometry, null, 1));
await browser.close();
console.log("QA DONE");
