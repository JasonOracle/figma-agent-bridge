# Stage 10.4 — L2 Design System Generation 架构设计

日期：2026-09-16 ｜ 仓库：figma-agent-bridge ｜ 基线 commit：a27bce8（Stage 10.3）

> **STAGE 10.4 ARCHITECTURE COMPLETE**

本阶段设计 AI UI Designer Skill 五层架构中的 **L2 Design System Generation**。继续保持纯规划：不动 Vue、不动 Figma、不动 Tailwind、不动 Bridge，不写实现代码。所有规则均源自 Stage 5–10.3 已验证的生产经验（每条可追溯），并与 Stage 10.1（Figma Build 铁律）和 Stage 10.3（Design Brief）严格对接。

**定位**：L2 输入 L1 的 Design Brief JSON，输出 **DS Spec JSON**；DS Spec 是 L3 Figma Build 的**唯一输入**——L3 禁止直接消费 Brief 或任何自然语言需求。

---

## 1. L2 总体职责

### 1.1 流水线（五段线性，禁止跳步）

```
Design Brief JSON（L1 出口物）
  → ① Token Generation      生成五类 token，全部带 source
  → ② Component Decision    对 Brief.componentExpectation 逐条判定（§4）
  → ③ Layout Intelligence   按平台模板生成页面分区（§6）
  → ④ Build Plan            预估 L3 构建批次（≤30 ops，交接参考）
  → DS Spec JSON（唯一出口物）
```

中间产物 `componentPlan`（§4）与 `layoutPlan`（§6）不单独交付，最终合并进 DS Spec；`buildPlan` 作为 DS Spec 的可选字段。**四段串行依赖**：Token 供 Component 引用（states 语义色）、Component 供 Layout 引用（分区挂载组件）、Layout 供 BuildPlan 估算 op 数。

### 1.2 三条不变式

1. **确定性**：L2 是规则引擎而非创作引擎。同一 Brief 输入必须得到同一 DS Spec 输出；任何规则未覆盖处写入 `sourceMapping.assumptions`，禁止静默自由发挥。
2. **可溯源**：每个 token 必须携带 `source` 字段（`preset:` / `brief:` / `rule:` / `derived:` / `existing-ds:` 五种前缀，见 §2.3）。QA 可从 source 反向审计到 Style Preset 或规则。
3. **单源**：L2 不产生任何 Figma 节点；对既有 DS 项目，`generate-core` 决策必须为 0（对应 Stage 10.1 §3.4「新增正式 DS Component 数量默认 0」）。

---

## 2. Design Token Generation 架构

### 2.1 五类 Token

| 类别 | 子组 | 来源 |
|---|---|---|
| **Color** | Brand（primary/hover/active）· Background（page）· Surface（card）· Text（primary/regular/secondary/placeholder）· Border（default/divider）· Status（success/warning/danger/info）· Chart（series1-5） | preset / brief / derived |
| **Typography** | Display · Heading · Body · Caption · Number/Data（等宽数字） | preset / brief + TY 规则 |
| **Spacing** | base · scale · cardPadding · cellPadding · pagePadding | preset + SP 规则 |
| **Radius** | sm · md · lg | preset / brief |
| **Shadow** | card · overlay · glow（type=drop/glow + usage 受限声明） | **仅 preset，禁止派生** |

### 2.2 禁令（确定性红线）

- **禁止 L2 随意创造颜色**：token 色值只能出自 ① Style Preset 的 visualSystem（primaryColor/background/surface/textColors/stroke/chartColors）② Brief 显式覆盖（必须同步记录到 `briefOverrides`）③ 列入白名单的派生规则（§2.4）。
- 除白名单派生外**不允许任何混色、透明度变体、新增灰阶**。preset 只有一个 shadow 时就只有一个 shadow——需要更多 elevation 层级时走「修订 Style Preset」流程，不得运行时派生。
- `placeholder` 无第四灰阶时复用 `textColors[2]`（rule:TY-4），不得造新灰。

### 2.3 source 字段规范

```
preset:<id>.<json路径>                    例：preset:enterprise-dashboard.visualSystem.primaryColor
brief:<字段>                              例：brief:visualSystem.radius(8/12/16)
rule:<rule-id>                            例：rule:ST-1@preset.chartColors(绿系)
derived:<rule-id>@<父token路径>            例：derived:RD-1@tokens.color.brand.primary
existing-ds:<组件名>                       例：existing-ds:DS/Form/Button
```

`sourceMapping` 聚合：`presetId` + `rulesUsed`（本次启用的规则 id 全集）+ `briefOverrides` + `existingDsRefs` + `assumptions`。

### 2.4 派生规则白名单（仅此四条）

