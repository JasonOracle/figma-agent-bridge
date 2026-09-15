---
name: figma-agent-skill
description: Figma 设计资产捕获 / 画布构建 / 视觉回归三单元工作流。通过本地 Figma Bridge（Node server + 插件客户端）让 Agent 直接读写 Figma 画布，完成设计规格化、DS 组件与页面构建、像素级回归。触发场景：根据 Figma 设计稿或 UI 截图生成/还原 Figma 页面、构建 Design System 组件、做 Figma↔前端视觉回归。需要本机运行 figma-agent-bridge 的 bridge server 且 Figma 中已运行插件客户端。
---

# Figma Agent Skill

## 触发条件

- 用户要求「把这张 UI 截图 / Figma 设计稿还原成 Figma 页面 / Vue 页面」
- 用户要求在 Figma 中构建 Design System、页面 Frame、状态 specimen
- 用户要求 Figma↔前端视觉回归（像素 diff / 几何审计 / token 审计）
- 前置：bridge server 运行中（默认 `http://127.0.0.1:45677`），Figma 桌面版中插件客户端已运行并绑定目标文件

## 输入 / 输出

| 项 | 定义 |
|---|---|
| 输入 | Figma 节点 id / UI 截图 / 设计规格 JSON（`.vibe/<stage>/design-spec.json`） |
| 中间态 | build-ids 快照（`as:` 名 → 真实 node id）、审计 JSON |
| 输出 | Figma 页面 Frame、PNG 证据（`.vibe/<stage>/screenshots/`）、Markdown 报告（`docs/<stage>-*.md`） |

## 三单元 Workflow

### figma-capture（设计资产捕获）

1. `get-page-summary` / `get-node(detail:true)` 读取目标节点，或解析用户提供的 UI 截图
2. 生成设计规格 JSON（Frame 树 / token / 几何 / 文本 / 组件引用），落盘 `.vibe/<stage>/design-spec.json`
3. **人工确认规格后方可进入 build**（规格是下游唯一输入，禁止绕过）

### figma-build（画布构建）

1. DS Component 存在性检查（READ）——**禁止盲目 create-component**
2. 组件缺失时逐组件构建；组件齐全时直接实例化
3. 页面按层构建：shell → menu → header → content → specimens（Empty/Error/Loading 放 x≥1560 隔离带）
4. 每批 WRITE → READBACK，build-ids 即时落盘
5. 五级 QA 审计（见 references/qa-checklist.md）

### figma-regress（实现回归）

1. 统一视口截图（1440×900 / DPR 1 / Chromium）
2. 像素 diff（SSIM / Diff% / Diff Pixels）+ 几何 DOM readback
3. Root Cause 分类：VUE_IMPLEMENTATION_ERROR / FIGMA_SOURCE_DIFFERENCE / ENVIRONMENT / REFERENCE_UNCERTAINTY
4. 基线冻结：数字一经冻结，后续触基线改动必须复测

## Stage Gate 检查规则

每单元完成必须输出五项，缺一项即停止：

1. 完成节点清单（真实 node id，非 as: 名）
2. Geometry Audit（几何红线见 references/design-tokens.md）
3. Token Audit（`unknownColors = []`）
4. Git diff（白名单范围 + 禁改区 = 0）
5. 未完成项与限制（Known limitations）

## Agent 六条执行铁律

1. **READ before WRITE** — 一切构建前 readback 实际画布状态，严禁按历史报告/记忆猜 node id
2. **批 ≤30 ops 严格串行** — `run` 批 ≥35 ops 会概率性触发 NO_RESULT；禁止并行写 Figma
3. **跨批引用必须用真实 node id** — `as:` / `$name` / `@last` 仅批内有效，跨批必失效
4. **NO_RESULT ≠ 未执行** — 严禁立即 retry，走五步故障流程（见下）
5. **token 零新增** — 颜色只出自 token 表；新颜色先修复来源，不擅自入库
6. **Git 白名单 + ls-remote 核对** — 提交前禁改区 diff=0，推送后 `git ls-remote` 直连核对

## NO_RESULT 故障处理流程

```
超时 / NO_RESULT
→ 1. get-page-summary        # 读画布
→ 2. get-node(depth:2)       # 查实际子树：失败批可能已完整执行（仅结果回传丢失）
→ 3. delete-node 清残件       # 删前必须验证目标确为残件
→ 4. 批规模对半拆             # 治本
→ 5. 再重试
```

## WRITE→READBACK 规则

- 每个 create/set 批完成后立即 `get-node` 回读关键节点
- `as:` 名 → 真实 node id 映射每批落盘 build-ids JSON，断点续跑只认落盘 id
- 实例创建后必须回读内部文本并 `set-text-content` 覆写目标值，不得依赖实例继承文本

## 冻结文件协议

- 启动时显式登记冻结 fileKey + 关键 Frame id
- 多客户端并存时先查 health 注册表，确认旧客户端失活（lastSeen 超 staleAfter）再发命令
- 每阶段落盘完整性证据（registeredClients / activeClientPage / 写入计数=0）

## 详细规范索引

- references/bridge-api.md — 35 原子 op 手册、run 批处理规范、参数限制
- references/execution-rules.md — 批规模 / 引用生命周期 / node id 管理 / retry 禁则
- references/design-tokens.md — token 表、几何红线、文本行高陷阱
- references/qa-checklist.md — QA1~QA5 五级审计判据
- references/failure-playbook.md — NO_RESULT / 断连 / 路由污染 / 残件清理

## scripts/ 用法

```bash
node scripts/audit-token.mjs <dir...> [--allow extra-colors.txt]   # Token 审计
node scripts/audit-layout.mjs --spec design-spec.json --bridge http://127.0.0.1:45677 --token-file .vibe/token
node scripts/export-screenshot.mjs --base http://127.0.0.1:5180 --routes /users,/exams --out screenshots/
node scripts/generate-report.mjs --inputs *.audit.json --out report.md
```
