/**
 * 全部数据与几何常量取自第五阶段真实 Figma Frame 19:330
 * （.vibe/stage5-tree.json 读回 + tools/stage5-build.js 构建常量），未做任何改写。
 */

export const KPIS = [
  { label: "新增用户", value: "102,400", icon: "people", color: "#409EFF" },
  { label: "未读消息", value: "81,212", icon: "chat", color: "#409EFF" },
  { label: "交易金额", value: "9,280", icon: "yen", color: "#F56C6C" },
  { label: "购物车数量", value: "13,600", icon: "cart", color: "#67C23A" },
];

export const PIE = [
  { label: "直接访问", pct: 40, color: "#5470C6" },
  { label: "邮件营销", pct: 22, color: "#91CC75" },
  { label: "联盟广告", pct: 16, color: "#FAC858" },
  { label: "视频广告", pct: 12, color: "#FC8452" },
  { label: "搜索引擎", pct: 10, color: "#EE6666" },
];

export const BAR = {
  title: "每周用户活跃量",
  labels: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  values: [13500, 30500, 23000, 12800, 21500, 2400, 2100],
  vmax: 30500,
  axis: [0, 5000, 10000, 15000, 20000, 25000],
  // 悬浮徽标（设计内常驻元素）
  badge: { value: "7,600 KBa", delta: "+15.2 KBa" },
};

export const LINE = {
  title: "每月销售量",
  months: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
  s1: { name: "一月", color: "#5470C6", values: [115, 120, 138, 145, 150, 155, 150, 128, 175, 200, 152, 148] },
  s2: { name: "三月", color: "#91CC75", values: [105, 82, 130, 148, 150, 152, 150, 242, 200, 95, 112, 150] },
  vmax: 250,
  axis: [0, 50, 100, 150, 200, 250],
  // Figma 设计中 y 轴指针的固定文案（与参考图逐字一致）
  pointerText: "1130.94",
};

export const NAV = [
  { label: "首页", icon: "house", variant: "active" },
  { label: "更多菜单", icon: "grid" },
  { label: "菜单1", variant: "sub", indent: 40 },
  { label: "菜单1-1", variant: "sub", indent: 56 },
  { label: "菜单1-2", variant: "sub", indent: 56 },
  { label: "菜单2", icon: "doc" },
];

export const TAGS = [
  { label: "首页", active: true },
  { label: "首页2", closable: true },
];

export const FOOTER_TEXT = "Copyright © 2021-present ElementAdmin";
