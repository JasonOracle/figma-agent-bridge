<script setup>
/**
 * DS/Card —— 对应 Figma DS/Card/BaseCard
 * 规格：白底、radius 4、card shadow（0 1px 4px rgba(0,0,0,0.06)）、padding 16
 */
defineProps({
  title: { type: String, default: "" },
});
</script>

<template>
  <div class="rounded-sm bg-surface p-4 shadow-card">
    <h3 v-if="title" class="mb-3 text-heading text-ink-1">{{ title }}</h3>
    <slot />
  </div>
</template>
