<script setup>
// Figma "Card / 用户访问来源"：5 个贝塞尔扇形 + 引导线 + 标注 + 左下纵向图例
// plot 视窗 685×244，圆心 (250,118)，半径 72 —— 与 Figma 常量一致
import { PIE } from "../data/figma.js";
import { arcSectorPath } from "../data/geometry.js";
import LegendItem from "./LegendItem.vue";

const CX = 250, CY = 118, R = 72;

const sectors = [];
const labels = [];
const leaders = [];
{
  let a = -Math.PI / 2;
  PIE.forEach((item) => {
    const span = (item.pct / 100) * Math.PI * 2;
    sectors.push({ d: arcSectorPath(CX, CY, R, a, a + span), color: item.color });
    const mid = a + span / 2;
    const x1 = CX + (R + 5) * Math.cos(mid), y1 = CY + (R + 5) * Math.sin(mid);
    const x2 = CX + (R + 20) * Math.cos(mid), y2 = CY + (R + 20) * Math.sin(mid);
    const lx = CX + (R + 26) * Math.cos(mid), ly = CY + (R + 26) * Math.sin(mid);
    const right = Math.cos(mid) >= 0;
    leaders.push(`M ${x1} ${y1} L ${x2} ${y2}`);
    labels.push({
      x: right ? lx + 3 : lx - 3,
      y: ly + 4,
      anchor: right ? "start" : "end",
      label: item.label,
    });
    a += span;
  });
}
</script>

<template>
  <div class="relative">
    <svg
      viewBox="0 0 685 244"
      class="block w-full"
      role="img"
      aria-label="用户访问来源饼图"
    >
      <path v-for="(s, i) in sectors" :key="i" :d="s.d" :fill="s.color" />
      <path
        :d="leaders.join(' ')"
        stroke="#909399"
        stroke-width="1"
        fill="none"
      />
      <text
        v-for="(l, i) in labels"
        :key="'t' + i"
        :x="l.x"
        :y="l.y"
        :text-anchor="l.anchor"
        class="fill-ink-1"
        font-size="11"
      >
        {{ l.label }}
      </text>
    </svg>

    <!-- 图例：左下纵向（Figma 位置 12,122，间距 7） -->
    <div class="absolute left-3 top-1/2 flex -translate-y-[13px] flex-col gap-[7px]">
      <LegendItem
        v-for="item in PIE"
        :key="item.label"
        :label="item.label"
        :color="item.color"
      />
    </div>
  </div>
</template>
