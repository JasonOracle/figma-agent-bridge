<script setup>
/**
 * UserListView —— 对应 Figma Page/UserList (4:235)
 * 结构：Breadcrumb → 标题行 → Filter Area(Search/Status/Actions) → User Table → Pagination；Empty/Error 状态
 */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import PageLayout from "../components/layout/PageLayout.vue";
import DsBreadcrumb from "../components/design-system/DsBreadcrumb.vue";
import DsButton from "../components/design-system/DsButton.vue";
import DsInput from "../components/design-system/DsInput.vue";
import DsSelect from "../components/design-system/DsSelect.vue";
import DsTable from "../components/design-system/DsTable.vue";
import DsBadge from "../components/design-system/DsBadge.vue";
import DsPagination from "../components/design-system/DsPagination.vue";
import DsState from "../components/design-system/DsState.vue";
import { fetchUsers, USER_STATUS } from "../mock/users.js";

const route = useRoute();
const columns = [
  { key: "name", label: "用户" },
  { key: "email", label: "邮箱", width: "240px" },
  { key: "role", label: "角色", width: "110px" },
  { key: "status", label: "状态", width: "110px" },
  { key: "createdAt", label: "创建时间", width: "140px" },
  { key: "actions", label: "操作", width: "130px" },
];

const loading = ref(true);
const error = ref(false);
const allUsers = ref([]);
const keyword = ref("");
const status = ref("");
const page = ref(1);
const PAGE_SIZE = 10;

const statusOptions = Object.entries(USER_STATUS).map(([value, s]) => ({ value, label: s.label }));

async function load() {
  loading.value = true;
  error.value = false;
  try {
    allUsers.value = await fetchUsers({ state: route.query.state });
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const filtered = computed(() =>
  allUsers.value.filter(
    (u) =>
      (!keyword.value || u.name.includes(keyword.value) || u.email.includes(keyword.value)) &&
      (!status.value || u.status === status.value),
  ),
);
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));

function reset() {
  keyword.value = "";
  status.value = "";
  page.value = 1;
}
</script>

<template>
  <PageLayout>
    <DsBreadcrumb :items="[{ label: '首页', to: '/dashboard' }, { label: '用户管理' }]" />

    <!-- 标题行 -->
    <div class="flex items-center justify-between">
      <h1 class="text-display text-ink-1">用户管理</h1>
      <DsButton variant="primary">+ 新建用户</DsButton>
    </div>

    <!-- Filter Area -->
    <div class="flex items-center gap-3">
      <DsInput v-model="keyword" icon placeholder="搜索用户名、邮箱" class="w-60" @update:model-value="page = 1" />
      <DsSelect v-model="status" :options="statusOptions" placeholder="状态" @update:model-value="page = 1" />
      <div class="flex gap-2">
        <DsButton variant="secondary">搜索</DsButton>
        <DsButton variant="ghost" @click="reset">重置</DsButton>
      </div>
    </div>

    <!-- User Table -->
    <div class="overflow-hidden rounded-sm border border-stroke bg-surface shadow-card">
      <DsState v-if="loading" variant="loading" />
      <DsState
        v-else-if="error"
        variant="error"
        title="加载失败"
        description="网络异常，用户列表加载失败"
      >
        <DsButton variant="secondary" @click="load">重试</DsButton>
      </DsState>
      <DsState v-else-if="filtered.length === 0" variant="empty" description="没有匹配的用户，试试调整筛选条件" />
      <template v-else>
        <DsTable :columns="columns" :rows="paged">
          <template #cell-name="{ row }">
            <div class="flex items-center gap-2">
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white"
                :style="{ backgroundColor: row.avatar }"
              >{{ row.name[0] }}</span>
              <span class="font-medium">{{ row.name }}</span>
            </div>
          </template>
          <template #cell-status="{ row }">
            <DsBadge :variant="USER_STATUS[row.status].variant" :label="USER_STATUS[row.status].label" />
          </template>
          <template #cell-actions>
            <div class="flex gap-3 text-[13px] text-menu">
              <button type="button" class="hover:underline">查看</button>
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
