# figma-agent-bridge

**中文** | [English](README.en.md)

让 AI Agent 通过一条自建本地通道，直接读写真实 Figma 画布——从设计系统构建、整页高保真设计，到 Vue 代码还原与像素级视觉回归的**全链路开源实验**。

不使用 Figma 官方付费 Write to Canvas，不依赖任何 MCP 的写入能力，自建本地写入通道（HTTP Bridge + Figma 开发插件），并用它在真实 Figma 画布上完成了 7 个真实 UI（1 个设计系统 + 6 个完整页面），把其中一个转成 Vue3 + Tailwind 网页，做了程序化像素级视觉回归与真实浏览器交互回归。

> Roadmap：项目正在向 **MCP Server** 与 **Agent Skills** 形态演进，见 [Roadmap](#-roadmap--路线图)。

---

## 架构 / Architecture

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

详细协议、34 个原子操作与排错表见 [`docs/bridge-architecture.md`](docs/bridge-architecture.md)。

## 九个阶段 / Nine Stages

| 阶段 | 内容 | 关键产物 | 结果 |
|---|---|---|---|
| [Stage 1-2](stages/stage1-2-bridge-channel/) | 写入通道 + 34 个原子操作 | bridge / plugin / cli | selftest 91/91，真实画布断言 35/35 |
| [Stage 3](stages/stage3-saas-dashboard/) | 首个真实 Vibe Design：SaaS 教育仪表盘 | 274 节点 / 10 组件 / 0 IMAGE | audit 42/42 |
| [Stage 4](stages/stage4-pixelflow-ai/) | Agent 自主设计闭环：PixelFlow AI 暗色工具 | 188 节点 / 17 组件 | audit 42/42（自查补漏） |
| [Stage 5](stages/stage5-elementadmin-figma/) | 仅凭截图高还原 ElementAdmin（1920×1030） | 207 节点 / 25 程序化 VECTOR | audit 47/47，自评 89/100 |
| [Stage 6](stages/stage6-vue-elementadmin/) | Figma → Vue3 + Tailwind → 浏览器 | Vite5 + Vue3.4 + Tailwind3.4 | 两轮 QA 88→93/100 |
| [Stage 7](stages/stage7-visual-regression/) | 程序化像素级视觉回归 | 自研 diff 工具 + 32 节报告 | Pixel Diff **5.691%** / SSIM **0.9037** / Final **92/100** |
| [Stage 8](stages/stage8-interaction-regression/) | 真实浏览器事件交互回归（40 项） | Playwright 交互矩阵 + 证据截图 | PASS 24 / FAIL 0 / READY FOR STAGE 9 |
| [Stage 9](stages/stage9-product-expansion/) | 产品化扩展：IA 规划 + 设计系统 + 多页面 | 25 个 native DS 组件 + User List / Exam List / Exam Detail / Settings | 各项审计全绿，新增正式组件 0 |

## 目录结构 / Repository Layout

```
├── bridge/          本地 Bridge（Node 内置模块，零 npm 依赖）
├── plugin/          Figma 开发插件（manifest + code.js + ui.html）
├── cli/             figma-vibe CLI（声明式命令表）
├── tools/           selftest / verify / probe / build / audit 脚本
├── examples/        命令示例 JSON
├── stage6-element-admin/   Stage 6 Vue3 + Tailwind 项目（回归实验对象）
├── stages/          ★ 各阶段产物归档（每阶段 README、审计 JSON、几何 dump、截图、diff 数据）
│   ├── stage1-2-bridge-channel/
│   ├── stage3-saas-dashboard/
│   ├── stage4-pixelflow-ai/
│   ├── stage5-elementadmin-figma/
│   ├── stage6-vue-elementadmin/
│   ├── stage7-visual-regression/
│   ├── stage8-interaction-regression/
│   └── stage9-product-expansion/   （含 data/ 下 17 份审计 JSON）
├── docs/
│   ├── bridge-architecture.md     通道架构与协议
│   ├── stage7-visual-regression.md  32 节视觉回归报告（可独立审阅）
│   ├── stage8-interaction-regression.md  40 项交互回归矩阵
│   ├── stage9-*.md                IA / 设计系统 / 9.2-A / 9.2-B 报告
│   ├── communication-log.md       ★ 各阶段沟通记录
│   └── lessons-learned.md         ★ 经验教训（中英标题）
└── .vibe/           运行时状态（token 不入库；审计数据已归档至 stages/）
```

## 快速开始 / Quick Start

```bash
# 1. 启动 Bridge
node bridge/server.js

# 2. mock 自测（不需要 Figma）
node tools/selftest.js

# 3. Figma Desktop → Plugins → Development → Import manifest.json → 运行插件

# 4. 真实画布验证（需要插件在线）
node tools/stage2-verify.js

# 5. Stage 6 前端（回归实验对象）
cd stage6-element-admin && npm install && npm run dev   # http://127.0.0.1:5180
```

## 安全 / Security

- `.vibe/token`（Bridge 鉴权令牌）与所有日志已被 `.gitignore` 排除，不入库。
- Bridge 只绑回环地址 `127.0.0.1`；插件只允许访问 `localhost`。
- 文档与审计数据中的 "token" 均指设计令牌（颜色/字号 token），非鉴权凭据。

## 核心结论 / Headline Results

- **通道可靠性**：命令同步语义 + waiter 存活检查 + 客户端注册制，消灭静默丢命令与假阳性。
- **设计还原**：仅凭截图在 Figma 还原 ElementAdmin 自评 89/100；转 Vue 后与 Figma 渲染基准像素 Diff 5.691%（SSIM 0.9037，Final 92/100），布局骨架与全部 17 个颜色 token 0px 差异。
- **交互回归**：40 项真实浏览器事件 24 PASS / 0 FAIL。
- **产品化**：在全新 Figma 文件程序化构建 25 个 native DS 组件与 4 个业务页面，复用率 100%（新增正式组件 = 0）。
- 全部经验沉淀在 [`docs/lessons-learned.md`](docs/lessons-learned.md)，全部阶段沟通在 [`docs/communication-log.md`](docs/communication-log.md)。

## 🗺 Roadmap / 路线图

- [ ] **MCP Server**：把 Bridge 的 34 个原子操作封装为标准 MCP 工具（create-frame / set-auto-layout / run batch …），任何支持 MCP 的 Agent 均可直接操作 Figma 画布。
- [ ] **Agent Skills**：沉淀「截图还原」「设计系统构建」「像素级回归」三条可复用 Skill 工作流。
- [ ] **像素回归工具独立发包**：`pixel-diff.py` + 证据链生成器抽为独立 CLI 包。
- [ ] 欢迎提 Issue 讨论 API 设计与命名。

## License

MIT
