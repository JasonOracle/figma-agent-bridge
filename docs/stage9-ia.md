# Stage 9.0 — Multi-page Product IA & Architecture

> 状态：Stage 9.0（IA + Product Architecture）已完成，等待进入 Stage 9.1。
> 本文档全部事实来自真实源码读取与 Stage 5–8 artifacts 核对，非记忆描述。

---

## 1. Product Goal

把 Stage 6 的单页面 ElementAdmin（仅 Dashboard，视觉已通过 Stage 7 像素级验收、交互已通过 Stage 8 真实事件验收）扩展为一个**多页面后台产品**，完整验证 Vibe Design 工作流的全链路能力：

```
需求 → IA → Design System → Figma 多页面(Bridge 工作流)
    → Vue Router → 复用组件 → 页面状态(Mock 数据层)
    → 浏览器 → Visual Regression → Interaction Regression → Cross-page Regression
```

**边界约束**：
- Stage 8 冻结基线（commit `343fda4`）不得被覆盖；Dashboard 静态视觉与已验证交互默认不动。
- 新增页面为产品扩展的**明确授权范围**（用户 Stage 9 指令），但视觉语言必须继承 Stage 5/6 Design Token，不得擅自发明新视觉细节。
- Figma 源 Sidebar 的菜单文案（首页/更多菜单/菜单1/菜单1-1/菜单1-2/菜单2）是 Stage 5 参考还原的占位命名；Stage 9 将其**绑定真实路由**属于产品化映射，不改变视觉结构（节点几何/样式/文案不变，仅增加 click 语义）。

---

## 2. Existing Product（源码核实现状）

### 2.1 环境（实测）

| 项 | 值 |
|---|---|
| Node | v22.22.2（managed） |
| npm | 10.9.7 |
| Vue | 声明 `^3.4.38`，实际安装 3.5.42 |
| Vite | 声明 `^5.4.8`，实际安装 5.4.21 |
| Tailwind | 声明 `^3.4.13`，实际安装 3.4.19 |
| Playwright（库） | 1.64.0-alpha-2026-09-14（bridge/node_modules，Stage 8 脚本在用） |
| Playwright CLI | @playwright/cli（playwright-cli.js 入口，chromium-1243） |
| dev server | http://127.0.0.1:5180 → HTTP 200 存活 |
| Git | 工作树干净，HEAD = 远端 main = `343fda4`（Stage 8 冻结基线） |

### 2.2 已有页面 / 组件 / 路由 / 交互

- **页面**：仅 1 个 —— Dashboard（`src/App.vue` 内联实现，非独立 view）。
- **路由**：**无**（无 `src/router/`、`src/views/`、`vue-router` 依赖）。`main.js` 直接 `createApp(App).mount("#app")`。
- **数据层**：`src/data/figma.js`（静态常量 KPIS/PIE/BAR/LINE/NAV/TAGS）+ `src/data/geometry.js`（SVG path 函数）。**无 api/mock 分层**。
- **组件（12）**：TopBar / Sidebar / MenuItem / TagsBar / KpiCard / ChartCard / PieChart / BarChart / LineChart / LegendItem / AppFooter / VIcon（11 个真实图标）。
- **布局结构**（App.vue，对应 Figma 19:330）：`TopBar(40) → [Sidebar(180) | TagsBar(36) + Content(p-6, gap-6)]`。
- **已验证交互（Stage 8，40 项）**：
  - 真实实现：LineChart 全套 hover（24/24 数据点断言、crosshair<1px、边缘翻转）、Sidebar CSS hover/active、Tab/Shift+Tab 焦点遍历。
  - NOT_IMPLEMENTED（8）：菜单点击切换、折叠、tag 点击/关闭、柱级 hover/tooltip、Enter 业务行为、Escape。
  - NOT_SPECIFIED（8）：KPI 交互、tag hover、TopBar search/通知/avatar/全屏/gear。

