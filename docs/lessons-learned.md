# 经验教训 / Lessons Learned

> 七个阶段沉淀的可复用经验，按主题分类。每条都是真实踩坑后验证过的，不是理论推断。
> Reusable lessons from all seven stages. Every item was verified through a real failure, not theory.

---

## 1. 架构与协议 / Architecture & Protocol

1. **Figma 插件的网络边界**：网络能力只在插件 UI iframe；主线程（Plugin API realm）没有网络权限。唯一可行架构 = UI iframe long-poll + postMessage 转发主线程执行。
2. **长连接 + 内存队列的服务，投递前必须校验对端存活**。插件重跑/重连后旧 long-poll socket 已死，不检查就会静默吞命令（调用方永远 NO_RESULT）。配套要有「谁吞了消息」的告警，否则极难归因。
3. **超时 ≠ 未执行 ≠ 可重试**。CLI 超时只是「信息缺失」，batch 可能已在插件侧执行完。带 TRANSIENT 正则盲目重试曾把 DS 画板复制 3 份。重试只允许在确认零副作用的连接层错误上进行；大 batch 按实测放大超时。
4. **对客户端做注册制 + 握手门**：带轮询循环的页面一旦脱离宿主环境（如被丢进 IDE 预览面板）会变成「假客户端」截胡命令且假阳性 `connected: true`。要求先 hello 注册再 poll（403 拦截），页面未收到宿主握手则永久惰性。
5. **增量扩展的最小改动面**：Bridge 对 op 无白名单直接透传，校验全在插件侧 → 新增 26 个 op 只改 plugin/code.js + CLI，Bridge 和 ui.html 一行不动。

## 2. Figma Plugin API / Figma Plugin API

6. **manifest `networkAccess.allowedDomains` 不支持 `127.0.0.1`**（文档只例举 localhost，实际就是不支持）。Bridge 因此额外绑 `::1`，让 Windows 上 `localhost`（可能解析到 IPv6）也能通。
7. **`documentAccess: dynamic-page` 下同步 `figma.getNodeById` 被禁用**，必须 `getNodeByIdAsync`。且改完插件代码必须重新运行插件（不热更新已加载代码；Hot reload plugin 勾选后可以）。
8. **部分写入会留孤儿节点**：`create-rect` 先建后解析 parentId，失败时矩形已挂在页面根部。「命令报错」≠「什么都没写」→ 报错后必须回读画布确认残留再清理。
9. **`node.duplicate()` 不存在，是 `clone()`**。`remove/resize/appendChild` 都是正常名字，唯独复制换了名，凭印象写必错。定位手法：临时加诊断 op 输出原型链属性名。
10. **自动布局容器的子节点不能直接写 x/y 或尺寸**；要动就针对容器本身或先 `set-auto-layout --mode none`。
11. **实例无法插入/替换子节点**（无 component-swap/variants）。可组件化的走实例 + 延迟覆写（ovr + applyOverrides）；不可组件化的如实用原生 frame，不用 mock 掩盖缺口。
12. **实例名默认继承组件名**，语义重命名要用 set-name 批量做。
13. **`get-node` 的 depth 只在 `detail: true` 时递归**，detail:false 返回浅层假象（dump 曾报 4 节点实际 274）。审计/读回一律 detail:true。
14. **mock 测试永远测不出真实 Plugin API 约束**（dynamic-page 禁同步 API 就是 mock 环境永远发现不了的）。mock 通过 ≠ 真实成功，必须保留真实画布断言层。

## 3. 设计与数据流 / Design & Data Flow

15. **「文档里的画布内容」必须从 tree.json 读回取值，禁止凭记忆写**。曾凭印象编造 KPI 标签/学科数量，被逐字核对揪出。
16. **审计预期也要对齐真实设计意图**（如 Generate 宽 380 是 FILL 全列宽而非固定 348）。
17. **像素回归能暴露源设计的几何错误**：Stage 7 发现 Stage 5 源的饼图扇区变形、折线曲线不经过数据点（vector 仅 76px 高）、网格线左移 52px 与柱不对齐——这些必须归类 FIGMA_SOURCE 差异，不能偷偷在 Vue 里「修正」。

## 4. 测试策略 / Testing Strategy

18. **两层测试职责分开**：selftest（mock + CLI --dry 断言，不需要 Figma，快）+ 真实画布断言脚本（强制插件在线、逐项回读确认落地）。--dry 是验证 CLI 参数映射的利器，比端到端报错快一个数量级。
19. **测试编排里端口/token 这类环境参数必须同时喂给被测双方**（曾因 selftest 与 CLI 用了不同 token 全部 401 秒失败）。
20. **反向用例与回归守卫是必须的**：坏 token→401、无插件→PLUGIN_OFFLINE、死 waiter→NOT_PICKED_UP（不许 NO_RESULT），示例文件一改 selftest 不能跟着烂（steps 从文件读，不硬编码）。

## 5. 工具与环境坑（Windows）/ Tooling & Environment (Windows)

21. **同一条消息里对同一个文件发起多条 Edit 会静默丢一条**且工具仍报成功。同文件编辑必须串行；跨文件改完用 grep 核验关键标记。
22. **npm install 在无 package.json 的目录会向上爬到最近 package.json**（空子目录安装 playwright-cli 误装到上层项目）。
23. **playwright-cli 会话在多次命令调用间不保活**：open→resize→screenshot→eval→close 必须串在一条 shell 命令里。
24. **系统代理会劫持 localhost 的 curl（502）**：必须 `--noproxy '*'`。
25. **Git Bash 里 `taskkill //F //PID` 转义问题** → 用 PowerShell `Stop-Process -Id <pid> -Force`。
26. **后台 dev server / Bridge 会随会话意外退出**：重启命令 = `npm run dev -- --port 5180 --strictPort` 与 `node bridge/server.js`；插件在 Bridge 停机期间会 backoff 重试，Bridge 一起来 0.1s 内自动重连。
27. **MCP 导出的图片落在 MCP 配置的目录**（D 盘工作区），使用前要拷回项目目录。
28. **环境变量大小写重复会搞崩 .NET 安装器**（http_proxy/HTTP_PROXY 成对存在时 VS Build Tools 秒退 5008）。

## 6. 协作模式 / Collaboration Pattern

29. **每阶段完成后暂停等验收**，不删旧产物（Page 1 上 x=4200/5200/7000/8000/11500/12500 全部保留，形成可追溯的阶段地层）。
30. **无法继续时明确说出缺什么**：如 Stage 7 需要 fileKey，直接向用户要链接而不是猜测。
