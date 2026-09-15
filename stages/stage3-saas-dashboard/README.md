# Stage 3 · 第一次真实 Vibe Design：SaaS 教育仪表盘 / First Real Vibe Design: SaaS Education Dashboard

## 中文

**目标**：用 Stage 1-2 通道，以纯 Figma 原生节点（0 IMAGE）从零构建一个完整真实的 SaaS 教育仪表盘 UI。

**成果**（Figma Page 1）
- `Design System / SED`（x=4200）：11 色 + 字阶 + 圆角四档 + 10 个组件（Button×3 / Badge / Avatar / KPI Card / Table Row / Todo Item / Nav Item×2）
- `SaaS Education Dashboard`（x=5200，1440×900）：274 节点 / 95 auto-layout / 最深 7 层；Sidebar(220) / Header(64) / Welcome / 4 KPI / 趋势图（真实 VECTOR 折线 + 渐变面）/ 学科分布 / 考试表 5 行 / 待办 3 类；83 处嵌套实例文本覆写
- 插件 op 扩展到 34+（create-vector / set-effects / set-text-align / set-layout-sizing 等）

**工作流资产**（后续阶段全部复用）
- `tools/stage3-probe.js`：真画布探测（CJK 字体 / 新 op / 嵌套覆写）
- `tools/stage3-build.js`：令牌 → op 批次编译器，状态断点续跑（--stage / --teardown）
- `tools/stage3-audit.js`：读回真画布的 42 项断言

**验证**：audit 42/42 通过；selftest 91/91 回归通过。

**本目录文件**
- `stage3-review.md`：验收复核记录（逐条对照原始 spec 读回画布）
- `stage3-tree.json`：画布节点树完整几何 dump（274 节点）
- `stage3-batch.json`：生成画布所用的 op 批次（365 ops）
- `stage3-ia.md` / `stage3-figma2code.md`：信息架构与 Vue3 转换分析

## English

**Goal**: Build a complete SaaS Education Dashboard from scratch using only native Figma nodes (zero images), via the Stage 1-2 channel.

**Deliverables**: `Design System / SED` (x=4200, 11 colors + type scale + 10 components) and `SaaS Education Dashboard` (x=5200, 1440×900, 274 nodes, 95 auto-layouts, depth 7, 83 nested-instance text overrides). Plugin ops extended to 34+.

**Workflow assets** (reused by all later stages): probe → batch compiler (resumable) → audit script. Audit 42/42, selftest regression 91/91.

**Files here**: review notes, full geometry tree dump (`stage3-tree.json`), the op batch (`stage3-batch.json`), IA + figma2code analyses.
