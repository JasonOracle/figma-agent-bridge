# Stage 6 · Figma → Vue3 + Tailwind → 浏览器 / Figma → Vue3 + Tailwind → Browser

## 中文

**目标**：把 Stage 5 的 Figma Frame `19:330` 高保真转为可运行网页。约束：不重新设计、不改视觉、不读原 ElementAdmin 源码、仅以 Figma 为依据、图表用 SVG、实现真实 hover。

**成果**：`stage6-element-admin/`（仓库根目录，Vite 5 + Vue 3.4 + Tailwind 3.4，dev 端口 5180）
- 34 个 Tailwind token 逐值取自 Stage 5 Figma（16 色 / 4 字阶 / 3 圆角 / 2 阴影 / 布局常量）
- 12 个 Vue 组件：App / TopBar / Sidebar / MenuItem（复用 6）/ TagsBar / KpiCard / ChartCard / LegendItem / PieChart / BarChart / LineChart / AppFooter + VIcon
- `src/data/geometry.js` 与 Figma 侧 path 函数同源（arcSector / smooth / grid / dash）
- **真实 hover**：pointermove → 最近月份 → 虚线 crosshair + 蓝药丸 + tooltip（二月 / 一月:120 / 三月:82）+ y 轴指针 1130.94

**QA**：playwright-cli 截图两轮视觉 QA（88 → 93/100）；1440/1280 无横向溢出；hover「二月」态与参考图逐字一致。

**环境坑**（详见 docs/lessons-learned.md）
- npm install 在无 package.json 的子目录会向上爬到最近 package.json（误装到上层）
- playwright-cli 会话在 bash 调用间不保活，open→resize→screenshot→eval→close 必须串在一条命令里

**本目录文件**：QA 截图（1440 / round1 / round2 / hover 态）。

## English

**Goal**: Convert the Stage 5 Figma frame `19:330` into a running web page with high fidelity. Constraints: no redesign, no reading the original ElementAdmin source, Figma as the only reference, SVG charts, real hover interaction.

**Deliverable**: `stage6-element-admin/` at repo root (Vite 5 + Vue 3.4 + Tailwind 3.4, dev port 5180): 34 Tailwind tokens taken value-by-value from the Figma frame, 12 Vue components, geometry helpers sharing the same path math as the Figma side, and a real hover implementation (crosshair + blue pill + tooltip + y-axis pointer). Visual QA over two rounds (88 → 93/100), no horizontal overflow at 1440/1280.

**Files here**: QA screenshots (1440, round1, round2, hover state).
