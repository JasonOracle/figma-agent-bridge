# Stage 10.1 — Figma Agent Skill Architecture

日期：2026-09-16 ｜ 仓库：figma-agent-bridge ｜ 基线 commit：24db48a（Stage 10）

> **STAGE 10.1 ARCHITECTURE COMPLETE**

本阶段将 Stage 5–9.2-C 全部实战流程抽象为可复用的 **Figma Agent Skill** 架构。仅输出设计：不动 Vue、不动 Figma、不写实现代码。所有规则均源自已验证的生产经验（每条可追溯到一个真实事故或审计结论）。

---

## 1. Skill 工作流（Workflow）

Skill 对外暴露三个能力单元，每个单元是一条**不可跨越的线性流水线**，禁止跳步：

### 1.1 `figma-capture`（设计资产捕获）

```
Figma 选中节点 / 截图
  → get-page-summary / get-node(detail)  READ
  → 解析为结构化设计清单（Frame 树 / token / 几何 / 文本）
  → 落盘 .vibe/<stage>/design-spec.json
  → 人工确认规格
```
出口物：**设计规格 JSON**（下游一切工作的唯一输入）。

### 1.2 `figma-build`（画布构建）

```
设计规格 JSON
  → DS Component 存在性检查（READ，禁止盲目 create-component）
  → 组件缺失 → 逐组件构建（build-ids 落盘）
  → 页面构建（shell → menu → header → content → specimens）
  → 每批 WRITE → READBACK
  → 五级 QA 审计（§4）
```
出口物：**页面 Frame + build-ids 快照 + 审计报告**。

### 1.3 `figma-regress`（实现回归）

```
Figma 页面（冻结基线） + Vue 页面
  → 统一视口截图（1440×900 / DPR 1）
  → 像素 diff（SSIM / Diff% / Diff Pixels）
  → Root Cause 分类：VUE_IMPLEMENTATION_ERROR / FIGMA_SOURCE_DIFFERENCE / ENVIRONMENT / REFERENCE_UNCERTAINTY
  → 交互回归（真实浏览器事件矩阵）
```
出口物：**回归报告 + 冻结基线**（基线一经冻结，后续任何触基线改动必须复测）。

### 1.4 全局阶段门（Stage Gate）

每个单元完成后必须输出：① 完成节点清单 ② Geometry Audit ③ Token Audit ④ Git diff ⑤ 未完成项与限制。**五项不全不许进入下一单元**。

---

## 2. Agent 执行规则（Execution Rules）

### 2.1 读取优先（READ before WRITE）

- 一切构建前必须先 `get-page-summary` + `get-node`，以**实际 readback 为准**，严禁根据历史报告/记忆猜 node id。
- Bridge 无 `createPage` op：多页面策略固定为 **Page 1 内部隔离分区**（命名前缀 + 坐标分区），不得为了「真多 Page」修改已完成内容。

### 2.2 写入纪律（WRITE → READBACK）

- 所有写操作走 `run` 批处理，**严格串行**，禁止并行向 Figma 写入。
- **批规模 ≤ 30 ops**：≥35 ops 的批实测会概率性触发 NO_RESULT（插件侧实际已执行但结果回传丢失）。
- 每批完成立即将 `as:` 名 → 真实 node id 映射**落盘**（build-ids JSON），断点续跑只认落盘 id。

### 2.3 引用规则（Reference Rules）

- `as:` / `$name` / `@last` **仅批内有效**；跨批引用必须使用真实 node id（血泪事故：跨批 `$ref` 失败、恢复后重复执行产生双胞胎节点）。
- 跨文件引用组件 = 禁止操作（Bridge 不支持）。

### 2.4 故障处置（NO_RESULT ≠ 未执行）

超时/NO_RESULT 时**严禁立即 retry**，固定五步走：

```
1. get-page-summary            # 读画布
2. get-node 查实际子树          # 确认是否已执行（可能部分或全部已执行）
3. 清残件（delete-node）       # 只删确认为残件的节点
4. 缩小批规模（对半拆）         # 治本
5. 再重试
```
注意残件判定铁律：**失败批可能已完整执行**（实测 15s 超时窗口内 45 ops 全落、仅结果丢失）——先查再删，删前 `get-node(depth:2)` 验证目标完整性。

### 2.5 冻结协议（Freeze Protocol）

- 冻结文件（如 Stage 5 Dashboard）在启动阶段**显式记录 fileKey + 关键 Frame id**，运行期一切命令前确认路由目标插件实例的 page 归属。
- Bridge FIFO 路由到「正在等待的」插件客户端：多客户端并存时先确认旧客户端失活（health 注册表 + lastSeen），避免命令打进旧文件。
- 冻结证据每阶段落盘（registeredClients / activeClientPage / 命令计数）。

### 2.6 Git 纪律

- 提交范围白名单制（如仅 `docs/`、`stages/`、`.vibe/stage9/`）。
- 提交前必须 `git diff --stat -- <禁改文件>` 输出为零。
- 推送后必须 `git ls-remote origin refs/heads/main` 直连核对（沙箱内 `git status` 的 upstream 显示不可信）。

---

## 3. Figma 操作规范（Operation Norms）

### 3.1 原子 op 白名单（34 op）

仅允许使用 Bridge 已实现的 34 个原子 op；需要新能力时按 9.2-C 模式扩展插件（如 `export-node`：exportAsync → base64），扩展必须先声明再实现。

### 3.2 几何与 Token

