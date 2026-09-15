# Stage 10 — Backend Architecture Planning / API Design

日期：2026-09-16 ｜ 仓库：figma-agent-bridge ｜ 基线 commit：97bca35（Stage 9.4）

> **STAGE 10 PLANNING COMPLETE**

本阶段为**纯规划**：仅输出本文档，不写任何实现代码。Vue 前端、Figma、Tailwind token、DS 组件、Dashboard 全部保持冻结。

设计原则：**以 Stage 9.3 已固化的前端契约（`src/types/index.js` + mock 数据 + Settings 表单字段）为唯一事实来源**，反向推导 API 与 Schema，保证后续实现时前端零改动或最小改动接入。

---

## 0. 技术选型（建议）

| 层 | 选型 | 理由 |
|---|---|---|
| 运行时 | Node.js 22 + TypeScript | 与现有 bridge/plugin 生态一致，前后端同语言 |
| Web 框架 | Fastify | 内置 JSON Schema 校验（可直接复用本文 Schema 定义）、性能好、插件体系清晰 |
| ORM/DB | SQLite（better-sqlite3 / Drizzle）起步，Schema 兼容 PostgreSQL | 本项目为单体实验平台，SQLite 零运维；字段类型均用标准子集，后续可平滑迁 PG |
| 认证 | JWT（access 15min）+ Refresh Token（7d，旋转+复用检测） | 无状态起步，预留 Redis 黑名单位 |
| 鉴权 | RBAC（4 角色静态映射） | 与前端 User.role 枚举一一对应 |
| 校验/文档 | JSON Schema + @fastify/swagger（自动 OpenAPI） | API 文档即代码 |

目录规划（实现期创建，本阶段不建）：

```
server/
├── src/
│   ├── app.ts              # Fastify 实例 + 插件装配
│   ├── config.ts           # 环境变量（PORT/JWT_SECRET/DB_PATH）
│   ├── db/
│   │   ├── schema.ts       # 本文 §2 的表定义（Drizzle）
│   │   ├── seed.ts         # 导入 stage9 mock 数据作为种子
│   │   └── migrations/
│   ├── modules/
│   │   ├── auth/           # 登录/刷新/RBAC 守卫
│   │   ├── users/          # §1.1
│   │   ├── exams/          # §1.2
│   │   ├── questions/      # §1.3
│   │   ├── scores/         # §1.4
│   │   └── settings/       # §1.5
│   └── plugins/            # jwt、rbac、error-handler
└── openapi.json            # 由 swagger 插件自动产出
```

---

## 1. API Design

通用约定：

- 前缀 `/api/v1`；响应包络 `{ code, message, data }`，业务成功 `code=0`；错误码段：`1xxx 参数` / `2xxx 认证` / `3xxx 权限` / `4xxx 业务` / `5xxx 系统`。
- 列表接口统一分页参数 `?page=1&pageSize=10`，响应 `data: { list, total, page, pageSize }` —— 对应前端 DsPagination 的「共 N 条 / 每页 10 条」。
- 除 `POST /auth/login`、`POST /auth/refresh` 外全部需要 `Authorization: Bearer <accessToken>`。
- 时间字段统一 ISO 8601；前端展示 `YYYY-MM-DD` 的字段（createdAt 等）由后端返回完整时间戳、前端截断显示，或返回 `YYYY-MM-DD` 原样（推荐后者，与现 Mock 完全一致，前端零改动）。

### 1.1 用户 API（UserListView）

| Method | Path | 说明 | 权限 |
|---|---|---|---|
| GET | /api/v1/users | 列表。Query：`page` `pageSize` `keyword`(name/email 模糊) `status`(Active/Pending/Disabled) | admin/teacher |
| GET | /api/v1/users/:id | 详情 | admin/teacher |
| POST | /api/v1/users | 创建（name/email/role 必填，status 默认 Pending） | admin |
| PATCH | /api/v1/users/:id | 更新（role/status/email 等，字段级校验） | admin |
| PATCH | /api/v1/users/:id/status | 启用/禁用/待激活快捷切换 | admin |
| DELETE | /api/v1/users/:id | 软删除（status=Disabled + deletedAt 标记） | admin |

契约对齐点：列表项返回 `{ id, avatar, name, email, role, status, createdAt }`；`avatar` 返回 token 色值（按 role 哈希映射 9 色），前端零改动。

### 1.2 考试 API（ExamListView / ExamDetailView）

