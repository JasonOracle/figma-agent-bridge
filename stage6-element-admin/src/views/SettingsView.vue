<script setup>
/**
 * SettingsView —— 对应 Figma Page/Settings (8:1215)
 * 结构：Breadcrumb → 标题 → 分组卡（系统设置 / AI 设置 / 通知设置）→ Footer(保存/取消)
 * 表单行：label 120 + 控件；开关复用 DS/Toggle（Figma 原生 Frame+ellipse 的 Vue 实现）
 */
import { reactive } from "vue";
import PageLayout from "../components/layout/PageLayout.vue";
import DsBreadcrumb from "../components/design-system/DsBreadcrumb.vue";
import DsButton from "../components/design-system/DsButton.vue";
import DsCard from "../components/design-system/DsCard.vue";
import DsInput from "../components/design-system/DsInput.vue";
import DsSelect from "../components/design-system/DsSelect.vue";
import DsToggle from "../components/design-system/DsToggle.vue";

const form = reactive({
  systemName: "ElementAdmin 考试平台",
  logo: "https://cdn.example.com/logo.svg",
  defaultDuration: "120",
  aiEnabled: true,
  aiModel: "gpt-4o",
  tokenQuota: "500,000",
  emailNotify: true,
  systemNotify: false,
});

const modelOptions = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "glm-4", label: "GLM-4" },
  { value: "qwen-max", label: "Qwen-Max" },
];

function save() {
  /* Mock：无后端，保存即置成功态 */
}
</script>

<template>
  <PageLayout>
    <DsBreadcrumb :items="[{ label: '首页', to: '/dashboard' }, { label: '系统设置' }]" />

    <h1 class="text-display text-ink-1">系统设置</h1>

    <div class="flex max-w-3xl flex-col gap-4">
      <!-- 系统设置 -->
      <DsCard title="系统设置">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <label class="w-[120px] shrink-0 text-[13px] leading-5 text-ink-2">系统名称</label>
            <DsInput v-model="form.systemName" class="w-80" />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-[120px] shrink-0 text-[13px] leading-5 text-ink-2">Logo</label>
            <DsInput v-model="form.logo" class="w-80" />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-[120px] shrink-0 text-[13px] leading-5 text-ink-2">默认考试时间</label>
            <DsInput v-model="form.defaultDuration" class="w-80" placeholder="单位：分钟" />
          </div>
        </div>
      </DsCard>

      <!-- AI 设置 -->
      <DsCard title="AI 设置">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <label class="w-[120px] shrink-0 text-[13px] leading-5 text-ink-2">AI 开关</label>
            <DsToggle v-model="form.aiEnabled" />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-[120px] shrink-0 text-[13px] leading-5 text-ink-2">模型选择</label>
            <DsSelect v-model="form.aiModel" :options="modelOptions" width="w-80" />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-[120px] shrink-0 text-[13px] leading-5 text-ink-2">Token 额度</label>
            <DsInput v-model="form.tokenQuota" class="w-80" :disabled="!form.aiEnabled" />
          </div>
        </div>
      </DsCard>

      <!-- 通知设置 -->
      <DsCard title="通知设置">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <label class="w-[120px] shrink-0 text-[13px] leading-5 text-ink-2">邮件通知</label>
            <DsToggle v-model="form.emailNotify" />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-[120px] shrink-0 text-[13px] leading-5 text-ink-2">系统通知</label>
            <DsToggle v-model="form.systemNotify" />
          </div>
        </div>
      </DsCard>

      <!-- Footer Actions -->
      <div class="flex items-center gap-2">
        <DsButton variant="primary" @click="save">保存设置</DsButton>
        <DsButton variant="ghost">取消</DsButton>
      </div>
    </div>
  </PageLayout>
</template>
