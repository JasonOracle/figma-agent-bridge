# AI UI Designer 1.0.0 — 发布包

一句话输入，自动完成 AI UI 设计全流程：设计定位 → 设计系统 → Figma 自动绘制 → 五维视觉审查（不达标自动修复，最多 3 轮）→ PNG / SVG / 交付清单导出。

## 怎么用（3 步）

**安装单元是 `skills/ai-ui-designer/` 这个技能目录 —— 它自包含，复制过去就能用。**

1. **装技能**：把 `skills/ai-ui-designer/` 整个复制到你的技能目录
   - WorkBuddy：`~/.workbuddy/skills/ai-ui-designer/`
   - CodeBuddy CLI：`~/.codebuddy/skills/ai-ui-designer/`
2. **连 Figma**（一次性，约 3 分钟）：见 `skills/ai-ui-designer/SETUP.md`
3. **说一句话**：

   > 帮我设计一个现代 AI 健康管理 App 首页，要有健康评分、趋势图、健康建议和底部导航，整体高级简洁，适合 iPhone。

完整教程见 `skills/ai-ui-designer/USER_GUIDE.md`。

## 包内有什么

| 路径 | 说明 |
|---|---|
| `skills/ai-ui-designer/` | **技能本体（自包含）**：文档 + `figma-plugin/`（Figma 插件）+ `bridge/`（本地桥接，零依赖）+ `tools/`（运行环境自检）+ `references/` + `assets/` |
| `CHANGELOG.md` | 版本变更记录 |
| `LICENSE` | MIT（技能目录内另有一份，便于单独分发） |
| `RELEASE-MANIFEST.json` | 逐文件 SHA-256 清单 |

无需 `npm install`：桥接程序只使用 Node.js 内置模块（需 Node.js ≥ 18）。
