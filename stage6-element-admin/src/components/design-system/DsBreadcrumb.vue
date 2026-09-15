<script setup>
/**
 * DS/Breadcrumb —— 对应 Figma DS/Breadcrumb
 * 规格：text 12，分隔符 "/"，ink3；末级 ink1；可点击项 hover 变 primary
 */
defineProps({
  items: { type: Array, required: true }, // [{ label, to? }] 末级不带 to
});
</script>

<template>
  <nav class="flex items-center gap-1.5 text-[12px] leading-[18px] text-ink-3">
    <template v-for="(it, i) in items" :key="i">
      <span v-if="i > 0" class="text-ink-4">/</span>
      <RouterLink v-if="it.to" :to="it.to" class="hover:text-menu">{{ it.label }}</RouterLink>
      <span v-else class="text-ink-1">{{ it.label }}</span>
    </template>
  </nav>
</template>
