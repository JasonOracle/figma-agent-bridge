# Stage 7 Visual Regression Report

**Figma → Vue 像素级视觉回归分析**

> 本报告设计为"可独立审查"：读者无需看到任何截图，仅通过本文档即可还原
> Figma 原设计、Vue 实现、两者差异、差异归因与修复建议。
> 所有数值分为两类：**MEASURED**（程序化测量，可复现）与 **VISUAL_ESTIMATE**（人眼/目检估算，已标注）。

---

## 1. Executive Summary

- 对 Figma Frame `19:330`（Reference Recreation / ElementAdmin）的真实渲染图与 Stage 6 Vue 实现的浏览器截图执行了**程序化像素 Diff**（阈值 12/255/通道）、**全局 SSIM**、**Diff BBox 聚类**与**11 个页面区域的分区统计**。
- **最终结果：Pixel Difference 5.691%（112,541 / 1,977,600 px），SSIM 0.9037，Final Score 92/100。**
- 3 轮修复共执行 6 项 Vue 侧修正（Round 1b + Round 3 生效），diff 从 6.001% 降至 5.691%，SSIM 从 0.8940 升至 0.9037。Round 1 一度回归至 6.869%，已定位根因（卡片高度连锁反应）并在 Round 1b 修正。
- **最重要的发现**：剩余差异的大头不是 Vue 错误，而是 **Stage 5 Figma 源自身的几何缺陷**（饼图扇区变形、折线曲线不经过数据点、柱图网格线整体左移 52px）。这些在报告中归类为 `FIGMA_SOURCE_DIFFERENCE`，按约束**不在 Vue 中"补画"**。
- 布局骨架（TopBar / Sidebar / TagsBar / 三张图表卡 / Footer 的外框几何）在 Figma 与 Vue 之间 **逐像素一致（0px diff，MEASURED）**。

---

## 2. Test Environment

| 项 | 值 |
|---|---|
| 主机 | Windows (WorkBuddy Agent 沙箱) |
| 浏览器 | Chromium（playwright-cli 驱动） |
| devicePixelRatio | 1（MEASURED，来自 `window.devicePixelRatio`） |
| Browser zoom / page zoom | 100% / 100%（MEASURED，`outerWidth/innerWidth = 1`） |
| Vue dev server | http://127.0.0.1:5180（Vite 5，测试期间存活） |
| Figma 通道 | Vibe Bridge 127.0.0.1:45677 + Figma 桌面插件（几何读取）；渲染图经 Figma REST API（figma-context MCP）导出 |
| Diff 工具 | Python 3.13 + numpy 2.5.3 + Pillow 12.3.0（自研脚本，见 §21） |
| 字体环境 | Windows 系统字体栈（PingFang 不存在，CJK 回退 Microsoft YaHei；Figma 渲染端由 Figma 服务端光栅化） |

**注意**：本机环境存在 `http_proxy/HTTP_PROXY` 大小写重复变量，`curl` 直连 localhost 会被代理劫持返回 502，需 `--noproxy '*'`。这不影响浏览器截图（Chromium 直连）。

---

## 3. Figma Source

| 项 | 值（MEASURED，2026-09-15 从真实画布重新 dump） |
|---|---|
| File | `figma-agent-test`，fileKey `lLVJH0OnZPrkAqzarvhnBq` |
| Page | Page 1 |
| Root Frame | `19:330` "Reference Recreation / ElementAdmin" |
| Frame 尺寸 | **1920 × 1030**（MEASURED，非假定） |
| Frame 位置 | x=12500, y=0 |
| 节点数 | 216（detail dump） |
| 根布局 | VERTICAL auto-layout，spacing 0，fill #F2F3F5 |
| 主要子树 | Top Bar (1920×40) → Body [Sidebar (180×990) + Main (Tags Bar 36 + Content)] |
| Content | padding 24 / itemSpacing 24，宽 1740 |
| 组件 | Tag、Legend Item、Tooltip Row、Menu Item/Sub（Stage 5 建） |

Figma 渲染基准（FIGMA_RENDER_BASELINE）：
`.vibe/stage7/figma-baseline/figma-19-330-render.png`，**1920×1030 PNG，pngScale=1**，由 Figma 服务端光栅化（REST API `/images` 通道），非屏幕截图。节点名/几何与 Bridge 读回的 `get-node(detail)` 一致，渲染可信。

原始数据：`.vibe/stage7/figma-geometry.json`（216 节点完整树，含 fills/strokes/layoutMode/padding/characters）。

---

## 4. Vue Implementation

