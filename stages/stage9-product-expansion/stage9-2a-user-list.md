# Stage 9.2-A — Figma Multi-page Design / DS Extension + User List

> 目标文件：新建空白 Figma 文件（Untitled，fileKey `pGbRiWtRyXh1J7m4MDSAqK`）。
> 冻结文件（Stage 5 Dashboard 所在 lLVJH0OnZPrkAqzarvhnBq）本阶段**零接触**——旧文件插件在构建前已注销，全部写命令经 Bridge 实证只送达新文件。
> Vue 项目零改动（git 核验见 §G）。未进入 9.3/9.4。

---

## A. Figma 页面 / Frame

| 项 | 值 |
|---|---|
| 承载 Page | `Page 1`（新文件唯一页，空白起步；因 Bridge 34 个原子 op 无 createPage 能力，且用户未建新 Page，按 Stage 9.2 规格允许的「明确隔离的新区域」退路执行） |
| 隔离方式 | DS 扩展区 y=0..1200；User List 区 y=1300..2260；命名前缀 `DS/`、`Page/`、`UserList/` 提供逻辑隔离 |
| User List Frame | `Page/UserList`，**id 4:235**，**1440×900**，位置 (0, 1340)，bg #F2F3F5，clipsContent |
| 状态 specimens | `UserList/State/Empty`（4:463，420×260，x=1560 y=1370）、`UserList/State/Error`（4:470，420×260，x=1560 y=1720） |
| 顶层节点总数 | 36（构建前 0） |

> 注：若后续需要独立 Page，可用 `append-child` 把已建成子树迁入新 Page（Bridge 支持 page 作为 parent），视觉零损失。

## B. DS Extension（25 个 native Components）

| 组 | 组件（全部 native COMPONENT） |
|---|---|
| Button ×4 | DS/Button/Primary(3:6) Secondary(3:9) Ghost(3:12) Danger(3:15) |
| Input ×3 | DS/Input/Default Focus Error |
| Select ×1 | DS/Select/Default |
| Badge ×5 | DS/Badge/Success Warning Error Info Neutral（dot+label 结构） |
| Table ×4 | DS/Table/Header、DS/Table/Row(4:112)、DS/Table/Row/Hover(4:130)、DS/Table/Row/Selected(4:194) |
| Pagination ×3 | DS/Pagination/Default Active Disabled |
| State ×3 | DS/EmptyState、DS/LoadingState、DS/ErrorState |
| Card/Breadcrumb ×2 | DS/Card/BaseCard、DS/Breadcrumb |

- **25/25 建立为真 Component，无伪造**。无法建 Component 的场景：无。
- **Instance 使用**：User List 页面内 **29 个 instance**（面包屑×1、按钮×3、输入框×1、下拉×1、表头×1、数据行×8、分页项×6、状态组件×2、Row 内徽章 instance×6——Row 组件内部嵌 Badge instance）。
- 已知偏差（如实记录）：Row 组件内 badge 为 instance；Empty/Error 组件内按钮为 instance 并做了文案 override（清空筛选/重试）。
- Figma variant 未使用（原子 op 无 variant 能力），以独立 Component 命名约定替代（如 DS/Table/Row/Hover）——符合规格 §13 的许可。

## C. User List 结构

```
Page/UserList (1440×900)
├─ UserList/TopBar (1440×40, AL) — Logo 双三角 + ElementAdmin + burger/首页/全屏切换/gear/avatar/admin
├─ UserList/Sidebar (180×860, AL-V) — 首页(active #5A5CF0)+更多菜单+菜单1/1-1/1-2(40/56/56 缩进)+菜单2，icon=native vector
├─ UserList/TagsBar (1260×36, AL) — 首页(active 蓝) + 首页2(×) + burger
└─ UserList/Content (1260×824, AL-V, p24, gap16)
   ├─ DS/Breadcrumb instance（首页 / 用户管理）
   ├─ 标题行 (AL, SPACE_BETWEEN) — 用户管理 16/24/500 + DS/Button/Primary「新建用户」instance
   ├─ 搜索行 (AL, gap12) — Input「搜索用户名、邮箱」+ Select「状态」+ Button/Secondary「搜索」+ Button/Ghost「重置」
   └─ UserList/TableCard (AL-V, p16, r4, shadow-card)
      ├─ DS/Table/Header instance（40px：用户240/邮箱260/状态120/注册时间180/最近登录180(FILL)/操作200）
      ├─ DS/Table/Row instance ×8（44px：头像#AAB8E8+用户名、邮箱、Badge 状态、日期×2、编辑/删除）
      └─ table-footer (AL, SPACE_BETWEEN) — 共 87 条 + 分页(‹ 1 2 3 … › 全 instance + 文案 override) + 「10 条/页」选择器
State Specimens（隔离区）：EmptyState instance（暂无数据+清空筛选）、ErrorState instance（加载失败+重试）
```

