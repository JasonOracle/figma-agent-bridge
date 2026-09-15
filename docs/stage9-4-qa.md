# Stage 9.4 — Frontend QA / Visual Regression / Final Integration

日期：2026-09-15 ｜ 仓库：figma-agent-bridge ｜ 基线 commit：617e02c（Stage 9.3）

> **Stage 9.4 COMPLETE**

本阶段为纯 QA 阶段：零源码修改、零 Figma 写入、零依赖变更。所有检查基于 Playwright（Chromium，chromium-1243，真实浏览器事件）与文件级扫描。

---

## A. Browser QA — PASS

环境：viewport 1440×900 / DPR 1 / Chromium。五条路由逐一 `goto` + `networkidle`：

| 路由 | 加载 | RouterView | Sidebar | TopBar | TagsBar | console error | Vue warning |
|---|---|---|---|---|---|---|---|
| /dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| /users | ✅ | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| /exams | ✅ | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| /exams/E-2001 | ✅ | ✅ | ✅ | ✅ | ✅ | 0 | 0 |
| /settings | ✅ | ✅ | ✅ | ✅ | ✅ | 0 | 0 |

- 全程监听 `console.error` / `pageerror` / `console.warning`：**均为 0**。
- 成绩 Tab 点击切换（`text=考试成绩`）真实事件验证通过，表格渲染 40/44 几何达标。

## B. Visual Regression — 6 张截图已生成

目录 `stage6-element-admin/screenshots/stage9-4/`（统一 1440×900 / DPR 1 / Chromium）：

1. `dashboard.png`
2. `user-list.png`
3. `exam-list.png`
4. `exam-detail.png`
5. `exam-detail-score.png`（点击成绩 Tab 后状态）
6. `settings.png`

全部经目检：页面结构、DS 组件渲染、Badge 语义色、分页、空态样式与 Figma 设计一致。原始数据见 `.vibe/stage9/stage9-4-qa-results.json`。

## C. Geometry Audit — PASS（scoped 至 DS 组件）

第一轮宽口径扫描将 TopBar/TagsBar/分页箭头等非 DS 控件计入（按钮 20–40px 不等），不符合规格语义；第二轮按 DS 组件根类名精确圈定（DsButton=`button.h-[30px]`，DsInput 包裹层=`div.inline-flex.h-[30px]`——内部原生 input 为 18px 属设计使然）：

| 指标 | 要求 | 实测 | 结果 |
|---|---|---|---|
| DS Button height | 30px | 全部 = 30（/users×3 /exams×3 /exams/:id×4 /settings×2） | ✅ |
| DS Input height | 30px | 全部 = 30（包裹层；内部 input 18px 为设计使然） | ✅ |
| DS Select height | 30px | = 30 | ✅ |
| Table Header | 40px | 全部 = 40 | ✅ |
| Table Row | 44px | 全部 = 44（含成绩 Tab） | ✅ |
| Card radius | 4px | 全部 = 4px | ✅ |
| Page width | 1440px | 全部 = 1440 | ✅ |

原始数据：`.vibe/stage9/stage9-4-geometry-scoped.json`。脚本：`tools/stage9-4-geometry.mjs`。

## D. DS Component Audit — PASS

`src/components/design-system/` 十个组件全部在位：DsButton、DsInput、DsSelect、DsBadge、DsTable、DsPagination、DsCard、DsState、DsBreadcrumb、DsToggle。

- 重复组件：0（DS 目录外无 `Ds*.vue`）。
- 绕过 DS 检查：views 中存在 7 处原生 `<button>`，逐一定性为 **设计一致实现，非违规**：
  - 表格「查看/编辑」文字链（主色 + hover 下划线）——对应 Figma 表格操作列的文字链样式，非 30px DS Button 实例；
  - ExamDetail 静态 Tabs ×2——9.2-B 中 Tabs 即为页内本地 Frame（DS 无 Tab 组件，规格禁止擅自新增）。
- 样式 token：页面样式统一走 Tailwind 语义 token（bg-surface/text-ink-1/border-stroke 等），无页面级私有 CSS。

## E. Token Audit — PASS（unknownColors = []）

全量扫描 `src/**/*.vue` + `src/**/*.js`，共 17 种 hex 色，全部映射到 Stage 9 token：

| 类别 | 色值 |
|---|---|
| 语义 | #5A5CF0(primary) #409EFF #F56C6C #67C23A |
| Ink | #303133 #606266 #909399 #C0C4CC |
| 面层 | #FFFFFF(surface) #F2F3F5(page) #E4E7ED(stroke) |
| Chart | #5470C6 #91CC75 #FAC858 #FC8452 #EE6666 |
| 允许派生 | #AAB8E8 ✅（规格明示允许的组件派生色） |

## F. Vue Integrity — PASS

- `tailwind.config.js`：**zero diff**（vs HEAD 及 vs 9.2-C 基线）。
- `package.json` / `package-lock.json`：本阶段 **zero diff**（9.3 的 vue-router 变更已在 617e02c 入库，属预期）。
- Dashboard 组件：`TopBar.vue` / `Sidebar.vue` / `TagsBar.vue` / `KpiCard.vue` / `charts/` 自 cb5ede3（原始移植）以来 **从未被修改**；9.3–9.4 对其 diff = 0。`DashboardView.vue` 为 9.3 的原样迁移（App.vue → 路由视图），渲染自查通过（Stage 9.3 dashboard-selfcheck）。

## G. Git Audit

本阶段（9.4）变更清单（将入库）：

```
docs/stage9-4-qa.md                                (新增，本报告)
tools/stage9-4-qa.mjs                              (新增，QA 脚本)
tools/stage9-4-geometry.mjs                        (新增，几何审计脚本)
.vibe/stage9/stage9-4-qa-results.json              (新增，QA 原始数据)
.vibe/stage9/stage9-4-geometry-scoped.json         (新增，几何原始数据)
stage6-element-admin/screenshots/stage9-4/*.png    (新增，6 张截图)
```

禁改核对：`tailwind.config.js`、`package.json`、`package-lock.json` 本阶段 diff = **零**；Figma 文件零写入；Stage 5 冻结文件零写入。

工作区另有 `plugin/code.js`（9.2-C 的 export-node op 遗留，+19 行）——不属于 9.4 范围，保持未提交（与 9.2-C/9.3 处理一致；开源时建议并入仓库以补齐导出能力）。

## Known Limitations

1. 视觉回归为「截图存档 + 目检」级别，非像素 diff（Stage 7 的像素回归通道针对 Stage 5 Dashboard 基线；新页面尚未建立像素基线，可作为后续迭代项）。
2. DsSelect 为受控静态样式组件，options 下拉为静态渲染；分页/筛选为前端 Mock 交互。
3. DS 无 Tab 组件（规格限制），Tabs 由页面按 9.2-B Figma 页内实现还原。
4. 表格操作列「查看/编辑」为文字链而非 DS Button——与 Figma 设计一致。
5. `/exams/:id` 成绩 Tab 切换为客户端状态切换，无路由记忆（设计未要求）。

## 停止声明

已完成 User List / Exam List / Exam Detail / Settings / Dashboard 全链路 QA，**立即停止**。未进入 Stage 10 / Backend API / Authentication / Database / Deployment / CI/CD。
