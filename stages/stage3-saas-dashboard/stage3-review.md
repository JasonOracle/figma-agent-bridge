# Stage 3 · Design Review & Component Audit

Source: real canvas read-back (`.vibe\stage3-tree.json`) — no mock data.

**Result: 42 passed, 0 failed** of 42 checks.

## Node census

- total nodes: **274**
- by type: FRAME 90, VECTOR 10, TEXT 105, ELLIPSE 24, RECTANGLE 25, INSTANCE 20
- max nesting depth: **7**
- component instances: **20**

## Checks

| | check | evidence |
|---|---|---|
| ✓ | no raster/IMAGE node is used as a shortcut | 0 IMAGE nodes - all graphics are native |
| ✓ | every node has a real size (no 0-size leftovers) | 274 nodes checked |
| ✓ | root frame name | SaaS Education Dashboard |
| ✓ | root frame is 1440x900 | 1440x900 |
| ✓ | Sidebar is 220px wide | 220px |
| ✓ | Header is 64px tall | 64px |
| ✓ | Main area height = 900-64 | 836px |
| ✓ | section present: Welcome | 12:1648 |
| ✓ | section present: KPI Section | 12:1659 |
| ✓ | section present: Analytics Section | 12:1688 |
| ✓ | section present: Recent Exams | 12:1750 |
| ✓ | section present: Todo Section | 12:1808 |
| ✓ | sidebar has 7 nav items | found 7 |
| ✓ | every nav row carries a real CJK label | 首页 / 学生管理 / 考试管理 / 成绩分析 / 题库 / 数据报表 / 设置 |
| ✓ | every nav row has a native vector icon | icons: 1,1,1,1,1,1,1 |
| ✓ | exactly one nav item is active (primarySoft bg) | Nav Item / 首页 |
| ✓ | 4 KPI cards, built from the KPI Card component | found 4 |
| ✓ | every KPI card exposes label + value + delta | KPI/Label / KPI/Value / KPI/Delta |
| ✓ | KPI delta values carry real numbers | +8.2% +4 场 +1.6 -0.4% |
| ✓ | trend chart has a dedicated plot frame | 676x104 |
| ✓ | chart grid is drawn as real lines (4) | 4 |
| ✓ | data points are real vector ellipses (12) | 12 |
| ✓ | trend line is a real VECTOR | VECTOR paths=1 |
| ✓ | trend area is a real VECTOR | VECTOR paths=1 |
| ✓ | chart legend present | dot + label |
| ✓ | both chart axes are labelled | Y=4 X=5 |
| ✓ | recent-exams table has >=5 rows | 5 rows |
| ✓ | table rows keep their component structure (not inlined) | Cell/Name / Cell/Participants / Cell/Avg / Cell/Pass / Cell/Status |
| ✓ | every row has a status badge with text | 已完成 已完成 进行中 已完成 待发布 |
| ✓ | numeric table columns are right-aligned | 15/15 |
| ✓ | todo section has 3 categories | 3 |
| ✓ | todo items carry real titles | 待批改试卷 | 异常成绩 | 待审核题目 |
| ✓ | page is built from component instances | 20 instances of: Avatar, Badge, Button/Ghost, Button/Primary, Button/Secondary, KPI Card, Table Row, Todo Item |
| ✓ | majority of containers use Auto Layout | 75/90 = 83% |
| ✓ | all Chinese text uses a CJK-capable font | 66 Chinese text nodes, all Noto Sans SC |
| ✓ | no empty text nodes | 0 empty of 105 |
| ✓ | digits/latin use the Inter family | 36 latin text nodes |
| ✓ | every fill/stroke comes from the declared palette | 17 distinct colours, all in the 11-colour system |
| ✓ | corner radii come from the 4-level scale (6/10/14/pill) | used: 6, 10, 14, 999 (12 icon-detail radii exempt) |
| ✓ | font sizes come from the type scale | 10, 11, 12, 13, 15, 16, 22, 28 |
| ✓ | cards use the shared drop shadow | 8 nodes |
| ✓ | no detached debris float on the page | page top-level verified separately |
