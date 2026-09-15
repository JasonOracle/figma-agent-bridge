<script setup>
/**
 * 内联 SVG 图标——对应 Figma 中由原生 Vector 构建的图标。
 * Stage 7 修正：Figma 渲染中 KPI 的 people/chat/cart 为实心填充（约 16px），
 * sidebar 的 grid/doc 为大号实心块；其余为线性。
 */
const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 14 },
  color: { type: String, default: "#303133" },
});

const PATHS = {
  house: "M2 8.5 L8 3 L14 8.5 M3.5 7.5 V13.5 H12.5 V7.5 M6.5 13.5 V9.5 H9.5 V13.5",
  burger: "M2 4 H14 M2 8 H14 M2 12 H14",
  fullscreen: "M2 6 V2 H6 M10 2 H14 V6 M14 10 V14 H10 M6 14 H2 V10",
  gear: "M8 5.5 A2.5 2.5 0 1 0 8 10.5 A2.5 2.5 0 1 0 8 5.5 M8 1.5 V3 M8 13 V14.5 M1.5 8 H3 M13 8 H14.5 M3.4 3.4 L4.5 4.5 M11.5 11.5 L12.6 12.6 M12.6 3.4 L11.5 4.5 M4.5 11.5 L3.4 12.6",
  close: "M4 4 L12 12 M12 4 L4 12",
};

/* 实心图标：Figma 渲染为填充 glyph */
const FILLED = {
  people:
    "M5.6 7.2 A2.5 2.5 0 1 0 5.6 2.2 A2.5 2.5 0 0 0 5.6 7.2 Z M10.6 7 A2.2 2.2 0 1 0 10.6 2.7 A2.2 2.2 0 0 0 10.6 7 Z M5.6 8.6 C3 8.6 0.9 10.2 0.9 12.9 L0.9 14 L10.3 14 L10.3 12.9 C10.3 10.2 8.2 8.6 5.6 8.6 Z M13.9 8.8 C12.9 8.2 11.8 8 10.8 8.1 C11.9 9 12.6 10.3 12.6 12 L12.6 14 L15.1 14 L15.1 12.6 C15.1 10.9 14.6 9.6 13.9 8.8 Z",
  chat:
    "M2 2.5 C1.2 2.5 0.5 3.2 0.5 4 L0.5 10.5 C0.5 11.3 1.2 12 2 12 L4.5 12 L4.5 14.8 L8.2 12 L14 12 C14.8 12 15.5 11.3 15.5 10.5 L15.5 4 C15.5 3.2 14.8 2.5 14 2.5 Z M4.5 8 A1 1 0 1 1 4.5 6 A1 1 0 0 1 4.5 8 Z M8 8 A1 1 0 1 1 8 6 A1 1 0 0 1 8 8 Z M11.5 8 A1 1 0 1 1 11.5 6 A1 1 0 0 1 11.5 8 Z",
  cart:
    "M1.2 2 A0.9 0.9 0 0 1 1.2 0.2 L3 0.2 A0.9 0.9 0 0 1 3.9 0.9 L4.4 3 L14.6 3 C15.2 3 15.6 3.5 15.5 4.1 L14.6 8.6 C14.5 9.3 13.9 9.8 13.2 9.8 L5.7 9.8 L6 11.2 L13.4 11.2 L13.4 13 L5.4 13 C4.6 13 3.9 12.4 3.7 11.6 L2.1 4.4 L1.6 2 Z M5.8 15.8 A1.1 1.1 0 1 1 5.8 13.6 A1.1 1.1 0 0 1 5.8 15.8 Z M12 15.8 A1.1 1.1 0 1 1 12 13.6 A1.1 1.1 0 0 1 12 15.8 Z",
  grid: "M2 2 H7 V7 H2 Z M9 2 H14 V7 H9 Z M2 9 H7 V14 H2 Z M9 9 H14 V14 H9 Z",
  doc: "M3 1.5 H10 L13.2 4.7 V14.5 H3 Z M5 7.5 H11.2 M5 10 H11.2 M5 12.5 H9.4",
};

const mode = ["people", "chat", "cart", "grid", "doc"].includes(props.name)
  ? "fill"
  : "stroke";
const d =
  mode === "fill" ? FILLED[props.name] : PATHS[props.name];
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    :fill="mode === 'fill' ? color : 'none'"
    :stroke="mode === 'stroke' ? color : 'none'"
    :stroke-width="mode === 'stroke' ? 1.3 : undefined"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- doc：实心外形 + 白色镂空线条 -->
    <template v-if="name === 'doc'">
      <path :d="FILLED.doc.split(' M')[0]" :fill="color" stroke="none" />
      <path
        :d="'M' + FILLED.doc.split(' M').slice(1).join(' M')"
        fill="none"
        stroke="#FFFFFF"
        stroke-width="1.1"
        stroke-linecap="round"
      />
    </template>
    <template v-else>
      <path :d="d" />
    </template>
  </svg>
</template>
