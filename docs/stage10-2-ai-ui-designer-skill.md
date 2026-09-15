# Stage 10.2 — AI UI Designer Skill Architecture

日期：2026-09-16 ｜ 仓库：figma-agent-bridge ｜ 基线 commit：24db48a（Stage 10）

> **STAGE 10.2 — AI UI Designer Skill Architecture COMPLETE**

本阶段为架构重设计（Re-design）：把 Stage 10.1 的「Figma 自动化操作 Skill」升级为对标 huashu-design / Taste / UI-UX-Pro-Max / frontend-design 的**完整 AI 设计增强 Skill**。仅输出架构，不写实现代码；Vue / Figma / Tailwind / Dashboard 全部冻结。

---

## 1. Skill 总体架构（五层）

```
┌─────────────────────────────────────────────────────────────┐
│                        User Prompt                           │
│   “设计一个现代 SaaS 教育管理后台 / AI 医疗 App / 养护大屏”    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─ L1 Design Intelligence Layer（设计智能层）───────────────────┐
│  风格分析 → 产品定位 → 用户场景 → 信息架构 → 页面规划            │
│  → 色彩体系 → Typography → Design Token                       │
│  出口：Design Brief JSON                                      │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─ L2 Design System Generation Layer（设计系统生成层）──────────┐
│  Brief → Token Set（Color/Type/Spacing/Radius/Shadow）        │
│  → Component 清单（复用判定 vs 新增判定）→ DS Spec JSON        │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─ L3 Figma Generation Layer（Figma 自动绘制层）★已具备★────────┐
│  DS Spec → Build Plan → Bridge run batch（≤30 ops）           │
│  → Canvas（Frame/组件/布局/文本/图表/插画区）                  │
│  本层 = Stage 10.1 架构 + skills/figma-agent-skill（本仓库）   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─ L4 Visual Critic Layer（视觉审查层）─────────────────────────┐
│  export-node PNG → 五维评分（布局/色彩/一致性/商业感/可用性）    │
│  → 不达标项回写 L1/L2 修正（Critic Loop，≤3 轮）               │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─ L5 Export Layer（输出层）────────────────────────────────────┐
│  PNG / SVG / Figma JSON / Design Spec JSON /                  │
│  Frontend Code Mapping（DS 组件 → Vue/React 组件映射表）        │
└──────────────────────────────────────────────────────────────┘
```

层间契约全部是**可落盘 JSON**（Brief / DS Spec / Build Plan / Critic Report / Export Manifest）——每一层可独立调试、独立审计、独立复跑，继承 Stage 5–9「一切中间产物入库」的工程纪律。

---

## 2. Agent Workflow

```
Prompt
 → L1: Design Brief JSON          ← 阶段门① 用户确认风格方向（一句话级）
 → L2: DS Spec JSON               ← 阶段门② token 表 + 组件清单确认
 → L3: Figma Build（WRITE→READBACK）← 阶段门③ QA1–QA5 五级审计全绿
 → L4: Visual Critic（PNG 评分）   ← 阶段门④ 均分 ≥8/10 或 3 轮收敛
 → L5: Export Manifest            ← 阶段门⑤ 出口物清单 + Git 审计
```

Critic Loop：L4 任一维度 <7 分 → 生成带证据的修正项（指出具体 Frame/token/组件）→ 回写 L1 或 L2 的对应 JSON → 仅重建受影响节点 → 重审。最多 3 轮，未收敛则如实降级声明（Known limitations），不无限循环。

## 3. Skill 文件结构

```
skills/ai-ui-designer/
├── SKILL.md                      # 五层总控 + 阶段门 + 六条铁律 + Critic Loop
├── references/
│   ├── design-intelligence.md    # 风格库/行业模板/IA 模式/配色生成法
│   ├── design-system-spec.md     # Token 五件套规范 + 组件复用判定矩阵
│   ├── visual-critic.md          # 五维评分卡 + 行业语言对标（Apple/Stripe/Linear）
│   ├── export-mapping.md         # DS→前端组件映射规范
│   ├── bridge-api.md             # ★已存在（L3 原子 op 手册）
│   ├── execution-rules.md        # ★已存在（WRITE→READBACK 等纪律）
│   ├── design-tokens.md          # ★已存在（ElementAdmin 基线 token）
│   ├── qa-checklist.md           # ★已存在（QA1–QA5）
│   └── failure-playbook.md       # ★已存在（NO_RESULT 五步等）
├── assets/
│   ├── style-library/            # 行业风格预设（saas-dashboard / health-app / gov-screen…）
│   ├── templates/                # design-spec / build-report / qa-report / critic-report
│   └── examples/                 # 本仓库 9 个 Stage 产物作为 few-shot 样例
└── scripts/
    ├── audit-token.mjs / audit-layout.mjs / export-screenshot.mjs / generate-report.mjs  # ★规划中（L3/L5 通用脚本）
    └── （新增）critic-score.mjs / brief-to-ds.mjs / ds-to-build-plan.mjs                 # L4/L1/L2 转换器
```

