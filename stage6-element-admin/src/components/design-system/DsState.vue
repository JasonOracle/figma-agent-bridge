<script setup>
/**
 * DS/State —— 对应 Figma DS/{EmptyState,LoadingState,ErrorState}
 * 规格：卡片内居中，图标 48、标题 16/24 Medium、描述 13/20 ink3；
 *       Empty 勾选框图形、Loading 圆环动画、Error 警告三角（仅 native 简单几何）
 */
defineProps({
  variant: { type: String, default: "empty" }, // empty | loading | error
  title: { type: String, default: "" },
  description: { type: String, default: "" },
});
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-14">
    <!-- empty: 简单勾选框 -->
    <svg v-if="variant === 'empty'" width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="8" width="32" height="32" rx="4" stroke="#C0C4CC" stroke-width="2" />
      <path d="M17 24L22 29L31 19" stroke="#C0C4CC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <!-- loading: 圆环 -->
    <svg v-else-if="variant === 'loading'" width="48" height="48" viewBox="0 0 48 48" fill="none" class="animate-spin">
      <circle cx="24" cy="24" r="18" stroke="#E4E7ED" stroke-width="3" />
      <path d="M24 6A18 18 0 0 1 42 24" stroke="#5A5CF0" stroke-width="3" stroke-linecap="round" />
    </svg>
    <!-- error: 警告三角 -->
    <svg v-else width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M24 7L44 41H4L24 7Z" stroke="#F56C6C" stroke-width="2" stroke-linejoin="round" />
      <path d="M24 20V30" stroke="#F56C6C" stroke-width="2" stroke-linecap="round" />
      <circle cx="24" cy="35" r="1.5" fill="#F56C6C" />
    </svg>
    <p class="text-heading text-ink-1">{{ title || (variant === "empty" ? "暂无数据" : variant === "loading" ? "加载中…" : "加载失败") }}</p>
    <p v-if="description" class="text-[13px] leading-5 text-ink-3">{{ description }}</p>
    <slot />
  </div>
</template>
