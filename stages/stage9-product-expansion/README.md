# Stage 9 — Product Expansion（产品化扩展）

**中文** | [English](#english)

从「单页还原实验」走向「产品级 Figma 工作流」：IA 规划 → 设计系统规范 → 在全新 Figma 文件中用纯程序化方式构建 DS 组件库与多个业务页面。

---

## 中文

### 子阶段

| 子阶段 | 范围 | 关键产物 | 结果 |
|---|---|---|---|
| 9.0 IA 规划 | 仅规划不写码：route map / 页面清单 / 导航结构 | [stage9-ia.md](stage9-ia.md) | 8 条路由规划完成 |
| 9.1 Design System 规范 | 16 色 / 5 字阶 / 3 圆角 / 2 阴影，16 个组件规格 | [stage9-design-system.md](stage9-design-system.md) | 25 节规范文档 |
| 9.2-A DS 构建 + User List | 在新 Figma 文件（`pGbRiWtRyXh1J7m4MDSAqK`）程序化创建 25 个 native 组件 + User List 页 | [stage9-2a-user-list.md](stage9-2a-user-list.md) | 审计全绿（几何 11/11、token 0 未知色） |
| 9.2-B Exam List / Exam Detail / Settings | 复用 9.2-A 的 25 个 DS 组件（新增正式组件 = 0）构建 3 个业务页 + 状态 specimens | [stage9-2b-exam-settings.md](stage9-2b-exam-settings.md) | 三页 1440×900，审计全绿 |

### 文件说明

- `stage9-2a-*.mjs` / `stage9-2b-*.mjs` — 程序化构建与五项审计脚本（串行 run 批处理、WRITE→READBACK、断点续跑）
- `data/` — 全部审计 JSON 快照：组件清单、几何审计、token 审计、Dashboard/UserList 完整性、构建日志与节点 id 快照
- `environment.json` — 当时的工具链版本快照（Node / Vue / Vite / Tailwind / Playwright）

### 关键约束（全程遵守）

- Stage 5 Dashboard 冻结文件（`lLVJH0…`）零写入；User List（Frame `4:235`）构建后不再触碰
- Vue 项目 `stage6-element-admin/src`、`tailwind.config.js` 零改动（每阶段 `git diff` 复核 ZERO CHANGES）
- 不创建 Prototype / Reaction，Tabs 等交互一律静态高保真状态

### 已知限制

- Bridge 无 createPage 能力，多页面以 Page 1 内 y 轴隔离分区实现
- Figma 文本自动行高 ≈16px ≠ Tailwind 20px，按钮/输入框需 FIXED 高度覆盖（30px）
- `run` 批处理 ≥35 ops 时偶发 NO_RESULT 回传丢失（画布实际已执行），靠 get-page-summary + 残件清理兜底

---

## English

From "single-page recreation experiment" to "product-grade Figma workflow": IA planning → design system spec → programmatic construction of a DS component library and multiple business pages in a brand-new Figma file.

### Sub-stages

| Sub-stage | Scope | Key artifacts | Result |
|---|---|---|---|
| 9.0 IA Planning | Plan-only: route map / page inventory / navigation | [stage9-ia.md](stage9-ia.md) | 8 routes planned |
| 9.1 Design System Spec | 16 colors / 5 type sizes / 3 radii / 2 shadows, 16 component specs | [stage9-design-system.md](stage9-design-system.md) | 25-section spec |
| 9.2-A DS Build + User List | 25 native components + User List page, built programmatically in a new Figma file | [stage9-2a-user-list.md](stage9-2a-user-list.md) | all audits green |
| 9.2-B Exam pages + Settings | 3 business pages reusing the 25 DS components (new formal components = 0) + state specimens | [stage9-2b-exam-settings.md](stage9-2b-exam-settings.md) | three 1440×900 pages, all audits green |

### Files

- `stage9-2a-*.mjs` / `stage9-2b-*.mjs` — programmatic build & 5-way audit scripts (serial run batches, WRITE→READBACK, resumable)
- `data/` — all audit JSON snapshots: component inventory, geometry audit, design-token audit, integrity checks, build logs, node-id snapshots
- `environment.json` — toolchain versions at the time

### Hard constraints (held throughout)

- Frozen Stage 5 Dashboard file: zero writes; User List frame untouched after build
- Vue project & tailwind config: zero changes (verified via `git diff` each stage)
- No Prototype / Reaction; all interactions are static high-fidelity states

### Known limitations

- Bridge has no createPage; multi-page done as y-axis isolation zones on Page 1
- Figma auto line-height ≈16px ≠ Tailwind 20px; controls need FIXED height overrides (30px)
- `run` batches ≥35 ops occasionally drop the result response (canvas actually executed); recovered via page-summary reads + debris cleanup
