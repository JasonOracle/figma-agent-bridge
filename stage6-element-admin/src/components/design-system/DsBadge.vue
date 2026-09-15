<script setup>
/**
 * DS/Badge —— 对应 Figma DS/Badge/{Success,Warning,Error,Info,Neutral}
 * 规格（badgeOps）：8×8 圆点 + text 12，gap 6，透明底，文字/圆点同色
 */
defineProps({
  variant: { type: String, default: "neutral" }, // success | warning | error | info | neutral
  label: { type: String, required: true },
});
const COLOR = {
  success: "#67C23A",
  warning: "#FAC858",
  error: "#F56C6C",
  info: "#409EFF",
  neutral: "#909399",
};
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-[12px] leading-[18px]" :style="{ color: COLOR[variant] }">
    <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: COLOR[variant] }" />
    {{ label }}
  </span>
</template>
