# bridge-api.md — Figma Bridge 原子 op 手册

来源：`plugin/code.js`（35 个 handler，含 Stage 9.2-C 扩展的 export-node）。一切 Figma 操作只能走这些 op，禁止臆造。

## 通信模型

```
Agent → POST http://127.0.0.1:45677/v1/command?token=<token> { op, params }
     ← { ok, data } | NO_RESULT（超时，见 failure-playbook.md）
Bridge FIFO 路由到「正在等待的」插件客户端 → Figma 画布
GET /health 可查：plugin.connected / lastSeenAgoMs / info.page / 注册表
```

## op 清单（35）

### 读取
| op | 参数 | 说明 |
|---|---|---|
| get-page-summary | — | 当前页顶层节点（id/type/name/宽高/xy） |
| get-node | id, depth, **detail:true** | ⚠️ 必须 `detail:true` 才递归子树；否则只返回单层 |

### 创建
| op | 关键参数 |
|---|---|
| create-frame | name, width, height, x, y, parentId, fill, clips |
| create-rect | name, width, height, x, y, parentId, fill, cornerRadius |
| create-text | characters, x, y, fontSize, parentId, fontFamily, fontStyle, name, fill, autoResize |
| create-ellipse | name, width, height, x, y, parentId, fill |
| create-line | name, length, width, x, y, rotation, parentId, stroke, strokeWeight |
| create-vector | name, points 或 data, closed, x, y, width, height, parentId, stroke/fill | ⚠️ 路径仅支持 **M/L/Q/C/Z**，无 A/H/V；弧线用三次贝塞尔近似 |
| create-component | nodeId/from, name | 命名强制 `DS/<Category>/<Name>` |
| create-instance | componentId, x, y, parentId | 跨文件组件引用不支持 |
| duplicate-node | id, name, parentId, x, y |

### 几何/结构
| op | 参数 |
|---|---|
| move-node | id, x, y 或 dx, dy |
| resize-node | id, width, height |
| delete-node | id（⚠️ 删前必须 get-node 验证确为残件） |
| append-child | parentId, childId |
| set-layout-sizing | id, horizontal, vertical ∈ FIXED/FILL/HUG | ⚠️ **FILL 前置校验：节点自身必须已开启 Auto Layout** |

### 样式
| op | 参数 |
|---|---|
| set-fill | id, color（hex）/ fill / clear |
| set-stroke | id, color, stroke, width/strokeWeight / clear |
| set-opacity | id, opacity |
| set-corner-radius | id, radius 或 topLeft/topRight/bottomLeft/bottomRight |
| set-effects | id, shadow / effects / blur / clear |
| set-name | id, name |

### 文本
| op | 参数 |
|---|---|
| set-font | id, family, style |
| set-font-size | id, size |
| set-font-weight | id, weight, italic |
| set-text-color | id, color |
| set-text-content | id, characters | 实例文本覆写唯一可靠手段 |
| set-text-align | id, horizontal, vertical |
| set-text-autoresize | id, mode, width, height |

### Auto Layout
| op | 参数 |
|---|---|
| set-auto-layout | id, mode ∈ horizontal/vertical/none, spacing, padding, primaryAxisSizingMode, counterAxisSizingMode |
| set-padding | id, all 或 top/right/bottom/left 或 horizontal/vertical |
| set-item-spacing | id, spacing |
| set-primary-axis-align | id, align ∈ MIN/CENTER/MAX/SPACE_BETWEEN |
| set-counter-axis-align | id, align ∈ MIN/CENTER/MAX/BASELINE |

### 导出（Stage 9.2-C 扩展）
| op | 参数 | 说明 |
|---|---|---|
| export-node | id, scale | `figma.exportAsync(PNG)` → base64 返回；2MB 载荷内安全，1440×900@1x 约 63–84KB |

### 批处理
| op | 参数 | 说明 |
|---|---|---|
| run | ops[], stopOnError | 顺序执行；`as:"name"` 命名 + `"$name"` / `"@last"` 引用，**仅批内有效** |

## run 批处理规范

1. **规模 ≤30 ops**：≥35 ops 概率性 NO_RESULT（实测 45 ops 在 15s 窗口内全落、仅结果丢失）。
2. 单批失败不默认回滚已执行 op——必须先 READBACK 判断残件。
3. 批内引用链要完整：父节点 `as:` 与子孙 `$` 引用必须在同一批或改为真实 id。

## 参数限制速查

- 颜色一律 hex 字符串（含 `#`），全部色值必须出自 token 表（design-tokens.md）。
- x/y 为页面绝对坐标；分区布局约定 y 间隔 1020px（1340/2360/3380/4400…）。
- 无 `createPage` op——多页面 = Page 1 隔离分区 + 命名前缀。
- get-node 的 styleInfo 字段名：fills/strokes/effects/fontSize/fontFamily/layoutMode/itemSpacing/padding{Left,Right,Top,Bottom}/primaryAxisAlignItems/counterAxisAlignItems/layoutSizing{Horizontal,Vertical}。
