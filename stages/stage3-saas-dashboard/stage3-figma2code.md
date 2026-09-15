# Stage 3 — figma2code 分析：Vue 3 + Tailwind CSS

来源：真实画布读回（`.vibe/stage3-tree.json`，274 节点）+ `tools/stage3-build.js` 设计令牌。
目标：把 `SaaS Education Dashboard` Frame 一比一映射为可运行的 Vue 3 项目。

---

## 1. 设计令牌 → Tailwind 配置

`tailwind.config.js`（全部取自画布实际值，非猜测）：

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: "#F7F8FA", surface: "#FFFFFF", "surface-alt": "#F4F6F9",
        border: "#E9ECF1",
        primary: { DEFAULT: "#2F6BFF", soft: "#EDF2FF" },
        success: { DEFAULT: "#12A150", soft: "#E8F7EF" },
        warning: { DEFAULT: "#D98200", soft: "#FFF4E1" },
        danger:  { DEFAULT: "#E5484D", soft: "#FDEDED" },
        accent:  { violet: "#7C5CFC", sky: "#0EA5E9" },
        ink: { 1: "#111418", 2: "#5A6270", 3: "#8B93A1" },
      },
      borderRadius: { sm: "6px", md: "10px", lg: "14px", pill: "9999px" },
      boxShadow: { card: "0 1px 2px rgba(11,27,51,0.06)" },
      fontFamily: {
        sans: ['"Noto Sans SC"', "Inter", "system-ui", "sans-serif"],
        num: ["Inter", '"Noto Sans SC"', "sans-serif"],   // 数字专用（KPI/表格右对齐列）
      },
      spacing: { /* 4/8pt 栅格已由 padding/gap 值直接映射 */ },
    },
  },
};
```

Typography（画布实测）：Display 28/600、Heading 20/600、Body 13–14/400–600、Caption 11–12/400、Number 28/600 用 `font-num`。中文 `Noto Sans SC`，纯数字/拉丁 `Inter`。

## 2. Figma 组件 → Vue SFC 映射

| Figma 组件（10 个） | 实例数 | Vue 组件 | 关键 props |
|---|---|---|---|
| `Button/Primary · Secondary · Ghost` | 1+1+1 | `BaseButton.vue` | `variant: "primary"\|"secondary"\|"ghost"` |
| `Badge` | 5（表格状态） | `StatusBadge.vue` | `tone: "success"\|"warning"\|"danger"\|"primary"` |
| `Avatar` | 1（头部）+1（侧栏） | `UserAvatar.vue` | `initial`, `size` |
| `KPI Card` | 4 | `KpiCard.vue` | `label, value, delta, deltaTone, caption` |
| `Table Row` | 5 | `ExamRow.vue`（父：`ExamTable.vue`） | `exam: {name, grade, date, count, status}` |
| `Todo Item` | 3 | `TodoItem.vue` | `title, subtitle, count` |
| `Nav Item` / `Nav Item / Active` | 7 | `NavItem.vue` | `icon, label, active`（active 态在 Vue 里用类切换，不需两个组件） |
| —（图例、趋势线） | — | `TrendChart.vue` | 见 §4 |

> 注意：Figma 里 "Nav Item / Active" 是独立组件（变体能力不在本次 34 op 范围内）；代码层合并为一个组件更合理。

## 3. 页面结构 → Vue 树

```
App.vue
└─ DashboardLayout.vue            ← Frame "SaaS Education Dashboard" (1440×900, flex)
   ├─ Sidebar.vue                 (w-220, bg-white, border-r, flex-col)
   │  ├─ BrandBlock（Logo RAD.md + EduOS）
   │  ├─ nav: v-for NavItem ×7（首页/学生管理/考试管理/成绩分析/题库/数据报表/设置）
   │  └─ UserArea（Avatar + 姓名/角色）
   ├─ Header.vue                  (h-64, flex, justify-between)
   │  ├─ 标题 "教学概览"
   │  ├─ SearchInput（搜索学生、考试或题目）
   │  └─ NotificationBell + UserAvatar（管理员）
   └─ Main.vue                    (flex-1, bg-canvas, p-32, flex-col gap-16, overflow-auto)
      ├─ WelcomeBar.vue           （问候 + 日期 chip + 「新建考试」快捷按钮，两端对齐）
      ├─ KpiGrid.vue              (grid grid-cols-4 gap-16)
      │  └─ KpiCard ×4            （累计学生 12,842 / 今日考试 24 / 平均成绩 86.4 / 通过率 92.8%，
      │                             环比 +8.2% · +4 场 · +1.6 · -0.4%，提示 较上月/较昨日/较上周）
      ├─ AnalyticsGrid.vue        (grid grid-cols-5 gap-16)
      │  ├─ TrendChart.vue        (col-span-3)  ← 矢量折线 + 网格 + 数据点 + 图例，「近 30 天平均成绩变化」
      │  └─ SubjectDist.vue       (col-span-2)  ← 数学 32% / 语文 26% / 英语 24% / 科学 18% 四条进度条
      ├─ ExamTable.vue            ← Recent Exams（表头 考试名称/参与人数/平均成绩/通过率/状态 + 5×ExamRow，数字右对齐 font-num）
      └─ TodoPanel.vue            ← 3×TodoItem（待批改试卷 3 / 异常成绩 2 / 待审核题目 5）
```

## 4. 图表还原策略（关键差异）

- Figma：趋势线是**真实 VECTOR 节点**（`vectorPaths`），数据点是 ELLIPSE，网格是 LINE——全部原生、可编辑。
- Vue：两种路线——
  1. **保真优先**：把 vectorPaths 的点数组导出为数据（已可从读回 JSON 提取），用内联 SVG `<polyline>`/`<circle>` 渲染 → 无运行时依赖，与画布像素一致（推荐）；
  2. 交互优先：换 ECharts，但视觉需重新调平，不推荐首版。

## 5. 交互缺口（设计稿未覆盖，需在代码层补）

- 导航切换路由（设计稿只有 active 态，无目标页）；
- 表格排序/分页、搜索过滤；
- KPI 卡 hover 态（阴影 card → card+lift）；
- 趋势图 tooltip（画布为静态矢量，代码层可补 hover 提示点）。

## 6. 转换检查单

- [ ] 颜色只用 `tailwind.config` 语义名，禁止裸 hex（审计已保证画布 0 个 #d9d9d9/#000 残留）；
- [ ] 圆角只用 sm/md/lg/pill 四档；
- [ ] 中文文本 `font-sans`（Noto Sans SC），数字列 `font-num tabular-nums`；
- [ ] 表格金额/数量列 `text-right`（画布已右对齐）；
- [ ] 间距全部 4 的倍数（画布 spacing/padding 已合规）。
