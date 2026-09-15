<script setup>
// Figma "Tags Bar"（h=36）+ Tag 实例 ×2（Tag 组件 = Icon + Label）+ 右侧 burger
// tag1 未覆写 → menu 色图标；tag2 覆写图标为灰色（对应 set-stroke t4/1.3）
import { TAGS } from "../data/figma.js";
import VIcon from "./VIcon.vue";
</script>

<template>
  <nav class="flex h-9 shrink-0 items-center gap-2.5 bg-surface px-3">
    <!-- Figma Tag 组件 = Icon(12) + Label，无背景/无边框/无关闭钮 -->
    <span
      v-for="tag in TAGS"
      :key="tag.label"
      class="flex h-[22px] shrink-0 cursor-default items-center gap-[5px] text-caption"
      :class="tag.active ? 'text-menu' : 'text-ink-3'"
    >
      <VIcon
        name="house"
        :size="12"
        :color="tag.active ? '#5A5CF0' : '#C0C4CC'"
      />
      {{ tag.label }}
    </span>
    <div class="min-w-0 flex-1"></div>
    <VIcon name="burger" color="#909399" />
  </nav>
</template>