| Method | Path | 说明 | 权限 |
|---|---|---|---|
| GET | /api/v1/exams | 列表。Query：`page` `pageSize` `keyword`(名称) `type` `status`(ongoing/finished/draft) | 全角色（学生仅 ongoing/finished） |
| GET | /api/v1/exams/:id | 详情（含创建人姓名冗余，见 §2 Exam.relation） | 全角色 |
| POST | /api/v1/exams | 新建考试（对应「+ 新建考试」按钮），status=draft 起步 | admin/teacher |
| PATCH | /api/v1/exams/:id | 编辑基本信息 | admin/teacher（own） |
| PATCH | /api/v1/exams/:id/status | 发布 / 结束 / 退回草稿 | admin/teacher |
| GET | /api/v1/exams/:id/scores | 该考试成绩表（见 §1.4，Tab「考试成绩」数据源） | 全角色 |
| GET | /api/v1/exams/:id/info | 考试说明/规则/起止时间（Tab「考试信息」） | 全角色 |

契约对齐点：`questionCount` 与 `participants` 为冗余统计字段（COUNT 缓存于 Exam 行，写路径维护），与前端一次性渲染一致；`creator` 冗余存姓名（Mock 即姓名字符串），避免前端联表。

### 1.3 题目 API（本阶段前端未做页面，仅规划数据层能力）

| Method | Path | 说明 | 权限 |
|---|---|---|---|
| GET | /api/v1/questions | 列表。Query：`examId` `type`(single/multiple/judge/short) `page` | admin/teacher |
| GET | /api/v1/questions/:id | 详情（answer 字段仅 teacher+ 返回） | admin/teacher |
| POST | /api/v1/exams/:id/questions | 批量导入题目（数组，含答案与分值） | admin/teacher |
| PATCH | /api/v1/questions/:id | 编辑 | admin/teacher |
| DELETE | /api/v1/questions/:id | 删除（仅 draft 考试下） | admin/teacher |

说明：题目仅挂靠考试（exam_id 外键），不建独立题库版本管理——保持与 Stage 9 范围一致的克制设计。

### 1.4 成绩 API（ExamDetailView 成绩 Tab）

| Method | Path | 说明 | 权限 |
|---|---|---|---|
| GET | /api/v1/exams/:id/scores | 按 score DESC 排名输出，含 rank 计算 | 全角色（学生仅见自己） |
| GET | /api/v1/scores/:recordId/answers | 单份答卷明细（每题对错） | admin/teacher + 本人 |
| POST | /api/v1/exams/:id/submit | 交卷（写 ExamRecord + ExamAnswer + 计算 Score，事务） | student |
| GET | /api/v1/exams/:id/score-stat | 分布统计（供未来图表） | admin/teacher |

契约对齐点：成绩行返回 `{ rank, name, score, accuracy, timeSpent, submittedAt, status }`；`accuracy` 返回 `"94%"` 字符串（或数值+前端格式化，推荐前者）；`status` 为 `pass|fail`（由及格线 60 分判定，及格线入 SystemConfig）。

### 1.5 系统设置 API（SettingsView）

| Method | Path | 说明 | 权限 |
|---|---|---|---|
| GET | /api/v1/settings | 读取全部配置（key-value 拍平返回） | 登录即可 |
| PUT | /api/v1/settings | 整体保存（对应「保存设置」按钮，key-value 批量 upsert） | admin |

契约对齐点：字段名与 SettingsView 的 `form` 完全一致：

```
systemName      string   # 系统名称（默认 "ElementAdmin 考试平台"）
logo            string   # Logo URL
defaultDuration number   # 默认考试时间（分钟），新建考试表单的默认值
aiEnabled       boolean  # AI 开关
aiModel         enum     # GPT-4o | ... （模型枚举入 SystemConfig 可选项）
tokenQuota      number   # Token 额度（aiEnabled=false 时后端也拒绝写入）
emailNotify     boolean  # 邮件通知
systemNotify    boolean  # 系统通知
passingScore    number   # 及格线（内部字段，默认 60，前端暂不展示）
```

---

## 2. Database Schema

通用字段：所有表含 `id`（TEXT，业务前缀主键 `U-`/`E-`/`Q-`/`R-`/`S-`，与前端 Mock 格式一致；内部可加自增 rowid）、`created_at`、`updated_at`（ISO 8601 TEXT，SQLite 起步足够）。

### User

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | U-1001 格式 |
| name | TEXT NOT NULL | |
| email | TEXT UNIQUE NOT NULL | 登录凭据 |
| password_hash | TEXT NOT NULL | bcrypt/argon2；Mock 用户默认密码 |
| role | TEXT NOT NULL | `admin`/`teacher`/`assistant`/`student`（前端中文标签映射层） |
| status | TEXT NOT NULL | `Active`/`Pending`/`Disabled`（保持前端枚举大小写） |
| avatar | TEXT | token 色值 |
| deleted_at | TEXT NULL | 软删除 |

