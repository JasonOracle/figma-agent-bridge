# Stage 4 — figma2code 分析：PixelFlow AI（Vue 3 + Tailwind）

来源：真实画布读回（`.vibe/stage4-tree.json`，188 节点）+ `tools/stage4-build.js` 令牌。
根 Frame：`PixelFlow AI`（id `14:2039`）。

## 1. Dark Tokens → tailwind.config.js

```js
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#0A0C10", canvas: "#0E1116" },
        surface: { DEFAULT: "#14181F", hi: "#1B2029" },
        line: "#262D3A",                                   // border
        primary: { DEFAULT: "#6E7BFF", soft: "#1D2440" },
        success: "#3ECF8E", warning: "#F5B84A", danger: "#F26D6D",
        aura: { violet: "#9B7BFF", sky: "#5AC8FA", pink: "#F27FB2" },
        ink: { 1: "#F2F4F8", 2: "#A9B1C0", 3: "#6C7686" },
      },
      borderRadius: { sm: "6px", md: "10px", lg: "14px" },  // pill 用 rounded-full
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,.3)",
        glow: "0 4px 16px rgba(110,123,255,.22)",           // Generate 主按钮
      },
      fontFamily: { sans: ["Inter", "system-ui"], mono: ["Inter", "monospace"] },
    },
  },
};
```

字阶：Display 28/600、Heading 18/600、Body 13、Caption 11、Numeric 13/600（`tabular-nums`）。全部 Inter（本页无中文 UI 文案）。

## 2. 17 个 Figma 组件 → Vue SFC

| Figma 组件 | 实例 | Vue 组件 | props |
|---|---|---|---|
| Button/Primary · Secondary · Ghost | 1/1/3 | `BaseButton.vue` | `variant`, `icon?` |
| Icon Button | 1 | `IconButton.vue` | `icon: "bell"` |
| Input | 1 | `SearchInput.vue` | `placeholder` |
| Textarea | 1 | `PromptTextarea.vue` | `v-model`, `maxLength=1000` |
| Select | 1 | `SelectField.vue` | `options: [1024,1536,2048]` |
| Chip / Chip/Active | 7 | `ToggleChip.vue` | `label`, `active`（Figma 双组件 → Vue 单组件类切换） |
| Tab / Tab/Active | 2 | `TabBar.vue` | `tabs`, `activeKey` |
| Slider | 0（页面用原生结构） | `SliderField.vue` | `label`, `value`, `pct` |
| Card | 0（模式文档） | `PanelCard.vue` | 具名插槽 |
| Badge | 0 实例 | `Badge.vue` | `tone` |
| Avatar | 2 | `UserAvatar.vue` | `initial`, `size` |
| Nav Item(/Active) | 0（原生行+真图标） | `NavItem.vue` | `icon`, `label`, `active` |

> 结构性说明（与画布一致，非缺陷掩饰）：Slider/Card/NavItem 的页面实例需要改子节点几何或插入子节点，超出实例覆写能力 → 页面上为原生 frame，代码层反而更干净（单组件 + props）。

## 3. 页面组件树

```
App.vue (bg-bg, h-screen, flex, font-sans)
└─ StudioLayout.vue                       ← PixelFlow AI (1440×900)
   ├─ Sidebar.vue        w-[240px] bg-surface border-r border-line p-4 flex-col gap-5
   │  ├─ BrandBlock（28px primary 圆角块 + sparkle + "PixelFlow / AI IMAGE STUDIO"）
   │  ├─ nav: NavItem ×5（Create=active / Projects / Assets / History / Settings）
   │  └─ UserCard（Avatar + Aria Chen / Acme Workspace, mt-auto）
   ├─ 1px 分隔条（border-line）
   └─ Main.vue           flex-1 flex-col
      ├─ StudioHeader.vue h-16 border-b flex items-center gap-3 px-6
      │  ├─ 项目标题块（Nightfall Series + Flux v2 · 24 images）
      │  ├─ spacer / SearchInput(240) / CreditsPill(142 credits + success dot)
      │  └─ IconButton(bell) + UserAvatar
      └─ Workspace.vue   flex-1 flex gap-5 p-6
         ├─ ControlsPanel.vue w-[380px] flex-col gap-[18px]
         │  ├─ PromptCard（Prompt + "140 / 1000" 计数 + PromptTextarea）
         │  ├─ ParamSection "Aspect Ratio"：ToggleChip ×3（1:1 active）
         │  ├─ ParamSection "Image Size"：SelectField（1024 px）
         │  ├─ ParamSection "Style"：ToggleChip ×4（Cinematic active）
         │  ├─ AdvancedCard：SliderField ×3（Steps 32 / Guidance 7.5 / Seed 42）
         │  └─ BaseButton primary glow 全宽 "Generate ✦"
         └─ PreviewPanel.vue flex-1 flex-col gap-4
            ├─ PreviewCanvas.vue  752×558 rounded-lg bg-[#12151C] overflow-hidden relative
            │  ├─ aurora：3 个 blur 色斑（violet .26 / primary .18 / sky .14）
            │  ├─ 同心 ring ×2 + 中心 sparkle（白色 .92）
            │  ├─ Tabs 浮层（Latest active / Variations，bg-bg/70 backdrop）
            │  └─ MetaPill 底部居中（Seed 42 · Steps 32 · Guidance 7.5）
            ├─ PreviewToolbar.vue：Download / Edit / Variation / Upscale + "1024 × 1024 · PNG"
            └─ HistoryCard.vue：4×HistoryThumb（orb+horizon+sun 迷你构图 + 时间戳）
```

## 4. 预览占位图 → 代码还原（关键）

画布用 3 层 Ellipse（低透明度）+ 2 个同心 ring + sparkle 矢量构成「生成主体」占位。代码层两条路线：

1. **保真**：保留 DOM 结构，`<div class="rounded-full bg-aura-violet/25 blur-3xl">` ×3 + SVG ring/sparkle —— 零依赖、像素级对应（推荐首版）；
2. 接入真实生成 API 后替换为 `<img>`，占位层保留为 loading 态骨架。

## 5. 还原度最敏感的设计细节

1. **间距节奏**：Controls 纵向 `gap-[18px]`、卡片内 `p-4 + gap-2.5` —— 参数区的呼吸感全靠它；
2. **层级只用 3 个面**：bg → surface → surfaceHi，所有 border 统一 `#262D3A`；多一层白/灰都会破坏暗色沉浸感；
3. **Generate 的 glow 阴影**是页面唯一彩色投影，是视觉重心，不能丢；
4. **数字全部 `tabular-nums`**（credits、参数值、seed）；
5. **历史缩略图**：每张不同底色 tint + 单 accent 色斑，代码里用 4 组常量数组渲染。

## 6. 交互缺口（设计稿未覆盖，代码层补）

- Prompt 输入 → Generate 的 loading/progress 态；历史项 hover 阴影与点击载入；
- Slider 拖动（画布为静态结构）；Aspect/Style/Tab 的选中切换；
- Credits 不足态（warning 色）；通知未读红点。
