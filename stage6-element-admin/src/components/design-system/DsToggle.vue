<script setup>
/**
 * DS/Toggle —— 对应 Figma 9.2-B Settings 开关（原生 Frame+ellipse 构造，非正式 DS Component）
 * 规格：36×20 轨道，radius full，16×16 圆钮；on #5A5CF0 / off #C0C4CC
 */
defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="relative h-5 w-9 rounded-full transition-colors"
    :class="modelValue ? 'bg-menu' : 'bg-ink-4'"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      class="absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-card transition-transform"
      :class="modelValue ? 'translate-x-[18px]' : 'translate-x-0.5'"
    />
  </button>
</template>
