# Stage 9.1 — Design System Expansion

> 状态：规范阶段。本阶段**零业务源码改动**（无 vue-router、无 App.vue 修改、无新 View、Dashboard DOM/CSS/视觉逐位不变）。
> Source of Truth = Stage 5 Figma Frame 19:330 + Stage 6 实现 + Stage 7/8 验收基线。所有现有 token 数值均从真实源码读取，非重新设计。

---

## 1. Scope

**本阶段产出**：现有 Token 全量清单与映射、15 个新增共享组件规范（另加 BaseCard 共 16 份规格）、组件状态矩阵、Responsive 规范、Accessibility 规范、Icon System 扩展清单。

**明确不做**：不安装 vue-router；不拆 App.vue；不创建任何业务 View；不实现 mock API；不修改 Sidebar/TagsBar/LineChart 行为；不修改现有 Figma Dashboard；不引入任何新视觉语言或第三方 UI/图标库。

**组件数量口径**：Stage 9.0 曾写「13 个新组件」，本阶段以实际清单为准——**15 个新增组件**（PageContainer、BaseButton、BaseInput、BaseSelect、BaseBadge、BaseTable、BasePagination、BaseModal、BaseForm、FormItem、BaseTabs、BaseBreadcrumb、EmptyState、LoadingState、ErrorState），另有 **BaseCard** 1 份通用卡片规范（与现有 ChartCard 并存，见 §23），合计 **16 份规格**。

---

## 2. Existing Token Inventory（实测）

### 2.1 Color（16 token，来源 tailwind.config.js，逐值来自 Figma 19:330）

| Token | 值 | Figma 来源 / 现有用途 |
|---|---|---|
| `page` | #F2F3F5 | 页面底色（body 区） |
| `surface` | #FFFFFF | 卡片/顶栏/侧栏底色 |
| `stroke` | #E4E7ED | 边框/分隔线/图表网格线 |
| `menu` | #5A5CF0 | 主色：active 菜单底、Logo、focus 指示 |
| `chart.blue` | #5470C6 | 折线主序列/柱图主色/药丸/y 指针 |
| `chart.green` | #91CC75 | 折线次序列/柱图次色/Logo 第二三角 |
| `chart.yellow` | #FAC858 | 饼图第三扇区 |
| `chart.orange` | #FC8452 | 饼图第四扇区 |
| `chart.red` | #EE6666 | 饼图第五扇区 |
| `kpi.blue` | #409EFF | KPI 图标色（新增用户） |
| `kpi.red` | #F56C6C | KPI 图标色（聊天）/徽标负值 |
| `kpi.green` | #67C23A | KPI 图标色（购物）/徽标正值 |
| `ink.1` | #303133 | 主文本 |
| `ink.2` | #606266 | 次文本 |
| `ink.3` | #909399 | 弱文本/占位符/图标默认色 |
| `ink.4` | #C0C4CC | 禁用/更弱图标（tag close 图标） |