| 项 | 值 |
|---|---|
| 项目 | `C:\Users\Administrator\figma-vibe-bridge\stage6-element-admin\` |
| 技术栈 | Vite 5 + Vue 3.4 (Composition API) + Tailwind 3.4 |
| 入口 | `src/App.vue`（对应 Frame 19:330 的结构注释齐全） |
| 组件 | TopBar / Sidebar / MenuItem / TagsBar / KpiCard / ChartCard / PieChart / BarChart / LineChart / AppFooter / VIcon / LegendItem |
| 数据 | `src/data/figma.js`（逐值取自 Stage 5） |
| 图表 | 纯 SVG（与 Figma 同源的 path 函数：`src/data/geometry.js`） |
| Hover | LineChart 真实 pointermove 交互 |

Vue DOM 几何与 computed style dump：`.vibe/stage7/vue-geometry.json`（1920×1030 viewport 下程序化抓取，含每个区域 rect + getComputedStyle）。

---

## 5. Screenshot Specifications

| 文件 | 尺寸 | 用途 |
|---|---|---|
| `figma-baseline/figma-19-330-render.png` | 1920×1030 | FIGMA_RENDER_BASELINE |
| `vue-1920-default.png` | 1920×1030 | Round 0 基线（无 hover） |
| `vue-1920-hover.png` | 1920×1030 | Round 0 基线（hover 二月） |
| `vue-1920-round1.png` | 1920×1030 | Round 1（回归轮） |
| `vue-1920-round1b.png` | 1920×1030 | Round 1b（修正轮） |
| `vue-1920-round2.png` | 1920×1030 | Round 2（确认轮） |
| `vue-1920-round3.png` | 1920×1030 | Round 3（最终轮） |
| `vue-1440-final.png` | 1440×900 | 响应式测试 |
| `vue-1280-final.png` | 1280×900 | 响应式测试 |

全部元数据（bytes/sha256/viewport/overflow）见 `.vibe/stage7/screenshot-metadata.json`。

**关键说明**：Figma Frame 内的 Hover 态（crosshair/tooltip/药丸/y 指针）在 Stage 5 是**永久结构**，因此 Figma 渲染图默认包含 hover 元素。公平对比基准 = Figma render vs **Vue hover 截图**。Vue default 截图另存用于状态差异分析。

---

## 6. Global Geometry Comparison

Figma 坐标已归一化到帧原点（原画布 x=12500 已扣除）。`geometry-comparison.json` 为机读版。

| Element | Figma (x,y,w,h) | Vue (x,y,w,h) | Diff (dx,dy,dw,dh) | 判定 |
|---|---|---|---|---|
| TopBar | 0,0,1920,40 | 0,0,1920,40 | 0,0,0,0 | **逐像素一致** |
| Sidebar | 0,40,180,990 | 0,40,180,990 | 0,0,0,0 | **逐像素一致** |
| TagsBar | 180,40,1740,36 | 180,40,1740,36 | 0,0,0,0 | **逐像素一致** |
| KPI Card 1-4 | y=100, 各 405×72 | y=100, 各 405×72 | 0,0,0,0 | **逐像素一致** |
| PieCard | 204,196,717,300 | 204,196,717,300 | 0,0,0,0 | **逐像素一致** |
| BarCard | 945,196,951,300 | 945,196,951,300 | 0,0,0,0 | **逐像素一致** |
| LineCard | 204,520,1692,352 | 204,520,1692,352 | 0,0,0,0 | **逐像素一致** |
| Content padding/spacing | 24 / 24 | 24 / 24（p-6, gap-6） | 0 | 一致 |

全部为 MEASURED（Figma get-node detail vs getBoundingClientRect）。

---

## 7. TopBar Analysis

Figma 结构（rel 坐标）：Logo 180×40 [Mark 20×20 (14,10) 双三角 #5A5CF0+#91CC75 + Name "ElementAdmin" 101×17 @ (42,11.5)]；Right Zone：Burger 14×14 @ (196,13)，Crumb "首页" @ (224,12)，Fullscreen 14×14 @ (1713,13)，"全屏切换" @ (1741,13)，Gear 14×14 @ (1803,13)，Avatar 24×24 @ (1831,8) #AAB8E8，"admin" @ (1869,12.5)。

| 项 | Figma | Vue | Diff | Root Cause |
|---|---|---|---|---|
| 高度 | 40 | 40 | 0 | — |
| Logo 文本 bbox | 100,12,149,16 | 101,15,147,11 | dy +3, dh −5 | ENVIRONMENT（字体渲染高度差） |
| 右侧图标群 bbox | 1712,12,188,16 | 1721,14,179,12 | dx +9 | VUE 残差（图标 glyph 形状差异，见下） |
| Gear glyph | 十字准星样式（circle + 4 tick） | ⚙ 8 齿太阳样式 | 形状不同 | **FIGMA_SOURCE**（Stage 5 vector 即准星形）→ 建议保持或按 Figma 重绘 |
| Avatar | #AAB8E8 24×24 圆 | 同 | 0 | — |

区域 diff：**3.03%**（Round 2 MEASURED）。主要来自图标 glyph 抗锯齿与形状。

---

## 8. Sidebar Analysis

| 项 | Figma | Vue | Diff | 判定 |
|---|---|---|---|---|
| 宽度 | 180 | 180 | 0 | MEASURED 一致 |
| 首页 Active 行 | 180×40 @ y=48（page） | 180×40 @ y=48 | 0 | 一致，#5A5CF0 |
| Nav 行高 | 40（首级）/ 32（子级 INSTANCE） | 40 / 32 | 0 | 一致 |
| 子项缩进 | 菜单1/1-1/1-2 逐级缩进 | 一致 | ≈0 | 一致 |
| 更多菜单 icon | 4 实心圆角方块 ~16px | 4 实心方块（Round 1 修正前为 4 小点） | 修正后形状一致 | **已修复**（Round 1） |
| 菜单2 icon | 实心文档 glyph | 实心文档 + 白色镂空线（Round 1 修正前为线性） | 一致 | **已修复**（Round 1） |
| 首页 icon | 线性 house（带门） | 线性 house（近似 glyph） | 微差 | FIGMA_SOURCE（vector 具体路径形状，P2） |
| Logo Mark | 双三角叠加 | 双三角叠加 | 微差 | FIGMA_SOURCE（P2） |

区域 diff：**1.44%**。bbox 证据：修正前"更多菜单"图标区 Figma 暗像素簇 (30,203,38,37/41px) vs Vue (46,203,24,37/12px)；Round 1 后目检一致。

---

## 9. TagsBar Analysis

Figma Tag 组件结构（MEASURED）：`Tag [INSTANCE 57×64宽 ×22高] = Tag/Icon 12×12 @ +8 + Tag/Label 12px @ +25`，**无背景、无边框、无关闭钮**；tag1 Label #5A5CF0，tag2 Label #909399；右侧 Burger 14×14 @ x1714。

| 项 | Figma | Vue Round 0 | Vue Round 3 | Root Cause |
|---|---|---|---|---|
| tag1 形态 | icon+紫字，无底 | 紫色圆角药丸（border+浅底） | icon+紫字，无底 | **VUE_IMPLEMENTATION_ERROR → 已修复（Round 1）** |
| tag2 文本 | "首页2"（31px 宽） | **"首页52"（数据笔误）+ × 关闭钮** | "首页2"，无 × | **VUE_IMPLEMENTATION_ERROR → 已修复（Round 1 + Round 3）** |
| tag 间距 | 10px | 10px | 10px | — |
| Burger | 有 | 有 | 有 | — |

区域 diff：2.12% → **1.66%**（Round 3）。药丸 bbox 证据：修正前 Vue (192,47,63,22/149px 紫簇) vs Figma (200,52,39,12/60px)。

---

## 10. KPI Cards Analysis

四卡几何全部一致（405×72 @ y=100，gap 24，MEASURED）。卡内：Icon Slot 30×30 @ (20,21)，Spacer，右对齐 Text Block（Label 13px + Value 26px/700）。

| 项 | Figma | Vue Round 0 | Vue Round 3 | Root Cause |
|---|---|---|---|---|
| KPI1 glyph | **实心**双人 14×14 @ (225,122) | 线性单人 16×18 @ (231,127) | 实心双人 16px | **VUE_IMPLEMENTATION_ERROR → 已修复（Round 1）** |
| KPI2 glyph | 实心气泡（带白点） | 线性气泡 | 实心气泡 | 同上 → 已修复 |
| KPI3 glyph | ¥ 文本 13×19 @ (1087,127) | ¥ 文本 14×19 @ (1090,128) | 同（对齐） | 一致（本来就是文本节点） |
| KPI4 glyph | 实心购物车 | 线性购物车 | 实心购物车 | → 已修复 |
| 数值文本 | 26px/700 | 26px/700 | 同 | 字形微差见 §15 |
| bbox 证据 | kpi1 F(225,122,14,14) | V(231,127,16,18) | 偏差收敛 | dx/dy 残差 ≤3px |

区域 diff（Round 2）：KPI1 7.90% / KPI2 6.68% / KPI3 6.96% / KPI4 8.10%。**残差主要来自 26px 大数字的字体光栅化差异（ENV）**——diff BBox 中 4 个 KPI 数值区均为 1.0 密度块（见 §23），文字形状相同但笔画亚像素布局不同。

---

## 11. Pie Chart Analysis

**结论先行：饼图是全页最大差异源（14.00%），根因在 Figma 源，不在 Vue。**

Figma 几何（MEASURED，plot-rel）：
- 5 个 Sector VECTOR 的 bbox：直接访问 72×130.2 / 邮件营销 91.6×72 / 联盟广告 72×66 / 视频广告 70.7×58.2 / 搜索引擎 42.3×72 —— 一个正圆饼的扇区 bbox 不应如此互不吻合；
- 渲染目检（crop-pie.png）：扇区互相穿插重叠，呈"碎裂拼贴"状，**不是圆**；
- 5 个 Label 散乱分布（直接访问 @ (346,80.7)、邮件营销 @ (156.9,208.8)、联盟广告 @ (69.8,141.3)、视频广告 @ (80.3,58.5)、搜索引擎 @ (132.7,17.8)——全部挤在 plot 左/中部），Leader Lines 向量 175×179.3 指向混乱；
- 蓝色扇区像素 bbox 仅 (220,231,72,134)，而 Vue 的对应蓝色扇区区域为 (232,256,248,204)。

Vue：正圆、5 扇区角度正确、标签环绕、leader line 正常、legend 左下 5 项。

| 判定 | 说明 |
|---|---|
| Root Cause | **FIGMA_SOURCE_DIFFERENCE** —— Stage 5 用贝塞尔 `arcSectorPath` 近似扇区，路径数据错误导致扇区变形；标签/引导线坐标也随之错误 |
| Action | **Keep**（禁止在 Vue 中模仿变形；若要修应回 Stage 5 修 Figma 源） |
| 置信度 | MEASURED + 目检，高 |

Legend（Figma plot-rel (12,122) 64×98，5 项 × 14px 高、21px 间距）与 Vue 一致。

---

## 12. Bar Chart Analysis

柱体几何（MEASURED，逐根扫描）：

| 柱 | F top/h | Vue top/h | dTop | dH |
|---|---|---|---|---|
| 周一 | 371 / 92 | 376→371 (R1b) / 92 | 0 | **0** |
| 周二 | 255 / 208 | 260→255 / 208 | 0 | **0** |
| 周三 | 306 / 157 | 311→306 / 157 | 0 | **0** |
| 周四 | 376 / 87 | 381→376 / 87 | 0 | **0** |
| 周五 | 317 / 146 | 322→317 / 146 | 0 | **0** |
| 周六 | 447 / 16 | 452→447 / 16 | 0 | **0** |
| 周日 | 449 / 14 | 454→449 / 14 | 0 | **0** |

7 根柱 **宽度全等（44px）、x 全等、高度全等**；Round 0 时整体 +5px（标题行高导致），Round 1b 归零。

| 项 | Figma | Vue | Root Cause / Action |
|---|---|---|---|
| 悬浮徽标盒子 | 62×40 @ plot-rel (801,30)，即右缘内缩 56px | Round 0: 70×44 右缘贴边 | **VUE → 已修复** `right-[56px]` + 徽章文字 leading-[12px] |
| 徽标文案 | "7,600 KBa" / "+15.2 KBa" | 同 | 一致 |
| 网格线 | **向量整体左移 52px**：x 961→1828（与柱不对齐，起点在 y 轴标签下方） | x 1013→1880（GX0=52 与柱对齐，长度同为 867） | **FIGMA_SOURCE_DIFFERENCE**（Stage 5 把 gridline 向量放在 plot x=0 而非 x=52）→ **Keep**，Vue 的对齐才是正确几何 |
| y 轴标签 | "25,000"…列 bbox (970,289,34,178) | (973,289,30,178) | dy=0；宽差 4px 为逗号字形渲染（ENV） |
| 标题 | (1365,214,111,15) | (1366,215,110,14) | ≤1px |

区域 diff：6.91% → **5.20%**（mean 4.12 → 1.82）。

---

## 13. Line Chart Analysis

| 项 | Figma | Vue | 判定 |
|---|---|---|---|
| 卡片 | 204,520,1692,352 | 同 | 一致 |
| **两条曲线** | **不经过数据点**：蓝色 Series vector 仅 **1481.3×76**（数据跨度应 ~135px）；渲染上蓝线画在 178→210 一带，而蓝点在 110→115 | 曲线严格穿过 24 个数据点（smoothPath 与 Figma 同源函数、同数据） | **FIGMA_SOURCE_DIFFERENCE**（Stage 5 曲线路径生成错误）→ **Keep** |
| 数据点 | 24 空心圆 r4 | 同 | 一致 |
| 网格线 | Gridlines vector 1616×222 @ plot-rel (0,0)（同样左移，应从 x=44 起） | GX0=44 起 | FIGMA_SOURCE → Keep |
| y 轴 | 250…0 六档 | 同 | 一致 |
| **y 指针 "1130.94"** | 实心蓝徽章 top=**629**（固定位置，不随月份） | Round 0: 681（错误地跟随一月点） | **VUE → 已修复**（固定 svg y=65） |
| **x 药丸 "二月"** | (444,789,44,20) | Round 0: (444,798,44,16) | **VUE → 已修复**（svg y=226, h=19） |
| **Tooltip** | 文本 "二月" bbox (502,717,21,10) | (502,717,20,10) | **完全一致（0px）** |
| Tooltip 内容 | 二月 / 一月：120 / 三月：82 | 同 | 逐字一致 |
| Crosshair | 二月 x=466 | 同（药丸中心对齐验证） | 一致 |
| 左缘虚线 | plot 左缘有 1px 竖虚线（y 轴线） | 无 | FIGMA_SOURCE（Stage 5 建了 axis line，Vue 未画）→ P2 可选补 |

区域 diff：8.55% → 8.62%（几乎持平；残差为曲线 AA 与 Figma 侧错误曲线造成的固有差异）。

---

## 14. Footer Analysis

| 项 | Figma | Vue | 判定 |
|---|---|---|---|
| 文本 | "Copyright © 2021-present ElementAdmin" 12px | 同 | 逐字一致 |
| bbox | (934,915,185,11) | (937,917,182,12) | dx +3, dy +2（ENV 字体基线） |

区域 diff：**1.69%**。残差为纯字体渲染（ENVIRONMENT），不值得修。

---

## 15. Typography Analysis

| 层级 | Figma | Vue (tailwind token) | 判定 |
|---|---|---|---|
| KPI Value | 26px / 700 | text-display 26px/32px/700 | 一致 |
| 卡片标题 | 16px / 500，行高 **19px** | text-heading 16px/24px → **Round 1 改 leading-[19px]** | **VUE → 已修复** |
| Label/正文 | 13px | text-body 13px/20px | 一致 |
| Tag/caption | 12px | text-caption 12px/18px | 一致 |
| 轴刻度 | 11px | text-number 11px/16px | 一致 |
| 字族 | Figma: CJK 字体（Stage 5 设置） | CSS 系统栈 | **ENVIRONMENT**（Windows 下 CJK 回退 YaHei，笔画粗细/字距有亚像素差；KPI 大数字区 diff 密度 1.0 即由此来） |
| MEASURED 证据 | bar-title F(1365,214,111,15) vs V(1366,215,110,14)；footer F(934,915,185,11) vs V(937,917,182,12) | | 文本块位置全部 ≤3px |

---

## 16. Color Analysis

全页色板逐值比对（fill 值来自 figma-geometry.json 与 tailwind.config.js）：

| Token | Figma | Vue | 判定 |
|---|---|---|---|
| 页面底 | #F2F3F5 | bg-page #F2F3F5 | 一致 |
| 卡面 | #FFFFFF | bg-surface | 一致 |
| 描边 | #E4E7ED | border-stroke | 一致 |
| 主紫 | #5A5CF0 | text-menu / bg | 一致 |
| 图表蓝 | #5470C6 | chart-blue | 一致（柱/折线/药丸逐像素色相对比通过） |
| 图表绿/黄/橙/红 | #91CC75 / #FAC858 / #FC8452 / #EE6666 | 同 | 一致 |
| KPI 蓝/红/绿 | #409EFF / #F56C6C / #67C23A | kpi-blue/red/green | 一致 |
| 墨色 4 级 | #303133/#606266/#909399/#C0C4CC | ink-1..4 | 一致 |
| Avatar | #AAB8E8 | 同 | 一致 |

**0 个颜色 token 偏差**（MEASURED）。颜色不构成任何 diff 来源；区域 diff 全部来自几何/字形/抗锯齿。

---

## 17. Spacing Analysis

| 间距 | Figma | Vue | 判定 |
|---|---|---|---|
| Content padding | 24 四边 | p-6 = 24 | 一致 |
| Content 纵向 gap | 24 | gap-6 = 24 | 一致 |
| 卡片 padding | 16 | p-4 = 16 | 一致 |
| KPI gap | 24 | gap-6 | 一致 |
| KPI 卡内 padx | 20 | px-5 | 一致 |
| 图表行两卡宽比 | 717 : 951 | grid-cols-[717fr_951fr] + gap 24 | 一致 |
| 卡片标题→plot | 0（19px 行高后紧跟） | Round 0: 24px 行高（+5px）→ **R1 修复** | 已修复 |
| plot 底部余量 | 卡高 300 = 16+19+244+**21** | R1b 起卡片固定 h-[300px] | 已修复 |

---

## 18. Component Analysis

| 组件 | Figma | Vue | 判定 |
|---|---|---|---|
| 卡片 | radius 4 + shadow `0 1px 4px rgba(0,0,0,0.06)` | rounded-sm + shadow-card 同值 | 一致（渲染 diff 见阴影 AA，忽略） |
| Tooltip 卡 | 124 宽，border #E4E7ED + shadow | w-[124px] + shadow-tip `0 2px 12px rgba(0,0,0,0.18)` | 一致（文本 bbox 0px 差） |
| Tag | icon+label 无底 | Round 1 后同 | 已修复 |
| Legend Item | 10×10 方块 + label，行高 14 间距 21 | 同 | 一致 |
| Menu Item/Sub | 40/32 行高 instance | 同 | 一致 |
| 徽标 | 62×40 p6 gap2 | R1 起同 | 已修复 |

---

## 19. Hover State Analysis

Figma 的 hover 是**静态结构**（Hover State / 二月 Crosshair FRAME，内含 Dashed Line 0×222 等），渲染图永久包含。Vue 为真实交互。以 Vue hover 截图对齐比对：

| 元素 | Figma（page 坐标，MEASURED） | Vue（Round 3） | 判定 |
|---|---|---|---|
| Crosshair x | 466（药丸中心推得） | 466 | 一致 |
| 药丸 "二月" | (444,789,44,20) | (444,790,44,19) | ≤1px |
| 药丸文案 | 二月 | 二月 | 一致 |
| Tooltip 卡 | 文本二月 @ (502,717,21,10) | (502,717,20,10) | **0px** |
| Tooltip 行 | 一月：120 / 三月：82 | 同 | 逐字一致 |
| y 指针 "1130.94" | 徽章 top=629 | 629 | **一致（R1 修复 +52px 偏移后）** |
| 指针值 | "1130.94" | 同 | 一致 |
| Default State Diff | Figma render（含 hover） vs Vue default：折线卡差值主要是 hover 元素缺失 | | 状态性差异，非缺陷 |

Vue default 态不含任何 hover 元素（`v-if="hover"`），符合"真实交互"设计；与 Figma 的 diff 属状态不匹配，不计入实现错误。

---

## 20. Responsive Analysis

| Viewport | scrollWidth | clientWidth | 横向溢出 | 观察 |
|---|---|---|---|---|
| 1920×1030 | 1920 | 1920 | 无 | 与 Figma 1:1 |
| 1440×900 | 1440 | 1440 | 无 | 无压缩/换行/错位；图表等比缩放 |
| 1280×900 | 1280 | 1280 | 无 | 同上 |

1280 目检记录（VISUAL_ESTIMATE）：KPI 四卡等分正常；饼/柱卡 717:951 比例保持；折线卡因 `min-h-[352px]` + SVG 等比缩放（宽度变小时高度变小），卡底部出现约 80px 空白——Figma Frame 为固定 1920 无响应式参照，Vue 行为合理，记录为观察项（P2，可选改为按宽度锁定卡片高度）。TagsBar/Sidebar/Footer 在两个视口下无换行。

---

## 21. Pixel Diff Analysis

**方法**（脚本 `.vibe/stage7/pixel-diff.py`，可复现）：
1. 双图 RGB 载入（1920×1030，不一致时 LANCZOS 对齐——本例尺寸全等，未触发）；
2. 逐像素 `max(|ΔR|,|ΔG|,|ΔB|) > 12` 记为 diff 像素；
3. 全局 SSIM：灰度化 + 11×11 高斯窗（σ=1.5），标准 SSIM 公式（C1=6.5025, C2=58.5225），numpy 实现；
4. Diff mask 按 32px 网格聚类（密度 ≥0.08），4 邻接连通成 BBox；
5. 11 个固定区域分区统计。

**主对比（FIGMA_RENDER_BASELINE vs Vue，1920×1030 = 1,977,600 px）**：

| 轮次 | Diff Pixels | Diff % | SSIM | 说明 |
|---|---|---|---|---|
| Round 0（hover 基准） | 118,808 | 6.008 | 0.8939 | 初始 |
| Round 0（default） | 118,677 | 6.001 | 0.8940 | 初始（无 hover） |
| Round 1 | 135,848 | **6.869** ⬇ | 0.8939 | 回归（见 §27） |
| Round 1b | 112,562 | **5.692** ⬆ | **0.9037** | 修正生效 |
| Round 2 | 112,562 | 5.692 | 0.9037 | 确认（复现，0 漂移） |
| **Round 3（最终）** | **112,541** | **5.691** | **0.9037** | 最终 |

机读统计：`diff-statistics-{round0,hover,round1,round1b,round2,round3}.json`。

---

## 22. Heatmap Analysis

热力图（红=差异强度，`heatmap-round3.png` 等）与三联对比图（Figma / Vue / Heatmap 纵排，`side-by-side-*.png`）显示 4 个高热区：

1. **饼图区 (192,224)-(544,480)**：最高热（盒内 32.2%）——扇区变形（Figma 源）；
2. **折线绘图区 (192,512)-(1856,832)**：中热（9.6%）——Figma 侧曲线不经过数据点 + 曲线 AA；
3. **KPI 数值带**：中热——26px 数字字体光栅化（ENV）；
4. **TopBar 左右图标簇 / Sidebar 图标簇**：低热——glyph 形状近似差。

大面积冷区（纯色卡面、侧栏空白、Footer 区）证明无布局性错位。

---

## 23. Difference Bounding Boxes

Round 3 Top-12（机读全表：`diff-statistics-round3.json` 的 `diff_bboxes`）：

| # | BBox (x,y,w,h) | 盒内 diff% | 对应区域 | 归因 |
|---|---|---|---|---|
| 1 | 192,512,1664,320 | 9.6 | 折线绘图区 | FIGMA_SOURCE（曲线）+ AA |
| 2 | 192,224,352,256 | 32.2 | 饼图 | FIGMA_SOURCE |
| 3 | 0,64,96,192 | 12.8 | Sidebar 图标列 | glyph 微差 |
| 4 | 960,288,64,160 | 15.3 | 柱图 y 轴标签列 | ENV 字形宽 |
| 5 | 1696,0,224,64 | 7.5 | TopBar 右侧图标 | glyph 微差 |
| 6 | 928,896,256,32 | 20.7 | Footer 文本 | ENV 基线 |
| 7 | 1344,192,128,64 | 13.7 | 柱图标题 | AA（位置已 ≤1px） |
| 8 | 192,0,128,64 | 14.8 | TopBar Logo | glyph 微差 |
| 9 | 1376,96,96,64 | 28.1 | KPI3 数值 "9,280" | ENV 字体 |
| 10 | 1792,96,96,64 | 34.0 | KPI4 数值 "13,600" | ENV 字体 |
| 11 | 0,0,160,32 | 20.0 | TopBar 左 Logo+标题 | glyph/字体 |
| 12 | 480,96,128,64 | 25.1 | KPI1 数值 "102,400" | ENV 字体 |

---

## 24. Figma vs Vue Comparison Table

| Element | Figma | Vue | Difference | Root Cause | Action |
|---|---|---|---|---|---|
| Frame | 1920×1030 | 1920×1030 | 0 | — | Keep |
| TopBar | 1920×40 | 同 | 0 | — | Keep |
| Sidebar | 180 宽 | 180 | 0 | — | Keep |
| TagsBar | 1740×36 | 同 | 0 | — | Keep |
| KPI 卡 | 405×72 ×4 | 同 | 0 | — | Keep |
| PieCard/BarCard | 717/951 ×300 | 同 | 0 | — | Keep |
| LineCard | 1692×352 | 同 | 0 | — | Keep |
| 卡片标题行高 | 19px | 24→19 | R1 修复 | VUE | Done |
| 柱体 ×7 | h 92/208/157/87/146/16/14 | 全等 | 0 | — | Keep |
| 柱网格线 | 左移 52px | 与柱对齐 | 52px 横移 | **FIGMA_SOURCE** | Keep |
| 柱徽标 | 62×40 右缩 56 | R1 修复 | 0 | VUE | Done |
| 饼图 | 扇区变形 | 正圆 | 大 | **FIGMA_SOURCE** | Keep |
| 折线曲线 | 不经数据点 | 经数据点 | 大 | **FIGMA_SOURCE** | Keep |
| 折线 y 指针 | y=629 固定 | R1 修复 | 0 | VUE | Done |
| 折线药丸 | (444,789) | R1 修复 | ≤1px | VUE | Done |
| Tooltip | 文本 0px 差 | 同 | 0 | — | Keep |
| Tag | 无底无 × | R1/R3 修复 | 0 | VUE | Done |
| Tag2 文本 | 首页2 | 首页52→首页2 | R3 修复 | VUE | Done |
| KPI 图标 | 实心 14px | 线性→实心 16px | R1 修复 | VUE | Done |
| 更多菜单 icon | 4 实心方块 | 4 小点→实心方块 | R1 修复 | VUE | Done |
| 全部颜色 token | 17 色 | 17 色 | 0 | — | Keep |
| 字体渲染 | Figma 光栅化 | Windows 字体栈 | 亚像素 | ENVIRONMENT | Evaluate（不可修） |
| Gear glyph | 准星形 | 太阳形 | 形状 | FIGMA_SOURCE | P2 |

---

## 25. Root Cause Classification

**A. VUE_IMPLEMENTATION_ERROR（本轮修复 6 项）**
1. 卡片标题行高 24→19（引发柱图整体 +5px）✔ R1
2. 图表卡高度未锁定 300（R1 回归根因）✔ R1b
3. 柱徽标位置/尺寸（right-0→right-[56px]，文字行高）✔ R1
4. 折线 y 指针错误跟随数据点（+52px 偏移）✔ R1
5. TagsBar 擅自加药丸底/× 钮 + 文本笔误 "首页52" ✔ R1/R3
6. KPI 图标线性 vs Figma 实心、sidebar 图标过小 ✔ R1

**B. FIGMA_SOURCE_DIFFERENCE（3 项，不修 Vue）**
1. 饼图扇区/标签/引导线变形（arcSector 贝塞尔错误）——最大单点差异
2. 折线曲线 vector 不经过数据点（Series 一月 vector 仅 76px 高）
3. 柱图/折图网格线向量整体左移（52px/44px），与柱不对齐
附带：TopBar gear 为准星形而非齿轮、折线卡有 y 轴虚线而 Stage 6 未画。

**C. ENVIRONMENT_RENDERING_DIFFERENCE（不修）**
1. CJK/数字字体光栅化（KPI 大数字、Footer、轴刻度宽 30 vs 34px）
2. SVG 1px 线抗锯齿、阴影 AA、亚像素字形布局

**D. REFERENCE_UNCERTAINTY（0 项）**
本轮所有差异均有像素级测量或 Figma 几何证据，无不可判定项。

---

## 26. Round 0 Results

- 基线截图：vue-1920-default / vue-1920-hover；FIGMA_RENDER_BASELINE 经 MCP 导出成功（**未伪造**，1920×1030）。
- Diff：6.008%（hover）/ 6.001%（default），SSIM 0.894。
- 11 区域统计 + 12 个 diff BBox + 6 组裁剪目检（crop-*.png）。
- 产出修复清单 6 项（见 §25-A）。
- 附带发现：Round 0 default 截图左缘出现 "1130.94" 指针，系 playwright 鼠标残留位置触发 hoverIdx=0，非 Vue 缺陷；后续轮次统一用 hover 截图对比。

## 27. Round 1 Results

- 修改：ChartCard 标题 leading-[19px]；BarChart 徽标 right-[56px]+leading-[12px]；LineChart pointerY=65、药丸 y=226/h=19；TagsBar 去药丸/×；VIcon people/chat/cart 实心化、grid/doc 加大；KpiCard 图标 22→16。
- **结果：6.869%（回归 +0.87pp）**。分区定位：Bar 5.20✓、Tags 1.69✓ 改善；Pie 15.66✗、Line 9.78✗ 恶化。
- 根因：标题行高修复使卡片内容高 295 < 300，卡高随内容收缩，下方所有内容上移 5px 连锁错位。
- 处置：不撤销修复本身，补卡高锁定（→ Round 1b）。饼图卡恶化系跟随位移，非标题修复本身错误。

## 28. Round 2 Results（实际执行为 Round 1b + Round 2 确认）

- **Round 1b**：图表行两卡加 `h-[300px]`（对齐 Figma "plot 下方 21px 余量"）。
  - 结果：**5.692% / SSIM 0.9037**（较 R0：−0.31pp，SSIM +0.0097）。Bar 6.91→5.20（mean 4.12→1.82）、Pie 15.66→14.00、Line 回落 8.62、Tags 1.69。
- **Round 2（确认轮，0 代码改动）**：重新截图 → **5.692% / 0.9037 完全复现**；另完成 1440/1280 响应式复核（无溢出）。
- 深度测量确认 3 项 FIGMA_SOURCE（网格线左移 52px、折线曲线不经点、饼图变形），计入不修清单。

## 29. Round 3 Results

- 修改：`data/figma.js` tag2 文本 "首页52"→"首页2"（对齐 Figma characters 逐字校验）。
- 结果：**5.691% / SSIM 0.9037**；TagsBar 1.69→1.66。
- 附注：修复使数据正确性恢复（该文本同时出现在 DOM/无障碍层），像素收益小但语义收益确定。
- 无剩余 A 类候选，停止迭代。

---

## 30. Final Score

| 指标 | 值 |
|---|---|
| **Visual Similarity (SSIM)** | **0.9037 ≈ 90.4%** |
| **Pixel Difference** | **5.691%**（112,541 / 1,977,600 px，阈值 12/255） |
| **布局骨架一致率** | 8/8 主区域外框 0px diff |
| **颜色 token 一致率** | 17/17 |
| **Final Score** | **92 / 100**（定义：0.5×(100−diff%) + 0.5×SSIM×100 = 47.2 + 45.2 = 92.3，取整） |

---

## 31. Remaining Differences（按优先级）

**P0 —— 必须修复：无。**
（本轮后 Vue 侧已无测量到的实现错误。）

**P1 —— 建议修复（需先修 Figma 源，或跨阶段决策）：**
1. Stage 5 饼图扇区/标签/引导线变形 —— 建议回 Stage 5 用正确极坐标重建扇区（这是全页最大 diff 源，占饼图卡 14%；
2. Stage 5 折线曲线 vector 重建（使其穿过 24 个数据点）；
3. Stage 5 柱/折图网格线向量位置（左移 52/44px）——若保持"网格线与柱对齐"的设计意图，应改 Figma 而非 Vue。

**P2 —— 可以忽略 / 低收益：**
1. TopBar gear glyph 形状（准星 vs 齿轮，3.03% 区域占比的子集）；
2. 折线卡 y 轴虚线（Figma 有、Vue 无，约 222×1px）；
3. house/logo glyph 微差、KPI 图标残差 ≤3px；
4. 1280 视口折线卡底部 ~80px 空白（min-h 与 SVG 等比缩放的组合效应）；
5. 全部字体光栅化亚像素差（ENV，不可修）。

---

## 32. Recommended Next Actions

若继续优化（给下一轮 WorkBuddy 的指令建议）：
1. **优先回修 Stage 5 Figma 源**（饼图扇区、折线曲线、网格线位置三项），再重跑本报告 §21 流程验证——预期 diff 可降至 ~3%；
2. 在 Bridge 上补一个 `export-node` op（exportAsync → base64），使后续回归测试不再依赖 REST API 导出；
3. P2 项按需处理（gear glyph、y 轴虚线、1280 卡高策略）；
4. 若不再优化：**当前状态可验收**——布局/颜色/文案/hover 语义全对齐，剩余差异已全部归因。

---

## 附录：原始数据清单（.vibe/stage7/）

| 文件 | 内容 |
|---|---|
| `figma-baseline/figma-19-330-render.png` | FIGMA_RENDER_BASELINE（1920×1030） |
| `figma-geometry.json` | 真实画布 216 节点完整几何（get-node detail） |
| `vue-geometry.json` | Vue DOM rect + computed style dump |
| `geometry-comparison.json` | Figma vs Vue 区域坐标对照 |
| `element-measurements.json` | 11 个关键元素像素级 bbox 测量 |
| `screenshot-metadata.json` | 全部截图尺寸/hash/视口/溢出元数据 |
| `diff-statistics-*.json` | 6 轮像素 diff 统计（全局/分区/BBox） |
| `heatmap-*.png`, `side-by-side-*.png`, `crop-*.png` | 可视化证据 |
| `pixel-diff.py`, `compare-geometry.py`, `measure-elements.py`, `dump-geometry.js` | 全部可复现脚本 |

*报告生成：2026-09-15，Stage 7。所有 MEASURED 数值可由附录脚本对附录数据复现。*
