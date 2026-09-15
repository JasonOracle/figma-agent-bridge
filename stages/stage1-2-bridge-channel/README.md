# Stage 1-2 · 通道建设与原子操作 / Bridge Channel & Atomic Ops

## 中文

**目标**：不使用 Figma 官方付费 Write to Canvas，自建一条 `WorkBuddy Agent / CLI → 本地 Bridge → Figma Development Plugin → Figma Plugin API` 的真实画布写入通道。

**阶段 1（通道）成果**
- `bridge/server.js`：本地 Bridge，仅绑回环地址（127.0.0.1 + ::1），token 认证，`POST /v1/command` 同步语义（插件真正执行完才返回）
- `plugin/ui.html` + `plugin/code.js`：Figma 开发插件。UI iframe 是唯一能发 HTTP 的一层，负责 long-poll Bridge 并 postMessage 给主线程执行
- `cli/figma-vibe.js`：命令行入口
- 关键防御：UI 侧「握手门」（未运行在 Figma 内则永久惰性）+ Bridge 侧「客户端注册制」（未注册的 poll 一律 403），杜绝了「假插件截胡命令」的假阳性
- Bridge waiter 存活检查 + 死 long-poll 清扫，命令宁可诚实报 `NOT_PICKED_UP` 也不静默丢失

**阶段 2（30 个原子操作）成果**
- 五组能力：节点 / 样式 / 文本 / Auto Layout / 结构（create-component / create-instance）
- CLI `buildCommand` 重构为声明式命令表（表驱动，新命令 = 一行声明）

**验证证据**
| 测试 | 结果 |
|---|---|
| `tools/selftest.js`（mock 插件 + CLI --dry 断言） | 91/91 通过 |
| `tools/stage2-verify.js`（真实画布 35 项断言，无 mock） | 35/35 通过 |
| 真实画布节点 | frame `9:2`(1440×900) + rect/text/ellipse/component/instance/clone 全部经回读确认 |

**复现方式**
```bash
node bridge/server.js                # 启动 Bridge
node tools/selftest.js               # mock 自测（不需要 Figma）
# Figma Desktop → Plugins → Development → Import manifest.json → 运行插件
node tools/stage2-verify.js          # 真实画布断言（需要插件在线）
```

## English

**Goal**: Build a real write-to-canvas channel `WorkBuddy Agent / CLI → local Bridge → Figma Development Plugin → Figma Plugin API`, avoiding the paid official "Write to Canvas".

**Stage 1 (channel)**: local Bridge (loopback-only, token auth, synchronous command semantics), Figma dev plugin (UI iframe long-polls the Bridge and posts messages to the main thread), CLI entry. Key defenses: a UI-side "handshake gate" (page stays inert unless hosted by Figma) and a Bridge-side client registry (unregistered polls get 403) — eliminating false-positive "fake plugin" command hijacks. Dead long-poll waiters are pruned; commands honestly report `NOT_PICKED_UP` instead of being silently dropped.

**Stage 2 (30 atomic ops)**: node / style / text / auto-layout / structure groups; CLI refactored to a declarative command table.

**Evidence**: selftest 91/91 (mock + `--dry` assertions), 35/35 real-canvas assertions via read-back, real nodes `9:2`/`9:4`/`9:5`/component/instance/clone verified on the actual canvas.