**非 token 硬编码色（如实记录，不擅自转正）**：`#AAB8E8`（TopBar avatar 圆点，内联 bg-[#AAB8E8]）。
**语义缺口（仅记录 migration recommendation，本阶段不改名）**：
- success → 现用 `kpi.green` #67C23A；warning → 现用 `chart.yellow` #FAC858；error/danger → 现用 `kpi.red` #F56C6C。建议 Stage 9.2 后视需要增加语义别名 token（指向同值），不新建色值、不重命名现有 token。

### 2.2 Typography（5 字阶 + 2 临时用法）

| Token | size / line-height / weight | 现有用途 |
|---|---|---|
| `text-display` | 26 / 32 / 700 | KPI 大数字 |
| `text-heading` | 16 / 24 / 500（ChartCard 内局部覆写 `leading-[19px]`，Stage 7 校准值） | 卡片标题 |
| `text-body` | 13 / 20 | 正文/菜单项 |
| `text-caption` | 12 / 18 | 辅助文本/标签 |
| `text-number` | 11 / 16 | 图表刻度/徽标 |
| 临时：`text-[14px] font-bold leading-5` | TopBar Logo 文案 | 不转 token |
| 工具类：`.num` | tabular-nums | 数字列/刻度（style.css） |

### 2.3 Spacing（实测用法，Tailwind 4px 基准）

| 值 | 现有用途 |
|---|---|
| 24（p-6 / gap-6） | 页面内容 padding、区块间距（KPI 行/图表行/折线卡间） |
| 16（p-4） | ChartCard 内边距（Figma pad16） |
| 20（px-5 / pl-20px） | KpiCard 水平 padding、MenuItem 顶级缩进 |
| 12（px-3） | TagsBar 水平 padding |
| 10（gap-2.5）/ 8（gap-2）/ 6（gap-1.5）/ 4（gap-1） | 图标-文本、行内间距 |
| MenuItem 缩进体系 | 顶级 20px，子级 40 / 56px（Figma indent） |

### 2.4 Radius

| Token | 值 | 现有用途 |
|---|---|---|
| `rounded-xs` | 2px | 柱图徽标、折线药丸/指针（Figma r=2） |
| `rounded-sm` | 4px | 卡片（ChartCard/KpiCard，Figma r=4） |
| `rounded-md` | 6px | **现有组件未使用**，预留按钮/输入框/Modal（Figma 参考体系 r=6） |
| `rounded-full` | — | avatar 圆点等圆形元素 |

### 2.5 Shadow

| Token | 值 | 现有用途 |
|---|---|---|
| `shadow-card` | 0 1px 4px rgba(0,0,0,0.06) | 卡片 |
| `shadow-tip` | 0 2px 12px rgba(0,0,0,0.18) | tooltip/徽标 |
| Modal 阴影 | **复用 `shadow-tip`**，不新增 token | — |

---

## 3. Token Mapping（Figma → Tailwind → Vue Usage）

| Figma Token | Tailwind Token | Vue Component Usage |
|---|---|---|
| 页面底 #F2F3F5 | `bg-page` | App.vue 根、MenuItem hover 底 |
| 卡片底 #FFFFFF | `bg-surface` | ChartCard/KpiCard/TopBar/Sidebar/TagsBar、新 BaseTable/Modal |
| 描边 #E4E7ED | `border-stroke` / `bg-[#E4E7ED]`(网格) | BarChart 徽标、LineChart tooltip 边、新 Input/Table/Pagination |
| 主色 #5A5CF0 | `bg-menu` / `text-menu` / `#5A5CF0` | MenuItem active、Logo、新 Button primary/Tabs 指示条 |
| 主文本 #303133 | `text-ink-1` / `#303133` | 标题/正文、VIcon 默认 |
| 次文本 #606266 | `text-ink-2` / `#606266` | 辅助文本/图标 |
| 弱文本 #909399 | `text-ink-3` / `#909399` | 占位符/Footer/Burger 图标 |
| 禁用 #C0C4CC | `text-ink-4` / `#C0C4CC` | 禁用态/关闭图标 |
| 图表 5 色 | `chart.*` / `#5470C6` 等 | Pie/Bar/Line、新 Badge 状态点 |
| KPI 3 色 | `kpi.*` | KpiCard、Badge 语义色（success/error） |
| r=2/4/6 | `rounded-xs/sm/md` | 徽标/卡片/新表单控件 |
| 阴影 ×2 | `shadow-card/tip` | 卡片/浮层 |

**审计结论**：无重复 token；无命名冲突；缺口仅 §2.1 语义别名（建议项，不实施）。**「零新增正式 token」原则核查**：正式 Design Token 清单仍为 §2.1 的 16 色 / 5 字阶 / 3 圆角 / 2 阴影；文档中出现的其余色值全部为 (a) 现有 token 的直接引用（如 #5A5CF0=menu、#F56C6C=kpi.red）或 (b) 组件级派生值（BaseTable 选中行 #F0F1FE、Button hover 暗化值、Badge 10% 透明度底色、Modal 遮罩 rgba 黑），均已在对应规格中标注「非正式 token、不计入 inventory」，仅作实现参考。

---

## 4. Typography 规范（新组件适用）

| 场景 | 使用 |
|---|---|
| 页面标题（Content 顶部） | `text-heading`（16/24/500, ink-1） |
| 区块/卡片标题 | `text-heading`（ChartCard 场景保持 leading-[19px]） |
| 表头 | `text-caption` 500 / ink-2 |
| 表体单元格 | `text-body` / ink-1；数字列加 `.num` |
| 表单 label | `text-caption` / ink-2 |
| 输入框文本 | `text-body` / ink-1；placeholder `text-body` / ink-3 |
| 按钮 | `text-body` 500 |
| 错误提示 | `text-caption` / #F56C6C（=kpi.red） |
| 徽标/分页数字 | `text-number` + `.num` |

---

## 5. Spacing 规范（新组件适用）

| 场景 | 值 |
|---|---|
| 页面 padding / 区块 gap | 24（沿用 p-6/gap-6） |
| 卡片 padding | 16（p-4） |
| 表单字段间垂直间距 | 16 |
| label↔控件 | 6（gap-1.5） |
| 表格 cell padding | 垂直 10（py-2.5）+ 水平 12（px-3） |
| 按钮内 padding | 垂直 5（py-[5px]）+ 水平 14（px-3.5） |
| Modal 内边距 | 16（header/body/footer 一致） |

不新增 spacing token；一律用 Tailwind 原生刻度（4 的倍数/半步）。

---

## 6–7. Radius / Shadow 规范（新组件适用）

| 组件 | Radius | Shadow |
|---|---|---|
| Button / Input / Select / Pagination 按钮 / Tab | `rounded-md`（6px） | 无 |
| Badge | `rounded-full`（状态点）或 `rounded-xs`（文本徽标） | 无 |
| Card（BaseCard/Modal/Table 容器） | `rounded-sm`（4px） | `shadow-card`；Modal 用 `shadow-tip` |
| Tooltip 浮层 | `rounded-xs` | `shadow-tip` |

---

## 8. Icon System（继续使用 VIcon，禁装第三方库）

**现有 11 图标分类**（源码实测）：

| 类别 | 图标 |
|---|---|
| navigation | `house` `grid` `doc` `burger` |
| action | `close` `fullscreen` `gear` |
| object/other | `people` `cart` `chat` `color` |

**使用规范**：一律经 `<VIcon name size color>`；尺寸 11–14px 为主（现有用法 9–20）；颜色传 `ink.*`/`#FFFFFF` 十六进制；装饰性图标必须 `aria-hidden`（VIcon 现有约定）。

**Stage 9 后续所需新增图标（规范先行，实现放 9.2/9.4，同样以内联 SVG path 并入 VIcon，禁止外部库）**：

| 需求 | 图标 | 用于 |
|---|---|---|
| 搜索 | `search` | Input 前缀（列表搜索框） |
| 下拉指示 | `chevron-down` | Select / 折叠菜单 |
| 返回 | `arrow-left` | Detail 返回按钮 |
| 成功/警告/错误 | `check` `warning` `error-circle` | ErrorState/Badge/Form 校验/EmptyState |
| 空数据 | `empty-box` | EmptyState |
| 加号 | `plus` | 新建考试 |
| 面包屑分隔 | 文本 `/`（无需图标） | Breadcrumb |

---

## 9. BaseButton

**Purpose**：统一操作按钮。**Token Source**：menu 主色 + body 字阶 + rounded-md。

| 属性 | 规范 |
|---|---|
| Height | 30px（紧凑型，与 KpiCard 图标位/菜单行高协调） |
| Padding | py-[5px] px-3.5；icon+text 时 gap-1.5 |
| Radius / Typography | 6px；13/20/500 |
| Variants | `primary`：bg-menu text-white；`secondary`：bg-surface border border-stroke text-ink-1；`ghost`：无底无框 text-ink-2；`danger`：bg-[#F56C6C]（=现有 `kpi.red`，非新色） text-white |
| default | 见上 |
| hover | **均为现有语义色的暗化派生值（组件级实现参考，非新 Design Token，不计入 §2.1 清单）**：primary = `menu` #5A5CF0 暗化 → `#4B4DD6`；secondary = 换用现有 `bg-page`；danger = `kpi.red` #F56C6C 暗化 → `#E45757`。实现时可写死参考值，但不得沉淀为新 token/新色值 |
| active | 再加深一档（pressed 视觉） |
| focus | `focus-visible:outline-2 outline-menu outline-offset-1` |
| disabled | opacity .5 + cursor-not-allowed，不变色相 |
| loading | 左侧 12px 旋转 spinner（继承 stroke 色），禁用点击 |
| Responsive | 文本溢出 ellipsis；按钮组 `flex-wrap: wrap` gap-2 |
| A11y | 真 `<button>`；loading 时 `aria-busy`；图标按钮必须 `aria-label` |
| Usage | Modal footer（取消=secondary/确认=primary）、表格行操作（ghost/danger）、表单提交 |

## 10. BaseInput

| 属性 | 规范 |
|---|---|
| Height | 30px；宽度默认 100%（容器控制） |
| Border / Radius | 1px `stroke`；6px |
| Text / placeholder | 13/20 ink-1；placeholder ink-3 |
| Prefix/Suffix | 可选 VIcon（如 search），左右 px-3 |
| default | 同上 |
| hover | border-color → ink-4 |
| focus | border-color → `#5A5CF0`，无阴影（保持轻量视觉） |
| disabled | bg-page、text-ink-4、cursor-not-allowed |
| error | border-color → #F56C6C；下方 FormItem 显示错误文案 |
| Keyboard | 原生 `<input>`；label 经 FormItem `<label :for>` 关联；Escape 无业务行为（NOT_SPECIFIED 项，不实现） |
| Usage | 列表搜索（防抖 300ms 由调用方控制）、Settings 表单 |

## 11. BaseSelect

| 属性 | 规范 |
|---|---|
| Height / Border / Radius / Text | 同 BaseInput |
| Trigger | `bg-surface`；右侧 `chevron-down` 12px ink-3 |
| Dropdown | 浮层 `bg-surface border stroke rounded-md shadow-tip`；item h-8 px-3 text-body；hover bg-page；选中 text-menu |
| default/hover/focus/disabled/error | 同 BaseInput |
| Keyboard | **交互实现路线（9.1 不实现）**：路线 A（优先）——原生 `<select>`，键盘行为完全遵循浏览器原生（Enter/Space 展开、↑↓ 移动、Esc 关闭由 UA 提供，零自定义 JS）；路线 B——若未来实现自定义 Select，必须采用 ARIA combobox/listbox 模式（`role="combobox"` + `aria-expanded` + `listbox`/`option`），并显式实现：Enter/Space=展开与选中、ArrowUp/ArrowDown=选项移动（循环可选）、Escape=关闭并归还焦点。两路线二选一，不得混合 |
| Usage | 状态筛选（考试：全部/进行中/已结束）、表单 |

## 12. BaseBadge

| 属性 | 规范 |
|---|---|
| 两种形态 | **Dot**：8px 圆点 + 文本；**Text**：rounded-xs px-1.5 h-[18px]，底色 = 现有语义色加 10% 透明度（**组件级透明度派生，非新 token**） |
| 色彩映射 | success=#67C23A、error=#F56C6C、warning=#FAC858、info=#409EFF、neutral=ink-3（全部复用现有值，零新色） |
| Typography | 12/18 |
| States | 无交互态（非交互元素，cursor: default） |
| A11y | 纯展示；状态语义由文本承担（如「已结束」） |
| Usage | 用户/考试表格状态列、Detail 信息区 |

## 13. BaseTable

| 属性 | 规范 |
|---|---|
| 结构 | header（bg-page，12/18/500 ink-2，h-10）+ body rows |
| Row | h-11（44px）；cell py-2.5 px-3；行底 surface；行分隔 `border-b stroke` |
| Row hover | bg-page（与 MenuItem hover 一致） |
| Selected row | `bg-[#F0F1FE]` —— **组件级派生值（menu #5A5CF0 的 8% 透明度近似），暂非正式 Design Token，不计入 §2.1 inventory**；若 9.2 Figma 确需跨组件复用选中态底色，再决定是否建立 semantic token |
| 数字列 | `.num` 右对齐 |
| loading | 表体替换为 3 行骨架（LoadingState 规范） |
| empty | 表体替换 EmptyState（含「清空筛选」可选动作） |
| error | 表体替换 ErrorState（含重试） |
| overflow | 外层 `overflow-x-auto`；列 min-width 保证 768 视口可横向滚动，禁止压缩变形 |
| A11y | `<table>` 语义 + `<th scope>`；可点行用真 `<tr tabindex=0 role="button">` 之上的**行内主操作按钮**优先（避免整行 button 的 a11y 争议，Enter 触发行按钮） |
| Usage | UserList、ExamList |

## 14. BasePagination

| 属性 | 规范 |
|---|---|
| 结构 | `共 n 条` + 上一页/页码/下一页（ghost 按钮）+ 每页条数 Select |
| Item | 24×24，rounded-md，12/18；当前页 bg-menu text-white；其余 text-ink-2 hover bg-page |
| 状态 | 无更多页时禁用（ink-4）；总页数≤1 时整体仍显示计数 |
| Keyboard | 真按钮，Tab 可达 |
| Usage | UserList、ExamList |

## 15. BaseModal

| 属性 | 规范 |
|---|---|
| Overlay | `bg-[rgba(0,0,0,0.5)]`，z-50，点击遮罩**不关闭**（防误触，表单场景） |
| Panel | width 520px；max-width 90vw；max-height 80vh 内部滚动；bg-surface rounded-sm shadow-tip |
| Header / Body / Footer | p-4；header 标题 heading + close 图标按钮（ghost）；footer 右对齐按钮组 gap-2（取消=secondary，确认=primary） |
| 交互 | Esc 关闭；打开时焦点移入面板、关闭时归还触发元素（focus trap） |
| Responsive | ≤768：width=92vw，footer 按钮可 wrap |
| A11y | `role="dialog" aria-modal="true" aria-labelledby`；Esc 见上 |
| Usage | 新建考试、编辑用户 |

## 16. BaseForm / FormItem

| 属性 | 规范 |
|---|---|
| BaseForm | 纵向 flex gap-4（16）；`<form>` 语义；提交由按钮触发 |
| FormItem | label（caption/ink-2，必填项尾随红色 `*`）+ 控件 + 错误文案（caption/#F56C6C，前置 error-circle 12px）；label↔控件 gap-1.5 |
| 校验时机 | blur 校验单项；提交时全量校验；错误项 focus |
| 校验规则（Settings/Modal） | required / max-length（站点名 20）/ 枚举（Select） |
| disabled | 提交中所有字段禁用 + 按钮 loading |
| Usage | SettingsView、CreateExamModal、EditUserModal |

## 17. BaseTabs

| 属性 | 规范 |
|---|---|
| 结构 | 水平 tab 行，底部 1px stroke 分隔线；item h-10 px-4 text-body |
| Active | 文本 menu 色 + 底部 2px menu 指示条（与 Figma 主色一致，无新色） |
| Hover | text-ink-1 |
| Keyboard | 左右方向键移动（roving tabindex），Tab 键进出 |
| Usage | UserDetail/ExamDetail 信息分区 |
| Badge 变体 | tab 右侧可带 BaseBadge 数字 |

## 18. BaseBreadcrumb

| 属性 | 规范 |
|---|---|
| 结构 | `列表 / 详情-{id}`；分隔符 `/`（ink-4）；当前段 ink-1，可点段 ink-2 hover text-menu |
| Typography | 12/18；h 与页面标题行对齐 |
| Keyboard | 真 `<router-link>`（9.3 落地） |
| Usage | 两个 Detail 页顶部 |

## 19. EmptyState / LoadingState / ErrorState

| 组件 | 规范 |
|---|---|
| **EmptyState** | 容器：居中，py-10；icon `empty-box` 40px ink-4；title text-body/ink-2（如「暂无数据」）；可选 description caption/ink-3；可选动作 = BaseButton secondary（如「清空筛选」）。**不得发明插画** |
| **LoadingState** | 骨架条（bg-page 圆角 4px，高度 12/44px 两档）+ shimmer 动画（opacity 0.5↔1，800ms）；**不用 spinner 大转圈**，与现有轻量视觉一致 |
| **ErrorState** | icon `error-circle` 40px #F56C6C；title text-body/ink-1（「加载失败」）；description caption/ink-3（错误摘要）；动作 = BaseButton secondary「重试」 |
| 三者通用 | 均为非交互容器内组件；各自 height 撑满父容器可用区；Mock 注入（`?__state=`）下必须可被自动化命中（data-testid：`state-empty` / `state-loading` / `state-error`） |

---

## 20. Responsive Rules

沿用 Stage 8 已验证视口（1920×1030 / 1440×900 / 1280×900 / 1024×768 / 768×900），**不发明新 breakpoint**（用 Tailwind 默认 `md=768` 唯一断点行为）：

| 场景 | 规范 |
|---|---|
| 页面 padding | 全视口 p-6 不变（与 Dashboard 一致） |
| Table | 外层 overflow-x-auto，列 min-width；768 下横向滚动 |
| KPI 行（Dashboard，冻结） | 不动 |
| 新页 KPI/统计行 | ≥1024 四列；768 两列（唯一断点行为，9.2 Figma 或报告显式声明） |
| Modal | ≤768：92vw、footer 可 wrap |
| Form | ≥1024 双列（间距 gap-4）；768 单列 |
| 按钮组 | flex-wrap gap-2，禁止溢出 |
| 图表（Analytics） | 复用 Dashboard 图表网格策略：717fr:951fr 全视口保持，768 下纵向堆叠 |
| 验收 | 每视口：scrollWidth==clientWidth、无截断（clip 检测）、无 overlap（bbox 相交检测）、控件可达——沿用 Stage 8 检测方法 |

---

## 21. Accessibility

| 规则 | 适用组件 |
|---|---|
| 可交互元素必须是原生 `<button>/<input>/<select>/<a>`；禁 div+click（除表格行内已含真按钮的场景） | 全部 |
| 可见焦点：`focus-visible` 2px `outline-menu` offset 1（继承 menu 主色，无新色） | Button/Input/Select/Tabs/Pagination/Modal |
| Modal：`role="dialog"` + `aria-modal` + focus trap + Esc + 焦点归还 | BaseModal |
| Select：方向键/Enter/Esc 键盘树 | BaseSelect |
| Tabs：roving tabindex + 方向键 | BaseTabs |
| label 关联：`<label for>` 或 aria-label | Input/Select/FormItem |
| disabled：`disabled` 属性 + `aria-disabled` 一致 | 全部表单类 |
| 状态语义：aria-current（Sidebar active 沿用现有实现）| MenuItem |
| 装饰图标 aria-hidden；纯图标按钮必须有 aria-label | VIcon 使用处 |
| data-testid：`state-empty/loading/error`、`table-row-{id}`、`modal-title` | 自动化断言 |

---

## 22. Component State Matrix

| 组件 | default | hover | active/pressed | focus | disabled | loading | error | empty |
|---|---|---|---|---|---|---|---|---|
| BaseButton | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| BaseInput | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | — |
| BaseSelect | ✓ | ✓ | —（展开态） | ✓ | ✓ | — | ✓ | ✓（空选项） |
| BaseBadge | ✓ | 非交互 | — | — | — | — | — | — |
| BaseTable | ✓ | 行 hover | 行选中 | 行内按钮焦点 | — | ✓ | ✓ | ✓ |
| BasePagination | ✓ | ✓ | 当前页 | ✓ | ✓ | — | — | — |
| BaseModal | ✓ | — | — | trap | — | 按钮级 | 表单级 | — |
| BaseForm/FormItem | ✓ | — | — | ✓ | ✓ | 提交中 | ✓ | — |
| BaseTabs | ✓ | ✓ | ✓（active） | ✓ | — | — | — | — |
| BaseBreadcrumb | ✓ | ✓ | — | ✓ | — | — | — | — |
| EmptyState | ✓ | 非交互 | — | — | — | — | — | 即本体 |
| LoadingState | ✓ | 非交互 | — | — | — | 即本体 | — | — |
| ErrorState | ✓ | 动作按钮 | — | — | — | — | 即本体 | — |
| BaseCard/PageContainer | ✓ | 非交互 | — | — | — | — | — | — |

✓=有规范定义；—=不适用。**不得为「—」的格子虚构状态。**

---

## 23. Existing Component Compatibility（兼容清单）

以下组件**保持原样，不做视觉重构**：TopBar、Sidebar、MenuItem、TagsBar、AppFooter、VIcon、KpiCard、ChartCard、PieChart、BarChart、LineChart、LegendItem。

**ChartCard 与 BaseCard 并存规则**：

| | ChartCard（现有） | BaseCard（新） |
|---|---|---|
| 用途 | Dashboard 图表卡（标题居中、19px 行高、300/352px 高度契约） | 新页面通用卡片（标题左对齐、内容自适应） |
| Token | rounded-sm + p-4 + shadow-card | 相同 |
| 演进 | 冻结 | 9.4 实现 |

**禁止**：把 ChartCard 改造为 BaseCard；把 KpiCard 塞进新页面当通用组件（新页面统计卡另用 BaseCard 组合）。

---

## 24. Dashboard Freeze Rules

1. 9.1 全程 `git diff` 仅允许出现：`docs/`、`stages/`、`.vibe/stage9/` 新增文件；**`src/**` 与 `tailwind.config.js` 零改动**。
2. Stage 7 baseline（5.691% / 0.9037 / 112,541 px）与 Stage 8 artifacts（24 PASS / 0 FAIL）文件本体不得修改、覆盖、重解释。
3. 新组件实现（9.4）若日后触碰 Dashboard 共享文件，必须先复测 Stage 7 静态 diff 与 Stage 8 交互段。
4. 本阶段验收即执行了第 1 条核验（见提交记录）。

---

## 25. Stage 9.2 Handoff

**交给 9.2（Figma 多页面设计）的输入**：

1. 页面优先级：User List > Exam List > User Detail > Settings > Exam Detail > Analytics（Login 最后或与 9.3 并行，因其布局独立）。
2. 新页面 Figma 必须复用 Page 1 的既有 component/instance 体系（TopBar/Sidebar/MenuItem/Tag/卡片），新组件（Button/Input/Table/Modal/状态组件）需在 Figma 以 native Component 建立对应库页（DS 扩展页），与本文档 token 同值。
3. 尺寸契约：Input/Select h=30、Button h=30、TableRow h=44、TableHeader h=40、Modal 520px、radius 2/4/6、色彩全部取 §2.1 的 16 值。
4. Figma 命名建议与 Vue 组件一一对应（`DS/Button/Primary` ↔ BaseButton primary），便于 9.7 逐页 diff 归因。
5. Bridge 工作流提醒：timeout ≠ 未执行，写入后必须读回验证；同文件串行编辑。

**遗留决策项（9.2 需拍板）**：语义色别名 token 是否在 Figma 侧同步建立（§2.1 建议）；768 下 KPI 2 列行为是否进 Figma（§20 唯一断点行为）。
