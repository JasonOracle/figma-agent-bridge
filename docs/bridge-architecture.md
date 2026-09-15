# figma-vibe-bridge

本地写入通道：**WorkBuddy / CLI → 本地 Bridge → Figma Development Plugin → Figma Plugin API**

不使用 Figma 官方付费 Write to Canvas，不依赖任何 MCP 的写入能力，零 npm 依赖（仅用 Node 内置模块）。

```
WorkBuddy / figma-vibe CLI
        │  HTTP POST /v1/command   (?token=…)
        ▼
   Bridge  (127.0.0.1:45677, 仅回环, token 认证)
        │  HTTP GET /v1/poll  ← long-poll，插件主动来取
        ▼
   Figma Plugin UI (iframe)      ←—— 唯一有网络能力的一层
        │  postMessage
        ▼
   Figma Plugin main thread  →  Figma Plugin API  →  真实画布节点
```

---

## 目录结构

| 路径 | 作用 |
|---|---|
| `manifest.json` | Figma Development Plugin 清单（`api 1.0.0`、`documentAccess: dynamic-page`、`networkAccess` 允许回环） |
| `plugin/code.js` | 插件主线程：唯一能调 Plugin API 的地方（30 个原子操作，见下方「命令 ↔ Plugin API 映射」） |
| `plugin/ui.html` | 插件 UI iframe：唯一能发 HTTP 的地方，long-poll 拉命令并回传结果 |
| `bridge/server.js` | 本地 Bridge：只绑 `127.0.0.1`（附带 `::1`，让 `localhost` 也能解析） |
| `cli/figma-vibe.js` | CLI：声明式命令表，覆盖节点 / 样式 / 文本 / Auto Layout / 结构五组 |
| `tools/mock-plugin.js` | 协议测试替身（**不是**真插件，返回 `MOCK:` 开头的假 id） |
| `tools/selftest.js` | 自动化自测：拉起 Bridge + mock 插件，74 项断言（只证明协议，不碰 Figma） |
| `tools/stage2-verify.js` | **真实 Figma** 验证：驱动真插件写画布并回读断言，35 项，要求插件在线 |
| `examples/vibe-test.json` | 批量指令示例（frame + 一个子节点） |
| `examples/stage4.json` | 第四阶段用的批量指令：把 rect + text 放进**同一个** frame |
| `.vibe/token` | 持久化的临时 token（首次启动 Bridge 时自动生成） |

---

## 启动 Bridge

```bash
cd C:\Users\Administrator\figma-vibe-bridge
node bridge/server.js
```

- 只监听 `127.0.0.1:45677`（外加 `[::1]`，两者都是回环）
- token 从 `.vibe/token` 读取（已生成），可用 `--token <t>` 覆盖
- 换端口：`node bridge/server.js --port 45678`（同时要用 `--port` 传给 CLI）

---

## 在 Figma Desktop 里加载插件（需手动操作一次）

1. 打开 Figma Desktop → 你的空白 Design File
2. 菜单 **Plugins → Development → Import plugin from manifest…**
3. 选择文件：`C:\Users\Administrator\figma-vibe-bridge\manifest.json`
4. 再进 **Plugins → Development → Vibe Bridge (Dev)** 运行
5. 插件面板应显示 **绿点 + connected**

> 插件面板里已预填好 URL 与 token。若显示 offline，点 **Connect** 重连。

### 改了插件代码后，怎么让它生效

Figma **不会热更新已加载的插件**，也**不会**在你重跑 Bridge 后自动重载插件 UI。
`plugin/code.js` 或 `plugin/ui.html` 改动后，必须让插件重新运行一次：

| 方式 | 操作 | 说明 |
|---|---|---|
| 1. 快捷键重跑 | `Ctrl + Alt + P` | 重新运行上一个插件。最快。 |
| 2. 菜单重跑 | Figma 菜单 → **Plugins → Development → Vibe Bridge (Dev)** | 最可靠。插件已在运行时先关掉面板再点。 |
| 3. 热重载 | **Plugins → Development → Hot reload plugin** | 勾选后文件一改就自动重载，开发时首选。 |

