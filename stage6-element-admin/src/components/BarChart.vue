<script setup>
// Figma "Card / 每周用户活跃量"：网格线 + 7 根柱 + 轴标签 + 右上悬浮徽标
// plot 视窗 919×244，gx0=52，yFor = 232 - v/30500*208 —— 与 Figma 常量一致
import { BAR } from "../data/figma.js";
import { gridPath } from "../data/geometry.js";

const GX0 = 52, GX1 = 919;
const yFor = (v) => 232 - (v / BAR.vmax) * 208;
const SLOT = (GX1 - GX0) / BAR.values.length;
const BW = 44;

const grid = gridPath(GX0, GX1, BAR.axis.map(yFor));
const bars = BAR.values.map((v, i) => {
  const by = yFor(v);
  return {
    x: GX0 + SLOT * i + (SLOT - BW) / 2,
    y: by,
    h: 232 - by,
    label: BAR.labels[i],
    cx: GX0 + SLOT * i + SLOT / 2,
    value: v.toLocaleString("en-US"),
  };
});
</script>

<template>
  <div class="relative">
    <svg
      viewBox="0 0 919 244"
      class="block w-full"
      role="img"
      aria-label="每周用户活跃量柱状图"
    >
      <!-- 网格线 -->
      <path :d="grid" stroke="#E4E7ED" stroke-width="1" fill="none" />
      <!-- y 轴刻度（右对齐到 x=44） -->
      <text
        v-for="v in [...BAR.axis].reverse()"
        :key="'y' + v"
        x="44"
        :y="yFor(v) + 4"
        text-anchor="end"
        class="num fill-ink-3"
        font-size="11"
      >
        {{ v.toLocaleString("en-US") }}
      </text>
      <!-- 柱 + x 标签 -->
      <g v-for="(b, i) in bars" :key="b.label">
        <rect :x="b.x" :y="b.y" :width="BW" :height="b.h" fill="#5470C6" />
        <text
          :x="b.cx"
          y="245"
          text-anchor="middle"
          class="fill-ink-3"
          font-size="12"
        >
          {{ b.label }}
        </text>
      </g>
    </svg>

    <!-- 悬浮徽标（Figma "Bar Chart / Hover Badge" 62×40，plot 右缘内缩 56，设计内常驻） -->
    <div
      class="absolute right-[56px] top-[30px] flex flex-col gap-[2px] rounded-xs border border-stroke bg-surface p-1.5 shadow-tip"
    >
      <span class="num text-number leading-[12px] text-kpi-green">{{ BAR.badge.value }}</span>
      <span class="num text-number leading-[12px] text-kpi-red">{{ BAR.badge.delta }}</span>
    </div>
  </div>
</template>
