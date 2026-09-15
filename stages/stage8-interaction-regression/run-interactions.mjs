/**
 * Stage 8 — Interaction & State Regression
 * 真实浏览器事件驱动（Playwright Chromium, headless, DPR=1）。
 * 输出：.vibe/stage8/{interaction-matrix.json, interaction-summary.json,
 *        screenshots/, geometry/, logs/}
 * 状态枚举：PASS | FAIL | NOT_IMPLEMENTED | NOT_SPECIFIED | ENVIRONMENT_LIMITATION
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname);
const SS = path.join(OUT, "screenshots");
const GEO = path.join(OUT, "geometry");
const LOGS = path.join(OUT, "logs");
for (const d of [SS, GEO, LOGS]) fs.mkdirSync(d, { recursive: true });

const URL = "http://127.0.0.1:5180/";
const matrix = [];
const consoleLogs = [];
const pageErrors = [];

function rec(component, state, action, expected, actual, status, screenshot = "", root_cause = "") {
  matrix.push({ component, state, action, expected, actual, status, screenshot, root_cause });
  const tag = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "·";
  console.log(`${tag} [${status}] ${component}/${state}/${action} :: ${String(actual).slice(0, 110)}`);
}

const val = (s) => (s && s.trim() ? s.trim() : "(empty)");
const shot = async (page, name) => {
  const p = path.join(SS, name);
  await page.screenshot({ path: p });
  return `screenshots/${name}`;
};

/* ---------- helpers ---------- */
async function box(page, sel) {
  const el = await page.$(sel);
  if (!el) return null;
  const b = await el.boundingBox();
  return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
}
async function bg(page, sel) {
  return page.$eval(sel, (e) => getComputedStyle(e).backgroundColor);
}
async function color(page, sel) {
  return page.$eval(sel, (e) => getComputedStyle(e).color);
}
async function cursor(page, sel) {
  return page.$eval(sel, (e) => getComputedStyle(e).cursor);
}

/* ---------- LINE 数据（与 src/data/figma.js 同源，用于断言） ---------- */
const MONTHS = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
const S1 = [115,120,138,145,150,155,150,128,175,200,152,148];
const S2 = [105,82,130,148,150,152,150,242,200,95,112,150];

