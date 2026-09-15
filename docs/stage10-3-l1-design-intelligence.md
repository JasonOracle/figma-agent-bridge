# Stage 10.3 — L1 Design Intelligence Layer 实现

日期：2026-09-16 ｜ 仓库：figma-agent-bridge ｜ 基线 commit：fcfce6e（Stage 10.2）

> **STAGE 10.3 COMPLETE — L1 Design Intelligence Layer**

本阶段实现五层架构的 L1：把一句自然语言需求**确定性**转换为结构化 Design Brief JSON。不写 Figma 操作代码（不进 L3），不修改 Vue / Figma / Bridge / plugin。

---

## 1. L1 工作流

```
User Prompt（自然语言）
 → ① 关键词识别 → 风格路由（大屏 > 后台 > SaaS 优先级判定）
 → ② 行业映射（8 行业 → primaryColor / 组件修正）
 → ③ 信息架构生成（4 平台模板：web-admin / mobile-app / big-screen / web-site）
 → ④ Token 推导（继承 Preset，行业仅修正 primaryColor；禁止造 Preset 外色值）
 → ⑤ 组件预期清单（Preset coreComponents=P0 种子 + 行业追加 P1 + Prompt 显式功能）
 → Design Brief JSON（唯一出口物，含 _assumptions 审计字段）
```

核心原则：**不是 AI 自由发挥**。每条规则可追溯（design-intelligence.md 的映射表）；规则未覆盖处必须显式写 `_assumptions`，规则命中处禁止写入假设（防审计污染）。

## 2. Brief Schema

`templates/design-brief.json`（JSON Schema draft-07）：

| 字段组 | 内容 | 关键约束 |
|---|---|---|
| product | name / industry / targetUser / platform | industry 8 枚举、platform 4 枚举 |
| designDirection | style / keywords / reference / avoid | style 只能取 3 Preset id；**avoid 必须完整继承 Preset**（L4 否决依据） |
| informationArchitecture | pages[] / layoutPattern / contentDensity | pages ≥3，每页 purpose 必答「解决什么问题」 |
| visualSystem | colorMood / primaryColor / background / typography / spacing / radius | hex 正则校验；值必须有 Preset/映射表出处 |
| componentExpectation | ≥5 ≤20 项 | P0=coreComponents 全集，来源可追溯 |
| _assumptions | 假设清单 | 只收假设，格式 `字段路径: 内容（原因）` |

## 3. Style Preset（首批 3 套）

| Preset | 对标 | 核心特征 | 适用 |
|---|---|---|---|
| `premium-saas` | Apple / Stripe / Linear / Vercel | 大留白（区块 48-80px）、密度控制、微阴影、radius 4-8、黑白灰+品牌色、禁渐变/重投影 | 订阅制 SaaS、开发者工具、官网 |
| `enterprise-dashboard` | Element Plus / Ant Design Pro | 表格(40/44)/KPI 卡/数据卡片、sidebar-content、radius 2/4/6、深浅双模式、**几何红线内建**（30/40/44/4px/1440×900） | 教育/医疗/政务/交通 web-admin |
| `gov-digital-screen` | 智慧城市 IOC / 高速指挥中心 / 数字孪生 | 深蓝 #0A1A3C + Cyan #00D4FF glow（仅关键指标）、图表占比 ≥50%、1920×1080 三段式、最小字号 14px | 交通/政务/能源/园区大屏 |

Preset JSON 含 `coreComponents`（L1 组件 P0 种子）与 `geometry`（enterprise-dashboard 的红线直接来自 Stage 9 已验证 token 表）。

## 4. Prompt Mapping Rule

- **关键词→风格**：大屏/IOC/驾驶舱/数字孪生 → gov-digital-screen（优先级 1）；后台/admin/中后台 → enterprise-dashboard（2）；SaaS/现代/极简 → premium-saas（3）；无命中 → 缺省 + assumption。
- **行业映射**：教育 #5A5CF0 / 医疗 #0FB5AE / 政务 #1E5EFF / 交通 #00D4FF(大屏) / 金融 深底金点缀 / 美业 #E8A0BF / 电商 品牌色 / 通用 继承 Preset；每行业附带 P1 组件追加集（如教育 + ExamCard/ScoreBadge，交通 + RoadStatusMap/DeviceMonitor）。
- **平台判定**：App/小程序 → mobile-app + tab-flow；后台 → web-admin + sidebar-content；大屏 → big-screen + full-bleed-screen。

## 5. 示例说明（few-shot ×3）

| 示例 | 来源 | Preset | 说明 |
|---|---|---|---|
| `example-saas.json` | **本仓库 Stage 5-9 实测项目**（ElementAdmin 考试平台） | enterprise-dashboard | 唯一有完整实现与 QA 数据支撑的样本；6 页面/18 组件，零 assumptions |
| `example-health.json` | AI 发型 App 项目（美业健康类） | premium-saas | 5 页面/13 组件；历史会话细节不可考（conversation_search 无结果），按领域惯例重建，**3 条 assumptions 显式标注** |
| `example-highway.json` | 河南高速智慧养护大屏 | gov-digital-screen | 3 屏/14 组件；同样按领域惯例重建，**3 条 assumptions 标注** |

两个重建示例的假设均已透明化（产品名占位、页面清单推导、色值取向），用户可随时用真实需求修正——这本身就是 `_assumptions` 机制的示范。

## 6. QA 结果

- **JSON 可解析**：7 个 JSON 文件（schema + 3 preset + 3 example）全部 `json.load` 通过 ✅
- **三套 Style 完整**：三 Preset 均含 id/keywords/reference/avoid/visualSystem 全字段 + coreComponents ≥8 项 ✅
- **示例字段完整**：三示例均含五大必填字段组；P0 集合与对应 Preset coreComponents 一致；avoid 完整继承 ✅
- **Git diff**：仅新增 `skills/ai-ui-designer/`（10 文件）+ `docs/stage10-3-l1-design-intelligence.md`；`src/` `plugin/` `bridge/` Figma 文件**零改动** ✅

## 7. Known Limitations

1. 风格库首批仅 3 套：官网/电商独立风格、dark-mode enterprise 未覆盖（走缺省 + assumption）。
2. 行业映射表 8 行业，primaryColor 为单值建议，L2 层才做完整色板生成。
3. example-health / example-highway 为领域重建样本，非原始需求文档转写。
4. L1→L2 的 Brief→DS Spec 转换器属 Stage 10.4，本阶段未实现。

## 8. 停止声明

L1 基础能力实现完成，**立即停止**。未进入 Stage 10.4（L2 Design System Generation），未进入 L3 Figma 操作，未修改 Vue/Figma/Bridge/plugin。
