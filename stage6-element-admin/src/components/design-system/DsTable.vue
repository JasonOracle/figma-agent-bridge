<script setup>
/**
 * DS/Table —— 对应 Figma DS/Table/{Header,Row,Row/Hover,Row/Selected}
 * 规格：Header 高 40、bg #F2F3F5、text 12 Medium ink2；Row 高 44、border-b #E4E7ED、text 13 ink1；
 *       水平 padding 12、垂直 padding 10；Row hover #F2F3F5
 */
defineProps({
  columns: { type: Array, required: true }, // [{ key, label, width?, align? }]
  rows: { type: Array, required: true },
  rowKey: { type: String, default: "id" },
});
</script>

<template>
  <div class="w-full">
    <table class="w-full border-collapse">
      <thead>
        <tr class="h-10 bg-page">
          <th
            v-for="col in columns"
            :key="col.key"
            class="border-b border-stroke px-3 py-2.5 text-left text-[12px] font-medium leading-[18px] text-ink-2"
            :class="col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''"
            :style="col.width ? { width: col.width } : null"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row[rowKey]"
          class="h-11 border-b border-stroke bg-surface transition-colors hover:bg-page"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            class="px-3 py-2.5 text-[13px] leading-[20px] text-ink-1"
            :class="col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
