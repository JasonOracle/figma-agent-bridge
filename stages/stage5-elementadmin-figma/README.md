# Stage 5 · 参考图高还原 Benchmark：ElementAdmin / Reference Recreation Benchmark: ElementAdmin

## 中文

**目标**：**仅凭一张参考截图**（不提供源码/标注），在 Figma 里高还原 ElementAdmin 风格的 1920×1030 数据仪表盘，作为「还原度」基准测试。

**成果**（Figma Page 1）
- `Design System / ElementAdmin`（id `19:192`，x=11500）+ 根 Frame `Reference Recreation / ElementAdmin`（id `19:330`，x=12500，1920×1030）
- 207 节点 / 4 组件 / 14 实例 / 49 auto-layout / 0 IMAGE / 25 VECTOR
- 25 个 VECTOR 全部程序化生成：饼图 5 个贝塞尔扇形（arc→cubic 近似）、2 条 Catmull-Rom 平滑曲线、多段虚线 crosshair 合成单节点
- 仅凭截图推导：1920×1026 换算（×1.778）、sidebar 180 / topbar 40 / KPI 72 / 图表行 717:951 / 折线卡 352、Element 色板 17 色全部 token 化
- **Hover 状态结构化**：`Hover State / 二月 Crosshair` 独立 frame（虚线 + 蓝药丸 + tooltip 卡 + y 轴指针 "1130.94"）

**验证**：audit 47/47；几何抽查（扇形逐 bbox、柱高与参考等比、KPI gap 24 精确、子菜单缩进覆写 40/56/56 生效）。
**自评还原度**：89/100（图标简化、饼图占比估读、无 prototype 交互为主要扣分）。

**运维修正**：Bridge 超时上限 120s→600s（`--maxTimeout` 参数，冷启动 Figma 首批 379 op 需约 100s）。

**本目录文件**
- `stage5-review.md`：审计记录
- `stage5-tree.json`：节点树完整几何 dump（后续 Stage 6/7 的唯一视觉依据）
- `stage5-figma2code.md`：Figma Node → Vue Component 映射表

## English

**Goal**: Recreate an ElementAdmin-style 1920×1030 admin dashboard in Figma from **a single reference screenshot** (no source code, no annotations) as a fidelity benchmark.

**Deliverables**: `Design System / ElementAdmin` + root frame `Reference Recreation / ElementAdmin` (id `19:330`): 207 nodes / 4 components / 14 instances / 49 auto-layouts / 25 programmatic VECTORs (bezier pie sectors, Catmull-Rom curves, dashed crosshairs). Hover state built as a structured frame (dashed crosshair + blue pill + tooltip card + y-axis pointer "1130.94"). Audit 47/47; self-assessed fidelity 89/100. Bridge timeout raised to 600s for cold-start batches.

**Files here**: audit notes, full geometry tree dump (the single visual source of truth for Stages 6-7), Figma→Vue mapping table.