### Exam

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | E-2001 格式 |
| name | TEXT NOT NULL | |
| type | TEXT NOT NULL | 高中数学/英语/安全知识…（字典表可选） |
| duration | INTEGER NOT NULL | 分钟 |
| status | TEXT NOT NULL | `ongoing`/`finished`/`draft` |
| creator_id | TEXT FK→User.id | |
| creator_name | TEXT | 冗余，免联表（与 Mock 一致） |
| question_count | INTEGER DEFAULT 0 | 冗余统计 |
| participants | INTEGER DEFAULT 0 | 冗余统计（DISTINCT 参考人数） |
| description | TEXT NULL | 考试说明（Tab 1） |
| rules | TEXT NULL | 考试规则（Tab 1） |
| start_at / end_at | TEXT NULL | 开始/结束时间（Tab 1） |

### Question

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | Q-3001 格式 |
| exam_id | TEXT FK→Exam.id NOT NULL | |
| type | TEXT NOT NULL | single/multiple/judge/short |
| stem | TEXT NOT NULL | 题干 |
| options | TEXT(JSON) NULL | 选项数组 |
| answer | TEXT NOT NULL | 标准答案（对 student 接口脱敏） |
| score | INTEGER NOT NULL | 分值 |

### ExamRecord（一场考试的一次作答，成绩表的一行）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | R-4001 格式 |
| exam_id | TEXT FK→Exam.id NOT NULL | |
| user_id | TEXT FK→User.id NOT NULL | 考生 |
| status | TEXT NOT NULL | `in_progress`/`submitted`/`graded` |
| score | INTEGER NULL | 总得分 |
| accuracy | REAL NULL | 正确率 0-1 |
| time_spent | INTEGER NULL | 用时（秒；前端展示转「78分钟」） |
| submitted_at | TEXT NULL | 提交时间 |
| UNIQUE(exam_id, user_id) | | 每人每场一条（与「允许重复考试」开关联动，见 SystemConfig） |

### ExamAnswer（答卷明细）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | A-5001 格式 |
| record_id | TEXT FK→ExamRecord.id NOT NULL | |
| question_id | TEXT FK→Question.id NOT NULL | |
| answer | TEXT | 考生作答 |
| is_correct | INTEGER(0/1) | 自动判分结果 |
| got_score | INTEGER | 得分 |

### Score（排名视图物化）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | S-6001 格式 |
| exam_id | TEXT FK NOT NULL | |
| record_id | TEXT FK UNIQUE NOT NULL | 与 ExamRecord 1:1 |
| rank | INTEGER | 交卷时按 score 重算全表 |
| status | TEXT NOT NULL | `pass`/`fail`（passingScore 判定） |

> 设计取舍：Score 可作为 ExamRecord 的视图查询实现；独立成表是为了 rank 排名稳定缓存与前端契约直出。实现期二选一，倾向独立表+事务重算。

### SystemConfig（key-value）

| 字段 | 类型 | 说明 |
|---|---|---|
| key | TEXT PK | systemName / aiEnabled / …（§1.5 字段清单） |
| value | TEXT(JSON) | 标量存 JSON 字符串 |
| updated_by | TEXT FK→User.id | |
| updated_at | TEXT | |

### ER 关系

```
User 1───N Exam (creator)
User 1───N ExamRecord
Exam 1───N Question
Exam 1───N ExamRecord 1───1 Score
ExamRecord 1───N ExamAnswer N───1 Question
SystemConfig 独立 key-value
```

---

## 3. Authentication

### 3.1 登录流程

```
POST /api/v1/auth/login  { email, password }
→ 校验 User（status 必须 Active，Disabled/Pending 返回 2xxx 明确错误码）
→ 签发 { accessToken(JWT, 15min, 含 uid+role), refreshToken(不透明随机串, 7d, 存 refresh_tokens 表, 含旋转链 id) }
→ 响应 { accessToken, refreshToken, user: { id, name, role, avatar } }
```

前端接入点：新增 `src/api/auth.js` + axios 拦截器（实现期工作，本阶段不动）。

### 3.2 Token / Refresh 策略

