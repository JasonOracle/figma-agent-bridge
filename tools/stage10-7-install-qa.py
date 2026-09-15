#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Stage 10.7 安装即用 QA — 安装体验 / Runtime Probe / E2E 文档 契约校验。"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL = os.path.join(ROOT, "skills", "ai-ui-designer")
results = []

def check(ok, name):
    results.append((bool(ok), name))

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

# ---- QA1 交付物存在 ----
for rel in [
    "skills/ai-ui-designer/README.md",
    "skills/ai-ui-designer/SETUP.md",
    "skills/ai-ui-designer/references/runtime-capability.md",
    "tools/runtime-check.mjs",
    "docs/stage10-7-e2e-validation.md",
]:
    check(os.path.isfile(os.path.join(ROOT, rel)), f"QA1 存在 {rel}")

# ---- QA2 探针行为约束（静态） ----
probe = read(os.path.join(ROOT, "tools", "runtime-check.mjs"))
check("GET" in probe and "/health" in probe, "QA2 探针仅复用公开 GET /health 端点")
check("POST" not in probe, "QA2 探针无写操作（不含 POST）")
check("mcp.json" in probe, "QA2 探针读取 MCP 配置判定读能力")
check("figma-developer-mcp" in probe and "figma-context" in probe, "QA2 探针识别已知读取型 Figma MCP")
check("new Server" not in probe and "listen(" not in probe, "QA2 探针未创建任何新协议/服务")

# ---- QA3 探针实跑契约（--no-write，解析 stdout JSON） ----
r = subprocess.run([sys.executable.replace("python.exe", "python.exe")] if False else
                   ["node", os.path.join(ROOT, "tools", "runtime-check.mjs"), "--no-write"],
                   capture_output=True, text=True, timeout=30, cwd=ROOT)
check(r.returncode == 0, "QA3 探针可执行（exit 0）")
try:
    cap = json.loads(r.stdout)
    parsed = True
except Exception:
    parsed = False
    cap = {}
check(parsed, "QA3 探针 stdout 可解析为 JSON")
check(set(["figmaRead", "figmaWrite", "executor", "mode"]).issubset(cap.keys()),
      "QA3 输出含 figmaRead/figmaWrite/executor/mode 四个必备键")
mode = cap.get("mode")
check(mode in ("FULL_MODE", "READ_ONLY_MODE", "OFFLINE_MODE"), f"QA3 mode 枚举合法（{mode}）")
fw, fr = cap.get("figmaWrite"), cap.get("figmaRead")
check(isinstance(fw, bool) and isinstance(fr, bool), "QA3 figmaRead/figmaWrite 为布尔")
check((cap.get("executor") == "figma-plugin-bridge") == bool(fw), "QA3 executor 与 figmaWrite 自洽")
expect_mode = "FULL_MODE" if fw else ("READ_ONLY_MODE" if fr else "OFFLINE_MODE")
check(mode == expect_mode, "QA3 mode 与能力组合自洽（无假 FULL_MODE）")
if fw is False and fr is True:
    hints = (cap.get("details") or {}).get("hints") or ""
    check("需要安装 Figma Bridge" in hints, "QA3 READ_ONLY_MODE 提示语符合规格")

# ---- QA4 Capability Matrix 文档一致性 ----
rcap = read(os.path.join(SKILL, "references", "runtime-capability.md"))
for token in ["FULL_MODE", "READ_ONLY_MODE", "OFFLINE_MODE", "runtime-capability.json",
              "figma-plugin-bridge", "L1", "L2", "L3", "L4", "L5"]:
    check(token in rcap, f"QA4 runtime-capability.md 含 {token}")
check("需要安装 Figma Bridge 才能自动绘制" in rcap, "QA4 READ_ONLY 提示语三处口径一致（references）")
check("当前环境只有读取能力" in rcap, "QA4 READ_ONLY 提示语前半句一致（references）")
check("不修改 Bridge 核心" in rcap or "零协议新增" in rcap, "QA4 探针约束声明（零协议/零核心修改）")
check("不得假装执行" in rcap, "QA4 诚实铁律（不得假装执行被降级的层）")

readme = read(os.path.join(SKILL, "README.md"))
for token in ["FULL_MODE", "READ_ONLY_MODE", "OFFLINE_MODE", "SETUP.md", "runtime-check.mjs",
              "不开发、不替代任何 MCP"]:
    check(token in readme, f"QA4 README 含 {token}")

setup = read(os.path.join(SKILL, "SETUP.md"))
for token in ["runtime-check.mjs", "FULL_MODE", "Import plugin from manifest", "npm run bridge",
              "5 分钟", "故障排查"]:
    check(token in setup, f"QA4 SETUP 含 {token}")

# ---- QA5 E2E 走查完整性 ----
e2e = read(os.path.join(ROOT, "docs", "stage10-7-e2e-validation.md"))
for token in ["design-brief.json", "design-system-spec.json", "build-plan.json",
              "critic-report.json", "export-manifest.json", "FULL_MODE",
              "确认门", "5 分钟"]:
    check(token in e2e, f"QA5 E2E 文档含 {token}")
check(e2e.count("用户操作") >= 3, "QA5 E2E 标注了用户操作步骤")
check("实测输出" in e2e and "figmaWrite" in e2e, "QA5 E2E 含探针实测记录")

# ---- QA6 SKILL.md 注册 ----
sk = read(os.path.join(SKILL, "SKILL.md"))
check("runtime-check" in sk, "QA6 SKILL.md 注册 runtime-check 探针")
check("FULL_MODE" in sk, "QA6 SKILL.md 注册模式路由")

# ---- QA7 探针产物（可选，若有则校验形状） ----
cap_file = os.path.join(ROOT, ".vibe", "runtime-capability.json")
if os.path.isfile(cap_file):
    try:
        c = json.loads(read(cap_file))
        check("mode" in c and "figmaWrite" in c, "QA7 落盘 capability JSON 形状正确")
    except Exception:
        check(False, "QA7 落盘 capability JSON 可解析")

# ---- 汇总 ----
passed = sum(1 for ok, _ in results if ok)
failed = sum(1 for ok, _ in results if not ok)
for ok, name in results:
    print(("PASS" if ok else "FAIL"), name)
print(f"\n{passed} PASS / {failed} FAIL")
sys.exit(1 if failed else 0)