| 规则 | 公式（逐通道线性混合后四舍五入 half-up 取整） | 用途 |
|---|---|---|
| **RD-1** | hover = primary×0.88 + 表面色×0.12；浅色主题表面色=#FFFFFF，深色主题=background | brand.hover |
| **RD-2** | active = primary×0.92（与 #000000 混合） | brand.active |
| **RD-3** | divider = default×0.5 + 混合基×0.5；浅色主题混合基=#FFFFFF，深色主题=surface | border.divider |
| **ST-1** | status 四色 = 从 preset.chartColors **按色相分类映射**（绿系→success、黄/橙系→warning、红系→danger、蓝/青系→info），不改值不混色 | status.* |

其余全部 token 一律直取。深色主题（gov）的 RD-1/RD-3 使用其深色变体，已在 few-shot highway 示例中首次声明。

### 2.5 Typography 规则

- **TY-1**：Number/Data token 一律等宽数字（`tabular-nums`）；字体取 preset（enterprise=Inter、gov=DIN、premium=Inter），字阶取 body 档或 preset 数字强调档。
- **TY-2**：Brief/preset 只给字号未给行高时，lineHeight = size + (size≥20 ? 8 : 6)。
- **TY-3**：gov preset「禁 <14px」优先于常规字阶下限——caption 从 12 提升至 14（few-shot highway 已示范）。
- **TY-4**：无第四灰阶时 placeholder 复用 textColors[2]。

### 2.6 Spacing / Radius / Shadow 规则

- **SP-2**：密表格（dense）cellPadding 缺省 12；**SP-3**：mobile-app pagePadding/cardPadding 缺省 16。
- Radius 取 preset 档位；Brief 显式覆盖时记录 briefOverrides（health 示例 8/12/16）。
- Shadow 逐字取 preset，禁止派生；gov glow 必须声明 usage（仅关键指标与地图热区）。

---

## 3. 与上下游的接口契约

```
L1 Design Brief ──唯一输入──▶ L2 (本层) ──DS Spec 唯一输出──▶ L3 Figma Build
```

- **对 L1（输入校验）**：Brief 必须通过 `templates/design-brief.json` 校验；`_assumptions` 非空时逐条继承进 `sourceMapping.assumptions`。
- **对 L3（输出消费）**：L3 只读 DS Spec——
  - `components[].figmaNaming` → DS 命名规范（`DS/<Category>/<Name>`，Stage 10.1 §3.4）；
  - `tokens` → QA4 Token 审计的 unknownColors 白名单（双通道）；
  - `components[].decision` → 构建策略：`reuse-core`=create-instance 前先 get-node 校验存在、`extend`=新增 variant、`create-local`=页内本地 Frame（**禁止 `DS/` 前缀**，用 `Local/<Page>/<Name>`）、`reject`=跳过；
  - `buildPlan.estOps` ≤ 30 → Stage 10.1 §2.2 批规模红线；
  - geometry 红线（enterprise：Button/Input/Select 30、Table Header 40/Row 44、Card 圆角 4、画布 1440×900）由 preset.geometry 经 token 传递，L3 不另行引入数值。

---

## 4. Component Decision Matrix

### 4.1 判定流程（对 Brief.componentExpectation 逐条，按序短路）

```
① reject？     —— 只是视觉装饰 / 与既有组件能力重叠的低频变体 → reject
② reuse-core？ —— 目标文件已存在同名/同职责 DS 组件
                  且 geometry 与 token 满足需求 → reuse-core
③ extend？     —— 与既有（或本次已生成的）组件 ≥80% 结构一致
                  仅差 variant / 语义取值 → extend（新增 variant，不新建）
④ create-local？—— 页面特殊结构、跨页复用 <3 次 → create-local（不污染 DS）
⑤ generate-core —— 绿地项目（无既有 DS）且属于：
                  a. preset coreComponents 命中项（CD-2b 平台必需组件按 §⑥.2 适配）
                  b. 跨页复用 ≥3 次的通用件（CD-1 阈值）
                  c. 被多个 extend 依赖的基础原语（CD-3 补充，须显式标注）
```

### 4.2 判定规则明细

| 规则 | 内容 |
|---|---|
| **CD-1** | generate-core 复用阈值：跨页复用 ≥3 次；不足则 create-local |
| **CD-2** | extend 相似度阈值：≥80% 结构一致、仅 variant/语义差异；extend 必须写明 variants 清单 |
| **CD-2b** | 平台必需导航组件（如 mobile TabBar）不在 preset coreComponents 时，绿地项目按 generate-core 生成；平台适配例外须已在 Brief._assumptions 声明（对接 L1 §⑥.2） |
| **CD-3** | 基础原语补充：Brief 未显式列出但被 ≥2 个 extend 决策依赖的原语（如 Card），补入 plan 并标注来源 |
| **CD-4** | reject 条件：① 纯视觉装饰不具备复用价值 ② P2 且与既有组件能力重叠（列配置级差异用实例覆写覆盖） |