- 一切尺寸/颜色必须出自 **Design System token 表**；审计 `unknownColors` 必须恒为 `[]`；出现新颜色时禁止擅自入 token，先修复来源。
- 控件几何红线（ElementAdmin 体系）：Button/Input/Select = 30px、Table Header = 40px、Table Row = 44px、卡片圆角 4px、页面 1440×900。
- **文本自动行高陷阱**：Figma 文本自动行高 ≈16px ≠ 设计行高；控件高度必须 `set-layout-sizing FIXED` + `resize-node` 强制，不得依赖 Auto Layout HUG 推算。

### 3.3 矢量与图标

- `vector` 路径仅支持 **M/L/Q/C/Z**（不支持 A/H/V 弧线命令）；弧线用三次贝塞尔近似。
- 图标仅限 inline SVG / native vector / 简单几何，禁止第三方 icon library。

### 3.4 组件与实例

- DS Component 是**单一事实来源**：页面中必须优先 create-instance，禁止复制一套新 DS。
- 实例创建后必须 READBACK 实例内文本并 `set-text-content` 覆写（依赖实例继承文本等于失控）。
- 新增正式 DS Component 数量默认应为 0；页面级特殊结构（如 8 列表格、Tabs、Toggle）用**页内本地 Frame** 实现，不污染 DS。
- 命名规范强制 `DS/<Category>/<Name>`（如 `DS/Button/Primary`）；审计统计违规命名必须为零。

### 3.5 Auto Layout

- 规定结构必须使用 Auto Layout（Page container / Header / Search bar / Filter row / Table row / Pagination / Card / Breadcrumb / Button / Input / Badge / Form sections）。
- `set-layout-sizing FILL` 的前置校验：目标节点自身必须已开启 Auto Layout，否则操作失败。
- 必须 READBACK 完整参数集：layoutMode / padding×4 / itemSpacing / primaryAxisAlignItems / counterAxisAlignItems / layoutSizing×2，不凭视觉判断。

---

## 4. QA 检查规范（QA Norms）

五级审计，逐级全绿才算完成：

| 级 | 名称 | 判据 |
|---|---|---|
| QA1 | 分区完整性 | 顶层节点数量/坐标/命名与构建记录一致，无残件无双胞胎 |
| QA2 | DS 审计 | 组件存在性逐一 get-node 回读；`DS/*` 命名违规 = 0；foreign instance = 0 |
| QA3 | Layout 审计 | Frame 尺寸 / 控件几何（§3.2 红线）/ Auto Layout 参数 / spacing / token 色，全部 READBACK |
| QA4 | Token 审计 | `unknownColors = []`（Figma 侧 + Vue 侧 `src/**/*` hex 全量扫描，双通道） |
| QA5 | 完整性审计 | 冻结文件写入计数 = 0；历史页面（如 Page/UserList）存在且未变；Vue `git diff` = ZERO CHANGES |

补充规范：

- **几何审计口径**：DOM 侧必须按 DS 组件根类名精确圈定（宽口径会把 TopBar/TagsBar 等 chrome 控件计入导致误判）；内嵌原生控件（如 DsInput 内 input 18px）为设计使然，不计红线。
- **Visual QA 证据**：页面截图 PNG 入 `.vibe/<stage>/screenshots/`，逐张目检后方可落盘为基线。
- **审计脚本即资产**：每次审计脚本（audit/build/shots）与原始 JSON 一并入库，保证可被第三方 AI 独立复核。

---

## 5. Skill 文件结构（File Structure）

```
figma-agent-skill/
├── SKILL.md                          # 入口：触发条件、工作流、执行规则摘要（三层递进）
├── references/
│   ├── bridge-api.md                 # 34 原子 op 参数手册（按 plugin/code.js 生成）
│   ├── execution-rules.md            # §2 全文（读取优先/写入纪律/故障处置/冻结协议）
│   ├── design-tokens.md              # token 表 + 几何红线 + 文本行高陷阱
│   ├── qa-checklist.md               # §4 五级审计判据 + 评分卡模板
│   └── failure-playbook.md           # NO_RESULT 五步处置 / 残件判定 / 多客户端路由竞态
├── assets/
│   └── templates/
│       ├── build-ids.template.json   # 节点快照格式
│       ├── audit-report.template.md  # 阶段报告骨架（五项出口物）
│       └── design-spec.schema.json   # 设计规格 JSON Schema
└── scripts/                          # 复用脚本（由本仓库 tools/ 提炼）
    ├── audit.mjs                     # QA1–QA5 通用审计器
    ├── screenshots.mjs               # 统一视口截图 + 几何 DOM readback
    └── bridge-client.mjs             # 命令封装（token 读取/重试禁则/落盘）
```

SKILL.md 三段式：
1. **触发**：Figma→代码还原 / 画布构建 / 视觉回归 三类任务。
2. **工作流**：§1 三单元 + 阶段门。
3. **铁律速查**：§2–§4 各取 5 条最高频规则（NO_RESULT 五步、批 ≤30、跨批用真 id、token 零新增、冻结零写入）。

---

## 已知限制（如实声明）

1. 本 Skill 依赖本仓库的 Figma Bridge（Node server + 插件客户端），非通用 Figma REST API 方案；发布为独立 Skill 时需附带 bridge/ 与 plugin/ 子包。
2. 像素回归目前仅覆盖冻结 Dashboard 基线；新页面基线随各自阶段扩展。
3. Bridge 无 createPage，多页面策略为隔离分区（§2.1），Figma 侧「真多 Page」不是本 Skill 的能力目标。

## 停止声明

架构设计到此为止。**未编写任何实现代码**，未改动 Vue / Figma / Tailwind / DS / Dashboard，未进入 Skill 实现与打包。立即停止。
