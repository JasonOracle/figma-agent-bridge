# Stage5 Figma → Vue3 + Tailwind 映射表（唯一实现依据：Frame `19:330`）

> 所有数据取自 `.vibe/stage5-tree.json`（真实画布读回）与 `tools/stage5-build.js`（构建时的几何常量），未参考任何外部源码。

## 1. Design Tokens → tailwind.config

| Figma Token | 值 | Tailwind Key |
|---|---|---|
| Background | `#F2F3F5` | `bg-page` |
| Surface | `#FFFFFF` | `bg-surface` |
| Border | `#E4E7ED` | `border-stroke` |
| Menu Primary | `#5A5CF0` | `menu` |
| Chart Blue/Green/Yellow/Orange/Red | `#5470C6 / #91CC75 / #FAC858 / #FC8452 / #EE6666` | `chart-blue … chart-red` |
| KPI Blue/Red/Green | `#409EFF / #F56C6C / #67C23A` | `kpi-blue … kpi-green` |
| Text 1/2/3/4 | `#303133 / #606266 / #909399 / #C0C4CC` | `ink-1 … ink-4` |
| Radius xs/sm/md/pill | `2 / 4 / 6 / 999px` | `rounded-xs/sm/md` |
| Shadow card / tooltip | `0 1px 4px 6% / 0 2px 12px 18%` | `shadow-card / shadow-tip` |
| 字阶 Display/Heading/Body/Caption/Number | `26/700, 16/500, 13/400, 12/400, 11/400` | `text-display … text-number` |
| Spacing | 4/8pt（4px 基数；布局用 24 = p-6/gap-6，卡内 12/16/20） | Tailwind 原生 spacing |

## 2. 布局骨架（Figma 常量 → CSS）

| Figma | 值 | 实现 |
|---|---|---|
| Root 1920×1030, bg `#F2F3F5` | 纵向 | `min-h-screen flex flex-col` |
| Top Bar 40px 白 | 横向 | `h-10 flex`；Logo 区 `w-[180px]` |
| Sidebar 180px 白 | 纵向 padY 8 | `w-[180px] shrink-0 py-2` |
| Tags Bar 36px 白 | 横向 | `h-9 flex` |
| Content padding/gap 24 | 纵向 | `p-6 gap-6 flex-1` |
| KPI 卡 405×72（= (1692−72)/4） | 4 列 | `grid grid-cols-4 gap-6` |
| 图表行 饼717 : 柱951 | — | `grid grid-cols-[717fr_951fr] gap-6` |
| 折线卡 1692×352 | 全宽 | 独立 Card，plot 248 |

## 3. Figma Node → Vue Component → HTML

| Figma Node（name / id 前缀） | Vue SFC | HTML/Tailwind |
|---|---|---|
| Top Bar / Logo / Top Bar-Right Zone | `TopBar.vue` | header + 内联 SVG 图标 |
| Sidebar + Nav Item ×2 + Menu Item/Sub ×3 | `Sidebar.vue` + `MenuItem.vue`（复用 6 次，`variant`/`indent` props） | button 行 h-10 / h-8 |
| Tags Bar + Tag 实例 ×2 | `TagsBar.vue` | span 药丸 h-[22px] |
| KPI Card / ×4 | `KpiCard.vue`（v-for KPIS） | 卡片 h-[72px]，图标为内联 SVG |
| Card / 用户访问来源 + Pie/Sector ×5 | `ChartCard.vue` + `PieChart.vue` | SVG path（arc，同 Figma 贝塞尔扇形几何） |
| Card / 每周用户活跃量 + Bar ×7 | `ChartCard.vue` + `BarChart.vue` | SVG rect + 网格线 |
| Card / 每月销售量 + Series ×2 + Point ×24 | `ChartCard.vue` + `LineChart.vue` | SVG path（Catmull-Rom→bezier，与 Figma 同函数）+ circle |
| Hover State / 二月 Crosshair | `LineChart.vue` 内 hover 覆盖层 | 真实鼠标交互（pointermove → 最近月份） |
| Pie/Legend、Line/Legend（Legend Item 实例） | `LegendItem.vue` | 方块 + 12px 文字 |
| Footer | `AppFooter.vue` | footer 12px ink-3 |

## 4. 状态映射

- Figma `Hover State / 二月 Crosshair`（结构化状态）→ 浏览器真实 hover：悬停折线图任一数据点显示虚线 + x 轴药丸 + tooltip 卡 + y 轴指针；悬停「二月」时内容与参考图逐字一致（`二月` / `一月: 120` / `三月: 82` / 指针 `1130.94`）。
- 柱状图右上悬浮徽标（`7,600 KBa / +15.2 KBa`）为设计内常驻元素，保持静态。
