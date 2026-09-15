# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## [1.0.0] - 2026-09-16

首个公开发布版本。架构自本版本起冻结（Release Freeze）：不再新增架构层 / MCP / Bridge 能力 / 设计规则。

### 新增

- **五层 AI UI 设计流水线**：自然语言 → Design Brief（L1）→ Design System Spec（L2）→ Figma 自动构建（L3）→ Visual Critic 五维评分与自动修复循环（L4，≤3 轮）→ Export 交付（L5：PNG / SVG / Figma JSON / Design Spec / Frontend Mapping）
- **L0 运行模式自动判定**：FULL_MODE / READ_ONLY_MODE / OFFLINE_MODE 三级探测与逐层降级，未执行的层不假装执行
- **设计智能规则库**：中文行业映射（医疗 / 政务大屏 / 企业后台 / 教育）、风格路由（premium-saas 等）、Token 派生白名单与来源追溯
- **随包 Figma 插件**（`figma-plugin/`，自包含）与零依赖本地桥接程序（`bridge/`，仅 Node 内置模块）
- **交付 Schema 体系**：Brief / DS Spec / Critic Report / Export Manifest 四类 JSON Schema（draft-07）
- **三个行业 few-shot 示例**（企业后台 / 医疗 App / 政务大屏），已脱敏并自包含
- **用户文档三件套**：README（产品语言）/ SETUP（5 分钟安装，含 Windows·macOS 差异）/ USER_GUIDE（首跑教程）
- **发布卫生工具**：release-checklist、敏感信息扫描脚本、清洁环境首跑模拟脚本

### 质量

- 端到端真实 E2E 验收通过（新用户一句话 → Figma 成稿 → 导出，INSTALL_READY=YES）
- 发布前检查 25/25 通过；存量 QA 回归全绿（10.4: 47/0，10.6: 90/0，10.7: 652/0，安装体验: 56/0）

### 已知限制

- Figma 插件修改后不热更新，需重新运行插件
- Bridge 对 `create-text` 非法 `parentId` 静默落到画布根级（建议后续版本加参数校验）
- READ_ONLY / OFFLINE 降级由探针与文档契约保证，未做破坏性 live 演练
