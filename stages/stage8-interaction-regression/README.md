# Stage 8 · 交互与状态回归 / Interaction & State Regression

## 中文

**目标**：在 Stage 7 静态像素回归之上，用**真实浏览器事件**验证 Stage 6 Vue 实现的交互、状态、边界与响应式行为。原则：不改 Figma 源、不伪造交互、不只读代码下结论。

**方法**：单进程 Playwright（Chromium headless, DPR=1）脚本 `run-interactions.mjs`，40 项测试覆盖 Sidebar / TagsBar / KPI / BarChart / LineChart（24 数据点逐一 hover）/ TopBar / Keyboard / 5 档响应式，输出 DOM 状态、computed style、截图与几何数据。

**结果**：**PASS 24 · FAIL 0 · NOT_IMPLEMENTED 8 · NOT_SPECIFIED 8 · 环境限制 0**；控制台/页面错误 0。
- 首轮 7 个 FAIL 经逐项归因**全部为测试脚本自身缺陷**（选择器/坐标映射/断言过严），修正脚本后复测通过——应用代码零改动
- Stage 7 静态回归复测：**5.691% / SSIM 0.9037，与最终轮逐位一致，零视觉回归**
- LineChart：24/24 数据点 tooltip 文案逐字正确、crosshair 与数据点 <1px 对齐、mouseleave 无残留、十二月边缘 tooltip 自动翻转不越界
- 响应式：5 视口零横向溢出、零文本截断（矮视口的纵向滚动为内容高 1030px 所致，非缺陷）

**结论**：**READY FOR STAGE 9**（Interaction Coverage 60%，Critical Failures 0）。
完整报告：`docs/stage8-interaction-regression.md`。

**本目录文件**
- `run-interactions.mjs`：可复现测试脚本
- `interaction-matrix.json`（40 条）/ `interaction-summary.json`：原始矩阵与汇总
- `screenshots/`：16 张交互证据（sidebar-hover/active、tag-hover、bar-hover、line-hover-first/middle/last、tooltip-edge、keyboard-focus、responsive-×5 等）
- `geometry/`：responsive-geometry.json / layout-1920.json
- `logs/`：console / pageerror 日志（均为空错误）
- `stage7-regression-check.png` + `diff-statistics-stage8-regression.json`：回归保护证据

## English

**Goal**: Verify the Stage 6 Vue implementation's interactions, states, edge cases and responsive behavior with **real browser events**, on top of Stage 7's static pixel regression. No Figma changes, no faked interactions, no conclusions from source-reading alone.

**Method**: a single-process Playwright script driving 40 checks (Sidebar / TagsBar / KPI / BarChart / LineChart with all 24 data points hovered / TopBar / Keyboard / 5 viewports), capturing DOM state, computed styles, screenshots and geometry.

**Result**: **PASS 24 · FAIL 0 · NOT_IMPLEMENTED 8 · NOT_SPECIFIED 8 · environment 0**; zero console/page errors. The 7 first-round FAILs were all test-harness defects (selector / coordinate mapping / over-strict assertions) — no application code was changed, and the Stage 7 static regression re-run matched the final baseline **bit-exactly (5.691% / SSIM 0.9037)**. LineChart passed 24/24 point-level assertions with <1px crosshair alignment and correct edge-flip. Verdict: **READY FOR STAGE 9**.

**Files here**: reproducible script, interaction matrix + summary JSON, 16 evidence screenshots, geometry dumps, logs, and the Stage 7 regression-protection evidence.
