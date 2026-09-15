# Release Checklist — 发布前检查

逐项实测结果（2026-09-16，检查脚本见 `tools/stage11-release-check.py`，运行日志见 `docs/STAGE11-release-validation.md` §5）。

## 硬性项（全部通过才可分发）

- [x] **无硬编码个人路径** — 全目录扫描 `C:\Users\|/c/Users\|Administrator`：0 命中
- [x] **无个人 token** — 全目录扫描 token 字面值/`.vibe/token` 引用：0 命中（SETUP 中仅教学示意 `token: xxxx…`）；export 示例 `figmaFileKey` 已替换为 `EXAMPLE-FILE-KEY`
- [x] **无测试项目残留** — 无 `.vibe/` 运行时数据混入 Skill 目录；示例产物均为自包含拷贝（`assets/examples/export/files/`）
- [x] **无历史项目名称** — 扫描 `Stage 1x|stage10|stage7|stage5|ElementAdmin|e2e-final`：0 命中（唯一例外：`references/runtime-capability.md` 中 `service === "figma-vibe-bridge"` 为 Bridge 协议常量，探针判定依据，非项目名）
- [x] **examples 已脱敏** — 3 个 few-shot 示例的项目名已中性化（"企业考试管理平台"）、内部规则引用改为通用表述、引用文件全部内化为 Skill 相对路径
- [x] **docs 可以独立阅读** — README / SETUP / USER_GUIDE 不依赖仓库内其他文档即可完成安装与使用；SKILL.md / references 中的仓内 QA 脚本引用已改为通用描述
- [x] **新用户无需理解内部架构** — 首屏（README 前 30 行）无 MCP / Adapter / Executor / L1-L5 术语；SETUP 全程"照做即可"；USER_GUIDE 全程用户视角

## 结构项

- [x] **插件随包分发** — `figma-plugin/{manifest.json, code.js, ui.html}` 自包含（manifest 指向同目录文件），用户无需访问源仓库即可导入
- [x] **示例自包含** — export 示例引用的全部 PNG/SVG/JSON 位于 `assets/examples/export/files/`，路径在 Skill 目录内可解析
- [x] **平台差异说明** — SETUP 含 Windows/macOS 对照表（路径、防火墙、终端）
- [x] **常见错误处理** — SETUP 故障排查表 6 条（含新增"找不到 figma-plugin 目录"、"导入报错"两条分发场景）

## 质量门

- [x] 安装体验 QA：`tools/stage10-7-install-qa.py` 全绿（README/SETUP/USER_GUIDE/探针契约一致）
- [x] 存量回归：10.4（47/0）、10.6（90/0）、10.7-Export（652/0）全绿
- [x] 清洁环境模拟：`.vibe/release-test/` 全新目录首跑，无历史 build-id / 旧节点引用 / 旧 token（见 STAGE11 报告 §4）

## 已知不阻塞项

- Bridge 服务标识字符串 `figma-vibe-bridge` 为协议常量，改名需动 Bridge 核心（本阶段禁止），不阻塞分发
- 用户安装 Skill 后仍需一次性完成 Figma 插件导入（约 3 分钟），属产品形态固有成本，已在 SETUP/USER_GUIDE 充分引导
