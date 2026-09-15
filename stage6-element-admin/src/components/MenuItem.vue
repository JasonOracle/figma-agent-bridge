<script setup>
// Figma "Menu Item / Nav Item / Menu Item Sub" 的统一行实现（复用 6 次）
import VIcon from "./VIcon.vue";

const props = defineProps({
  label: { type: String, required: true },
  icon: { type: String, default: "" },
  variant: { type: String, default: "default" }, // default | active | sub
  indent: { type: Number, default: 40 },
});
</script>

<template>
  <button
    class="flex w-full shrink-0 items-center text-left"
    :class="[
      variant === 'sub' ? 'h-8' : 'h-10',
      variant === 'active'
        ? 'bg-menu'
        : 'hover:bg-page',
    ]"
    :style="{ paddingLeft: (variant === 'sub' ? indent : 20) + 'px' }"
    :aria-current="variant === 'active' ? 'page' : undefined"
  >
    <VIcon
      v-if="icon"
      :name="icon"
      :size="14"
      :color="variant === 'active' ? '#FFFFFF' : '#303133'"
    />
    <span
      class="ml-2.5 text-body"
      :class="variant === 'active' ? 'font-medium text-white' : 'text-ink-1'"
      >{{ label }}</span
    >
  </button>
</template>
