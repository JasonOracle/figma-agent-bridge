<script setup>
/**
 * DS/Button —— 对应 Figma DS/Button/{Primary,Secondary,Ghost,Danger}
 * 规格（tools/stage9-2a-build.mjs buttonOps）：高 30、px14/py5、radius 6、gap 6、text 13 Medium
 */
defineProps({
  variant: { type: String, default: "primary" }, // primary | secondary | ghost | danger
});
</script>

<template>
  <button
    type="button"
    class="inline-flex h-[30px] items-center gap-1.5 rounded-md px-3.5 py-[5px] text-[13px] font-medium leading-[18px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'bg-menu text-white hover:opacity-90': variant === 'primary',
      'border border-stroke bg-surface text-ink-1 hover:border-menu hover:text-menu': variant === 'secondary',
      'text-ink-2 hover:bg-page hover:text-ink-1': variant === 'ghost',
      'bg-kpi-red text-white hover:opacity-90': variant === 'danger',
    }"
  >
    <slot />
  </button>
</template>