### 2.3 回归基线（冻结，实测核对）

| Baseline | 指标 | 产物位置 |
|---|---|---|
| Stage 7 静态 | **5.691% / SSIM 0.9037 / 112,541 px**（阈值 12/255/通道） | `.vibe/stage7/diff-statistics-round3.json`、`pixel-diff.py`、`figma-baseline/figma-19-330-render.png` |
| Stage 8 交互 | **PASS 24 / FAIL 0** / NI 8 / NS 8，console+page error 0，Coverage 60% | `.vibe/stage8/interaction-matrix.json`、`interaction-summary.json`、`run-interactions.mjs` |
| Git | `343fda4`（已推送 origin/main，`ls-remote` 确认） | — |

---

## 3. Information Architecture（最终 IA）

结合现有 Sidebar 6 个导航槽位与产品语义（用户/考试/分析/设置），最终 IA 如下。**Dashboard 保持现有视觉冻结**；新页面继承同一 Design System。

```
ElementAdmin (Vue Router)
│
├── /login                    Login          独立布局（无 TopBar/Sidebar/TagsBar）
│
└── /  (AdminLayout = TopBar + Sidebar + TagsBar + Content)
    ├── /dashboard            首页            「首页」槽位，现有 Dashboard 冻结迁移
    ├── /users                菜单1           User List（表格/搜索/筛选/分页）
    ├── /users/:id            —              User Detail（行点击进入，无侧栏槽位）
    ├── /exams                菜单1-1         Exam List（表格/状态筛选/分页/新建）
    ├── /exams/:id            —              Exam Detail（行点击进入）
    ├── /analytics            菜单1-2         Analytics（图表复用 + 筛选）
    └── /settings             菜单2           Settings（表单/校验/保存）
```

**Sidebar 映射**（视觉结构不变，绑定 click → route）：

| Figma 槽位 | 语义 | Route | 备注 |
|---|---|---|---|
| 首页 | 仪表盘 | `/dashboard` | 默认 redirect `/` → `/dashboard` |
| 更多菜单 | 业务管理组父级 | — | 点击=展开/收起子菜单（实现 Stage 8 的 NOT_IMPLEMENTED 折叠项） |
| 菜单1 | 用户管理 | `/users` | 子菜单 |
| 菜单1-1 | 考试管理 | `/exams` | 子菜单 |
| 菜单1-2 | 数据分析 | `/analytics` | 子菜单 |
| 菜单2 | 系统设置 | `/settings` | 顶级 |

**TagsBar 语义升级**：静态标签 → 真实「已打开页面」tab（打开/激活/关闭跟随路由；`首页` tag 常驻不可关 —— 与 Figma「首页」tag 无 ×、「首页2」有 closable 的结构一致）。Detail 页打开时在 TagsBar 追加对应 tab。

---

## 4. Route Map

| Path | Name | View 组件 | Layout | Tag 标题 | 状态数据 |
|---|---|---|---|---|---|
| `/login` | login | LoginView.vue | 无（BlankLayout） | — | — |
| `/` | redirect | → `/dashboard` | — | — | — |
| `/dashboard` | dashboard | DashboardView.vue | AdminLayout | 首页 | 现有 KPIS/PIE/BAR/LINE |
| `/users` | users | UserListView.vue | AdminLayout | 用户管理 | mock users API |
| `/users/:id` | user-detail | UserDetailView.vue | AdminLayout | 用户详情-{id} | mock user API |
| `/exams` | exams | ExamListView.vue | AdminLayout | 考试管理 | mock exams API |
| `/exams/:id` | exam-detail | examDetailView.vue | AdminLayout | 考试详情-{id} | mock exam API |
| `/analytics` | analytics | AnalyticsView.vue | AdminLayout | 数据分析 | mock analytics API |
| `/settings` | settings | SettingsView.vue | AdminLayout | 系统设置 | settings store（本地） |

