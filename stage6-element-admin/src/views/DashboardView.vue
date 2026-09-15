<script setup>
/**
 * DashboardView —— 对应 Figma Frame 19:330 "Reference Recreation / ElementAdmin"
 * 自 Stage 6 App.vue 原样迁移（Stage 9.3 路由化），布局/类名/数据零改动。
 * 纵向：Top Bar(40) → Body[ Sidebar(180) | Main( Tags Bar(36) → Content(p-6, gap-6) ) ]
 */
import TopBar from "../components/TopBar.vue";
import Sidebar from "../components/Sidebar.vue";
import TagsBar from "../components/TagsBar.vue";
import KpiCard from "../components/KpiCard.vue";
import ChartCard from "../components/ChartCard.vue";
import PieChart from "../components/PieChart.vue";
import BarChart from "../components/BarChart.vue";
import LineChart from "../components/LineChart.vue";
import AppFooter from "../components/AppFooter.vue";
import { KPIS, PIE, BAR } from "../data/figma.js";

// Figma "Card / 用户访问来源"
const PIE_TITLE = "用户访问来源";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-page">
    <TopBar />
    <div class="flex min-h-0 flex-1">
      <Sidebar />
      <main class="flex min-w-0 flex-1 flex-col">
        <TagsBar />
        <div
          class="flex flex-1 flex-col gap-6 overflow-hidden p-6"
        >
          <!-- KPI 行 -->
          <div class="grid shrink-0 grid-cols-4 gap-6">
            <KpiCard
              v-for="k in KPIS"
              :key="k.label"
              :label="k.label"
              :value="k.value"
              :icon="k.icon"
              :color="k.color"
            />
          </div>
          <!-- 图表行：饼 717 : 柱 951（Figma 卡高固定 300：pad16 + 标题19 + plot244 + 底部余量5） -->
          <div class="grid shrink-0 grid-cols-[717fr_951fr] gap-6">
            <ChartCard class="h-[300px]" :title="PIE_TITLE">
              <PieChart />
            </ChartCard>
            <ChartCard class="h-[300px]" :title="BAR.title">
              <BarChart />
            </ChartCard>
          </div>
          <!-- 折线卡（全宽，Figma 卡高 352：plot 248 + 底部留白） -->
          <ChartCard class="min-h-[352px] shrink-0">
            <LineChart />
          </ChartCard>
          <AppFooter />
        </div>
      </main>
    </div>
  </div>
</template>
