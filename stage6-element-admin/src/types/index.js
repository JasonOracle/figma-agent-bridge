/**
 * Stage 9.3 数据类型（JSDoc typedef，供 mock 与视图引用）
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} avatar - 头像色（token 色值，作为圆形头像底色）
 * @property {string} name
 * @property {string} email
 * @property {string} role - 管理员 | 教师 | 助教 | 学生
 * @property {"Active"|"Pending"|"Disabled"} status
 * @property {string} createdAt - YYYY-MM-DD
 */

/**
 * @typedef {Object} Exam
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {number} duration - 分钟
 * @property {number} questionCount
 * @property {number} participants
 * @property {"ongoing"|"finished"|"draft"} status - 进行中 | 已结束 | 草稿
 * @property {string} creator
 * @property {string} createdAt
 */

/**
 * @typedef {Object} ExamScore
 * @property {number} rank - 排名
 * @property {string} name - 考生
 * @property {number} score - 得分
 * @property {string} accuracy - 正确率
 * @property {string} timeSpent - 耗时
 * @property {string} submittedAt - 提交时间
 * @property {"pass"|"fail"} status - 通过 | 未通过
 */
