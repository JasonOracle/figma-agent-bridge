<script setup>
/**
 * ExamDetailView —— 对应 Figma Page/ExamDetail (8:1034)
 * 结构：三级 Breadcrumb → 标题行(编辑/返回) → 信息卡 → Tabs(静态可切换) → Tab 面板 → FooterActions
 */
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageLayout from "../components/layout/PageLayout.vue";
import DsBreadcrumb from "../components/design-system/DsBreadcrumb.vue";
import DsButton from "../components/design-system/DsButton.vue";
import DsBadge from "../components/design-system/DsBadge.vue";
import DsCard from "../components/design-system/DsCard.vue";
import DsTable from "../components/design-system/DsTable.vue";
import DsState from "../components/design-system/DsState.vue";
import { getExamById, EXAM_STATUS } from "../mock/exams.js";
import { SCORES, SCORE_STATUS } from "../mock/scores.js";

const route = useRoute();
const router = useRouter();
const exam = computed(() => getExamById(route.params.id));
const activeTab = ref("info");

const scoreColumns = [
  { key: "rank", label: "排名", width: "70px" },
  { key: "name", label: "姓名", width: "120px" },
  { key: "score", label: "得分", width: "90px" },
  { key: "accuracy", label: "正确率", width: "90px" },
  { key: "timeSpent", label: "耗时", width: "100px" },
  { key: "submittedAt", label: "提交时间", width: "170px" },
  { key: "status", label: "状态", width: "100px" },
  { key: "actions", label: "操作" },
];
</script>

<template>
  <PageLayout>
    <template v-if="exam">
      <DsBreadcrumb
        :items="[
          { label: '首页', to: '/dashboard' },
          { label: '考试管理', to: '/exams' },
          { label: exam.name },
        ]"
      />

      <!-- 标题行 -->
      <div class="flex items-center justify-between">
        <h1 class="text-display text-ink-1">{{ exam.name }}</h1>
        <div class="flex gap-2">
          <DsButton variant="primary">编辑</DsButton>
          <DsButton variant="secondary" @click="router.push('/exams')">返回</DsButton>
        </div>
      </div>

      <!-- 信息卡 -->
      <DsCard>
        <div class="flex flex-wrap gap-x-12 gap-y-3">
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-3">考试名称</span>
            <span class="text-[13px] font-medium text-ink-1">{{ exam.name }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-3">考试类型</span>
            <span class="text-[13px] text-ink-1">{{ exam.type }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-3">考试时长</span>
            <span class="text-[13px] text-ink-1">{{ exam.duration }}分钟</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-3">题目数量</span>
            <span class="text-[13px] text-ink-1">{{ exam.questionCount }}题</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-3">参与人数</span>
            <span class="text-[13px] text-ink-1">{{ exam.participants }}人</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-3">状态</span>
            <DsBadge :variant="EXAM_STATUS[exam.status].variant" :label="EXAM_STATUS[exam.status].label" />
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-3">创建人</span>
            <span class="text-[13px] text-ink-1">{{ exam.creator }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-3">创建时间</span>
            <span class="text-[13px] text-ink-1">{{ exam.createdAt }}</span>
          </div>
        </div>
      </DsCard>

      <!-- Tabs（静态可切换，无路由） -->
      <div class="flex items-center gap-6 border-b border-stroke">
        <button
          type="button"
          class="-mb-px flex flex-col items-center gap-1.5 pb-0 text-[14px] leading-5"
          :class="activeTab === 'info' ? 'border-b-2 border-menu px-1 py-1.5 font-medium text-menu' : 'px-1 py-1.5 text-ink-2 hover:text-ink-1'"
          @click="activeTab = 'info'"
        >考试信息</button>
        <button
          type="button"
          class="-mb-px flex flex-col items-center gap-1.5 text-[14px] leading-5"
          :class="activeTab === 'scores' ? 'border-b-2 border-menu px-1 py-1.5 font-medium text-menu' : 'px-1 py-1.5 text-ink-2 hover:text-ink-1'"
          @click="activeTab = 'scores'"
        >考试成绩</button>
      </div>

      <!-- Tab：考试信息 -->
      <DsCard v-if="activeTab === 'info'">
        <div class="flex flex-col gap-3">
          <div class="flex gap-4">
            <span class="w-20 shrink-0 text-[13px] leading-5 text-ink-3">考试说明</span>
            <span class="text-[13px] leading-5 text-ink-1">覆盖本学期第 1–6 章内容，重点考查函数与几何。</span>
          </div>
          <div class="flex gap-4">
            <span class="w-20 shrink-0 text-[13px] leading-5 text-ink-3">考试规则</span>
            <span class="text-[13px] leading-5 text-ink-1">闭卷考试，独立完成，禁止携带计算器。</span>
          </div>
          <div class="flex gap-4">
            <span class="w-20 shrink-0 text-[13px] leading-5 text-ink-3">开始时间</span>
            <span class="text-[13px] leading-5 text-ink-1">2026-09-20 09:00</span>
          </div>
          <div class="flex gap-4">
            <span class="w-20 shrink-0 text-[13px] leading-5 text-ink-3">结束时间</span>
            <span class="text-[13px] leading-5 text-ink-1">2026-09-20 11:00</span>
          </div>
        </div>
      </DsCard>

      <!-- Tab：考试成绩 -->
      <div v-else class="overflow-hidden rounded-sm border border-stroke bg-surface shadow-card">
        <DsTable :columns="scoreColumns" :rows="SCORES">
          <template #cell-score="{ value }">
            <span class="font-medium">{{ value }}</span>
          </template>
          <template #cell-status="{ row }">
            <DsBadge :variant="SCORE_STATUS[row.status].variant" :label="SCORE_STATUS[row.status].label" />
          </template>
          <template #cell-actions>
            <div class="flex gap-3 text-[13px] text-menu">
              <button type="button" class="hover:underline">查看</button>
            </div>
          </template>
        </DsTable>
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center justify-end gap-2">
        <DsButton variant="secondary" @click="router.push('/exams')">返回</DsButton>
        <DsButton variant="primary">编辑考试</DsButton>
      </div>
    </template>

    <DsState v-else variant="error" title="考试不存在" :description="`未找到考试 ${route.params.id}`">
      <DsButton variant="secondary" @click="router.push('/exams')">返回列表</DsButton>
    </DsState>
  </PageLayout>
</template>
