# Stage 9.2-B — Figma Multi-page Design: Exam List + Exam Detail + Settings

STAGE 9.2-B COMPLETE

- 日期：2026-09-15
- 目标文件：`pGbRiWtRyXh1J7m4MDSAqK`（Page 1，隔离分区）
- 冻结文件：`lLVJH0OnZPrkAqzarvhnBq`（Stage 5 Dashboard，零写入）
- 本阶段性质：Figma-only。未修改任何 Vue 源码 / tailwind.config / package.json。

---

## 1. Figma 页面

| 页面 | 根 Frame | id | 尺寸 | 画布位置 |
|---|---|---|---|---|
| Exam List | `Page/ExamList` | **7:480** | 1440×900 | (0, 2360) |
| Exam Detail | `Page/ExamDetail` | **8:1034** | 1440×900 | (0, 3380) |
| Settings | `Page/Settings` | **8:1215** | 1440×900 | (0, 4400) |

State Specimens（x≥1560 隔离带）：

- `ExamList/State/Empty` 8:785、`ExamList/State/Error` 8:792、`ExamList/State/Loading` 8:800（复用 DS/LoadingState）
- `ExamDetail/Tab/考试成绩` 8:1138（静态 specimen，无 Prototype/Reaction）

Bridge 仍无 createPage op，故沿用 Page 1 内部分区方案（与 9.2-A 一致）。

## 2. Components / Instances

- 已有 DS Components（9.2-A 建立并直接复用）：**25** 个（Buttons×4、Inputs×3、Select×1、Badges×5、Pagination×3、Table×4、EmptyState、ErrorState、LoadingState、BaseCard、Breadcrumb）
- **新增正式 DS Component：0**（达标）
- 实例使用统计（含 specimen 内部嵌套实例）：
  - ExamList：**25** —— Breadcrumb×1、Button(Primary/Secondary/Ghost/Danger)×5、Input×1、Select×3、Badge(Success/Neutral/Warning)×6、Pagination×6、EmptyState×1、ErrorState×1、LoadingState×1
  - ExamDetail：**10** —— Button×5、Badge(Success×4、Error×2 计 6 中计入 10)（编辑/返回/返回/编辑考试 + 成绩表状态徽章）
  - Settings：**9** —— Breadcrumb×1、Input×4、Select×2、Button(Primary/Ghost)×2
- 文本覆写：全部实例文本通过 `get-node` readback + `set-text-content` 逐个覆写（如 搜索考试名称、考试状态/类型/创建时间、+ 新建考试、编辑考试、保存设置 等），未新增任何 DS 变体。

## 3. Geometry Audit

| 检查项 | 规格 | 实测 | 结果 |
|---|---|---|---|
| ExamList Frame | 1440×900 | 1440×900 | PASS |
| ExamDetail Frame | 1440×900 | 1440×900 | PASS |
| Settings Frame | 1440×900 | 1440×900 | PASS |
| Button 高度 | 30 | 30（全部实例） | PASS |
| Input/Select 高度 | 30 | 30（全部实例） | PASS |
| 表头高（本地 8 列） | 40 | 40 | PASS |
| 表行高 | 44 | 44×6 | PASS |
| 成绩表表头/行（specimen） | 40/44 | 40/44×5 | PASS |

