# Figma-test Vibe Coding

**中文** | [English](#english)

---

## 中文

一套完整的 **「Agent → Figma 写入 → Figma 设计 → Vue 代码 → 浏览器 → 像素级回归」** 全链路实践项目。

不使用 Figma 官方付费 Write to Canvas，不依赖任何 MCP 的写入能力，自建本地写入通道，并用它在真实 Figma 画布上完成了 4 个真实 UI（1 个设计系统 + 3 个完整页面），最终把其中一个转成 Vue3 + Tailwind 网页并做了程序化像素级视觉回归。

### 架构 / Architecture

```
WorkBuddy Agent / figma-vibe CLI
        │  HTTP POST /v1/command   (?token=…)
        ▼
   Bridge  (127.0.0.1:45677, 仅回环, token 认证, 同步语义)
        │  HTTP GET /v1/poll  ← long-poll，插件主动来取
        ▼
   Figma Plugin UI (iframe)      ←—— 唯一有网络能力的一层
        │  postMessage
        ▼
   Figma Plugin 主线程  →  Figma Plugin API  →  真实画布节点
```

详细协议、30 个原子操作与排错表见 [`docs/bridge-architecture.md`](docs/bridge-architecture.md)。

### 七个阶段 / Seven Stages

| 阶段 | 内容 | 关键产物 | 结果 |
|---|---|---|---|
| [Stage 1-2](stages/stage1-2-bridge-channel/) | 写入通道 + 30 个原子操作 | bridge / plugin / cli | selftest 91/91，真实画布断言 35/35 |
| [Stage 3](stages/stage3-saas-dashboard/) | 首个真实 Vibe Design：SaaS 教育仪表盘 | 274 节点 / 10 组件 / 0 IMAGE | audit 42/42 |
| [Stage 4](stages/stage4-pixelflow-ai/) | Agent 自主设计闭环：PixelFlow AI 暗色工具 | 188 节点 / 17 组件 | audit 42/42（自查补漏） |
| [Stage 5](stages/stage5-elementadmin-figma/) | 仅凭截图高还原 ElementAdmin（1920×1030） | 207 节点 / 25 程序化 VECTOR | audit 47/47，自评 89/100 |
| [Stage 6](stages/stage6-vue-elementadmin/) | Figma → Vue3 + Tailwind → 浏览器 | Vite5 + Vue3.4 + Tailwind3.4 | 两轮 QA 88→93/100 |
| [Stage 7](stages/stage7-visual-regression/) | 程序化像素级视觉回归 | 自研 diff 工具 + 32 节报告 | Pixel Diff **5.691%** / SSIM **0.9037** / Final **92/100** |

### 目录结构 / Repository Layout

```
├── bridge/          本地 Bridge（Node 内置模块，零 npm 依赖）
├── plugin/          Figma 开发插件（manifest + code.js + ui.html）
├── cli/             figma-vibe CLI（声明式命令表）
├── tools/           selftest / verify / probe / build / audit 脚本
├── examples/        命令示例 JSON
├── stage6-element-admin/   Stage 6 Vue3 + Tailwind 项目
├── stages/          ★ 各阶段产物归档（含每阶段说明、审计记录、几何 dump、截图、diff 数据）
│   ├── stage1-2-bridge-channel/
│   ├── stage3-saas-dashboard/
│   ├── stage4-pixelflow-ai/
│   ├── stage5-elementadmin-figma/
│   ├── stage6-vue-elementadmin/
│   └── stage7-visual-regression/
├── docs/
│   ├── bridge-architecture.md     通道架构与 30 op 协议
│   ├── stage7-visual-regression.md  32 节视觉回归报告（可独立审阅）
│   ├── communication-log.md       ★ 各阶段沟通记录
│   └── lessons-learned.md         ★ 30 条经验教训（中英标题）
└── .vibe/           运行时状态（token / batch / state，token 不入库）
```

### 快速开始 / Quick Start

```bash
# 1. 启动 Bridge
node bridge/server.js

# 2. mock 自测（不需要 Figma）
node tools/selftest.js

# 3. Figma Desktop → Plugins → Development → Import manifest.json → 运行插件

# 4. 真实画布验证（需要插件在线）
node tools/stage2-verify.js

# 5. Stage 6 前端
cd stage6-element-admin && npm install && npm run dev   # http://127.0.0.1:5180
```

### 安全 / Security

- `.vibe/token`（Bridge 鉴权令牌）与所有日志已被 `.gitignore` 排除，不入库。
- Bridge 只绑回环地址；插件只允许访问 `localhost`。

### 核心结论 / Headline Results

- 通道可靠性：命令同步语义 + waiter 存活检查 + 客户端注册制，消灭静默丢命令与假阳性。
- 设计还原：仅凭截图在 Figma 还原 ElementAdmin 自评 89/100；转 Vue 后与 Figma 渲染基准像素 Diff 5.691%（SSIM 0.9037，Final 92/100），布局骨架与全部 17 个颜色 token 0px 差异。
- 全部经验沉淀在 [`docs/lessons-learned.md`](docs/lessons-learned.md)，全部阶段沟通在 [`docs/communication-log.md`](docs/communication-log.md)。

---

## English

A complete end-to-end practice project: **Agent → Figma write channel → Figma design → Vue code → browser → pixel-level visual regression**.

No paid Figma "Write to Canvas", no MCP-based writes — a local write channel is self-built and used to create 4 real UIs (1 design system + 3 full pages) on a real Figma canvas, one of which is then ported to Vue3 + Tailwind and verified with a programmatic pixel diff.

### Architecture

See the diagram above. Protocol details and the 30 atomic ops: [`docs/bridge-architecture.md`](docs/bridge-architecture.md).

### Stages

| Stage | Scope | Key artifacts | Result |
|---|---|---|---|
| [1-2](stages/stage1-2-bridge-channel/) | Write channel + 30 atomic ops | bridge / plugin / cli | selftest 91/91, real-canvas assertions 35/35 |
| [3](stages/stage3-saas-dashboard/) | First real Vibe Design: SaaS Education Dashboard | 274 nodes / 10 components / 0 images | audit 42/42 |
| [4](stages/stage4-pixelflow-ai/) | Autonomous design loop: PixelFlow AI (dark) | 188 nodes / 17 components | audit 42/42 (self-detected & fixed) |
| [5](stages/stage5-elementadmin-figma/) | ElementAdmin recreation from a screenshot only (1920×1030) | 207 nodes / 25 programmatic VECTORs | audit 47/47, self-assessed 89/100 |
| [6](stages/stage6-vue-elementadmin/) | Figma → Vue3 + Tailwind → browser | Vite5 + Vue3.4 + Tailwind3.4 | two QA rounds 88→93/100 |
| [7](stages/stage7-visual-regression/) | Programmatic pixel-level visual regression | self-built diff tooling + 32-section report | Pixel Diff **5.691%** / SSIM **0.9037** / Final **92/100** |

### Repository Layout

See the tree above. `stages/` holds per-stage archives (each with a bilingual README: audit notes, geometry dumps, screenshots, diff data). `docs/communication-log.md` records what was asked and delivered per stage; `docs/lessons-learned.md` distills 30 verified lessons across architecture, Figma Plugin API, testing, and Windows tooling.

### Quick Start

```bash
node bridge/server.js          # start Bridge
node tools/selftest.js         # mock self-test (no Figma needed)
# Figma Desktop → Plugins → Development → Import manifest.json → run plugin
node tools/stage2-verify.js    # real-canvas assertions (plugin must be online)
cd stage6-element-admin && npm install && npm run dev   # http://127.0.0.1:5180
```

### Security

- `.vibe/token` (Bridge auth token) and all logs are gitignored and not committed.
- Bridge binds loopback only; the plugin may only reach `localhost`.
