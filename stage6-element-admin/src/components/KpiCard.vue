<script setup>
// Figma "KPI Card / ×4"（405×72，padX 20，图标槽 30 + Spacer + 右对齐文本块）
import VIcon from "./VIcon.vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  icon: { type: String, required: true },
  color: { type: String, required: true },
});
</script>

<template>
  <div
    class="flex h-[72px] items-center gap-3 rounded-sm bg-surface px-5 shadow-card"
  >
    <div class="flex h-[30px] w-[30px] shrink-0 items-center justify-center">
      <!-- 交易金额：Figma 中即为 ¥ 文本节点（26/700） -->
      <span
        v-if="icon === 'yen'"
        class="num text-display leading-none"
        :style="{ color }"
        >¥</span
      >
      <VIcon v-else :name="icon" :size="16" :color="color" />
    </div>
    <div class="min-w-0 flex-1"></div>
    <div class="flex flex-col items-end gap-0.5">
      <span class="text-body text-ink-3">{{ label }}</span>
      <span class="num text-display text-ink-1">{{ value }}</span>
    </div>
  </div>
</template>