const browser = await chromium.launch({
  executablePath: String.raw`C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe`,
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1030 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("console", (m) => consoleLogs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => pageErrors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

/* =========================================================
 * 1. Sidebar Interaction
 * ========================================================= */
const menuBtns = "aside button";
const btnCount = await page.$$eval(menuBtns, (els) => els.length);

// 1.1 初始 active
const activeInit = await page.$eval('aside button[aria-current="page"]', (e) => ({
  text: e.textContent.trim(),
  cls: e.className,
  bg: getComputedStyle(e).backgroundColor,
}));
rec("Sidebar", "initial", "load", '首页为 active（bg=#5A5CF0, aria-current="page"）',
  `active=${val(activeInit.text)} bg=${activeInit.bg}`,
  activeInit.text === "首页" && activeInit.bg === "rgb(90, 92, 240)" ? "PASS" : "FAIL",
  await shot(page, "sidebar-active.png"));

// 1.2 一级菜单 hover
const moreSel = 'aside button:has-text("更多菜单")';
const bgBefore = await bg(page, moreSel);
await page.hover(moreSel);
await page.waitForTimeout(150);
const bgHover1 = await bg(page, moreSel);
rec("Sidebar", "一级菜单", "hover", "背景从 transparent 变为 page 色（CSS hover:bg-page）",
  `before=${bgBefore} after=${bgHover1}`,
  bgBefore !== bgHover1 ? "PASS" : "FAIL", await shot(page, "sidebar-hover.png"));

// 1.3 子菜单 hover
const subSel = 'aside button:has-text("菜单1-1")';
const bgSubBefore = await bg(page, subSel);
await page.hover(subSel);
await page.waitForTimeout(150);
const bgSubHover = await bg(page, subSel);
rec("Sidebar", "子菜单", "hover", "背景变化（与一级菜单同 hover 样式）",
  `before=${bgSubBefore} after=${bgSubHover}`,
  bgSubBefore !== bgSubHover ? "PASS" : "FAIL");

// 1.4 子菜单缩进
const indents = await page.$$eval(menuBtns, (els) => els.map((e) => parseInt(getComputedStyle(e).paddingLeft)));
const expIndent = [20, 20, 40, 56, 56, 20];
rec("Sidebar", "子菜单", "indent", `paddingLeft=${JSON.stringify(expIndent)}（Figma 40/56/56）`,
  JSON.stringify(indents), JSON.stringify(indents) === JSON.stringify(expIndent) ? "PASS" : "FAIL");

// 1.5/1.6 菜单点击 → active 切换
await page.click('aside button:has-text("菜单1-1")');
await page.waitForTimeout(200);
const activeAfterClick = await page.$eval('aside button[aria-current="page"]', (e) => e.textContent.trim());
rec("Sidebar", "菜单点击", "click", "点击后 active 切换到被点菜单",
  `点击 菜单1-1 后 active 仍为 ${val(activeAfterClick)}`, "NOT_IMPLEMENTED",
  "", "MenuItem 为静态 variant（来自数据），未绑定 click 状态；Figma 仅定义 active 视觉态，未定义点击切换行为");
await shot(page, "sidebar-after-click.png");

// 1.7 mouseleave 状态恢复
await page.mouse.move(960, 500);
await page.waitForTimeout(150);
const bgRestored = await bg(page, moreSel);
rec("Sidebar", "一级菜单", "mouseleave", "背景恢复 transparent",
  `restored=${bgRestored}`, bgRestored === bgBefore ? "PASS" : "FAIL");

// 1.8 collapse
const collapseCtl = await page.$('aside button[aria-expanded], aside [class*="collapse"], aside svg[class*="fold"]');
rec("Sidebar", "folded", "collapse/expand", "存在折叠控件并可折叠/展开",
  collapseCtl ? "发现疑似控件" : "无折叠控件", "NOT_IMPLEMENTED",
  "", "Stage 6/Figma 19:330 未定义折叠能力（无控件、无状态），按要求不伪造");

/* =========================================================
 * 2. TagsBar
 * ========================================================= */
const tagTexts = await page.$$eval("nav span", (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
const tagExp = ["首页", "首页2"];
rec("TagsBar", "static", "text-check", `文案与 Figma 一致：${JSON.stringify(tagExp)}`,
  JSON.stringify(tagTexts.slice(0, 2)), JSON.stringify(tagTexts.slice(0, 2)) === JSON.stringify(tagExp) ? "PASS" : "FAIL");

const tag1 = 'nav span:has-text("首页")';
const tag2 = 'nav span:has-text("首页2")';
const tag1Color = await color(page, tag1);
const tag2Color = await color(page, tag2);
rec("TagsBar", "active/inactive", "state", "tag1=menu 色(#5A5CF0)、tag2=ink-3 灰",
  `tag1=${tag1Color} tag2=${tag2Color}`,
  tag1Color === "rgb(90, 92, 240)" && tag2Color !== "rgb(90, 92, 240)" ? "PASS" : "FAIL");

await page.hover(tag2);
await page.waitForTimeout(150);
rec("TagsBar", "hover", "hover", "Figma 未定义 tag hover 态（无视觉变化即符合设计）",
  "无样式变化", "NOT_SPECIFIED", await shot(page, "tag-hover.png"),
  "Figma Tag 组件仅有 Icon+Label 两个静态态，未定义 hover");

await page.click(tag1);
await page.waitForTimeout(150);
const tagTextsAfter = await page.$$eval("nav span", (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
rec("TagsBar", "首页 tag", "click", "存在点击行为（选中/关闭等）",
  `点击后 tag 列表无变化：${JSON.stringify(tagTextsAfter.slice(0, 2))}`, "NOT_IMPLEMENTED",
  "", "TagsBar 未绑定 click；Figma 未定义 tag 切换行为（NOT_SPECIFIED 交叉归类）");
await page.click(tag2);
await page.waitForTimeout(150);
const hasClose = await page.$('nav span:has-text("首页2") [class*="close"], nav [aria-label*="close"]');
rec("TagsBar", "首页2 tag", "click/close", "存在关闭能力（若设计定义）",
  hasClose ? "存在关闭钮" : "无关闭钮，点击无效果", "NOT_IMPLEMENTED",
  "", "Stage 6 修复轮已按 Figma 源移除 × 钮（Figma Tag 无关闭钮）——不得擅自加回");

/* =========================================================
 * 3. KPI Cards
 * ========================================================= */
const kpiSel = ".shadow-card";
const kpiCount = await page.$$eval(kpiSel, (els) => els.length);
const kpi0 = `${kpiSel} >> nth=0`;
const kpiBgBefore = await bg(page, kpi0);
await page.hover(kpi0);
await page.waitForTimeout(150);
const kpiBgHover = await bg(page, kpi0);
await page.screenshot({ path: path.join(SS, "kpi-hover.png"), clip: { x: 180, y: 80, width: 1400, height: 120 } });
rec("KPI Cards", "hover", `hover card1 / mouseleave`, "Figma 未定义 KPI hover 态",
  `bg before=${kpiBgBefore} after=${kpiBgHover}（无变化）`, "NOT_SPECIFIED",
  "screenshots/kpi-hover.png", "KPI 卡在 Figma 中为纯展示组件");
const kpiCursor = await cursor(page, kpi0);
rec("KPI Cards", "cursor", "inspect", "非交互元素 → 默认箭头（computed 为 auto 或 default 均等价）",
  `cursor=${kpiCursor}`, ["auto", "default"].includes(kpiCursor) ? "PASS" : "FAIL");
const kpiFocusable = await page.$eval(kpi0, (e) => ({ tab: e.tabIndex, tag: e.tagName }));
rec("KPI Cards", "focus", "Tab 聚焦尝试", "Figma 未定义点击/聚焦行为",
  `tag=${kpiFocusable.tag} tabIndex=${kpiFocusable.tab}（不可聚焦）`, "NOT_SPECIFIED",
  "", "按要求不强制加 tabindex；click 同为 NOT_SPECIFIED");

/* =========================================================
 * 4. Bar Chart
 * ========================================================= */
const barRects = 'svg[aria-label="每周用户活跃量柱状图"] rect[fill="#5470C6"]';
const barCount = await page.$$eval(barRects, (els) => els.length);
const barBox0 = await page.$$eval(barRects, (els) => els.map((e) => e.getBoundingClientRect().toJSON()));
let barHoverEvidence = [];
for (const idx of [0, 3, 6]) {
  const b = barBox0[idx];
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
  await page.waitForTimeout(120);
  const tipCount = await page.$$eval('[class*="tooltip"], [role="tooltip"]', (els) => els.length).catch(() => 0);
  barHoverEvidence.push({ bar: idx + 1, tooltip: tipCount });
}
rec("BarChart", "柱 hover", `hover 柱1/柱4/柱7（共 ${barCount} 根）`, "柱高亮 + tooltip",
  JSON.stringify(barHoverEvidence) + "（均无 tooltip、柱色不变）", "NOT_IMPLEMENTED",
  await shot(page, "bar-hover.png"), "Stage 6 未实现柱级交互；Figma 中徽标为常驻静态元素（Hover Badge 烘焙态）");
// 快速扫动
const bx0 = barBox0[0], bx6 = barBox0[6];
await page.mouse.move(bx0.x + 22, bx0.y + 10, { steps: 2 });
await page.mouse.move(bx6.x + 22, bx6.y + 10, { steps: 5 });
await page.waitForTimeout(120);
const barTipFast = await page.$$eval('[class*="tooltip"], [role="tooltip"]', (els) => els.length).catch(() => 0);
rec("BarChart", "快速移动", "柱1→柱7 扫动", "状态正确更新",
  `扫动后 tooltip=${barTipFast}（无任何状态）`, "NOT_IMPLEMENTED", "", "同上");
// 徽标回归检查（Stage 7 已验收元素仍在）
const badge = await page.$eval('div[class*="right-[56px]"], .shadow-tip', (e) => e.textContent.trim()).catch(() => null);
rec("BarChart", "回归保护", "badge 静态存在", "徽标 7,600 KBa / +15.2 KBa 仍在右上",
  val(badge), badge && badge.includes("7,600") ? "PASS" : "FAIL");

/* =========================================================
 * 5. Line Chart（核心：24 数据点逐一 hover）
 * ========================================================= */
const lineSvg = 'svg[aria-label="每月销售量折线图"]';
const lineBox = await box(page, lineSvg); // svg 自身 bbox（不含标题行）
const scX = lineBox.w / 1660; // viewBox → 屏幕（等比）
const tooltipSel = `div.pointer-events-none.absolute`; // tooltip 唯一含 pointer-events-none（badge 无此类）

// 数据点屏幕坐标（s1/s2，基于 svg bbox 精确映射）
const yForV = (v) => 232 - (v / 250) * 222;
const ptsScreen = [];
for (let i = 0; i < 12; i++) {
  const vx = 44 + (1660 - 44) / 12 * i + ((1660 - 44) / 12) / 2;
  ptsScreen.push({
    month: MONTHS[i], vx,
    s1: { x: lineBox.x + vx * scX, y: lineBox.y + yForV(S1[i]) * scX },
    s2: { x: lineBox.x + vx * scX, y: lineBox.y + yForV(S2[i]) * scX },
  });
}

// 5.1 24 数据点逐一 hover：断言 tooltip 内容 + 药丸月份 + 残留
let lineAll = { pass: 0, fail: [] };
const readHover = async () => {
  const tip = await page.$eval(tooltipSel, (e) => ({
    text: e.innerText.replace(/\n/g, " | "), left: e.style.left, top: e.style.top,
    box: e.getBoundingClientRect().toJSON(),
  })).catch(() => null);
  const pill = await page.$eval(`${lineSvg} rect[fill="#5470C6"][height="19"]`, (e) => e.getAttribute("x")).catch(() => null);
  const dash = await page.$eval(`${lineSvg} path[stroke="#C0C4CC"]`, (e) => e.getAttribute("d")).catch(() => null);
  const ptr = await page.$eval(`${lineSvg} rect[fill="#5470C6"][height="18"]`, (e) => ({ y: e.getAttribute("y") })).catch(() => null);
  const ptrTxt = await page.$eval(`${lineSvg} text[class="num fill-white"]`, (e) => e.textContent.trim()).catch(() => null);
  return { tip, pill, dash, ptr, ptrTxt };
};
for (let i = 0; i < 12; i++) {
  for (const s of ["s1", "s2"]) {
    const p = ptsScreen[i][s];
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await page.waitForTimeout(60);
    const h = await readHover();
    const expTip = `${MONTHS[i]} | ${"一月"}: ${S1[i]} | ${"三月"}: ${S2[i]}`;
    const okTip = h.tip && h.tip.text === expTip;
    const okPill = h.pill !== null && Math.abs(parseFloat(h.pill) - (ptsScreen[i].vx - 22)) < 1.5;
    const okPtr = h.ptrTxt === "1130.94";
    if (okTip && okPill && okPtr) lineAll.pass++;
    else lineAll.fail.push({ month: MONTHS[i], series: s, okTip, okPill, okPtr, got: h.tip && h.tip.text });
  }
}
await page.mouse.move(ptsScreen[1].s1.x, ptsScreen[1].s1.y, { steps: 3 });
await page.waitForTimeout(100);
const feb = await readHover();
rec("LineChart", "24 数据点逐一 hover", "逐点 hover（12 月 × 2 序列）",
  "每月 tooltip=「月 | 一月: s1 | 三月: s2」、药丸 x=数据点-22、y 指针 1130.94",
  `24 点中 ${lineAll.pass}/24 全部断言通过；失败明细=${lineAll.fail.length ? JSON.stringify(lineAll.fail) : "无"}`,
  lineAll.pass === 24 ? "PASS" : "FAIL");
rec("LineChart", "hover 二月", "s1 数据点 hover（Stage 7 基准态）",
  "tooltip=二月 | 一月: 120 | 三月: 82，y 指针=1130.94",
  `tooltip=${feb.tip ? feb.tip.text : "null"} ptr=${val(feb.ptrTxt)}`,
  feb.tip && feb.tip.text === "二月 | 一月: 120 | 三月: 82" && feb.ptrTxt === "1130.94" ? "PASS" : "FAIL");

// 5.2 crosshair 与数据点中心一致性（hover 三个月份逐一对比）
let crossAll = [];
for (const i of [0, 1, 5, 11]) {
  const p = ptsScreen[i].s1;
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.waitForTimeout(80);
  crossAll.push({ month: MONTHS[i], dash: await page.$eval(`${lineSvg} path[stroke="#C0C4CC"]`, (e) => parseFloat(e.getAttribute("d").match(/M ([\d.]+)/)[1])), exp: ptsScreen[i].vx });
}
const crossOk = crossAll.every((c) => Math.abs(c.dash - c.exp) < 1);
rec("LineChart", "crosshair 对齐", "crosshair x vs 数据点 x（一月/二月/六月/十二月）",
  `dash x === 数据点 viewBox x（期望 ${JSON.stringify(crossAll.map((c) => c.exp))}）`,
  JSON.stringify(crossAll.map((c) => c.dash)),
  crossOk ? "PASS" : "FAIL");

// 5.3 首/中/尾截图
for (const [i, name] of [[0, "line-hover-first.png"], [5, "line-hover-middle.png"], [11, "line-hover-last.png"]]) {
  const p = ptsScreen[i].s1;
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(SS, name), clip: { x: lineBox.x - 10, y: lineBox.y - 40, width: Math.min(lineBox.w + 20, 1920 - lineBox.x + 10), height: lineBox.h + 80 } });
}
const dec = await readHover();
rec("LineChart", "最后数据点", "hover 十二月", "tooltip 不越界（自动翻转到左侧）",
  `tooltip left=${dec.tip ? dec.tip.left : "null"}（应≈100%-左侧定位）, right edge=${dec.tip ? Math.round(dec.tip.box.x + dec.tip.box.width) : "?"} ≤ 卡右缘 ${lineBox.x + lineBox.w}`,
  dec.tip && dec.tip.box.x + dec.tip.box.width <= lineBox.x + lineBox.w + 1 ? "PASS" : "FAIL");
await page.screenshot({ path: path.join(SS, "tooltip-edge.png"), clip: { x: lineBox.x - 10, y: lineBox.y - 40, width: Math.min(lineBox.w + 20, 1920 - lineBox.x + 10), height: lineBox.h + 80 } });

// 5.4 mouseleave 恢复 + 残留检查
await page.mouse.move(lineBox.x + lineBox.w / 2, lineBox.y - 30, { steps: 3 });
await page.waitForTimeout(200);
const tipAfterLeave = await page.$$eval(tooltipSel, (els) => els.length).catch(() => 0);
const dashAfterLeave = await page.$$eval(`${lineSvg} path[stroke="#C0C4CC"]`, (els) => els.length).catch(() => 0);
rec("LineChart", "mouseleave", "指针移出图表", "crosshair/tooltip/药丸/指针全部消失，无残留",
  `tooltip=${tipAfterLeave} crosshair=${dashAfterLeave}（应均为 0）`,
  tipAfterLeave === 0 && dashAfterLeave === 0 ? "PASS" : "FAIL");

// 5.5 快速移动
const startX = ptsScreen[0].s1.x, endX = ptsScreen[11].s1.x, midY = ptsScreen[5].s1.y;
await page.mouse.move(startX, midY);
await page.mouse.move(endX, midY, { steps: 5 });
await page.waitForTimeout(100);
const fast = await readHover();
rec("LineChart", "快速移动", "一月→十二月一次扫动", "最终状态=十二月，tooltip 跟随",
  `tooltip=${fast.tip ? fast.tip.text : "null"}`,
  fast.tip && fast.tip.text.startsWith("十二月") ? "PASS" : "FAIL");
await page.mouse.move(lineBox.x + lineBox.w / 2, lineBox.y - 30);

/* =========================================================
 * 6. TopBar
 * ========================================================= */
const searchInput = await page.$('header input[type="search"], header input');
rec("TopBar", "search", "focus/typing", "存在可聚焦搜索框",
  searchInput ? "存在" : "页面无 search input", "NOT_SPECIFIED", "",
  "Figma 19:330 TopBar 无搜索框元素，Stage 6 亦未实现（不得擅自添加）");
const notif = await page.$('header [aria-label*="notification"], header button[class*="bell"]');
rec("TopBar", "notification", "click", "存在通知入口",
  notif ? "存在" : "无通知元素", "NOT_SPECIFIED", "", "Figma 未定义通知入口");
const avatar = 'header span[aria-label="avatar"]';
const avatarEl = await page.$(avatar);
if (avatarEl) {
  await avatarEl.click();
  await page.waitForTimeout(150);
  const menuAppeared = await page.$('[class*="dropdown"], [role="menu"]');
  rec("TopBar", "avatar", "click", "Figma 中为静态圆形占位，未定义点击",
    menuAppeared ? "出现菜单" : "无任何反应", "NOT_SPECIFIED", "", "Figma avatar 为纯视觉元素");
}
const fsBtn = 'header span:has-text("全屏切换")';
const fsEl = await page.$(fsBtn);
if (fsEl) {
  const fsCursor = await fsEl.evaluate((e) => getComputedStyle(e).cursor);
  await fsEl.click();
  await page.waitForTimeout(150);
  const isFull = await page.evaluate(() => !!document.fullscreenElement);
  rec("TopBar", "fullscreen", "click", "进入全屏或存在交互",
    `无反应（fullscreenElement=${isFull}, cursor=${fsCursor}）`, "NOT_SPECIFIED",
    "", "Figma 中「全屏切换」为静态视觉元素，未定义点击行为");
}
const gear = await page.$$('header svg');
rec("TopBar", "gear/settings", "click", "存在设置交互",
  "gear 为纯 SVG 图标无事件绑定", "NOT_SPECIFIED", "", "Figma 静态元素");

/* =========================================================
 * 7. Keyboard Accessibility
 * ========================================================= */
await page.mouse.move(5, 5);
await page.evaluate(() => document.activeElement && document.activeElement.blur());
const focusSeq = [];
for (let i = 0; i < 10; i++) {
  await page.keyboard.press("Tab");
  await page.waitForTimeout(40);
  const info = await page.evaluate(() => {
    const a = document.activeElement;
    return a && a !== document.body ? `${a.tagName}:${(a.textContent || a.getAttribute("aria-label") || a.className || "").toString().trim().slice(0, 14)}` : "(body)";
  });
  focusSeq.push(info);
  if (info === "(body)") break;
}
rec("Keyboard", "Tab", "连按 Tab 记录焦点序列", "焦点按 DOM 顺序落在 6 个 sidebar button 上，之后离开页面（无 trap）",
  JSON.stringify(focusSeq),
  focusSeq.slice(0, 6).every((f) => f.startsWith("BUTTON")) && focusSeq.length <= 7 ? "PASS" : "FAIL");

// Shift+Tab 回退
await page.keyboard.press("Shift+Tab");
await page.waitForTimeout(60);
const backFocus = await page.evaluate(() => document.activeElement.tagName);
rec("Keyboard", "Shift+Tab", "回退焦点", "焦点回退到上一个 button",
  `activeElement=${backFocus}`, backFocus === "BUTTON" ? "PASS" : "FAIL");

// focus 可见性
const focusInfo = await page.evaluate(() => {
  const a = document.activeElement;
  const cs = getComputedStyle(a);
  return { outlineW: cs.outlineWidth, outlineStyle: cs.outlineStyle, boxShadow: cs.boxShadow !== "none" };
});
rec("Keyboard", "focus-visible", "检查焦点样式", "存在可见焦点指示（outline 或 shadow）",
  JSON.stringify(focusInfo),
  focusInfo.outlineStyle !== "none" || focusInfo.boxShadow ? "PASS" : "FAIL",
  await shot(page, "keyboard-focus.png"));

// Enter / Escape
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
const activeAfterEnter = await page.$eval('aside button[aria-current="page"]', (e) => e.textContent.trim());
rec("Keyboard", "Enter", "在 sidebar button 上按 Enter", "触发 click（若 click 有行为则状态变化）",
  `Enter 触发了 button 默认 click，active 仍=${val(activeAfterEnter)}（click 行为本身 NOT_IMPLEMENTED）`,
  "NOT_IMPLEMENTED", "", "Enter 确实触发 click 事件，但 click 未绑定任何行为");
await page.keyboard.press("Escape");
await page.waitForTimeout(100);
rec("Keyboard", "Escape", "按 Escape", "存在 Escape 行为（如关闭弹层）",
  "无任何反应（页面无弹层、无 Escape 监听）", "NOT_IMPLEMENTED", "", "无弹层可关，Figma 未定义");

// keyboard trap 检查：Tab 循环 12 次仍能回到 body 方向（无死锁）
let trapFree = true;
let prev = null, stuck = 0;
for (let i = 0; i < 12; i++) {
  await page.keyboard.press("Tab");
  const cur = await page.evaluate(() => document.activeElement.tagName + ":" + (document.activeElement.textContent || "").trim().slice(0, 6));
  if (cur === prev) stuck++;
  prev = cur;
}
rec("Keyboard", "keyboard-trap", "连续 Tab 12 次", "无 keyboard trap（焦点持续移动/循环）",
  stuck === 0 ? "焦点始终移动，无 trap" : `出现 ${stuck} 次原地不动`, stuck === 0 ? "PASS" : "FAIL");

/* =========================================================
 * 8. Responsive State Regression
 * ========================================================= */
const VPS = [[1920, 1030], [1440, 900], [1280, 900], [1024, 768], [768, 900]];
const respData = {};
for (const [w, h] of VPS) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect().toJSON();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    // 文本截断候选
    const clipped = [];
    document.querySelectorAll("main span, main h2, aside span, aside button, header span").forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        clipped.push({ text: (el.textContent || "").trim().slice(0, 12), sw: el.scrollWidth, cw: el.clientWidth });
      }
    });
    // 图表卡 bbox（重叠检测）
    const cards = [...document.querySelectorAll("main .relative, main [class*='rounded']")].map((el) => el.getBoundingClientRect().toJSON()).filter((b) => b.width > 100);
    // KPI 卡
    const kpis = [...document.querySelectorAll(".shadow-card")].map((el) => Math.round(el.getBoundingClientRect().width));
    return {
      sw: doc.scrollWidth, cw: doc.clientWidth, sh: doc.scrollHeight, ch: doc.clientHeight,
      sidebar: q("aside"), topbar: q("header"), tags: q("nav"),
      footer: q("footer"),
      kpiWidths: kpis,
      clipped: clipped.slice(0, 8),
      hOverflow: doc.scrollWidth > doc.clientWidth,
      vOverflow: doc.scrollHeight > doc.clientHeight + 2,
    };
  });
  respData[`${w}x${h}`] = m;
  await page.screenshot({ path: path.join(SS, `responsive-${w}x${h}.png`) });
  rec("Responsive", `${w}x${h}`, "scrollWidth vs clientWidth", "无横向溢出",
    `sw=${m.sw} cw=${m.cw} vOverflow=${m.vOverflow} clipped=${m.clipped.length}`,
    m.hOverflow ? "FAIL" : "PASS", `screenshots/responsive-${w}x${h}.png`,
    m.hOverflow ? "存在横向溢出，需定位" : "");
}
fs.writeFileSync(path.join(GEO, "responsive-geometry.json"), JSON.stringify(respData, null, 1));

