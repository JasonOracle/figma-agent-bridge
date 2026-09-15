# execution-rules.md — Agent 执行规则（实战提炼）

## 1. 批规模纪律（batch ≤30）

- `run` 批 **≤30 ops**，严格串行，禁止并行向 Figma 写入。
- 实测阈值：35+ ops 概率性 NO_RESULT；45 ops 曾在 15s 超时窗口内「全落但结果丢失」。
- 大表格策略：每行拆 2–3 小批（行框+前 4 列 / 后 3 列 / 操作列），表头单独成批。

## 2. as:/$name 生命周期

- `as:"name"`、`"$name"`、`"@last"` **仅在同一 run 批内有效**。
- 跨批引用必须读 build-ids 快照中的真实 node id（血泪事故：跨批 `$ref` 静默失败 → 断点续跑重复执行 → 画布双胞胎节点）。
- 断点续跑 = 从 build-ids 恢复 id，绝不重新推导。

## 3. node id 管理

- build-ids JSON 格式：`{ "as名": "真实id", ... }`，每批成功后立即追加落盘（不等全部完成——首轮未落盘曾导致整批 id 需从 page-summary 按名恢复）。
- id 指向的节点被清理时，必须同步修正快照（9.2-B 曾出现快照指向已删节点的「幽灵引用」）。
- 完成报告中出现的 node id 必须是真实 id，禁止出现 as: 名。

## 4. retry 禁止规则

**超时/NO_RESULT 严禁立即 retry**，固定五步：

1. `get-page-summary` 读画布
2. `get-node(depth:2)` 查目标子树——**失败批可能已完整执行**，先确认执行度
3. `delete-node` 清残件（删前再验证：目标完整性、是否被其他节点/快照引用）
4. 批规模对半拆（治本）
5. 再重试

## 5. 写入纪律（WRITE→READBACK）

- 每批 WRITE 后 READBACK 关键节点，参数以 readback 为准，不凭视觉判断。
- 控件高度必须 `set-layout-sizing FIXED` + `resize-node` 强制（Figma 文本自动行高 ≈16px ≠ 设计行高，HUG 会把 30px 按钮压成 26px）。
- 实例文本必须 `set-text-content` 覆写，不依赖实例继承。

## 6. 冻结协议

- 启动登记冻结 fileKey + 关键 Frame id；一切命令前确认当前路由客户端的 page 归属。
- 多客户端并存 → 先 health 注册表确认旧客户端 lastSeen 超 staleAfter（45s）失活，再发命令。
- 冻结证据每阶段落盘：`{ registeredClients, activeClientPage, writeCommandsSentToFrozenFile: 0 }`。

## 7. 同文件编辑纪律（工具链层）

- 同一轮内对同一文件的多次编辑必须串行，禁止并行——并行 Edit 会静默相互覆盖且工具仍报成功（9.3 的 `route is not defined` 事故根因）。
- 多文件改完后用 grep 逐项核验关键标记是否都落地，比等报错省时间。

## 8. Git 纪律

- 提交范围白名单；提交前 `git diff --stat -- <禁改文件>` 必须为空。
- 推送后 `git ls-remote origin refs/heads/main` 直连核对；沙箱内 `git status` 的 upstream 显示（[gone]）不可信。