**重跑成功的标志**（`ui.html` 引入握手门之后新增，旧版没有这一行）：

```
client id: cxxxxxxxxxxx
main thread answered · page "Page 1" · ops: ping, get-page-summary, ...
registered with bridge as cxxxxxxxxxxx · http://localhost:45677
```

只看到 `waiting for Figma host…` 并最终变成 `not hosted by Figma`，说明这份页面
不是在 Figma 里跑的（例如被浏览器打开了），它会永久保持惰性、绝不轮询 Bridge。

重跑后 client id 会变（每次加载随机生成），属正常；旧 id 会从 Bridge 的
`registered` 列表里自然淘汰，无需手动清理。

---

## CLI 用法

```bash
# 连接状态
node cli/figma-vibe.js status

# 建 Frame 1440x900
node cli/figma-vibe.js create-frame --name "Vibe Design Test" --width 1440 --height 900

# 建 Text
node cli/figma-vibe.js create-text --text "Hello Vibe Design" --size 48 --x 100 --y 260 --parent <frameId>

# 建矩形 300x100
node cli/figma-vibe.js create-rect --name "Vibe Rect" --width 300 --height 100 --x 100 --y 100 --parent <frameId>

# 批量（一次 round-trip，逐个顺序执行）
node cli/figma-vibe.js run examples/vibe-test.json

# 回读画布做验证
node cli/figma-vibe.js page
```

批量指令里 `"parentId": "@last"` 表示"放进**上一步**刚创建的那个节点"。

> ⚠️ **`@last` 只能嵌一层。** 想把多个兄弟节点放进同一个 Frame，必须在
> `create-frame` 的返回里拿到 frame id，再用 `"parentId": "<frameId>"` 显式传入
> （见 `examples/stage4.json`）。写成"frame → rect(@last) → text(@last)"是错的：
> 第三步的 `@last` 指向的是 **rect**，不是 frame。

Windows 下也可用 `figma-vibe.cmd`（cmd/PowerShell）或 `./figma-vibe`（Git Bash）代替 `node cli/figma-vibe.js`。

---

## 命令 ↔ Figma Plugin API 映射

每个 CLI 命令最终都落到一个真实的 Plugin API 调用上，**没有任何 mock 分支**：
命令要么由真插件执行并返回真实 node id，要么明确失败。

### 节点

| CLI 命令 | Plugin API |
|---|---|
| `create-frame` | `figma.createFrame()` + `resize()` + `appendChild()` |
| `create-rect` | `figma.createRectangle()` |
| `create-ellipse` | `figma.createEllipse()` |
| `create-line` | `figma.createLine()`（长度走 `resize(len, 0)`） |
| `create-text` | `figma.createText()` + `loadFontAsync()` |
| `delete-node` | `node.remove()` |
| `duplicate-node` | **`node.clone()`** —— 不是 `duplicate()`，见排错表 |
| `move-node` | `node.x` / `node.y`（支持绝对 `--x --y` 与相对 `--dx --dy`） |
| `resize-node` | `node.resize(w, h)` |

### 样式

| CLI 命令 | Plugin API |
|---|---|
| `set-fill` | `node.fills = [SOLID]`（`--clear` 置为 `[]`） |
| `set-stroke` | `node.strokes` + `node.strokeWeight` |
| `set-opacity` | `node.opacity` |
| `set-corner-radius` | `node.cornerRadius`，或四角独立 `topLeftRadius` 等 |

### 文本

| CLI 命令 | Plugin API |
|---|---|
| `set-font` | `loadFontAsync()` + `node.fontName` |
| `set-font-size` | `node.fontSize`（先加载当前字体） |
| `set-font-weight` | 候选 style 名逐个 `loadFontAsync()` 试探 → `node.fontName` |
| `set-text-color` | `node.fills` |
| `set-text-content` | `node.characters`（先加载字体） |