Router 要求：`createWebHistory`、刷新直达、路由 meta.title、动态参数、`router.afterEach` 更新 TagsBar、Back/Forward 原生可用。

---

## 5. Global Layout

```
BlankLayout   — 仅 /login，居中卡片
AdminLayout   — TopBar / [Sidebar | (TagsBar / router-view / AppFooter)]
```

- `App.vue` 现有骨架**拆分**为 `src/layouts/AdminLayout.vue`；Dashboard 内容迁入 `src/views/DashboardView.vue`。
- **冻结验证点**：拆分后 Dashboard 的 DOM 结构与 class 必须逐位不变（仅组件文件位置变化），Stage 7 pixel diff 必须复测逐位一致。

---

## 6. Shared Components（GLOBAL 清单）

### 6.1 已有（复用，不重设计）

| 组件 | 复用范围 |
|---|---|
| TopBar / Sidebar / MenuItem / TagsBar / AppFooter / VIcon | 全局布局 |
| ChartCard | → 抽象为通用 `Card`（标题+内容区）|
| KpiCard | Dashboard 专属，暂不跨页 |
| PieChart / BarChart / LineChart / LegendItem | Dashboard + Analytics |

### 6.2 新建（多页面必需，继承现有 Token）

| 组件 | Token 来源 | 用于 |
|---|---|---|
| PageContainer | page bg + p-6 + gap-6 | 所有页内容壳 |
| BaseButton | menu #5A5CF0 主色 / stroke 边框 / radius-md | 表单、表格操作、Modal |
| BaseInput | stroke 边框、caption 字阶、focus 边框 menu | 搜索、表单 |
| BaseSelect | 同上 | 筛选、表单 |
| BaseBadge | kpi.green/red/blue、chart.* 状态色 | 表格状态列、详情 |
| BaseTable | stroke 分隔、surface 底、caption 字阶 | User/Exam List |
| BasePagination | caption、hover menu | 列表页 |
| BaseModal | surface + shadow-tip + radius-md | 新建考试、编辑用户 |
| BaseForm (+FormItem) | caption 标签 + 校验错误红 #F56C6C | Settings、Modal 内表单 |
| BaseTabs | 底部 2px menu 指示条 | Detail 页 |
| BaseBreadcrumb | ink-3 / ink-1 | Detail 页顶部 |
| EmptyState / LoadingState / ErrorState | ink-3 文案 + VIcon | 列表/详情全状态 |

> Drawer / Toast：**IA 不需要**（操作反馈用 inline message + Modal），不引入，避免过度设计。

---

## 7. Page-specific Components（PAGE 清单）

| 页面 | 专属组件 |
|---|---|
| LoginView | LoginForm、LoginCard |
| DashboardView | 现有 KPI 行 + Pie/Bar/Line 组合（迁移自 App.vue） |
| UserListView | UserTable、UserSearchBar（关键字+状态筛选） |
| UserDetailView | UserProfileCard、UserStatTabs（基本信息/订单/日志） |
| ExamListView | ExamTable、ExamFilterBar（状态筛选）、CreateExamModal |
| ExamDetailView | ExamInfoCard、ExamScoreTable、ExamActionButtons |
| AnalyticsView | AnalyticsFilterBar（日期范围）、复用 LineChart/BarChart/ChartCard |
| SettingsView | SettingsForm（站点名/主题色/通知开关/保存） |

---

## 8. State Model（每数据页 4 态）

```
src/
├── api/          # 接口层：getUserList()/getExamList()/... 全部 async
├── mock/         # 数据源 + 模拟延迟(200~500ms) + 可注入 fail/empty 场景
├── stores/       # settings 本地状态（Composition API reactive，不引 Pinia）
└── views/ components/ layouts/ router/ data/（保留）
```

