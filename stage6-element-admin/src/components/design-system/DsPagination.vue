<script setup>
/**
 * DS/Pagination —— 对应 Figma DS/Pagination/{Default,Active,Disabled}
 * 规格：item 24×24、radius 6、text 12；Active bg #5A5CF0 white；Disabled ink4；
 *       左侧「共 N 条」右侧「每页 10 条」（9.2-B ExamList footer 规格）
 */
import { computed } from "vue";

const props = defineProps({
  total: { type: Number, required: true },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
});
const emit = defineEmits(["change"]);

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const pages = computed(() => {
  const t = totalPages.value, c = props.page, out = [];
  for (let i = 1; i <= t; i++) {
    if (i === 1 || i === t || Math.abs(i - c) <= 1) out.push(i);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
});
function go(p) {
  if (p < 1 || p > totalPages.value || p === props.page) return;
  emit("change", p);
}
</script>

<template>
  <div class="flex items-center justify-between">
    <span class="text-caption text-ink-3">共 {{ total }} 条</span>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-[12px] leading-4"
        :class="page <= 1 ? 'text-ink-4' : 'text-ink-2 hover:bg-page'"
        :disabled="page <= 1"
        @click="go(page - 1)"
      >‹</button>
      <template v-for="(p, i) in pages" :key="i">
        <span v-if="p === '…'" class="px-1 text-[12px] text-ink-4">…</span>
        <button
          v-else
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-md text-[12px] leading-4"
          :class="p === page ? 'bg-menu text-white' : 'text-ink-2 hover:bg-page'"
          @click="go(p)"
        >{{ p }}</button>
      </template>
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-[12px] leading-4"
        :class="page >= totalPages ? 'text-ink-4' : 'text-ink-2 hover:bg-page'"
        :disabled="page >= totalPages"
        @click="go(page + 1)"
      >›</button>
    </div>
    <span class="text-caption text-ink-3">每页 {{ pageSize }} 条</span>
  </div>
</template>
