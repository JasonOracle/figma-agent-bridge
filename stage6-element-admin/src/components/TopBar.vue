<script setup>
// Figma "Top Bar"（h=40）：Logo 区 180px + 面包屑/全屏/设置/用户
import VIcon from "./VIcon.vue";
</script>

<template>
  <header class="flex h-10 shrink-0 items-stretch bg-surface">
    <!-- Logo 区：占侧边栏同宽 180 -->
    <div class="flex w-[180px] shrink-0 items-center gap-2 pl-3.5">
      <!-- Logo/Mark：双三角（与 Figma 矢量同形） -->
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M 10 2 L 19 19 L 1 19 Z" fill="#5A5CF0" />
        <path d="M 13.5 9.5 L 19 19 L 8 19 Z" fill="#91CC75" />
      </svg>
      <span class="text-[14px] font-bold leading-5 text-ink-1">ElementAdmin</span>
    </div>

    <div class="flex min-w-0 flex-1 items-center gap-3.5 px-4">
      <VIcon name="burger" color="#303133" />
      <span class="text-body text-ink-1">首页</span>
      <div class="min-w-0 flex-1"></div>
      <span class="flex items-center gap-1.5 text-caption text-ink-2">
        <VIcon name="fullscreen" color="#606266" />
        全屏切换
      </span>
      <VIcon name="gear" color="#606266" />
      <span
        class="h-6 w-6 shrink-0 rounded-full bg-[#AAB8E8]"
        role="img"
        aria-label="avatar"
      ></span>
      <span class="num text-caption text-ink-2">admin</span>
    </div>
  </header>
</template>
