# Stage 3 — 信息架构 (IA) / 状态矩阵 / 交互范围

> 方法论参照已安装的 **Figma User Flow Planner**（屏幕地图 + 状态矩阵，先于像素确定范围）
> 与 **Figma Prototype Plan**（交互规格 + Build vs Fake，避免过度建造）。
> 本文件是第三阶段动手前的规划产物，也是构建脚本的设计依据。

---

## 1. Flow Overview

| 项 | 内容 |
|---|---|
| Feature | 教育 SaaS 管理后台首页（教学数据概览） |
| User | 学校 / 培训机构的教务管理员（每天早上第一眼看的页面） |
| Goal | 30 秒内回答三件事：今天有没有考试、学生成绩整体走向、有没有必须我处理的事 |
| Entry points | ① 登录后默认落地页 ② 侧边栏「首页」 ③ 浏览器收藏/书签直达 |
| Success exit | 从 KPI 或表格点进「考试管理 / 成绩分析」继续处理 |
| Failure exits | 数据加载失败 → 重试；无数据 → 空状态引导创建第一场考试 |

**设计基调结论**：这是「扫一眼就得抓到重点」的页面，所以信息层级比装饰重要 ——
大数字 > 趋势 > 明细表格 > 待办。一切装饰（渐变、插画、重阴影）都被砍掉。

## 2. Screen Map

单一屏幕（Dashboard，非多页流程），但必须定义其变体：

| # | Screen | Type | Triggered by | Notes |
|---|---|---|---|---|
| 1 | 教学概览（默认） | 新页面 | 落地 | **本次建造** |
| 2 | 加载中 | 同页骨架屏 | 首屏请求 | 本轮不建造（见 §7） |
| 3 | 空状态 | 同页 | 机构无数据 | 本轮不建造 |
| 4 | 错误状态 | 同页提示条 | 接口失败 | 本轮不建造 |
| 5 | 搜索展开 | 浮层 | 点搜索框 | 本轮不建造 |

## 3. State Matrix

**教学概览**

| State | Trigger | Visual change | Action available |
|---|---|---|---|
| Default | 页面加载完成 | KPI 数字 + 环比 Badge + 趋势折线 + 表格 + 待办 | 全部导航 / 跳转 |
| Loading | 首屏请求 | KPI 数字与图表替换为骨架灰块 | 无 |
| Empty | 数据为空 | 图表区显示引导语 + 「创建考试」主按钮 | 新建考试 |
| Error | 接口失败 | 顶部细条提示 + 保留上次数据 | 重试 |
| Partial | 仅部分模块失败 | 单卡片显示重试占位，其余正常 | 单模块重试 |

## 4. Decision Points

**Decision: 今日是否有进行中的考试？**
- 有 → KPI「今日考试」用主色 + 表格首行状态为「进行中」
- 无 → KPI 用中性色，环比显示为 0

**Decision: 待办数量是否为 0？**
- 是 → 待处理事项显示「全部处理完成」空态
- 否 → 列表 + 总数 Badge（本轮为 10 项）

## 5. Interaction Specification（Prototype 思路；本轮**不接线**）

| # | 元素（图层名） | Trigger | Destination | Animation |
|---|---|---|---|---|
| 1 | `Nav Item / 成绩分析` | Tap | （未建）成绩分析页 | Instant |
| 2 | `Button/Primary` 「新建考试」 | Tap | （未建）新建考试弹窗 | Slide up |
| 3 | `Table Row` 任一行 | Tap | （未建）考试详情 | Push left |
| 4 | `Search` | Tap | 搜索浮层 | Dissolve |
| 5 | 其余导航项 | Tap | 同上（占位） | Instant |

> **为什么不接线**：目标页并不存在，连过去只会得到断链；且当前通道没有 reactions API。
> 交互规格先落到文档，等目标页就绪再接（这是 Prototype Plan 的「先定范围再建」原则）。

## 6. Figma 文件结构（与本轮真实节点树一一对应）

```
Page 1
├── Design System / SED            ← 设计系统（色板 / 字号 / 圆角 / 间距 / 组件）
└── SaaS Education Dashboard       ← 1440×900 交付页
    ├── Sidebar
    │   ├── Sidebar/Top → Brand(Logo + Brand/Text) + Nav(7 × Nav Item)
    │   └── Sidebar/User → Avatar + User/Text
    ├── Header
    │   ├── Header/Left → Page/Title + Chip/Period
    │   └── Header/Right → Search + IconButton/Bell + Divider + Header/User
    └── Main
        ├── Welcome（问候 + 日期 + 快捷操作）
        ├── KPI Section（4 × KPI Card）
        ├── Analytics Section（Trend Chart + Subject Distribution）
        ├── Recent Exams（表头 + 5 × Table Row）
        └── Todo Section（3 × Todo Item）
```

## 7. What NOT To Design Yet（明确出范围，防止范围蔓延）

- 加载/空/错误三种状态的**画面**（已在上表定义，本轮只交付 Default）
- 二级页面（学生管理、考试详情、成绩分析页）
- 移动端 / 平板断点
- 深色模式
- 原型跳转连线（缺目标页 + 通道无 reactions API）
- 数据动效、渐变背景、插画

## 8. Build vs Fake

| Element | Build（真做） | Fake（不做） | Notes |
|---|---|---|---|
| 页面骨架 / 栅格 | ✓ | | 全部原生 Frame + Auto Layout |
| 4 张 KPI 卡 | ✓ | | 真组件 + 实例覆盖 |
| 成绩折线图 | ✓ | | **原生 Vector 折线 + 数据点 + 网格**，绝不用图片 |
| 学科分布 | ✓ | | 原生矩形按比例表达占比 |
| 最近考试表格 | ✓ | | 5 行真实数据 |
| 待处理事项 | ✓ | | 3 类共 10 项 |
| 侧栏图标 | ✓ | | 简单几何 + Vector 画的线性图标 |
| 搜索 / 通知真实功能 | | ✓ | 静态外观 |
| 图表交互（hover 提示） | | ✓ | 静态外观 |
| 用户头像照片 | | ✓ | 首字母色块，避免占位图外链 |
