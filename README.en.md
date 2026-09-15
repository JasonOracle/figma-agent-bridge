# figma-agent-bridge

[中文](README.md) | **English**

Let AI agents read and write a real Figma canvas through a self-built local channel — an open-source, end-to-end experiment covering design-system construction, full-page high-fidelity design, Vue code porting, and pixel-level visual regression.

No paid Figma "Write to Canvas", no MCP-based writes — a local write channel (HTTP Bridge + Figma development plugin) is self-built and used to create 7 real UIs (1 design system + 6 full pages) on a real Figma canvas, port one of them to Vue3 + Tailwind, and verify it with programmatic pixel diff and real-browser interaction regression.

> Roadmap: the project is evolving toward an **MCP Server** and **Agent Skills**. See [Roadmap](#-roadmap).

---

## Architecture

```
WorkBuddy Agent / figma-vibe CLI
        │  HTTP POST /v1/command   (?token=…)
        ▼
   Bridge  (127.0.0.1:45677, loopback only, token auth, sync semantics)
        │  HTTP GET /v1/poll  ← long-poll; the plugin pulls commands
        ▼
   Figma Plugin UI (iframe)      ←—— the only layer with network access
        │  postMessage
        ▼
   Figma Plugin main thread  →  Figma Plugin API  →  real canvas nodes
```

Full protocol, 34 atomic ops and the troubleshooting table: [`docs/bridge-architecture.md`](docs/bridge-architecture.md).

## Nine Stages

| Stage | Scope | Key artifacts | Result |
|---|---|---|---|
| [1-2](stages/stage1-2-bridge-channel/) | Write channel + 34 atomic ops | bridge / plugin / cli | selftest 91/91, real-canvas assertions 35/35 |
| [3](stages/stage3-saas-dashboard/) | First real Vibe Design: SaaS Education Dashboard | 274 nodes / 10 components / 0 images | audit 42/42 |
| [4](stages/stage4-pixelflow-ai/) | Autonomous design loop: PixelFlow AI (dark) | 188 nodes / 17 components | audit 42/42 (self-detected & fixed) |
| [5](stages/stage5-elementadmin-figma/) | ElementAdmin recreation from a screenshot only (1920×1030) | 207 nodes / 25 programmatic VECTORs | audit 47/47, self-assessed 89/100 |
| [6](stages/stage6-vue-elementadmin/) | Figma → Vue3 + Tailwind → browser | Vite5 + Vue3.4 + Tailwind3.4 | two QA rounds 88→93/100 |
| [7](stages/stage7-visual-regression/) | Programmatic pixel-level visual regression | self-built diff tooling + 32-section report | Pixel Diff **5.691%** / SSIM **0.9037** / Final **92/100** |
| [8](stages/stage8-interaction-regression/) | Real-browser interaction regression (40 checks) | Playwright interaction matrix + evidence screenshots | PASS 24 / FAIL 0 / READY FOR STAGE 9 |
| [9](stages/stage9-product-expansion/) | Product expansion: IA + design system + multi-page | 25 native DS components + User List / Exam List / Exam Detail / Settings | all audits green, new formal components 0 |

## Repository Layout

```
├── bridge/          Local Bridge (Node built-ins only, zero npm deps)
├── plugin/          Figma development plugin (manifest + code.js + ui.html)
├── cli/             figma-vibe CLI (declarative command table)
├── tools/           selftest / verify / probe / build / audit scripts
├── examples/        Example command JSON
├── stage6-element-admin/   Stage 6 Vue3 + Tailwind project (regression subject)
├── stages/          ★ Per-stage archives (README, audit JSON, geometry dumps, screenshots, diff data)
│   └── … stage1-2 … stage9-product-expansion/ (17 audit JSONs under data/)
├── docs/
│   ├── bridge-architecture.md     Channel architecture & protocol
│   ├── stage7-visual-regression.md  32-section visual regression report
│   ├── stage8-interaction-regression.md  40-check interaction matrix
│   ├── stage9-*.md                IA / design system / 9.2-A / 9.2-B reports
│   ├── communication-log.md       ★ Stage-by-stage communication log
│   └── lessons-learned.md         ★ Lessons learned (bilingual headings)
└── .vibe/           Runtime state (auth token excluded; audit data archived under stages/)
```

## Quick Start

```bash
# 1. Start the Bridge
node bridge/server.js

# 2. Mock self-test (no Figma needed)
node tools/selftest.js

# 3. Figma Desktop → Plugins → Development → Import manifest.json → run the plugin

# 4. Real-canvas verification (plugin must be online)
node tools/stage2-verify.js

# 5. Stage 6 frontend (regression subject)
cd stage6-element-admin && npm install && npm run dev   # http://127.0.0.1:5180
```

## Security

- `.vibe/token` (Bridge auth token) and all logs are excluded via `.gitignore`.
- The Bridge binds loopback only (`127.0.0.1`); the plugin may only reach `localhost`.
- "Token" in docs and audit data always means *design tokens* (color/type), never credentials.

## Headline Results

- **Channel reliability**: sync command semantics + waiter liveness checks + client registration — no silent command loss, no false positives.
- **Design fidelity**: ElementAdmin recreated in Figma from a screenshot alone (self-assessed 89/100); after the Vue port, pixel diff vs the Figma render baseline is 5.691% (SSIM 0.9037, Final 92/100), with 0px deviation on the layout skeleton and all 17 color tokens.
- **Interaction regression**: 40 real-browser event checks, 24 PASS / 0 FAIL.
- **Productization**: 25 native DS components + 4 business pages built programmatically in a fresh Figma file, 100% component reuse (new formal components = 0).
- All lessons: [`docs/lessons-learned.md`](docs/lessons-learned.md); all stage communication: [`docs/communication-log.md`](docs/communication-log.md).

## 🗺 Roadmap

- [ ] **MCP Server**: wrap the 34 atomic ops as standard MCP tools (create-frame / set-auto-layout / run batch …) so any MCP-capable agent can drive a real Figma canvas.
- [ ] **Agent Skills**: distill three reusable skill workflows — screenshot-to-Figma recreation, design-system construction, pixel-level regression.
- [ ] **Standalone regression CLI**: extract `pixel-diff.py` + evidence-chain generator into its own package.
- [ ] Issues welcome for API design & naming discussions.

## License

MIT
