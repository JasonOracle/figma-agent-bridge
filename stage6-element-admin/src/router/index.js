import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "../views/DashboardView.vue";

/**
 * Stage 9.3 路由 —— 对应 Stage 9.0 IA（docs/stage9-ia.md）。
 * 首页 → /dashboard；新增 /users /exams /exams/:id /settings。
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", name: "dashboard", component: DashboardView },
    {
      path: "/users",
      name: "users",
      component: () => import("../views/UserListView.vue"),
    },
    {
      path: "/exams",
      name: "exams",
      component: () => import("../views/ExamListView.vue"),
    },
    {
      path: "/exams/:id",
      name: "exam-detail",
      component: () => import("../views/ExamDetailView.vue"),
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("../views/SettingsView.vue"),
    },
  ],
});

export default router;
