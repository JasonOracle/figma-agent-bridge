<script setup>
// Figma "Legend Item" 组件实例（10×10 色块 + 12px 文字 ink-2）
const props = defineProps({
  label: { type: String, required: true },
  color: { type: String, required: true },
});
</script>

<template>
  <span class="flex items-center gap-1.5">
    <span
      class="h-2.5 w-2.5 shrink-0"
      :style="{ background: color }"
      aria-hidden="true"
    ></span>
    <span class="text-caption text-ink-2">{{ label }}</span>
  </span>
</template>