### 4.3 输出：componentPlan（合并进 DS Spec.components）

每条：`{name, briefRefs[], category, priority, decision, figmaNaming?, variants?, basis, states[]}`。

- `briefRefs`：本条目覆盖的 Brief 组件名；**全部条目的 briefRefs 并集必须等于 Brief.componentExpectation**（合并场景如 State 覆盖 EmptyState/ErrorState/LoadingState）。
- `basis` 必须引用具体条件（复用次数 / 相似度 / geometry 红线 / priority），禁止「感觉合适」。
- **覆盖约束**：P0 组件 100% 覆盖；reject 仅允许出现在 P1/P2。

---

## 5. Component State Matrix

### 5.1 必选四件套（Brief 中出现即必须完整给出）

| 组件 | 必选状态 |
|---|---|
| **Button** | primary · secondary · disabled · loading |
| **Input** | default · focus · error · disabled |
| **Table** | header · row · empty · loading |
| **Card** | default · hover |

### 5.2 其余组件按类型基线（可裁剪，禁止杜撰）

| 类型 | 状态基线 |
|---|---|
| navigation | default · active（Pagination 增 disabled） |
| feedback | 语义态（success/warning/danger/info）或 default |
| chart | default · empty（图表必须有空数据态） |
| data-display | default（有交互再加 hover/selected/offline 等行为态） |

状态取值所需的颜色一律引用 status token，禁止为状态造色。QA 校验：四件套状态缺失 = FAIL。

---

## 6. Layout Intelligence

### 6.1 三平台分区模板

**Dashboard（web-admin，sidebar-content）**

```
┌─ Sidebar(240xFILL) ┬─ TopBar(FILLx56) ────────────────────┐
│                    ├─ BreadcrumbBar(FILLx48)             │
│                    ├─ 内容区（按页面类型）：               │
│                    │   Dashboard: KPI Grid(4列) → Chart Area(2:1) → Table │
│                    │   管理页:   FilterRow(30px) → Table → Pagination      │
│                    │   详情页:   InfoCard(+Tabs)          │
│                    │   设置页:   FormCards 纵列            │
└────────────────────┴──────────────────────────────────────┘
读取顺序即构建顺序（z 字形），KPI→图→表与用户「总览→趋势→明细」的阅读动线一致。
```

**Mobile App（tab-flow）**

```
StatusBar(44) → NavBar(44) → Hero(全幅出血) → Content Card(2列流) → TabBar(56+safeArea34)
```

**Government Screen（full-bleed-screen）**

```
┌───────────────── TitleBar(1920x86, 占高 8%) ─────────────────┐
├─ Left Panel(25%) ┬──── Center GIS(960, ≥50% 图表红线) ┬─ Right Panel(25%) ─┤
└──────────────────┴───────────────────────────────────┴────────────────────┘
KPI Tile → GIS Center → Monitoring Panels；数据即装饰，动效每屏 ≤2 处。
```

### 6.2 布局规则

| 规则 | 内容 |
|---|---|
| **LD-2** | web-admin TopBar 高度缺省 56（存量项目以 readback 为准，冲突时回写 Spec） |
| **LD-3** | web-admin Sidebar 宽度缺省 240（同上） |
| **LD-5** | iOS 移动端：状态栏 44 / NavBar 44 / TabBar 56 + safeArea 34 |
| **GEO-1** | 分区尺寸取整到 px（如 1080×8%≈86） |
| **通用** | zone.size 只允许三种写法：`WxH`（固定）/ `WxFILL`（锁定+伸缩）/ `FILL`；数值必须出自 token、preset.geometry 或 LD 规则——**layoutPlan 不产生任何无来源数值** |

### 6.3 输出：layoutPlan（合并进 DS Spec.layout）

`{pattern, frameBaseline, pages[{name(与 Brief 一一对应), zones[{name, role, size, order?, notes?}]}]}`。zone.notes 必须写明尺寸/组件出处；涉及规则缺省值时显式声明「以 readback 为准」。

---

## 7. DS Spec Schema

正本：`skills/ai-ui-designer/assets/templates/design-system-spec.json`（JSON Schema draft-07，与 10.3 的 design-brief.json 同规范）。

顶层八个必填字段（Brief→Spec 的映射）：

