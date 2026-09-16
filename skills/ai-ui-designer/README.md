# AI UI Designer Skill

一句话：**你只说"设计一个 AI 医疗 App 首页"，它自动完成从设计定位到 Figma 成稿再到质量审查与交付文件的全过程。**

安装后你只需要告诉 AI 你想设计什么——行业风格、配色、字体、组件、页面结构，全部由 Skill 自动推导；生成结果会经过自动视觉审查，不达标会自动修复并复检。

## 它能做什么

| 你输入 | 你得到 |
|---|---|
| "设计一个现代 AI 健康管理 App 首页" | 设计定位文档 → 设计系统 → **Figma 页面（自动绘制）** → 视觉质量审查报告 → PNG / SVG / 交付清单 |
| "设计一个河南高速智慧养护大屏" | 同上，自动套用政务大屏暗色风格与行业色板 |
| "设计一个企业后台 Dashboard" | 同上，自动套用企业级中后台风格 |

支持中文行业语义（医疗 / 政务 / 教育 / 企业后台等），配色与风格来自内置行业映射规则，不随机、不套模板。

## 5 分钟上手

完整步骤见 **[SETUP.md](SETUP.md)**，使用教程见 **[USER_GUIDE.md](USER_GUIDE.md)**。极简版：

1. 把这个技能目录复制到你的技能目录：WorkBuddy `~/.workbuddy/skills/`，或 CodeBuddy CLI `~/.codebuddy/skills/`（目录自包含，复制即可用）
2. Figma Desktop 导入随附插件（技能目录内 `figma-plugin/`），并在**技能目录内**启动本地桥接程序 `node bridge/server.js`，把终端打印的 token 粘进插件（约 3 分钟，一次性）
3. 在技能目录内运行 `node tools/runtime-check.mjs` 自检
4. 直接说："设计一个 AI 医疗 App 首页"

> 不装 Figma 插件也能用：Skill 会输出完整设计文档（定位 / 设计系统 / 构建计划），只是不会自动画进 Figma。

## 目录

- `SETUP.md` — 安装指南（普通用户视角，5 分钟）
- `USER_GUIDE.md` — 使用教程（第一次运行全流程走查）
- `SKILL.md` — Agent 执行手册（设计流水线规则）
- `references/` — 设计智能规则（行业映射 / 视觉审查 / 映射规则 / 运行模式判定）
- `assets/templates/` — 各类交付物的 JSON Schema
- `assets/examples/` — 三个行业的完整示例（企业后台 / 医疗 App / 政务大屏）
- `figma-plugin/` — 随技能分发的 Figma 插件（导入用）
- `bridge/` — 本地桥接程序（零依赖，仅用 Node 内置模块；`node bridge/server.js`）
- `tools/` — 运行环境自检探针（`node tools/runtime-check.mjs`）

## 运行模式（自动判定，无需配置）

Skill 每次启动会用技能目录内的 `tools/runtime-check.mjs` 探测环境，自动选择能跑多少跑多少：

| 模式 | 条件 | 执行范围 |
|---|---|---|
| **FULL_MODE** | Figma 插件已连接 | 全流程：设计 → 自动绘制 → 审查 → 导出 |
| **READ_ONLY_MODE** | 只有 Figma 读取类 MCP | 设计文档 + 构建计划；提示"当前环境只有读取能力，需要安装 Figma Bridge 才能自动绘制" |
| **OFFLINE_MODE** | 均无 | 仅生成设计文档三件套，诚实标注未执行 |

任何模式都**不会假装执行**——没跑的步骤会明确说没跑。

## 技术边界（可选阅读）

Skill 是设计大脑，只产出 JSON 契约与构建计划；对 Figma 的实际读写由你环境里的现有通道完成（随包插件 + 本地桥接程序，或市场已有的 Figma MCP）。**本 Skill 不开发、不替代任何 MCP。**