**状态覆盖**：Default（主页面 populated）+ Empty/Error（specimens）；Loading 以 DS/LoadingState 组件形式在 DS 区展示（规格 §12 许可）。

## D. Token Audit — **PASS**

- 全画布 fills/strokes 收集：**全部 ∈ Stage 9.1 十六色正式 token**，unknownColors = `[]`（user-list-token-audit.json）。
- 组件级派生值仅 2 处且已登记：`#F0F1FE`（Row/Selected 底色）、`#AAB8E8`（头像占位，Stage 5 既有硬编码复用）。**未新增任何正式 token**。
- Typography 全部 5 字阶（26/32、16/24、13/20、12/18、11/16），数字列 tabular（.num 语义由 Vue 实现承载，Figma 侧为文本样式）。

## E. Geometry Audit — **11/11 PASS**（user-list-geometry-audit.json）

Button h=30 ✓ r=6 ✓ / Input h=30 ✓ / Select h=30 ✓ / TopBar 40 ✓ / Sidebar 180 ✓ / TagsBar 36 ✓ / Frame 1440×900 ✓ / 列宽和 1180 ✓ / Header instance 40 ✓ / Row instance 44 ✓。Cell padding 12h、行底 1px stroke、Row hover=#F2F3F5、Selected=#F0F1FE（派生）。
**Auto Layout**：36 个顶层+子树共 X 节点中 AL 覆盖率 0.46；规格要求的 Page container/Search bar/Filter row/Table row/Pagination/Card/Breadcrumb/Button/Input/Badge **全部为 AL**（plain spacer 需自带 AL 才能参与 FILL——Bridge 校验怪癖，已在脚本内适配）。

## F. Dashboard Integrity — **PRESERVED（isolation-by-construction）**

- Frame 19:330 位于旧文件（lLVJH0...）；本阶段**对旧文件零写命令**。
- 实证：构建前采样 3× `get-page-summary` 全部命中新文件；旧文件插件客户端已注销（health registered 仅剩新客户端）；Bridge 命令路由不可能触达旧文件。
- 本阶段未运行 Stage 7 visual regression（Vue 未修改，符合 §18）。如需逐字节复核 19:330，在旧文件重开 Vibe Bridge 插件后 `get-node 19:330` 即可（建议放 9.2 收尾）。

## G. Git

- `git diff -- stage6-element-admin/src tailwind.config.js` → **ZERO CHANGES**；`vue-router` 未安装。
- 提交范围：`docs/`、`stages/`、`.vibe/stage9/`（经 .gitignore 例外规则放行，无 token）。

---

## 过程记录（可靠性经验）

1. **NO_RESULT ×2（timeout ≠ 未执行铁律生效）**：两次「picked up but never returned」。处置均为：查画布实际状态 → 清残件 → 小批量重试。根因疑似 badge create-instance 触发插件 UI 竞态丢结果；单实例隔离测试正常。
2. **create-vector 不支持 A/H/V 命令**：vectorPaths 仅 M/L/Q/C/Z——弧线改三次贝塞尔、H/V 展开。
3. **跨批次 `$` 引用不存在**：`as:` 命名仅批内有效，跨批必须用真实 id（改为 IDS 查表）。
4. **每批落盘 id 快照**：首轮未落盘 + 失败导致按钮组件 id 丢失，靠画布按名恢复（get-page-summary）找回。
5. **set-layout-sizing 校验怪癖**：子节点 FILL 前提是自身有 AL（与 Figma API 语义不同），plain spacer 需补 AL。
6. **按钮 26→30px**：Figma 文本自动行高 ≈16px 而 Tailwind 13px 档行高 20px；按契约改垂直 FIXED 30px + counter CENTER。

## 遗留与 9.2-B 建议

- MCP 图片导出通道在收尾时断开（Figma 桌面端连接丢失），本阶段 PNG 证据未落盘；可在连接恢复后对 4:235 / 4:463 / 4:470 重导。
- 9.2-B（Exam List / Detail / Settings）复用本阶段 25 个 DS 组件 + 构建脚本模式（tools/stage9-2a-*.mjs），预计效率显著提升。
- 建议用户在 Figma 中新建两个 Page 后用 append-child 迁移子树，使文件结构完全对齐 Stage 9.0 IA 命名。
