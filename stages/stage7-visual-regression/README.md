# Stage 7 · Figma → Vue 像素级视觉回归 / Pixel-Level Visual Regression

## 中文

**目标**：把 Stage 5 的 Figma 渲染图与 Stage 6 的 Vue 截图做**真正的程序化像素 Diff**（不是肉眼评价），生成一份可供另一个 AI 独立分析的完整报告。

**方法**
- Figma 基准：figma-context MCP 按真实 fileKey 导出 Node `19:330` 渲染图（1920×1030, pngScale=1）→ `figma-baseline/`
- Vue 截图：playwright-cli（Chromium，DPR=1，zoom 100%），1920×1030 默认态 + hover 态 + 1440/1280 响应式
- Diff 脚本：`pixel-diff.py`（numpy + Pillow，自研：阈值 12/255/通道、SSIM 高斯窗、32px 网格 BBox 聚类、11 区域统计）、`compare-geometry.py`（Figma 几何 vs Vue DOM 几何逐区域对比）、`measure-elements.py`（关键元素 bbox 精确测量）

**结果**
| 轮次 | Pixel Diff | SSIM | 说明 |
|---|---|---|---|
| Round 0 | 6.001% | 0.894 | 基线 |
| Round 1 | 6.869% | — | 回归（卡高连锁反应），按规则定位后修正 |
| Round 1b | 5.692% | 0.9037 | 标题行高/卡高锁定/徽章/指针等 6 项 Vue 修复 |
| Round 3 | **5.691%** | **0.9037** | 修 tag 文本笔误「首页52」→「首页2」，Final **92/100** |

- Vue 侧修复：图表卡标题行高 19px、卡高 h-[300px]、柱图徽章 right-[56px] 62×40、折线 y 指针固定 svg y=65、药丸 y226/h19、TagsBar 去药丸底/× 钮、KPI 图标实心 16px、sidebar 图标实心
- **重大 FIGMA_SOURCE 发现（不修 Vue）**：① 饼图扇区变形（Stage 5 arcSector 贝塞尔近似错误）② 折线曲线不经过数据点（Series vector 仅 76px 高）③ 柱/折图网格线向量左移 52/44px 与数据不对齐
- 布局骨架（TopBar/Sidebar/TagsBar/KPI×4/三图表卡/Footer）与全部 17 个颜色 token **0px diff**

**完整报告**：`docs/stage7-visual-regression.md`（32 节，含根因四分类 A/B/C/D、P0/P1/P2、修复优先级）。

**本目录文件**
- `pixel-diff.py` / `compare-geometry.py` / `measure-elements.py` / `dump-geometry.js`：全部可复现脚本
- `figma-geometry.json` / `vue-geometry.json` / `geometry-comparison.json` / `element-measurements.json` / `diff-statistics-*.json` / `screenshot-metadata.json`：原始数据
- `figma-baseline/`：Figma 真实渲染基准图
- `side-by-side-round3.png` / `heatmap-round3.png`：最终三联对比图与热力图
- `crop-*.png`：关键区域成对放大对比图（左 Figma / 右 Vue 或 上 F / 下 V）
- `vue-1920-*.png` / `vue-1440-*` / `vue-1280-*`：各轮次与响应式截图

## English

**Goal**: Run a *programmatic* pixel diff between the Stage 5 Figma render and the Stage 6 Vue screenshot (not eyeballing), and produce a report an independent AI can analyze without seeing the screenshots.

**Method**: Figma baseline exported via the real fileKey (node `19:330`, 1920×1030, scale 1); Vue screenshots via Playwright (Chromium, DPR 1); self-built diff tooling (per-channel threshold 12, Gaussian-window SSIM, 32px-grid BBox clustering, 11-region statistics) plus geometry comparison and element-measurement scripts.

**Result**: Round 0 6.001% / SSIM 0.894 → a regression round (6.869%) diagnosed and corrected → Round 1b 5.692% / SSIM 0.9037 after 6 Vue fixes → Round 3 **5.691% / 0.9037** after a copy typo fix. Final score **92/100**. Layout skeleton and all 17 color tokens match at 0px. Major FIGMA_SOURCE findings (not Vue bugs): deformed pie sectors, line curve not passing through data points, grid vectors offset 52/44px. Full report: `docs/stage7-visual-regression.md` (32 sections).

**Files here**: reproducible scripts, raw JSON data, Figma baseline, per-round screenshots, final side-by-side + heatmap, and paired zoomed crops of key regions.