### Auto Layout

| CLI 命令 | Plugin API |
|---|---|
| `set-auto-layout` | `node.layoutMode`（可选 `itemSpacing` / 四边 padding / `*AxisSizingMode`） |
| `set-padding` | `node.paddingTop/Right/Bottom/Left` |
| `set-item-spacing` | `node.itemSpacing` |
| `set-primary-axis-align` | `node.primaryAxisAlignItems` |
| `set-counter-axis-align` | `node.counterAxisAlignItems` |

### 结构

| CLI 命令 | Plugin API |
|---|---|
| `append-child` | `parent.appendChild(child)` |
| `create-component` | `figma.createComponentFromNode(node)`（源节点被消耗，返回的是新组件） |
| `create-instance` | `component.createInstance()` |

### 批量

| 能力 | 说明 |
|---|---|
| `run` | 顺序执行 `ops`，任一步失败立刻停止，并回报**已成功**的步骤 |
| `@last` | 指向上一步创建的节点；可用于任意 id 字段（`id` / `parentId` / `childId` / `componentId` / `from` …）。写在非 id 字段（如 `name`）会被明确拒绝，而不是静默生效 |

> **两个必须知道的 Figma 约束**（都在真实画布上踩到过）：
> 1. `figma.loadFontAsync` 是文本写入的前置条件 —— 改 `characters` / `fontName` /
>    `fontSize` 前必须先加载当前字体，否则抛 "Cannot write to node with unloaded font"。
> 2. 字重的 style 名各家字体不一致（Inter 用 `Semi Bold`，有的用 `SemiBold`），
>    所以 `set-font-weight` 用「候选名逐个试探」而不是硬编码一种拼法。

---

## 行为保证

- **同步语义**：`POST /v1/command` 在插件真正执行完并回传结果之前不会返回。
  `queued` / `pending` **永远不会**被当成成功。
- **注册制**：`GET /v1/poll` 必须带上已注册的 `client` id（先用 `POST /v1/hello` 注册），否则返回 `403`。
  这样即使有人在浏览器里误开了 `plugin/ui.html`，它也拿不到命令、不会截胡。
- **握手门**：`plugin/ui.html` 必须先收到插件主线程回的 `vibe:ready` 才允许开始轮询。
  在 Figma 之外打开这个页面，它会显示 "not hosted by Figma" 并**永久保持惰性**。
- **投递前存活性检查**：Bridge 只把命令交给"socket 还活着"的 long-poll。
  客户端消失后残留的 long-poll 会被识别并丢弃（`prune`，另有 5s 定时清扫），
  命令宁可留在队列里报 `NOT_PICKED_UP`，也不会被写进一个死 socket 后凭空消失。
- **丢单告警**：命令投递出去 10s 没回来，Bridge 会打印 `warn ... deployed to client "xxx" but no result`，
  直接点名是哪个客户端吞了命令。
- **单 poll 循环保证**（插件 UI）：重连时旧循环的 long-poll 会被主动 abort，
  同一时刻只允许存在一个 poll 循环（generation 守卫）。
- 插件离线 → 立刻返回 `PLUGIN_OFFLINE`（exit 1），不会静默排队。
- 插件取走命令但没回结果 → `NO_RESULT`（HTTP 504）。
- 命令一直没被取走 → `NOT_PICKED_UP`（HTTP 504）。
- token 错误 → `UNAUTHORIZED`（HTTP 401）。
- 批量执行中途失败 → 返回 `partial`，列出已成功的步骤。
- 退出码：`0` 成功，`1` 出错/超时，`2` 用法错误。

---

## 测试

### 自动化自测（不需要 Figma）

```bash
node tools/selftest.js
```

自用独立端口 45699，不影响正式 Bridge。**91 项断言**，覆盖：

