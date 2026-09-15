<script setup>
/**
 * Figma "Card / 每月销售量" + "Hover State / 二月 Crosshair"。
 * Figma 中 Hover 是结构化状态；这里实现为真实交互：
 * 指针悬停任一月份 → 虚线 crosshair + x 轴药丸 + tooltip 卡 + y 轴指针。
 * 悬停「二月」时所有文案与参考图逐字一致（一月: 120 / 三月: 82 / 1130.94）。
 */
import { ref, computed } from "vue";
import { LINE } from "../data/figma.js";
import { gridPath, dashPath, smoothPath } from "../data/geometry.js";
import LegendItem from "./LegendItem.vue";

const W = 1660, H = 250;
const GX0 = 44, GX1 = 1660;
const yFor = (v) => 232 - (v / LINE.vmax) * 222;
const SLOT = (GX1 - GX0) / LINE.months.length;
const xFor = (i) => GX0 + SLOT * i + SLOT / 2;

const grid = gridPath(GX0, GX1, LINE.axis.map(yFor));
const series = [LINE.s1, LINE.s2].map((s) => ({
  ...s,
  d: smoothPath(s.values.map((v, i) => [xFor(i), yFor(v)])),
  pts: s.values.map((v, i) => [xFor(i), yFor(v)]),
}));

const hoverIdx = ref(-1);

function onMove(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const vx = ((e.clientX - rect.left) / rect.width) * W;
  const i = Math.round((vx - GX0 - SLOT / 2) / SLOT);
  hoverIdx.value = Math.max(0, Math.min(LINE.months.length - 1, i));
}

const hover = computed(() => {
  if (hoverIdx.value < 0) return null;
  const i = hoverIdx.value;
  const hx = xFor(i);
  const tipX = hx + 24 + 124 > W ? hx - 24 - 124 : hx + 24; // 右侧越界时翻到左边
  return {
    hx,
    dash: dashPath(hx, 10, 232),
    pillX: hx - 22,
    month: LINE.months[i],
    // tooltip 以百分比定位（HTML 层，获得真实阴影与字体渲染）
    tipLeft: (tipX / W) * 100 + "%",
    tipTop: (148 / H) * 100 + "%",
    rows: [LINE.s1, LINE.s2].map((s) => ({
      name: s.name,
      value: s.values[i],
      color: s.color,
    })),
    // y 轴指针在 Figma 中为固定位置（plot-rel y=65，不随月份变化）
    pointerY: 65,
  };
});
</script>

<template>
  <div
    class="relative"
    @pointermove="onMove"
    @pointerleave="hoverIdx = -1"
  >
    <!-- 标题行：标题 + 内联图例（Figma lineHead，间距 24，整体居中） -->
    <div class="mb-1 flex items-center justify-center gap-6">
      <h2 class="text-heading text-ink-1">{{ LINE.title }}</h2>
      <div class="flex items-center gap-3">
        <LegendItem
          v-for="s in series"
          :key="s.name"
          :label="s.name"
          :color="s.color"
        />
      </div>
    </div>
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="block w-full cursor-crosshair"
      role="img"
      aria-label="每月销售量折线图"
    >
      <!-- 网格线 -->
      <path :d="grid" stroke="#E4E7ED" stroke-width="1" fill="none" />
      <!-- y 轴刻度 -->
      <text
        v-for="v in [...LINE.axis].reverse()"
        :key="'y' + v"
        x="36"
        :y="yFor(v) + 4"
        text-anchor="end"
        class="num fill-ink-3"
        font-size="11"
      >
        {{ v }}
      </text>
      <!-- x 轴月份 -->
      <text
        v-for="(m, i) in LINE.months"
        :key="m"
        :x="xFor(i)"
        y="247"
        text-anchor="middle"
        class="fill-ink-3"
        font-size="12"
      >
        {{ m }}
      </text>
      <!-- 两条平滑曲线 + 空心数据点 -->
      <g v-for="s in series" :key="s.name">
        <path :d="s.d" :stroke="s.color" stroke-width="2" fill="none" />
        <circle
          v-for="([px, py], i) in s.pts"
          :key="i"
          :cx="px"
          :cy="py"
          r="4"
          fill="#FFFFFF"
          :stroke="s.color"
          stroke-width="2"
        />
      </g>
      <!-- Hover crosshair（真实交互层） -->
      <g v-if="hover">
        <path :d="hover.dash" stroke="#C0C4CC" stroke-width="1" fill="none" />
        <rect
          :x="hover.pillX"
          y="226"
          width="44"
          height="19"
          rx="3"
          fill="#5470C6"
        />
        <text
          :x="hover.hx"
          y="239"
          text-anchor="middle"
          class="fill-white"
          font-size="11"
        >
          {{ hover.month }}
        </text>
        <rect
          x="0"
          :y="hover.pointerY"
          width="52"
          height="18"
          rx="2"
          fill="#5470C6"
        />
        <text
          x="26"
          :y="hover.pointerY + 13"
          text-anchor="middle"
          class="num fill-white"
          font-size="10"
        >
          {{ LINE.pointerText }}
        </text>
      </g>
    </svg>

    <!-- Tooltip 卡（HTML 层） -->
    <div
      v-if="hover"
      class="pointer-events-none absolute flex w-[124px] flex-col gap-[5px] rounded-xs border border-stroke bg-surface p-2.5 shadow-tip"
      :style="{ left: hover.tipLeft, top: hover.tipTop }"
    >
      <span class="text-caption font-bold text-ink-1">{{ hover.month }}</span>
      <span
        v-for="row in hover.rows"
        :key="row.name"
        class="flex items-center gap-1.5"
      >
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :style="{ background: row.color }"
        ></span>
        <span class="num text-caption text-ink-2"
          >{{ row.name }}: {{ row.value }}</span
        >
      </span>
    </div>
  </div>
</template>