| 页面 | Loading | Success | Empty | Error |
|---|---|---|---|---|
| User/Exam List | 表格骨架屏 | 数据表格 | EmptyState（"暂无数据"，筛选导致时显示清空筛选） | ErrorState + 重试按钮 |
| User/Exam Detail | 内容骨架 | 信息卡+Tab | 404 EmptyState（id 不存在） | ErrorState |
| Analytics | 图表区骨架 | 图表（复用 hover） | EmptyState | ErrorState |
| Settings | —（本地即时） | 表单回填 | — | 校验错误 inline |
| Modal 提交 | 按钮禁用+loading | 关闭+表格刷新 | — | inline 错误 |

Mock 场景注入：URL query `?__state=empty|error` 强制触发（仅测试用），保证 Empty/Error 可被自动化验证。

---

## 9. Interaction Model

| 类别 | 交互 | 验证方式（真实浏览器事件） |
|---|---|---|
| Navigation | Sidebar 点击切换路由、active 随 route、TagsBar tab 激活/关闭、Browser Back/Forward、URL 直达+刷新 | Playwright click/goto/goBack |
| Search | User/Exam 列表关键字即时过滤（防抖 300ms） | type → 断言行数与内容 |
| Filter | 状态 Select 过滤 | selectOption → 断言 |
| Pagination | 页码/每页条数切换 | click → 断言当前页数据 |
| Row → Detail | 行点击跳转 `/users/:id` | click → URL + 详情内容 |
| Detail | Tab 切换、返回列表（面包屑+按钮）、编辑（Modal/表单）、保存/取消 | click/type → 状态断言 |
| CRUD | 新建考试（Modal 表单→列表新增） | 完整流程 |
| Form | Settings 校验（必填/长度）、保存成功反馈 | 清空触发校验 → 提交 |
| Chart | Analytics 图表 hover/tooltip | mousemove → tooltip 文案 |

**Stage 8 NOT_IMPLEMENTED 项的转正**：菜单点击切换、折叠、tag 关闭在 Stage 9 属产品必需，将实现并在 9.8 重新断言（Stage 8 记录保持原样不改写，差异在 9.8 报告中说明 delta）。

---

## 10. Responsive Strategy

视口：1920×1030 / 1440×900 / 1280×900 / 1024×768 / 768×900。

| 区域 | 策略 |
|---|---|
| Sidebar | 固定 180px（Figma 几何），全程不隐藏（768 下也不折叠，避免发明未定义视觉） |
| 表格 | 包裹 `overflow-x-auto` 容器，列定义 min-width |
| KPI/图表行 | grid 保持 4 列/717fr:951fr（与 Dashboard 一致），窄视口允许等比压缩；768 下 KPI 改 2 列（唯一断点行为，需在 9.2 Figma 或报告中显式声明） |
| Modal | max-width 90vw + 内部滚动 |
| Tooltip | 沿用 LineChart 边缘翻转逻辑 |
| 验收 | 每视口：scrollWidth==clientWidth、无文本截断（clip 检测）、无 overlap（关键元素 bbox 相交检测）、控件可达 |

---

## 11. Visual Regression Strategy

1. **Dashboard 冻结**：任何重构/迁移后重跑 `.vibe/stage7/pixel-diff.py`，必须逐位等于 **5.691% / 0.9037 / 112,541 px**（基线 `figma-19-330-render.png` 不变）。
2. **新页面基线**：Stage 9.2 用 Bridge 在真实 Figma 画布新建关键页 Frame（User List、Exam List、User Detail、Settings 优先；Analytics 复用图表组件可后置），导出 PNG 作为各页 baseline；9.7 逐页 pixel diff。
3. **Design System 组件**：在 Figma 建 DS 扩展页（Button/Input/Table/Modal/状态组件），与 Vue 实现同源对照。
4. 全流程沿用 Stage 7 工具链（Pillow+numpy 自研 diff，阈值 12）。

---

## 12. Interaction Regression Strategy

