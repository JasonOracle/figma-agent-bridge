/** @type {import("../types/index.js").User[]} Mock 用户数据 ≥20 条 */
export const USERS = [
  { id: "U-1001", avatar: "#5A5CF0", name: "张伟", email: "zhangwei@school.edu", role: "管理员", status: "Active", createdAt: "2026-08-02" },
  { id: "U-1002", avatar: "#409EFF", name: "李静", email: "lijing@school.edu", role: "教师", status: "Active", createdAt: "2026-08-03" },
  { id: "U-1003", avatar: "#67C23A", name: "王强", email: "wangqiang@school.edu", role: "教师", status: "Pending", createdAt: "2026-08-05" },
  { id: "U-1004", avatar: "#FAC858", name: "刘洋", email: "liuyang@school.edu", role: "助教", status: "Active", createdAt: "2026-08-06" },
  { id: "U-1005", avatar: "#F56C6C", name: "陈晓", email: "chenxiao@school.edu", role: "学生", status: "Disabled", createdAt: "2026-08-08" },
  { id: "U-1006", avatar: "#5470C6", name: "赵蕾", email: "zhaolei@school.edu", role: "教师", status: "Active", createdAt: "2026-08-09" },
  { id: "U-1007", avatar: "#91CC75", name: "孙浩", email: "sunhao@school.edu", role: "学生", status: "Active", createdAt: "2026-08-11" },
  { id: "U-1008", avatar: "#FC8452", name: "周琳", email: "zhoulin@school.edu", role: "管理员", status: "Active", createdAt: "2026-08-12" },
  { id: "U-1009", avatar: "#5A5CF0", name: "吴涛", email: "wutao@school.edu", role: "学生", status: "Pending", createdAt: "2026-08-14" },
  { id: "U-1010", avatar: "#409EFF", name: "郑爽", email: "zhengshuang@school.edu", role: "助教", status: "Active", createdAt: "2026-08-15" },
  { id: "U-1011", avatar: "#67C23A", name: "冯军", email: "fengjun@school.edu", role: "教师", status: "Disabled", createdAt: "2026-08-17" },
  { id: "U-1012", avatar: "#FAC858", name: "褚燕", email: "chuyan@school.edu", role: "学生", status: "Active", createdAt: "2026-08-18" },
  { id: "U-1013", avatar: "#F56C6C", name: "卫东", email: "weidong@school.edu", role: "学生", status: "Active", createdAt: "2026-08-20" },
  { id: "U-1014", avatar: "#5470C6", name: "蒋梅", email: "jiangmei@school.edu", role: "教师", status: "Pending", createdAt: "2026-08-21" },
  { id: "U-1015", avatar: "#91CC75", name: "沈飞", email: "shenfei@school.edu", role: "学生", status: "Active", createdAt: "2026-08-23" },
  { id: "U-1016", avatar: "#FC8452", name: "韩雪", email: "hanxue@school.edu", role: "助教", status: "Active", createdAt: "2026-08-24" },
  { id: "U-1017", avatar: "#5A5CF0", name: "杨帆", email: "yangfan@school.edu", role: "学生", status: "Disabled", createdAt: "2026-08-26" },
  { id: "U-1018", avatar: "#409EFF", name: "朱婷", email: "zhuting@school.edu", role: "教师", status: "Active", createdAt: "2026-08-27" },
  { id: "U-1019", avatar: "#67C23A", name: "秦峰", email: "qinfeng@school.edu", role: "学生", status: "Active", createdAt: "2026-08-29" },
  { id: "U-1020", avatar: "#FAC858", name: "尤娜", email: "youna@school.edu", role: "管理员", status: "Pending", createdAt: "2026-08-30" },
  { id: "U-1021", avatar: "#F56C6C", name: "许亮", email: "xuliang@school.edu", role: "学生", status: "Active", createdAt: "2026-09-01" },
  { id: "U-1022", avatar: "#5470C6", name: "何雨", email: "heyu@school.edu", role: "教师", status: "Active", createdAt: "2026-09-02" },
];

export const USER_STATUS = {
  Active: { variant: "success", label: "启用" },
  Pending: { variant: "warning", label: "待激活" },
  Disabled: { variant: "error", label: "禁用" },
};

/** 模拟异步拉取；state=empty|error 用于状态 QA（对应 Figma State specimens） */
export function fetchUsers({ state } = {}) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (state === "error") reject(new Error("网络异常，用户列表加载失败"));
      else if (state === "empty") resolve([]);
      else resolve(USERS);
    }, 200);
  });
}