- 五组原子操作的协议往返（C2–C6），以及 CLI 参数 → JSON 的映射（用 `--dry` 断言）
- 反向用例：队列里的命令绝不报成功、错误 token 被拒、未知 op 报 `UNSUPPORTED_OP`
- 回归守卫：未注册客户端不能偷命令、死掉的 long-poll 不能吞命令（G / I / J 段）
- `@last` 批量串联；`@last` 写在非 id 字段（如 `name`）时必须被拒绝
- 第三阶段 6 个新 op 的 CLI 映射与真往返（C7 / C8 段），含 `$name` 批内引用

> ⚠️ 自测跑绿**只证明 Bridge/CLI 协议链路可用**，它完全不接触 Figma，
> 不能作为"画布真的被写入"的证据。

### 真实 Figma 端到端验证（需要插件在线）

```bash
node tools/stage2-verify.js            # 默认 x 偏移 1700
node tools/stage2-verify.js --x 2400   # 换位置，避免和上一次重叠
```

**35 项断言，全部基于真插件的回读。** 脚本强制要求插件在线（否则直接失败退出），
因为它全程不引入 mock —— 结果里不可能出现 `MOCK:` 前缀的 id。断言内容：

- 返回的 node id 是真实 Figma id，`parentId` 指向指定的 frame
- 节点真实存在（按 id 逐个回读）
- frame 内部确实包含预期数量的子节点，且**每个**子节点的 `parentId` 都等于该 frame
- 写入的属性真的落地：`fills` / `cornerRadius` / `fontSize` / `fontName` / `strokes` / `opacity`
- Auto Layout 真的写入：`layoutMode` / `itemSpacing` / 四边 `padding` / 两个轴的对齐
- 组件与实例：`create-component` 真的返回 COMPONENT，`create-instance` 真的返回 INSTANCE

---

## 第三阶段：真实 Vibe Design（SaaS 教育仪表盘）

一次完整的设计落地：Design System 画板 + 1440×900 仪表盘，全部为真实 Figma 原生节点（0 个 IMAGE）。

```bash
node tools/stage3-probe.js             # 真画布探测：CJK 字体 / 6 个新 op / 嵌套实例覆写
node tools/stage3-build.js --stage all # 全量构建（支持 --stage <name> 单阶段、--teardown）
node tools/stage3-audit.js             # 设计评审 + 组件审计（42 项断言，读回真画布）
```

产物与文档：

- 画布命名空间：`Design System / SED`（x=4200）与 `SaaS Education Dashboard`（x=5200），不触碰一、二阶段测试节点
- `docs/stage3-ia.md` — IA / 交互规划（figma-user-flow-planner + figma-prototype-plan 产出）
- `docs/stage3-figma2code.md` — Vue 3 + Tailwind 转换分析（组件树、令牌映射、图表还原策略）
- `.vibe/stage3-review.md` — 审计报告（42/42 通过）

阶段化构建的关键机制：

- **状态断点续跑**：`.vibe/stage3-state.json` 记录节点 id 映射与 `__done_<stage>` 标记，单阶段可重复执行
- **批量内引用**：`as`/`$key` 在同一 batch 内前后引用；**延迟覆写**（`ovr` + `applyOverrides`）解决"实例子节点在创建批次之后才存在"的引用问题（页面共用 83 处嵌套实例文本覆写）
- **超时不可重试**：CLI 超时只代表"信息缺失"不代表"没有副作用"，重试已执行的大 batch 会复制节点——重试仅允许在确认零副作用（如连接层 `Unable to establish connection`）时进行

### 已知能力缺口（如实记录，未用图片/mock 掩盖）

- **无法向实例插入/替换子节点**（无 component-swap、无 variants 切换 op）：侧边栏 7 个导航项因此是带真实矢量图标的原生 frame 而非 Nav Item 实例；`Nav Item` / `Nav Item / Active` 两个组件保留在 DS 画板作为模式文档
- 大 batch（365 op）在插件侧执行可达 ~100s，CLI 超时需相应放大

### 本阶段新增 op（6 个，均有真画布测试）