- **Access Token**：JWT HS256，payload `{ sub: uid, role, iat, exp }`，15 分钟；无服务端状态，靠短过期兜底。
- **Refresh Token**：随机 256bit，哈希落库 `refresh_tokens(token_hash, user_id, expires_at, rotated_from, revoked)`，7 天。
- **旋转 + 复用检测**：每次刷新旧 token 作废并签新；检测到已作废 token 被再次使用 → 判定泄露，撤销该用户全部 refresh token。
- **登出**：`POST /auth/logout` 撤销当前 refresh token；access token 靠短生命周期自然失效（单体阶段不引黑名单）。

### 3.3 RBAC 权限模型

角色与前端 User.role 枚举映射（中文 ↔ 内部码）：

| 内部码 | 前端标签 | 能力 |
|---|---|---|
| admin | 管理员 | 全部：用户管理、系统设置、考试 CRUD、成绩全部 |
| teacher | 教师 | 考试 CRUD（own）、题目、成绩查看、无用户/设置管理 |
| assistant | 助教 | 考试/题目只读+编辑、成绩查看 |
| student | 学生 | 考试列表(非草稿)、答题、仅看本人成绩 |

实现：Fastify preHandler 装饰器 `requireRole('admin', 'teacher')` + 资源属主校验（own 级：creator_id === sub）。权限矩阵表随代码常量维护，OpenAPI 文档自动携带。

---

## 4. Frontend Integration Mapping

| Vue View | API Endpoint | Database Entity |
|---|---|---|
| DashboardView（KPI/图表） | `GET /api/v1/dashboard/summary`（规划：KPI 聚合 + 图表数据） | User / Exam / Score 聚合查询 |
| UserListView | `GET /api/v1/users?keyword&status&page` | User |
| UserList 状态 specimen | 同上（空数据/HTTP 5xx 即为 empty/error 态） | — |
| ExamListView | `GET /api/v1/exams?keyword&type&status&page` | Exam |
| ExamListView「+ 新建考试」 | `POST /api/v1/exams` | Exam |
| ExamDetailView 信息卡 + Tab1 | `GET /api/v1/exams/:id` + `GET /api/v1/exams/:id/info` | Exam |
| ExamDetailView 成绩 Tab | `GET /api/v1/exams/:id/scores` | Score ⟶ ExamRecord ⟶ User |
| SettingsView | `GET /api/v1/settings` / `PUT /api/v1/settings` | SystemConfig |
| （未来）登录页 | `POST /api/v1/auth/login` / `refresh` / `logout` | User + refresh_tokens |

接入方式建议：新增 `src/api/client.js`（fetch 封装 + token 刷新拦截），各 View 将 `import { fetchUsers } from "../mock/users.js"` 替换为 API 调用——**mock 模块保留**作为离线开发与状态 QA 开关（`?state=empty|error` 机制可平移到后端错误模拟）。

---

## 5. 完成报告

### 5.1 文件列表

本阶段新增仅 1 个文件：`docs/stage10-backend-plan.md`（本文档）。其余零改动（Vue/Figma/Tailwind/DS/package.json 均冻结）。

### 5.2 数据模型

7 个实体：**User、Exam、Question、ExamRecord、ExamAnswer、Score、SystemConfig**（+实现期的 refresh_tokens 认证表）；ER 关系见 §2。

### 5.3 API 清单（共 22 个端点）

- Auth：login / refresh / logout（3）
- Users：list / get / create / patch / patch-status / delete（6）
- Exams：list / get / create / patch / patch-status / info（6）
- Questions：list / get / batch-import / patch / delete（5）
- Scores / Record：exam-scores / answers / submit / score-stat（4）
- Settings：get / put（2）
- （Dashboard summary 为后续图表阶段预留，未计入）

### 5.4 后续实施路线（建议切分，待用户确认后逐段执行）

| 里程碑 | 内容 | 前置 |
|---|---|---|
| M1 骨架 | server/ 脚手架、Fastify、SQLite、schema + seed（导入 Stage 9 mock）、/health | 无 |
| M2 认证 | login/refresh/logout、RBAC 守卫、前端 axios 拦截器 | M1 |
| M3 用户域 | users CRUD + UserListView 接入（下线 mock 直连） | M2 |
| M4 考试域 | exams CRUD + ExamList/ExamDetail 接入 | M2 |
| M5 设置域 | settings get/put + SettingsView 接入 | M2 |
| M6 答题闭环 | questions 导入、submit 事务、成绩排名、成绩 Tab 接入 | M4 |

每个里程碑保持现有 QA 惯例：契约对齐（§1 各「契约对齐点」）+ Playwright 回归 + Git 审计。

### 5.5 停止声明

本阶段仅完成规划文档，**未编写任何实现代码**，未安装依赖，未改动 Vue/Figma/Tailwind/DS/Dashboard。立即停止，等待 Stage 10 实施指令。