1. **Stage 8 冻结项复测**：`run-interactions.mjs` 扩展为 `stage8+stage9` 两段；Stage 8 段在 Dashboard 路由下原样复跑（LineChart 24 数据点、Tab 遍历等），结果必须保持 24 PASS / 0 FAIL。
2. **Stage 9 新增矩阵**：按 §9 全部真实事件驱动，输出 `.vibe/stage9/interaction-matrix.json`（沿用 component/state/action/expected/actual/status/screenshot/root_cause 字段与 5 态枚举）。
3. 跨页导航专项：Back/Forward、刷新直达、detail 深链、TagsBar 与路由一致性。
4. 禁止读码判 PASS；全部事件驱动 + 截图证据。

---

## 13. Task Checklist

- [x] **Stage 9.0** IA + Product Architecture（本文档）
- [ ] **Stage 9.1** Design System Expansion（token 继承 + 新组件规范，docs/stage9-design-system.md）
- [ ] **Stage 9.2** Figma Multi-page Design（Bridge 工作流新建页面 Frame + DS 扩展页）
- [ ] **Stage 9.3** Vue Router + Shared Layout（vue-router 安装、App.vue → layouts/ 拆分、**Dashboard pixel diff 复测**）
- [ ] **Stage 9.4** Page Implementation（8 个 view + 13 个共享组件）
- [ ] **Stage 9.5** State / Mock Data / Forms（api/mock 分层 + 4 态）
- [ ] **Stage 9.6** Cross-page Interaction（导航/搜索/筛选/分页/CRUD/表单）
- [ ] **Stage 9.7** Visual Regression（Dashboard 冻结复测 + 新页 diff）
- [ ] **Stage 9.8** Interaction Regression（Stage 8 段复跑 + Stage 9 矩阵）
- [ ] **Stage 9.9** Cross-page Acceptance（最终报告 + READY/BLOCKED）

**Git commit 计划**：每子阶段一 commit（`stage9: add product IA` → …），不 squash 历史。

---

## 14. 风险项

| # | 风险 | 缓解 |
|---|---|---|
| R1 | App.vue 拆分引入 Dashboard 视觉漂移 | 拆分后立即跑 Stage 7 diff，逐位一致才 commit |
| R2 | vue-router 为新依赖，需 npm install（仅 stage6 项目内） | `npm i vue-router@4`，锁定版本入 package.json |
| R3 | Sidebar 加 click 后 MenuItem 语义变化可能影响 Stage 8 已 PASS 项 | Stage 8 段复跑；hover/active 视觉 class 不变 |
| R4 | 「更多菜单」折叠实现改变默认展开态 → Dashboard 截图差异 | 默认态保持与 Figma 一致（子菜单展开可见），折叠仅在点击后发生 |
| R5 | TagsBar 静态→动态后 Dashboard 首屏 tag 结构必须仍是「首页(active)/首页2(closable)」 | 初始 tags 数据保持逐字一致，仅增加行为 |
| R6 | Mock 延迟使自动化测试不稳定 | `?__state=` 注入 + 可配置 0 延迟模式（`VITE_MOCK_FAST=1`） |
| R7 | Bridge timeout ≠ 未执行（历史教训） | Figma 写入后读回验证，禁止盲目重试 |
| R8 | 新页面 Figma 设计工作量集中在 9.2，可能超时 | 页面优先级排序（User List > Exam List > Settings > Detail > Analytics），可分批 |
| R9 | Windows 下同文件并行编辑丢失（历史教训） | 同文件编辑严格串行 |

---

## 15. 下一阶段建议（Stage 9.1）

1. 先装 `vue-router@4` 并做最小路由骨架（`/dashboard` 单路由 + layouts 拆分 + Stage 7 diff 复测）——把 R1/R2 风险在无新视觉的前提下提前消化（可作为 9.3 的前置步骤前移）。
2. 输出 `docs/stage9-design-system.md`：13 个新组件的 token 映射、尺寸、状态矩阵。
3. 9.2 前确认 Bridge/Figma 插件在线（`/health` + 插件心跳）。