`create-vector`（真实可编辑矢量路径）、`set-effects`（投影/模糊）、`set-text-align`、`set-text-autoresize`、`set-layout-sizing`（FIXED/HUG/FILL）、`set-name`；另 `set-stroke` 支持 `clear:true`、`create-frame` 支持 `parentId/fill/clips`、batch 支持 `as`/`$key`。`set-fill` / `set-stroke` 的 `clear` 与 `fill:null` 语义用于清除 Figma 默认的 `#D9D9D9` 填充与黑色描边残留。

---

## 已知风险点 / 排错

| 现象 | 处理 |
|---|---|
| Import manifest 报 `Invalid value for allowedDomains ... must be a valid URL` | **已实测确认**：Figma 的校验器不接受 `127.0.0.1`，只接受 `localhost`。manifest 里只保留 `http://localhost:45677` |
| 插件面板一直 offline | 1) Bridge 是否在跑 `node cli/figma-vibe.js status`；2) 点 Connect；3) 确认端口一致 |
| 状态显示 connected 但命令报 `NO_RESULT` | 有别的客户端在偷命令。看 `/health` 的 `registered` 数组找出是谁，把不认识的关掉 —— 尤其**不要**把 `plugin/ui.html` 丢进浏览器或用预览面板打开 |
| Bridge 启动报端口占用 | 已有实例在跑，或 `--port 45678` |
| 命令报 `MOCK:` 开头的 id | 你还在跑 `tools/mock-plugin.js`，它不是真插件，先停掉 |
| `Cannot call with documentAccess: dynamic-page. Use figma.getNodeByIdAsync instead.` | **已修**。`dynamic-page` 模式禁用了同步的 `figma.getNodeById`，解析父节点/按 id 查节点一律要走 `await figma.getNodeByIdAsync()`。改完 `plugin/code.js` 后**必须在 Figma 里重新运行插件**（开发插件不会热更新已加载的代码） |
| `duplicate-node` 报 `CANNOT_DUPLICATE` | **已修**。Plugin API 里节点复制的方法是 **`clone()`**，`duplicate()` 在节点对象上根本不存在 —— 实测 `typeof node.duplicate === "undefined"`、`typeof node.clone === "function"`，原型链上唯一名字相近的就是 `clone`。注意 `remove()` / `resize()` 这些名字都是正常的，只有复制换了个名字，很容易写错 |
| `move-node` / `resize-node` 对布局子节点报错 | 自动布局容器里的子节点，位置与尺寸由布局引擎控制，不能直接写。要对**容器本身**操作，或先 `set-auto-layout <id> --mode none` |
| `set-padding` / `set-item-spacing` / 对齐报 `NO_AUTO_LAYOUT` | 该节点还没开自动布局，或它本身不支持（只有 frame / component / instance 支持）。先 `set-auto-layout <id> --mode vertical` |
| `set-font-weight` 报 `FONT_STYLE_NOT_FOUND` | 这个字体族没有该字重的 style。命令会依次试探 `Semi Bold` / `SemiBold` / `Demi Bold` 等常见拼法，全都不存在才报错；可用 `set-font --family <f> --style <s>` 显式指定 |
| 状态显示 connected，CLI 却全部报 `NO_RESULT`，Bridge 日志里还有 `deploy ... (queue left: 0)` | **已修（v2）**：Bridge 的 `waiters` 里堆积了**已死掉的 long-poll**（每次重跑插件、旧 iframe 被销毁时留下的），命令被写进死 socket 后蒸发。现已加投递前存活性检查 + 5s 清扫 + 丢单告警。**临时救急：重启 Bridge 即可立刻恢复** |
| 命令报错，但画布上却多出一个节点 | **部分写入（partial write）**：多步 batch 里前面步骤已经执行完，后续步骤才失败。例如 `create-rect` 先建好矩形、再去解析 parentId 时才抛错，就留下一个挂在页面根部、没进 Frame 的"孤儿矩形"。排错时用 `figma-vibe page` 回读，按 id 删掉（`figma-vibe delete-node <id>`）再重试 |
