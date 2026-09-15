<script setup>
/**
 * PageLayout —— Stage 9 页面通用骨架（对应 Figma 9.2 各页的 TopBar+Sidebar+TagsBar 复用结构）
 * 复用 Stage 6 已有 TopBar/Sidebar/TagsBar，内容区 p-6 gap-4，可纵向滚动。
 */
import TopBar from "../TopBar.vue";
import Sidebar from "../Sidebar.vue";
import TagsBar from "../TagsBar.vue";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-page">
    <TopBar />
    <div class="flex min-h-0 flex-1">
      <Sidebar />
      <main class="flex min-w-0 flex-1 flex-col">
        <TagsBar />
        <div class="flex flex-1 flex-col gap-4 overflow-auto p-6">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
