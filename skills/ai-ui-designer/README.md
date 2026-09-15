# AI UI Designer Skill

一句话：**你说"设计一个 AI 医疗 App 首页"，它自动产出设计 Brief → 设计系统 → Figma 页面 → 视觉审查 → 可交付导出物。**

对标 UI-UX-Pro-Max（设计规范）、frontend-design（审美规则）并增强：中文行业映射 + 五层闭环 + 自动视觉批评。不依赖任何私有 Figma 协议——Figma 连接走你环境里已有的通道。

## 它能做什么

| 你输入 | 你得到 |
|---|---|
| "设计一个现代 AI 健康管理 App 首页" | design-brief.json → design-system-spec.json → build-plan.json → **Figma 页面（自动绘制）** → critic-report.json → export-manifest.json + PNG/SVG |
| "设计一个河南高速智慧养护大屏" | 同上，自动套用政务大屏暗色风格与行业色板 |

五层流水线：**L1 Brief → L2 DS Spec → L3 Figma Build → L4 Visual Critic → L5 Export**。

## 三种运行模式（自动判定，无需配置）

Skill 启动时用 `tools/runtime-check.mjs` 探测环境（详见 `references/runtime-capability.md`）：

| 模式 | 条件 | 执行范围 |
|---|---|---|
| **FULL_MODE** | Figma Bridge 插件已连接 | 五层全链路，页面自动画进 Figma |
| **READ_ONLY_MODE** | 只有 Figma 读取类 MCP | L1→L2 + Build Plan；提示"当前环境只有读取能力，需要安装 Figma Bridge 才能自动绘制" |
| **OFFLINE_MODE** | 均无 | 仅生成设计资产三件套（Brief / DS Spec / Build Plan），诚实标注未执行 |

任何模式都**不会假装执行**——没跑的层会明确说没跑。

## 5 分钟上手

完整步骤见 **[SETUP.md](SETUP.md)**。极简版：

1. 在 WorkBuddy 中安装本 Skill（你已做到这一步）
2. Figma Desktop 导入随附插件（`plugin/` + `manifest.json`），启动 Bridge 并粘贴 token（3 分钟）
3. 运行 `node tools/runtime-check.mjs` 确认输出 `FULL_MODE`
4. 直接说："设计一个 AI 医疗 App 首页"

## 目录

- `SKILL.md` — Agent 执行手册（五层流水线规则）
- `SETUP.md` — 安装指南（普通用户视角）
- `references/` — 设计智能规则（design-intelligence / visual-critic / critic-mapping / export-mapping / runtime-capability / brief-schema）
- `assets/templates/` — Brief / DS Spec / Critic Report / Export Manifest Schema
- `assets/examples/` — few-shot（saas / health / highway 三行业）

## 架构边界（一句话）

Skill 是大脑，只产出 JSON 契约；写通道 = Figma Plugin Bridge（Executor），读通道 = figma-developer-mcp 等（可选 Executor）；Adapter 做方言翻译与能力探测。**本 Skill 不开发、不替代任何 MCP。**
