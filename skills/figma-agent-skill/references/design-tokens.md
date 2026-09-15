# design-tokens.md — Token 表与几何红线

## Token 表（Stage 9.1 冻结，ElementAdmin 体系）

### 颜色

| 类别 | token | 色值 |
|---|---|---|
| Page 背景 | page | #F2F3F5 |
| Surface | surface | #FFFFFF |
| Stroke | stroke | #E4E7ED |
| Primary / Menu 激活 | primary / menu | #5A5CF0 |
| Ink 1（主文本） | ink-1 | #303133 |
| Ink 2（次文本） | ink-2 | #606266 |
| Ink 3（辅助） | ink-3 | #909399 |
| Ink 4（禁用） | ink-4 | #C0C4CC |
| KPI 蓝 | kpi-blue | #409EFF |
| KPI 红 / Danger | kpi-red | #F56C6C |
| KPI 绿 / Success | kpi-green | #67C23A |
| Chart ×5 | chart-1..5 | #5470C6 #91CC75 #FAC858 #FC8452 #EE6666 |
| 允许派生 | （组件级派生值，明示允许） | #AAB8E8 |

规则：`unknownColors` 必须恒为 `[]`；新颜色出现 → 先修复来源，**禁止擅自加入 token**。

### 字阶（size / line-height）

`26/32 · 16/24 · 14/20 · 13/20 · 12/18 · 11/16`

### 圆角

`2 · 4 · 6 · full`（卡片恒 4px）

### 阴影

卡片：`0 1px 4px rgba(0,0,0,0.06)`（禁止大阴影/霓虹/玻璃拟态/3D/渐变/装饰插画）

## 几何红线（审计判据）

| 控件 | 红线 |
|---|---|
| Button / Input / Select | **30px** 高 |
| Table Header | **40px** |
| Table Row | **44px**（水平 padding 12 / 垂直 10） |
| Card radius | **4px** |
| Page Frame | **1440×900** |
| Badge | 22px 高，hug 宽 |

## 已知陷阱

1. **文本自动行高**：Figma 文本自动行高 ≈16px ≠ 设计行高（如 13/20）。控件高度必须 `set-layout-sizing FIXED` + `resize-node`，不靠 Auto Layout HUG 推算（否则 30px 按钮实测 26px）。
2. **行内装饰撑破行高**：44px 行内的头像/图标 >20px 会撑破行高（实测 28px 头像 → 行 49px）。行内圆点/头像 ≤20px。
3. **DS 内嵌原生控件**：Vue 侧 DsInput 内部原生 input 高 18px 属设计使然，审计按**包裹层**计红线，不按内层元素。
4. **DOM 审计口径**：几何审计必须按 DS 组件根类名精确圈定（如 `button.h-[30px]`），宽口径 `document.querySelectorAll("button")` 会把 TopBar/TagsBar/分页箭头等 chrome 控件计入导致误判。

## Responsive 记录规则（仅命名/说明，不复制 Frame）

- ≥1024：四列 KPI、表单两列；768：两列 KPI、表单单列
- Table 允许横向滚动