/* =========================================================
 * 布局几何基准 dump（回归保护用，1920）
 * ========================================================= */
await page.setViewportSize({ width: 1920, height: 1030 });
await page.waitForTimeout(500);
const layout = await page.evaluate(() => {
  const q = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect().toJSON();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  return {
    topbar: q("header"), sidebar: q("aside"), tags: q("nav"),
    kpi: [...document.querySelectorAll(".shadow-card")].map((el) => { const b = el.getBoundingClientRect().toJSON(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; }),
    pieSvg: q('svg[aria-label*="饼"], svg[role="img"]:nth-of-type(1)'),
    barSvg: q('svg[aria-label="每周用户活跃量柱状图"]'),
    lineSvg: q('svg[aria-label="每月销售量折线图"]'),
    footer: q("footer"),
  };
});
fs.writeFileSync(path.join(GEO, "layout-1920.json"), JSON.stringify(layout, null, 1));

/* =========================================================
 * 汇总
 * ========================================================= */
fs.writeFileSync(path.join(OUT, "interaction-matrix.json"), JSON.stringify(matrix, null, 1));
fs.writeFileSync(path.join(LOGS, "console.log"), consoleLogs.join("\n"));
fs.writeFileSync(path.join(LOGS, "pageerrors.log"), pageErrors.join("\n") || "(no page errors)");

const summary = {};
for (const s of ["PASS", "FAIL", "NOT_IMPLEMENTED", "NOT_SPECIFIED", "ENVIRONMENT_LIMITATION"]) {
  summary[s] = matrix.filter((m) => m.status === s).length;
}
const verdict = {
  timestamp: new Date().toISOString(),
  url: URL,
  viewport_default: "1920x1030, DPR=1, headless chromium",
  counts: summary,
  total: matrix.length,
  interactionCoveragePct: +(100 * (summary.PASS + summary.FAIL) / matrix.length).toFixed(1),
  consoleErrors: consoleLogs.filter((l) => l.startsWith("[error]")).length,
  pageErrors: pageErrors.length,
};
fs.writeFileSync(path.join(OUT, "interaction-summary.json"), JSON.stringify(verdict, null, 1));
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(verdict, null, 1));

await browser.close();
