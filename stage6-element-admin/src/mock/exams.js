/** @type {import("../types/index.js").Exam[]} Mock 考试数据 ≥15 条（含 9.2-B Figma 示例 3 条） */
export const EXAMS = [
  { id: "E-2001", name: "期中数学模拟考", type: "高中数学", duration: 120, questionCount: 35, participants: 128, status: "ongoing", creator: "张伟", createdAt: "2026-09-15" },
  { id: "E-2002", name: "英语四级模拟测试", type: "英语", duration: 90, questionCount: 50, participants: 256, status: "finished", creator: "李静", createdAt: "2026-09-14" },
  { id: "E-2003", name: "消防安全知识测试", type: "安全知识", duration: 60, questionCount: 40, participants: 98, status: "draft", creator: "刘洋", createdAt: "2026-09-13" },
  { id: "E-2004", name: "高二物理期中测验", type: "高中物理", duration: 90, questionCount: 30, participants: 142, status: "ongoing", creator: "赵蕾", createdAt: "2026-09-12" },
  { id: "E-2005", name: "化学实验安全考核", type: "安全知识", duration: 45, questionCount: 25, participants: 76, status: "finished", creator: "周琳", createdAt: "2026-09-11" },
  { id: "E-2006", name: "英语听力专项训练", type: "英语", duration: 40, questionCount: 20, participants: 189, status: "ongoing", creator: "李静", createdAt: "2026-09-10" },
  { id: "E-2007", name: "高二化学月考", type: "高中化学", duration: 100, questionCount: 38, participants: 135, status: "finished", creator: "郑重", createdAt: "2026-09-09" },
  { id: "E-2008", name: "语文名句默写竞赛", type: "高中语文", duration: 30, questionCount: 50, participants: 210, status: "draft", creator: "郑爽", createdAt: "2026-09-08" },
  { id: "E-2009", name: "信息安全意识测评", type: "安全知识", duration: 30, questionCount: 20, participants: 64, status: "finished", creator: "周琳", createdAt: "2026-09-07" },
  { id: "E-2010", name: "高三数学冲刺模拟", type: "高中数学", duration: 150, questionCount: 45, participants: 173, status: "ongoing", creator: "张伟", createdAt: "2026-09-06" },
  { id: "E-2011", name: "英语语法阶段检测", type: "英语", duration: 60, questionCount: 40, participants: 156, status: "finished", creator: "李静", createdAt: "2026-09-05" },
  { id: "E-2012", name: "生物细胞专题测验", type: "高中生物", duration: 80, questionCount: 32, participants: 118, status: "draft", creator: "蒋梅", createdAt: "2026-09-04" },
  { id: "E-2013", name: "历史近代史单元测", type: "高中历史", duration: 90, questionCount: 36, participants: 127, status: "finished", creator: "郑爽", createdAt: "2026-09-03" },
  { id: "E-2014", name: "地理气候专题练习", type: "高中地理", duration: 70, questionCount: 28, participants: 101, status: "ongoing", creator: "赵蕾", createdAt: "2026-09-02" },
  { id: "E-2015", name: "全校防震减灾演练测", type: "安全知识", duration: 25, questionCount: 15, participants: 302, status: "finished", creator: "刘洋", createdAt: "2026-09-01" },
];

export const EXAM_STATUS = {
  ongoing: { variant: "success", label: "进行中" },
  finished: { variant: "neutral", label: "已结束" },
  draft: { variant: "warning", label: "草稿" },
};

export const EXAM_TYPES = [...new Set(EXAMS.map((e) => e.type))];

export function getExamById(id) {
  return EXAMS.find((e) => e.id === id) || null;
}

/** 模拟异步拉取；state=empty|error 用于状态 QA */
export function fetchExams({ state } = {}) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (state === "error") reject(new Error("网络异常，考试列表加载失败"));
      else if (state === "empty") resolve([]);
      else resolve(EXAMS);
    }, 200);
  });
}