| 字段 | 来源 | 内容 |
|---|---|---|
| `brand` | Brief.product + designDirection | name / industry / stylePresetId / contentDensity |
| `platform` | Brief.product.platform | web-admin / web-site / mobile-app / big-screen |
| `tokens` | §2 规则引擎 | color(7 组) / typography(5) / spacing / radius / shadow，全量带 source |
| `components` | §4 componentPlan | 判定结果 + briefRefs + states |
| `layout` | §6 layoutPlan | pattern / frameBaseline / pages[].zones |
| `responsive` | 平台规则 | baseline / breakpoints / rules |
| `accessibility` | AC 规则 | contrast 逐条结论 / minFontSize / touchTarget / focusRing |
| `sourceMapping` | §2.3 | presetId / rulesUsed / briefOverrides / existingDsRefs / assumptions |

可选字段 `buildPlan`：L2 预估的构建批次视图（`estOps` 上限 30 由 Schema `maximum` 强制），真正的批次规模以 L3 运行期 readback 为准。

目录约定：新正本置于 `assets/templates/`；10.3 的 `templates/design-brief.json` 建议在 L2 实现阶段一并迁入 `assets/templates/` 统一管理。

---

## 8. Few-shot Examples

三份 DS Spec 与 10.3 的三份 Brief 一一对应，存放于 `assets/examples/*.dsspec.json`，共同构成 L2 的 few-shot：

| 示例 | 平台/Preset | 项目形态 | 演示要点 |
|---|---|---|---|
| `example-saas.dsspec.json` | web-admin / enterprise-dashboard | **存量 DS 项目**（11 个 existingDsRefs） | reuse-core 主导（10 条）、State 三合一 extend、Badge 扩 variant、CourseTable reject、geometry 红线传递、generate-core=0 |
| `example-health.dsspec.json` | mobile-app / premium-saas | **绿地项目** | generate-core 6 条（含 CD-2b TabBar、CD-3 Card 原语补充）、Card 三 variant extend、Brief 覆盖 radius/字阶、AC-2 触控 44px |
| `example-highway.dsspec.json` | big-screen / gov-digital-screen | **绿地深色项目** | RD-1/RD-3 深色变体派生、TY-3 caption 提 14px、glow usage 受限声明、AC-4 大屏无触控、MapPanel/TrendChart variant 复用 |

三份示例合计覆盖 5 种 decision、4 条派生规则、全部三套 Layout 模板与状态基线，可作为 L2 实现后的回归基准。

---

## 9. QA 规范

四项验证全绿才算完成（脚本：`tools/stage10-4-qa.py`，随仓库入库，可被第三方 AI 独立复核）：

| # | 检查 | 判据 |
|---|---|---|
| QA1 | JSON 可解析 | Schema + 3 份 dsspec 全部 json.load 通过；Schema `required` 顶层字段齐备 |
| QA2 | Token 无未知颜色 | 逐 dsspec 收集 `tokens.color` 全部 hex：非派生值必须 ∈ 对应 preset 的 visualSystem 色板（含 chartColors、#FFFFFF/#000000 混合基）；`derived:` 值按 §2.4 公式逐通道复算并精确匹配 |
| QA3 | Component 数量与覆盖合理 | briefRefs 并集 = Brief.componentExpectation 全量；P0 覆盖率 100%；绿地项目 generate-core 数 ≤ 12；存量项目 generate-core = 0；reject 仅限 P1/P2 |
| QA4 | 不违反 Stage 10.1 DS 单源原则 | create-local 的 figmaNaming 一律 `Local/...`（`DS/` 前缀 = 0）；Button/Input/Table/Card 四件套状态矩阵完整；buildPlan.estOps 全部 ≤30；深色示例的 status/chart 色板与 preset 逐字一致 |

运行：`python tools/stage10-4-qa.py`（以仓库根为工作目录）。

---

## 10. Stage Gate 输出

1. **完成节点清单**：Schema 正本 ×1、few-shot DS Spec ×3、本设计文档 ×1、QA 脚本 ×1。
2. **QA 结果**：四项检查全绿（见 §9 脚本输出）。
3. **Git diff**：仅 `skills/ai-ui-designer/**`、`docs/`、`tools/` 白名单；Vue/Figma/Tailwind/Bridge 零改动。
4. **未完成项与限制**：
   - L2 仍为设计态——规则引擎的实现（Brief→Spec 的执行器）未编码；
   - `web-site` 平台模板与 responsive 细则未覆盖（三个 few-shot 均为其余三平台，待首个 web-site 案例补充）；
   - 派生规则白名单如需扩充（如 danger-hover），必须先修订本 §2.4 再实现；
   - 10.3 的 design-brief.json 迁移至 assets/templates/ 留待实现阶段。

> **STAGE 10.4 COMPLETE** —— 停止，不进入 Stage 10.5。
