<script setup>
/**
 * DS/Input —— 对应 Figma DS/Input/{Default,Focus,Error}
 * 规格：高 30、px12、radius 6、border 1（Default #E4E7ED / Focus #5A5CF0 / Error #F56C6C）、text 13
 */
defineProps({
  modelValue: { type: String, default: "" },
  placeholder: { type: String, default: "" },
  icon: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div
    class="inline-flex h-[30px] items-center gap-1.5 rounded-md border bg-surface px-3 transition-colors focus-within:border-menu"
    :class="disabled ? 'border-stroke opacity-60' : 'border-stroke'"
  >
    <svg v-if="icon" width="14" height="14" viewBox="0 0 14 14" fill="none" class="shrink-0">
      <circle cx="6" cy="6" r="4.5" stroke="#909399" stroke-width="1.5" />
      <path d="M9.5 9.5L12.5 12.5" stroke="#909399" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    <input
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full bg-transparent text-[13px] leading-[18px] text-ink-1 placeholder:text-ink-3 focus:outline-none"
      @input="emit('update:modelValue', $event.target.value)"
    />
  </div>
</template>