已知偏差（记录而非违规）：DS/Table/* 为 6 列用户表组件，考试表需 8 列，无法通过实例增列；
Exam List 表头/行改为**页内本地 Frame**，严格套用 DS Token（Header 40 / Row 44 / 12·10 padding /
#F2F3F5 表头底 / #E4E7ED 行描边）。未创建任何新正式组件。BaseCard 因实例无法改写内容槽，
信息卡/设置卡同样为按 BaseCard 规格的本地卡（白底/4px 圆角/16 padding/阴影）。

## 4. Token Audit

`unknownColors = []`（详见 `.vibe/stage9/exam-list-token-audit.json`）。

扫描范围：三个页面根 Frame 全子树 + 全部 specimens（fills + strokes）。仅命中 16 个正式
token；无新颜色进入正式 token 表。开关 off 态使用 Ink-4 #C0C4CC（正式 token）。

## 5. Auto Layout Audit

全部规定结构均启用 Auto Layout 并完成 readback（`layoutMode / paddingL/R/T/B / itemSpacing /
primaryAxisAlignItems / counterAxisAlignItems / sizing`），详见
`.vibe/stage9/exam-detail-al-audit.json`。覆盖：

- ExamList：pageContainer / TopBar / Sidebar / TagsBar / Content / filterRow / tableCard / tableHeader / tableRow / footer / pager
- ExamDetail：pageContainer / breadcrumb / titleRow / infoCard / infoRow / tabs / tabPanel / footerActions / specimenCard
- Settings：pageContainer / 三张设置卡 / formRow / toggle / footerActions

Responsive 规则已按规范记录（未复制大量 Frame）：≥1024 表格可横向滚动、Form 两列；768 Form 单列。

## 6. User List Integrity

- `Page/UserList` **4:235** 存在，1440×900，childCount=4（TopBar/Sidebar/TagsBar/Content）— 未修改
- `UserList/State/Empty` 4:463、`UserList/State/Error` 4:470 原样保留

## 7. Dashboard Integrity

- 冻结文件 `lLVJH0OnZPrkAqzarvhnBq`（Frame 19:330）**零写命令**
- 证据：整个 9.2-B 期间 Bridge 仅注册 1 个插件客户端（`registeredClients: 1`，label
  `figma-plugin-ui`，指向本文件 Page 1）；旧文件客户端在阶段开始前已注销并经用户确认

## 8. Vue Integrity

```
git diff -- stage6-element-admin/src tailwind.config.js  →  ZERO CHANGES
git status（上述路径 + package.json / package-lock.json）  →  无任何改动
未安装 vue-router，未创建 API/Pinia，未编写任何 Vue 页面
```

## 9. Git

- 提交：`stage9: add exam list detail settings figma`（含 docs/、tools/、.vibe/stage9/、.gitignore 放行规则）
- 推送：origin/main；以 `git ls-remote origin refs/heads/main` 直连核对（沙箱内
  `git status` 的 ahead/behind 不可信，为已知环境问题）

## 10. Known limitations

1. **考试表为本地 Frame**：因 DS/Table 组件列结构固定（6 列），8 列考试表按 Token 复刻为页内
   Frame（表头 8:592，行高/间距/描边与 DS 一致），未新增正式组件。
2. **多页仍为 Page 1 分区**：Bridge 无 createPage，继续采用 y 轴隔离带方案。
3. **Tabs 为静态状态**：仅 selected/unselected 视觉，无 Prototype/Reaction（规范要求）。
4. **开关为原生 Frame+ellipse**：40×22、full 圆角、on=#5A5CF0 / off=#C0C4CC，未注册为正式组件。
5. **写入可靠性事故与修复**（已全部恢复，最终画布无残件）：
   - `run` 批处理在 ≥35 ops 时概率性 NO_RESULT（结果回传丢失，但插件侧实际已执行完毕）；
     两次误判导致 TagsBar/InfoCard/TableHeader/TableRow 残件与 ExamDetail 前段重复，均已按
     "查画布→比对 IDS→删残件→重试" 流程清理；
   - 一次 skip 列表失误造成 ExamList 表行/页脚与 specimens 重复，已按 IDS 基准去重；
   - 最终审计以实际画布 readback 为准（非构建日志）。

## 11. 停止声明

已完成 Exam List + Exam Detail + Settings 三个页面后**立即停止**。

未做且不做：修改 Vue、安装 router、创建 API、创建 Pinia、Browser QA、Playwright、
Stage 9.3、Stage 9.4、Login、Analytics、重构 DS、重构 User List。
