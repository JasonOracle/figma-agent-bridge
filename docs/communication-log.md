# 沟通记录 / Communication Log

> 按阶段记录用户指令与交付摘要 / Per-stage record of user instructions and deliverables.
> 时间线：2026-09-14（Stage 1-2）→ 2026-09-15（Stage 3-7）

---

## 阶段 0：环境准备 / Stage 0: Environment Setup

**用户诉求**：接入 Figma，让 Agent 能读写 Figma 文件。

**沟通与决策过程**
- 用户明确账号为 jasonoracle（Free 计划），并生成了 Figma personal access token。
- 插件市场无 Figma 连接器 → 手动配置 MCP：`figma-dev-mode`（官方本地 3845，需付费能力，放弃）+ `figma-context`（Framelink，REST 只读，可用）。
- 实测 `get_figma_data` 读取文件 `lLVJH0OnZPrkAqzarvhnBq`（Untitled）成功 → **只读路线打通，写入路线缺失**。

**结论**：官方 Write to Canvas 付费 → 用户接受自建写入通道方案。

---

## 阶段 1-2：写入通道 + 30 个原子操作 / Bridge Channel + 30 Atomic Ops

**用户指令（摘要）**
- 自建 `WorkBuddy Agent → Figma Skills → CLI → Bridge → Figma Plugin API` 写入通道。
- 约束：不安装新 Skill、不修改 figma-context MCP、不用官方 Write to Canvas、验证必须用真实画布。
- 先建通道，再扩展 30 个原子操作，各自完成后暂停等验收。

**交付**
- Bridge + Figma 开发插件 + CLI；selftest 91/91；真实画布 35 项断言 35/35。
- 用户配合项：在 Figma Desktop 手动 Import manifest 并运行插件（提供插件已注册的截图确认）。

**过程中的关键往返**
- 用户报告插件面板绿点 → Agent 确认真插件（`editorType: figma`，非 mock 前缀）。
- 首轮全部命令 `NO_RESULT` → Agent 通过服务端日志定位 Bridge waiter 缺陷并修复。

---

## 阶段 3：SaaS 教育仪表盘 / SaaS Education Dashboard

**用户指令（摘要）**：提供完整原始 spec（KPI 四卡数值、学科分布、待办分类、7 项导航、表格字段等），要求用通道真实写入 Figma，完成后暂停，不删旧产物。

**交付**：DS 画板 + 1440×900 仪表盘（274 节点），audit 42/42。

**关键往返**：用户重发原始 spec 要求逐条核对 → Agent 逐条读回画布核对，全部一致；同时发现分析文档曾凭印象编写 KPI 标签/学科数量，被逐字核对揪出并修正 → 确立铁律「文档内容必须从 tree.json 读回取值，禁止凭记忆」。

---

## 阶段 4：PixelFlow AI 暗色创作工具 / PixelFlow AI

**用户指令（摘要）**：给目标而非规格——「AI 创作工具，暗色」，测试 Agent 自主设计决策与「构建→审计→修复→复审」闭环；完成后暂停。

**交付**：`PixelFlow AI`（188 节点/17 组件），audit 42/42（初版 38/42 自查补漏后复审通过）。

---

## 阶段 5：ElementAdmin 参考图高还原 / Reference Recreation

**用户指令（摘要）**：仅凭一张参考截图在 Figma 高还原 ElementAdmin 仪表盘（1920×1030），作为还原度 Benchmark；完成后暂停。

**交付**：`19:330`（207 节点/25 VECTOR 程序化图表/Hover 状态结构化），audit 47/47，自评 89/100。

**过程中的运维往返**：冷启动首批 379 op 超时 → 用户同意放宽 Bridge 超时上限至 600s；期间踩「同文件并行两条 Edit 静默丢一条」导致 Bridge 崩溃，串行重做修复。

**衔接**：用户确认「我打开了 Figma」后重启 Bridge 并指引运行插件恢复连接。

---

## 阶段 6：Figma → Vue3 + Tailwind → 浏览器 / Vue Port

**用户指令（摘要）**：把 Frame `19:330` 转成 Vue3 + Tailwind 可运行页面。10 步流程约束：不重新设计、不改视觉、不读原 ElementAdmin 源码、仅以 Figma 为依据、图表优先 SVG、实现真实 hover、Visual QA 两轮对比参考图、不进第七阶段、完成后暂停。

**交付**：`stage6-element-admin/`（Vite5+Vue3.4+Tailwind3.4，12 组件），两轮 QA 88→93/100，1440/1280 无溢出，hover「二月」态与参考逐字一致。

---

## 阶段 7：像素级视觉回归 / Pixel-Level Visual Regression

**用户指令（摘要，原文很长，核心）**
- 因无法稳定向外部提供截图，必须产出一份「可供另一个 AI 独立分析」的详细 Markdown 报告：视觉检查、截图分析、Diff 分析、Figma 几何、浏览器 DOM/CSS 全部整理进报告。
- 必须执行真正的程序化像素 Diff（含热力图/BBox/SSIM），差异必须给坐标、必须区分 MEASURED 与 VISUAL_ESTIMATE、必须四分类根因（A Vue 错误 / B Figma 源差异 / C 环境渲染 / D 无法判断）。
- 最多 3 轮修复，每轮记录指标；若修改导致相似度下降应撤销。
- 32 节固定报告结构；保存原始数据；最后回答 8 项结论 + P0/P1/P2；不进 Stage 8，完成后只告知报告路径/相似度/Pixel Diff/Final Score/Top10 差异。

**需要用户提供的输入**：Figma 文件链接（用于导出真实渲染基准）→ 用户提供 fileKey `lLVJH0OnZPrkAqzarvhnBq`。

**交付**：`docs/stage7-visual-regression.md` + `.vibe/stage7/` 全套原始数据。最终：SSIM 0.9037 / Pixel Diff 5.691% / Final 92/100。

---

## 本仓库整理指令 / This Repo Organization Task

**用户指令**：提供新仓库 `git@github.com:JasonOracle/Figma-test-vibe-coding.git`，要求把每个阶段的产物、沟通的信息、经验分类好放入文件夹，做中英双语 README，提交推送。

**交付**：本仓库 —— `stages/`（按阶段归档）、`docs/communication-log.md`、`docs/lessons-learned.md`、双语 `README.md`。
