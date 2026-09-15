# Stage 10.6 — L4 Visual Critic Layer 实现报告

**结论：STAGE 10.6 COMPLETE** — L4 Visual Critic 的架构、评分模型、Schema、Loop 规则、层间映射与 few-shot 全部落地并通过 QA（90 PASS / 0 FAIL）。本阶段为架构与验证态：未触碰 Figma 文件、Bridge 核心逻辑、src/（Vue/Tailwind）零改动，未进入 Stage 10.7 Export 增强。

## 1. 交付物清单

| 文件 | 内容 |
|---|---|
| `skills/ai-ui-designer/references/visual-critic.md` | 五维评分模型（权重/判定依据）+ 评分锚点 + Critic Loop 规则（CL-1~6）+ 执行方式 |
| `skills/ai-ui-designer/references/critic-mapping.md` | issue → targetLayer 路由判定表（Q1-Q4 自问序）+ 典型映射示例 + 回写约束 CR-1~5 + severity 联动 |
| `skills/ai-ui-designer/assets/templates/critic-report.json` | draft-07 Schema：project/page/scores×5/average/issues[](severity,location,evidence,suggestion,targetLayer)/action + `_loop`(round≤3,history) + `_meta` |
| `skills/ai-ui-designer/assets/examples/example-saas/critic-report.json` | 企业后台：Round 1 一次 PASS（8.7），遗留 2 L3 几何 + 1 L2 派生色问题（取自 Stage 7 真实发现） |
| `skills/ai-ui-designer/assets/examples/example-health/critic-report.json` | 消费健康 App：3 轮收敛 PASS（7.9→8.3→8.7），问题取自 Stage 10.5 真实 Critic Loop 同型案例 |
| `skills/ai-ui-designer/assets/examples/example-highway/critic-report.json` | 政务大屏：3 轮仍 7.7 → **STOP_MAX_LOOP**（深色对比度受品牌色相锁死，转人工 L1 决策） |
| `tools/stage10-6-qa.py` | QA1–QA6 校验脚本 |
| `skills/ai-ui-designer/SKILL.md` | 注册 L4 段落（入口、文件索引、出口校验） |

## 2. 五维评分模型（visual-critic.md §1）

| 维度 | 检查项 | 证据来源 |
|---|---|---|
| Layout（30/25/20/15/10 加权） | 页面比例、网格一致性、对齐误差 ≤1px、留白比例、信息密度 | get-node detail:true 实测 x/y/w/h/AL，禁止目测 |
| Color | token 使用率（unknownColors=0 一票扣）、主色比例 5-15%、对比度 ≥4.5:1、状态色规范 | 十六进制扫描 + 白名单（与 QA4 同源，可复现） |
| Consistency | Component 来源唯一（实例 vs 本地 Frame 不混用）、spacing/radius/typography 档位、icon 风格 | readback + L2 spec 档位比对 |
| Commercial | 锚点比对（Apple/Stripe/Linear/AntD Pro/Material 3）、模板感一票 ≤5、品牌识别贯穿、细节完成度 | 结构化证据 + 锚点对照；issue 必须可执行，禁止"不够高级"话术 |
| Usability | 信息层级、操作路径 ≤3 步、CTA 唯一最强、触控 ≥44（AC-2）、Dashboard 信息流 | readback 实测 + AC 规则 |

评分锚点：9-10 可交付 / 8-8.9 可 PASS / 7-7.9 必须出 issue / 5-6.9 系统性缺陷 / <5 回写 L1。

## 3. Critic Loop 规则（visual-critic.md §3）

- Round 0 生成 → Round 1 审查 → Round 2 只修受影响 token/组件/节点 → Round 3 终审
- CL-1：avg≥8 且无单项<7 → PASS 即停；CL-2：单项<7 必出 issue；**CL-3：最多 3 轮，超限 STOP_MAX_LOOP 转人工**；**CL-4：禁止无限自动优化与"顺手多改"**；CL-5：修复必复评（history 留痕）；CL-6：修复必须走映射路由，禁止跨层私改。
- 三个 few-shot 恰好覆盖三种结局：一次 PASS / 循环后 PASS / STOP_MAX_LOOP。

## 4. 路由与回写（critic-mapping.md）

四问判定序：方向错 → L1（Style Preset/designDirection）；规格错 → L2（token/组件规格，重跑 stage10-4-qa.py）；实现错 → L3（只重建受影响节点，更新 build-ids）；表述含糊 → 打回重写 evidence。回写五约束：evidence-first / 单层路由 / 最小影响面 / 层内 stage gate / 修复必复评。

## 5. QA 结果

`python tools/stage10-6-qa.py` → **90 PASS / 0 FAIL**：

- QA1 Schema 可解析，required 六字段齐备，targetLayer enum = [L1,L2,L3]
- QA2 三份 example 顶层必填字段完整
- QA3 五维完整且 0-10；average 与 half-up 实算一致（8.7 / 8.7 / 7.7）
- QA4 每条 issue：evidence 非空且含可复现实测痕迹、suggestion 可执行、severity 合法
- QA5 全部 targetLayer ∈ {L1,L2,L3}
- QA6 loop 自洽：round ≤3、maxLoop=3、history ≤ round、**action 与分数规则互证**（PASS⇒avg≥8 且最低分≥7；STOP_MAX_LOOP⇒round=3 且 avg<8 且循环确实发生）

## 6. 设计决策记录

1. **结构化证据优先于目检**：四维全部由 get-node 读回判定（Stage 10.5 已验证该通道可靠）；PNG 仅作 Commercial 维辅助与人工复核——规避当前模型图片读取限制。
2. **STOP_MAX_LOOP 是一等公民**：highway 示例故意演示"3 轮修不好要停下来找人类"，把 Stage 10.5 教训（超时≠未执行式的盲目重试）上升为评分层硬规则。
3. **evidence 必须含实测痕迹**：QA 强制 issue 的 evidence 含数字/色值/px/对比度等可回放字段，从机制上杜绝"感觉不对"式 issue。
4. **issue 表述禁止不可执行话术**（如"不够高级"），Commercial 维也不例外——每条 suggestion 必须指明改哪个 token/组件/节点。
5. **回写 L2 必须重跑 stage10-4-qa.py**：复用 10.4 的 47 项断言做层内 stage gate，避免 Critic 回写引入新违规。

## 7. 边界与限制

- 本阶段未实现 Critic 的自动化执行器（扫描脚本化部分沿用 10.5 QA 通道），大规模自动化判定留待后续阶段；当前形态为「Agent 按参考文档人工执行 + Schema/QA 兜底」。
- Commercial 维的锚点比对依赖评审者经验，主观性通过 evidence 强制要求缓解但无法归零。
- 停止声明：未修改 src/、Vue、Tailwind、Figma 文件、Bridge 核心逻辑；未进入 Stage 10.7 Export 增强。
