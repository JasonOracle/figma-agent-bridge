/** @type {import("../types/index.js").ExamScore[]} 考试成绩 Mock（≥8 行） */
export const SCORES = [
  { rank: 1, name: "孙浩", score: 96, accuracy: "94%", timeSpent: "78分钟", submittedAt: "2026-09-15 10:18", status: "pass" },
  { rank: 2, name: "沈飞", score: 92, accuracy: "89%", timeSpent: "85分钟", submittedAt: "2026-09-15 10:25", status: "pass" },
  { rank: 3, name: "卫东", score: 88, accuracy: "86%", timeSpent: "102分钟", submittedAt: "2026-09-15 10:42", status: "pass" },
  { rank: 4, name: "褚燕", score: 85, accuracy: "83%", timeSpent: "96分钟", submittedAt: "2026-09-15 10:36", status: "pass" },
  { rank: 5, name: "许亮", score: 81, accuracy: "77%", timeSpent: "110分钟", submittedAt: "2026-09-15 10:50", status: "pass" },
  { rank: 6, name: "秦峰", score: 76, accuracy: "71%", timeSpent: "115分钟", submittedAt: "2026-09-15 10:55", status: "pass" },
  { rank: 7, name: "陈晓", score: 62, accuracy: "60%", timeSpent: "118分钟", submittedAt: "2026-09-15 10:58", status: "fail" },
  { rank: 8, name: "杨帆", score: 55, accuracy: "54%", timeSpent: "120分钟", submittedAt: "2026-09-15 11:00", status: "fail" },
];

export const SCORE_STATUS = {
  pass: { variant: "success", label: "通过" },
  fail: { variant: "error", label: "未通过" },
};
