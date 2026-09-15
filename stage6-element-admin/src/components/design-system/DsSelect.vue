<script setup>
/**
 * DS/Select —— 对应 Figma DS/Select/Default
 * 规格：高 30、w160、px12、radius 6、两端对齐、chevron 12
 */
defineProps({
  modelValue: { type: String, default: "" },
  options: { type: Array, default: () => [] }, // [{ label, value }]
  placeholder: { type: String, default: "" },
  width: { type: String, default: "w-40" },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="relative" :class="width">
    <select
      :value="modelValue"
      class="h-[30px] w-full appearance-none rounded-md border border-stroke bg-surface px-3 pr-7 text-[13px] leading-[18px] text-ink-1 focus:border-menu focus:outline-none"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
    >
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#909399" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </div>
</template>
