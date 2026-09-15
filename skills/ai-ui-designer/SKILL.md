---
name: ai-ui-designer
description: AI UI Designer 五层设计增强 Skill 的 L1 Design Intelligence 层。把一句自然语言需求（如"设计一个现代 SaaS 教育管理后台"）确定性转换为结构化 Design Brief JSON：关键词→风格库匹配、行业映射、信息架构生成、Token 推导、组件预期清单。输出可直接交给 L2 Design System Generation / L3 Figma Generation 消费。触发场景：用户用一句话要求设计 App / 后台 / 大屏 / 网站，需要先把模糊需求规格化。
---

# AI UI Designer — L1 Design Intelligence Layer

## 定位

五层架构中的第一层：**把模糊的自然语言需求规格化为可执行的设计契约**。本层不做任何 Figma 操作（L3 职责）、不生成组件（L2 职责）、不评分（L4 职责）。

```
User Prompt（自然语言）
  → ① 关键词识别（风格路由）
  → ② 行业映射（色彩/组件修正）
  → ③ 信息架构生成（页面清单 + 布局模式）
  → ④ Token 推导（在 Style Preset 基础上做行业化微调）
  → ⑤ 组件预期清单
  → Design Brief JSON（唯一出口物）
```

核心原则：**不是 AI 自由发挥**。每个判断都必须能追溯到明确的映射规则或 Style Preset 字段；规则未覆盖时走「缺省继承 + 显式标注 assumption」。

## Workflow 五步

### ① 关键词识别 → 风格路由

| Prompt 关键词 | Style Preset |
|---|---|
| SaaS、现代、极简、premium、subscription | `premium-saas` |
| 后台、管理、admin、dashboard（企业语境）、中后台 | `enterprise-dashboard` |
| 大屏、IOC、驾驶舱、数字孪生、智慧城市、可视化指挥 | `gov-digital-screen` |

优先级：大屏 > 后台 > SaaS（"高速公路智慧养护大屏"命中大屏，即使同时含"管理"字样）。无命中 → 缺省 `enterprise-dashboard` + 标注 assumption。

### ② 行业映射（在 Style Preset 上做修正）

| 行业 | primaryColor 倾向 | 组件修正 |
|---|---|---|
| 教育 | 蓝紫系（#5A5CF0 / #409EFF） | + 考试/成绩/课程组件 |
| 医疗 | 青绿系（#0FB5AE / #00B578） | + 患者卡/预约/报告组件 |
| 政务 | 红蓝稳重（#1E5EFF / #C7000B 点缀） | + 审批流/公文组件 |
| 交通 | 深蓝底 + Cyan 数据色（#00D4FF） | + 路况地图/设备状态组件 |
| 金融 | 深色高对比（#1A1A2E 底 + 金 #D4AF37） | + 账户/流水/风控组件 |

### ③ 信息架构生成

- 页面清单按平台模板：Web 后台 = 登录/工作台/列表页×N/详情页/设置；移动 App = 首页/核心功能页×N/我的；大屏 = 主驾驶舱 + 子屏×N。
- `layoutPattern` 与 `contentDensity` 从 Style Preset 继承默认值。

### ④ Token 推导

继承 Style Preset 的 `visualSystem` 基线，行业映射仅修正 `primaryColor` 与 `background`；禁止凭空造色值——所有色值必须能在 Preset 或行业映射表中找到出处。

### ⑤ 组件预期清单

`componentExpectation[]`：每项 `{ name, type, priority }`，priority ∈ `P0(必须)/P1(应该)/P2(可选)`。P0 集合来自 Style Preset 的 `coreComponents`，行业修正追加 P1。

## Stage Gate（L1 出口检查）

1. Brief JSON 可通过 `templates/design-brief.json` schema 解析（jq/python json.load 验证）
2. 所有色值/字体/间距有出处（Preset 或行业映射）
3. 未命中规则处均有 `"_assumptions"` 显式标注
4. 用户确认风格方向（一句话级，不逐字段确认）

## 与其他层的关系

- 输出 Brief JSON → L2 消费（生成完整 Token Set 与组件库规格）
- L4 Visual Critic 不达标回写时，修正对象是 Brief JSON 的 `designDirection` / `visualSystem` 字段
- 详见 `references/design-intelligence.md`（完整规则）、`references/design-style-library.md`（三套 Preset）、`references/brief-schema.md`（Schema 定义）

## few-shot 示例

`assets/examples/`：`example-saas.json`（SaaS 教育后台）、`example-health.json`（AI 发型 App，美业健康类）、`example-highway.json`（河南高速智慧养护大屏）。Agent 生成新 Brief 前应先读对应行业示例对齐粒度。
