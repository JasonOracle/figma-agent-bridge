<script setup>
// Figma "Footer"（Copyright © 2021-present ElementAdmin，12px ink-3，水平居中）
import { FOOTER_TEXT } from "../data/figma.js";
</script>

<template>
  <footer class="flex justify-center pt-4">
    <span class="text-caption text-ink-3">{{ FOOTER_TEXT }}</span>
  </footer>
</template>