## 4. 与已有 Figma Bridge 的关系

**Bridge 是 L3 的物理执行通道，不是 Skill 本身。**

- 五层架构中仅 L3 直接调用 Bridge 35 原子 op；L1/L2/L4/L5 与 Bridge 解耦（输入输出都是 JSON）。
- Stage 10.1 沉淀的全部铁律（READ before WRITE / 批≤30 / NO_RESULT 五步 / 冻结协议 / token 零新增）整体迁移为 L3 内部纪律，对上层不可见。
- Bridge 未来若被标准 MCP server 替代，L3 接口不变（Build Plan JSON → 执行器），其余四层零改动——这是把 L3 与 Bridge 解耦的核心理由。

## 5. 与四类设计 Skill 的能力融合方式

| 对标 Skill | 融合位置 | 融合方式 |
|---|---|---|
| UI-UX-Pro-Max | L1 + L2 | 吸收其「设计规范自动生成」能力：Prompt→完整设计规范（色板/字阶/间距/组件状态矩阵）的输出格式作为 DS Spec JSON 的 schema 蓝本 |
| frontend-design | L1 + L4 | 吸收其前端审美规则（留白节奏、字重对比、现代 SaaS 排版惯例）作为 Critic 的可执行检查项，把「好看」翻译成可判定的几何/对比度/密度指标 |
| Taste skill | L4 | 吸收其视觉判断方法：多维评分 + 具体证据（指出哪个元素、哪条 token）+ 修正建议，而非抽象「高级感」打分 |
| huashu-design | L1 + L2 | 吸收其中文语境设计话术能力：行业风格预设（政务大屏/教育后台/医疗 App）用中文设计术语表达，Brief JSON 支持中英双语字段 |

融合原则：**只吸收方法论与检查项，不复制其 prompt 原文**；四类能力统一收敛为五层 JSON 契约中的字段与评分卡，避免变成四个 Skill 的缝合怪。

## 6. 后续 Stage 划分路线图

| Stage | 内容 | 出口物 | 依赖 |
|---|---|---|---|
| 10.2（本阶段） | 五层架构设计 | 本文档 | — |
| 10.3 | L1 Design Intelligence：风格库 3 套预设 + Brief JSON schema + Prompt→Brief 流程验证 | style-library/ + brief 样例×3 | 10.2 |
| 10.4 | L2 DS Generation：Token 生成器规则 + 组件复用判定矩阵（对接已有 25 组件审计能力） | ds-to-build-plan 转换器设计+验证 | 10.3 |
| 10.5 | L3 复跑验证：用全新行业 Prompt 端到端生成一套 Figma 页面（复用现有 Bridge/Skill 脚本），证明 L1→L3 链路 | 新 Figma 文件 + QA 报告 | 10.4 |
| 10.6 | L4 Visual Critic：五维评分卡实现 + Critic Loop 闭环（对 10.5 产物做 1 轮真实修正） | critic-report + 修正前后 PNG | 10.5 |
| 10.7 | L5 Export：PNG/SVG 导出 + DS→Vue 组件映射表（对接 Stage 9 DS 组件实现经验） | export-manifest + 映射表 | 10.6 |
| 10.8 | Skill 打包发布：SKILL.md 定稿、README、示例库、（可选）MCP server 化 | 可安装 Skill 包 | 10.7 |

与 Stage 10 后端路线（M1–M6）**互不阻塞**：设计 Skill 走 Figma/前端侧，后端走 server/ 侧，交汇点在 L5 的 Frontend Code Mapping 与后端 API 契约对齐。

## 已知限制

1. L1/L2/L4 目前是方法论与 JSON 契约设计，智能生成能力依赖 Agent 自身推理，无独立训练模型——评分一致性靠评分卡条目化兜底。
2. 行业风格预设首期仅规划 3 套，覆盖度有限。
3. Critic Loop 的「修正项回写」粒度到组件/token 级，不做像素级自动微调。

## 停止声明

架构设计完成，**立即停止**：未进入 10.3 风格库实现，未进入后端 M1，未进入 CI/CD。`skills/figma-agent-skill/`（本阶段早些时候落地的 SKILL.md + 三份 references）保留为 L3 地基，后续并入 `skills/ai-ui-designer/` 结构时仅做路径迁移。
