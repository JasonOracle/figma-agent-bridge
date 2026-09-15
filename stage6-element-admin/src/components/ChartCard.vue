<script setup>
// Figma "Card / ×"（radius 4 + shadow-card + pad 16，标题行居中）
const props = defineProps({
  title: { type: String, default: "" }, // 折线卡自带标题行，传空隐藏
});
</script>

<template>
  <section class="flex min-w-0 flex-col rounded-sm bg-surface p-4 shadow-card">
    <div v-if="title" class="flex justify-center">
      <h2 class="text-heading text-ink-1 leading-[19px]">{{ title }}</h2>
    </div>
    <slot />
  </section>
</template>
