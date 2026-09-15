<script setup>
/**
 * ExamListView —— 对应 Figma Page/ExamList (7:480)
 * 结构：Breadcrumb → 标题行(+新建考试) → Filter(搜索/状态/类型 + 搜索/重置) → 8 列表格 → Pagination
 */
import { computed, onMounted, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import PageLayout from "../components/layout/PageLayout.vue";
import DsBreadcrumb from "../components/design-system/DsBreadcrumb.vue";
import DsButton from "../components/design-system/DsButton.vue";
import DsInput from "../components/design-system/DsInput.vue";
import DsSelect from "../components/design-system/DsSelect.vue";
import DsTable from "../components/design-system/DsTable.vue";
import DsBadge from "../components/design-system/DsBadge.vue";
import DsPagination from "../components/design-system/DsPagination.vue";
import DsState from "../components/design-system/DsState.vue";
import { fetchExams, EXAM_STATUS, EXAM_TYPES } from "../mock/exams.js";

const router = useRouter();
const route = useRoute();
const columns = [
  { key: "name", label: "考试名称", width: "230px" },
  { key: "type", label: "考试类型", width: "110px" },
  { key: "questionCount", label: "题目数量", width: "90px" },
  { key: "duration", label: "考试时长", width: "100px" },
  { key: "participants", label: "参与人数", width: "100px" },
  { key: "status", label: "状态", width: "100px" },
  { key: "createdAt", label: "创建时间", width: "120px" },
  { key: "actions", label: "操作", width: "120px" },
];

const loading = ref(true);
const error = ref(false);
const errMsg = ref("");
const allExams = ref([]);
const keyword = ref("");
const status = ref("");
const type = ref("");
const page = ref(1);
const PAGE_SIZE = 10;

const statusOptions = Object.entries(EXAM_STATUS).map(([value, s]) => ({ value, label: s.label }));
const typeOptions = EXAM_TYPES.map((t) => ({ value: t, label: t }));

async function load() {
  loading.value = true;
  error.value = false;
  try {
    allExams.value = await fetchExams({ state: route.query.state });
  } catch (e) {
    error.value = true;
    errMsg.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const filtered = computed(() =>
  allExams.value.filter(
    (e) =>
      (!keyword.value || e.name.includes(keyword.value)) &&
      (!status.value || e.status === status.value) &&
      (!type.value || e.type === type.value),
  ),
);
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));

function reset() {
  keyword.value = "";
  status.value = "";
  type.value = "";
  page.value = 1;
}
</script>

<template>
  <PageLayout>
    <DsBreadcrumb :items="[{ label: '首页', to: '/dashboard' }, { label: '考试管理' }]" />

    <div class="flex items-center justify-between">
      <h1 class="text-display text-ink-1">考试管理</h1>
      <DsButton variant="primary">+ 新建考试</DsButton>
    </div>

    <!-- Filter Area -->
    <div class="flex items-center gap-3">
      <DsInput v-model="keyword" icon placeholder="搜索考试名称" class="w-56" @update:model-value="page = 1" />
      <DsSelect v-model="status" :options="statusOptions" placeholder="考试状态" @update:model-value="page = 1" />
      <DsSelect v-model="type" :options="typeOptions" placeholder="考试类型" @update:model-value="page = 1" />
      <div class="flex gap-2">
        <DsButton variant="secondary">搜索</DsButton>
        <DsButton variant="ghost" @click="reset">重置</DsButton>
      </div>
    </div>

    <!-- Exam Table -->
    <div class="overflow-hidden rounded-sm border border-stroke bg-surface shadow-card">
      <DsState v-if="loading" variant="loading" />
      <DsState v-else-if="error" variant="error" title="加载失败" :description="errMsg || '网络异常，考试列表加载失败'">
        <DsButton variant="secondary" @click="load">重试</DsButton>
      </DsState>
      <DsState v-else-if="filtered.length === 0" variant="empty" description="没有匹配的考试，试试调整筛选条件" />
      <template v-else>
        <DsTable :columns="columns" :rows="paged">
          <template #cell-name="{ row }">
            <span class="font-medium">{{ row.name }}</span>
          </template>
          <template #cell-duration="{ row }">{{ row.duration }}分钟</template>
          <template #cell-status="{ row }">
            <DsBadge :variant="EXAM_STATUS[row.status].variant" :label="EXAM_STATUS[row.status].label" />
          </template>
          <template #cell-actions="{ row }">
            <div class="flex gap-3 text-[13px] text-menu">
              <button type="button" class="hover:underline" @click="router.push(`/exams/${row.id}`)">查看</button>
              <button type="button" class="hover:underline">编辑</button>
            </div>
          </template>
        </DsTable>
        <div class="px-3 py-2.5">
          <DsPagination :total="filtered.length" :page="page" :page-size="PAGE_SIZE" @change="page = $event" />
        </div>
      </template>
    </div>
  </PageLayout>
</template>
