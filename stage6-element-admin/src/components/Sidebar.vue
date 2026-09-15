<script setup>
// Figma "Sidebar"（w=180，padY=8）：6 个导航行
import MenuItem from "./MenuItem.vue";
import { NAV } from "../data/figma.js";
</script>

<template>
  <aside class="flex w-[180px] shrink-0 flex-col bg-surface py-2">
    <MenuItem
      v-for="item in NAV"
      :key="item.label"
      :label="item.label"
      :icon="item.icon"
      :variant="item.variant"
      :indent="item.indent"
    />
  </aside>
</template>
