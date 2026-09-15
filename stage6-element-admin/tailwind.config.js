/** Design tokens — 全部逐值来自第五阶段真实 Figma Frame 19:330（docs/stage5-figma2code.md）。 */
export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  theme: {
    extend: {
      colors: {
        page: "#F2F3F5",
        surface: "#FFFFFF",
        stroke: "#E4E7ED",
        menu: "#5A5CF0",
        chart: {
          blue: "#5470C6",
          green: "#91CC75",
          yellow: "#FAC858",
          orange: "#FC8452",
          red: "#EE6666",
        },
        kpi: { blue: "#409EFF", red: "#F56C6C", green: "#67C23A" },
        ink: { 1: "#303133", 2: "#606266", 3: "#909399", 4: "#C0C4CC" },
      },
      borderRadius: { xs: "2px", sm: "4px", md: "6px" },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.06)",
        tip: "0 2px 12px rgba(0,0,0,0.18)",
      },
      fontSize: {
        display: ["26px", { lineHeight: "32px", fontWeight: "700" }],
        heading: ["16px", { lineHeight: "24px", fontWeight: "500" }],
        body: ["13px", { lineHeight: "20px" }],
        caption: ["12px", { lineHeight: "18px" }],
        number: ["11px", { lineHeight: "16px" }],
      },
    },
  },
  plugins: [],
};
