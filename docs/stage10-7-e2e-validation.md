# Stage 10.7 — 用户视角 E2E 验证（安装即用）

目的：完全模拟一个**新用户**（不了解内部架构）从安装到首次产出设计的完整走查，验证"5 分钟内完成首次运行"。

环境基线（本机实测，2026-09-15）：
- WorkBuddy + ai-ui-designer Skill（skills/ai-ui-designer/）
- Figma Desktop + Vibe Bridge 插件（manifest.json + plugin/）
- figma-context（figma-developer-mcp，~/.workbuddy/mcp.json）

---

## Step 1 — 安装 Skill（用户操作，≈1 分钟）

动作：WorkBuddy 内安装 Skill。
用户需要知道什么：**什么都不用**——不需要知道 Skill 内部有五层、Adapter、Executor。

## Step 2 — 配置 Figma（用户操作，≈3 分钟，只需一次）

动作（SETUP.md Step 2 的三件事）：
1. Figma 导入插件（Plugins → Development → Import plugin from manifest… → 选 `manifest.json`）
2. `npm run bridge` 启动 Bridge，复制终端打印的 token
3. Figma 中运行插件，粘贴 token，Connect

用户需要知道什么：只跟着 SETUP.md 抄命令，不理解 token 机制也没关系。

## Step 3 — 自检（用户操作，≈10 秒）

```
node tools/runtime-check.mjs
```

实测输出（本机）：

```json
{
  "figmaRead": true,
  "figmaWrite": true,
  "executor": "figma-plugin-bridge",
  "mode": "FULL_MODE",
  "details": {
    "bridge": { "reachable": true, "pluginConnected": true, "editorType": "figma" },
    "figmaMcp": { "available": true, "servers": ["figma-context"] }
  }
}
```

判定：**FULL_MODE** → 五层全链路可用。用户不需要理解这个 JSON，只需要看 `mode` 一行。

## Step 4 — 输入 Prompt（用户操作，≈5 秒）

> 设计一个现代 AI 健康管理 App 首页

## Step 5–10 — Skill 自动执行（Agent 操作，用户只做 2 次确认）

| # | 产物 | 模式 | 用户动作 |
|---|---|---|---|
| 5 | design-brief.json（L1） | 自动 | **确认门 ①**：Brief 合理性（点一次"确认"） |
| 6 | design-system-spec.json（L2） | 自动 | **确认门 ②**：Token/组件决策（点一次"确认"） |
| 7 | build-plan.json（L3 计划） | 自动 | 无 |
| 8 | Figma 页面（L3 执行） | 自动绘制 | 无（可在 Figma 中围观） |
| 9 | critic-report.json（L4，≤3 轮循环） | 自动 | 无（仅当 3 轮不达标才转人工） |
| 10 | export-manifest.json + PNG/SVG（L5） | 自动 | 无 |

预期产物清单（Stage 10.5 实测基线可对照 `docs/stage10-5-l3-generation-validation.md`）：
- `.vibe/stage10-5/design-brief.json`、`design-system-spec.json`、`build-ids.json`、`qa-report.json`、`critic-report`（评分记录）、`export-manifest.json`、`screenshots/*.png|svg`

## Step 11 — 验收（用户操作，≈1 分钟）

用户打开 Figma 看页面、打开 PNG 确认。完成。

---

## 时间核算

| 阶段 | 耗时 | 其中用户操作 |
|---|---|---|
| 首次安装（Step 1–3） | ≈4 分钟 | 全部（一次性） |
| 首次运行（Step 4–11） | ≈5–8 分钟（视 3 确认响应） | 2 次点击 + 1 次查看 |
| **二次运行** | ≈3–5 分钟 | 2 次点击 |

**结论：首次运行（环境就绪后）≤5 分钟成立；安装是一次性成本 ≈4 分钟。**

## 走查中发现的问题与处理

1. **插件不会热更新**：改插件代码后必须手动重跑（Plugins → Development → Vibe Bridge (Dev)）。→ 已写入 SETUP.md 故障排查表。
2. **Bridge 在跑 ≠ 能写**：`/health` 可达但 `plugin.connected=false` 时画不了。→ 探针以 `plugin.connected` 为写能力判据，避免假 FULL_MODE。
3. **三次确认中的两次（Brief/Spec 门）是流程要求而非技术限制**：若用户嫌慢，可在 Prompt 中预授权（"确认门自动通过"），属用户选择而非降级。
4. **READ_ONLY_MODE 提示语**已按规格固定为："当前环境只有读取能力，需要安装 Figma Bridge 才能自动绘制"（探针 `details.hints` 同步输出，保证 Agent 口径一致）。

## 模式覆盖说明

本机实测覆盖 FULL_MODE。READ_ONLY / OFFLINE 的降级行为由 `runtime-capability.md` §3–§4 契约约束，并在 `tools/stage10-7-install-qa.py` 中做契约级校验（探针输出形状、hints 文案、mode 枚举），三条路径的执行差异是纯逻辑分支，无新增 I/O。
