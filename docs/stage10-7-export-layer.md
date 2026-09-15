# Stage 10.7 — L5 Export Layer 架构设计

**结论：STAGE 10.7 COMPLETE** — L5 Export Layer 的契约与验证体系全部落地：总体架构、出口协议 Schema（draft-07）、Figma→Frontend 映射规则、QA 规范（**652 PASS / 0 FAIL**，远超 PASS≥50 目标）、三份 few-shot、SKILL.md 注册。遵守 10.1–10.6 全部架构约束：未修改 Vue/Tailwind/Dashboard、未破坏 Figma Bridge、未进入 MCP 化、未做 UI 生成实现。

## 1. 总体架构

```
L4 Critic PASS（Export Gate 四项前置全绿）
  ↓
Export Pipeline（受控导出，全部产物登记进 manifest）
  ↓
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ ① PNG Export │ ② SVG Export │ ③ Figma JSON │ ④ Design Spec│ ⑤ Frontend   │
│ 页面截图      │ 图标/Vector  │ Node Tree    │ Brief JSON   │ Mapping      │
│ @1x/@2x      │ 页面级矢量    │ Geometry     │ DS Spec JSON │ 组件映射矩阵  │
│ 展示/评审/    │ （文本转轮廓  │ Auto Layout  │ Build Plan   │ Token→CSSVar │
│ AI 视觉理解   │ 为 Figma 默认）│ Component   │ Critic Report│ Layout 规则  │
│              │              │ Instance     │              │              │
│              │              │ TokenRef     │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
  ↓
Export Manifest（唯一出口协议，draft-07）
  ↓
audit 区回填 qaPassed / criticScore / freezeStatus（交付物自带体检报告）
```

设计原则：
1. **Manifest 是唯一出口协议**：五类输出不是散装文件，每件产物都登记进 manifest（路径/字节/来源节点），消费方只看 manifest；
2. **可追溯闭环**：manifest.source 指回 Brief/DS Spec，token 条目沿 `dsToken` 点路径可回溯到 DS Spec 原文，criticScore 与 Critic Report 的 average 互证；
3. **Gate 前置**：未经 L4 PASS 的设计不允许 live-build 导出（highway 示例即该规则的活教材）；
4. **不重复造轮子**：导出执行通道复用 Stage 9.2-C/10.5 的 export-node op（PNG base64 / SVG v4 文本），本阶段只定义契约与验证，不改 Bridge。

## 2. Export Manifest Schema（assets/templates/export-manifest.json）

顶层：`project / version / source{brief,dsSpec,figmaFileKey,rootNodeIds} / exports{png[],svg[],figmaJson,designSpec} / mapping{components[],layoutRules} / tokens{color,typography,spacing,radius,shadow} / audit{qaPassed,criticScore,freezeStatus} + _meta`。

关键约束（均被 QA 机械化验证）：
- `rootNodeIds` 全部匹配 `^\d+:\d+$`；live-build 的所有导出 nodeId ⊆ rootNodeIds（可按 fileKey+id 在 Figma 回读）；
- design-phase（未过 Gate）允许 `figmaFileKey=null`、`exports.png=[]`，但必须在 `_meta.note` 说明；
- token 条目 `dsToken` 沿点路径在 dsspec 中必须可解析到含 `source` 的节点；`cssVariable` 强制 kebab 命名规则（`--ds-` + 路径转 kebab，camelCase 边界转 `-`）；
- A/B 类映射组件 `frontendComponent` + `props` 必填；C 类 `frontendComponent=null` 且 `manualNote` 必填。

## 3. Figma → Frontend Mapping 规则（references/export-mapping.md）

三类映射矩阵：
- **A-direct**：Button/Input/Card 等一一对应，variant/state 直接翻译 props（`DS/Form/Button/Primary|Secondary|Disabled|Loading → <DsButton variant="primary">`）；
- **B-composite**：Table（Header+Row×N+Pagination）、PageShell、Dashboard 区块——组合规则可写成一段话，props 注明组合来源；
- **C-manual**：复杂插画/自由布局（如大屏地图面板）——不自动映射，`manualNote` 给人工实现入口，禁止静默丢弃。

Token→CSS Variable：`tokens.color.brand.primary → --ds-color-brand-primary`，value 原样导出不换算，source 前缀随行。Layout→Implementation Rules 随包交付（auto-layout→flex 映射、FILL→flex-1、行高 FIXED→leading-[Npx] 等实战约定）。

## 4. QA 结果（tools/stage10-7-qa.py）

**652 PASS / 0 FAIL**（目标 PASS≥50 / FAIL=0，达标）：

| 审计 | 覆盖 |
|---|---|
| QA1 Manifest Schema | 模板可解析 + 三份 example 顶层字段/枚举/audit 值域 |
| QA2 导出文件存在 | existsCheck≠false 的 png/svg/figmaJson/designSpec 路径逐一落盘验证；规划路径必须有 note |
| QA3 node id 可回读 | id 格式 + live-build 交叉引用（导出 nodeId ⊆ rootNodeIds）+ design-phase 诚实标注 |
| QA4 映射完整 | A/B 类 frontendComponent+props 非空、C 类 manualNote、layoutRules ≥3 |
| QA5 Token 完整 | 五类齐备（color≥8/typography≥5）+ dsToken 回溯 dsspec + cssVariable 命名规则 + source 前缀 |
| QA6 无孤儿组件 | mapping.dsName 与 dsspec 组件双向覆盖 + 同名归并 + Export Gate 自洽（criticScore<8 ⇒ design-phase；criticReport average 与 audit 互证） |
| QA7 Freeze 零修改 | git 工作树检查 src//stage6-element-admin/bridge/cli 干净 |

回归：stage10-4-qa.py 47/0、stage10-6-qa.py 90/0 全绿。

## 5. Few-shot（assets/examples/export/）

| 案例 | status | 展示重点 |
|---|---|---|
| example-saas-export.json | live-build | ElementAdmin（fileKey lLVJH0…，root 19:330/19:192）：Stage 5 tree dump 作 figmaJson、Stage 7 基准 PNG、15 组件全映射（13 A + 2 B）、criticScore 与 example-saas critic-report 8.7 互证 |
| example-health-export.json | live-build | Stage 10.5 真实产物（fileKey RupGQ…，roots 5:110/5:183/5:239）：PNG+SVG @2x 真实存在、StatCard 四槽→props、create-local→页面子组件映射 |
| example-highway-export.json | design-phase | 深色大屏规划：MapPanel C-manual 示范、深色 token 约束随行；**criticScore 7.7 <8 → exports 为空规划清单**，演示 Export Gate 的拦截行为 |

三份示例刻意覆盖三种状态：全部真实 / 部分真实 / 规划态，供 Agent 按项目实际阶段对齐。

## 6. SKILL.md 更新

注册 L5 段落：完整流程 `Prompt → L1 → L2 → L3 → L4 → L5`、Export Gate 四项前置、五类输出、文件索引与出口校验命令。

## 7. 边界与停止声明

- 本阶段为契约与验证体系：导出执行仍由既有 export-node 通道承担（10.5 已验证），批量导出编排与 Figma JSON Node Tree 快照的实际生成器留待后续阶段（health 示例的 figmaJson=null 已如实标注）；
- 未修改 Vue/Tailwind/Dashboard（QA7 git 检查通过）、未改 Bridge 核心逻辑、未进入 MCP 化、未做 UI 生成实现；
- **已完成 L5 架构，立即停止。不进入 Stage 10.8 打包发布。**
