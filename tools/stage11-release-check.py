#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Stage 11 release check — 程序化执行 release-checklist.md 的硬性项。
只读扫描 Skill 目录 + 校验结构自包含性；不修改任何 Skill 文件。"""
import io, json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL = os.path.join(ROOT, "skills", "ai-ui-designer")
results = []
def check(ok, name):
    results.append((ok, name))

# ---- 1 无硬编码个人路径 ----
pat_path = re.compile(r"C:\\\\Users|/c/Users|Administrator|D:\\\\|/d/", re.I)
hits = []
for f in glob.glob(SKILL + "/**/*", recursive=True):
    if f.endswith((".png", ".svg")) or os.path.basename(f) == "release-checklist.md": continue  # checklist 记录扫描模式本身，豁免
    try: s = io.open(f, encoding="utf-8").read()
    except Exception: continue
    for m in pat_path.finditer(s): hits.append((f, m.group()))
check(not hits, f"1 无硬编码个人路径（命中 {len(hits)}）")

# ---- 2 无个人 token ----
real_tokens = ["lLVJH0OnZPrkAqzarvhnBq", "RupGQGcwLGupuhMw4j3rqH", "cagx3s36dmu2l7fe6", "cuoes9o4lmu2rbj1i", "RupGQGcwLGupuhMw4j3rqH"]
tok_hits = []
for f in glob.glob(SKILL + "/**/*", recursive=True):
    if f.endswith((".png", ".svg")): continue
    try: s = io.open(f, encoding="utf-8").read()
    except Exception: continue
    for t in real_tokens:
        if t in s: tok_hits.append((f, t))
check(not tok_hits, f"2 无个人 token / 真实 fileKey（命中 {len(tok_hits)}）")
check("EXAMPLE-FILE-KEY" in io.open(os.path.join(SKILL, "assets/examples/export/example-health-export.json"), encoding="utf-8").read(),
      "2b export 示例 fileKey 已占位化")

# ---- 3 无运行时数据混入 ----
runtime = [f for f in glob.glob(SKILL + "/**/*", recursive=True) if ".vibe" in os.path.relpath(f, SKILL) or os.path.basename(f) in ("build-ids.json", "qa-report.json")]
check(not runtime, f"3 无 .vibe 运行时数据/测试产物混入（命中 {len(runtime)}）")

# ---- 4 无历史项目名称 ----
leak_pat = re.compile(r"Stage 1\d|stage10|stage7|stage5|elementadmin|e2e-final|stage9", re.I)
leaks = []
for f in glob.glob(SKILL + "/**/*", recursive=True):
    if f.endswith((".png", ".svg")) or os.path.basename(f) == "release-checklist.md": continue

    try: s = io.open(f, encoding="utf-8").read()
    except Exception: continue
    for m in leak_pat.finditer(s): leaks.append((os.path.relpath(f, SKILL), m.group()))
allow = [l for l in leaks if "figma-vibe-bridge" in l[1]]  # 协议常量豁免
real = [l for l in leaks if l not in allow]
check(not real, f"4 无历史项目名称（命中 {len(real)}{'; 协议常量豁免 %d' % len(allow) if allow else ''}）")

# ---- 5 首屏术语检查 ----
readme = io.open(os.path.join(SKILL, "README.md"), encoding="utf-8").read()
first_screen = "\n".join(readme.splitlines()[:30])
jargon = [w for w in ("MCP", "Adapter", "Executor", "L1", "L2", "L3", "L4", "L5") if w in first_screen]
check(not jargon, f"5 README 首屏无内部术语（命中 {jargon}）")
for tok in ("FULL_MODE", "READ_ONLY_MODE", "OFFLINE_MODE", "SETUP.md", "runtime-check.mjs", "不开发、不替代任何 MCP"):
    check(tok in readme, f"5b README 保留必需标记「{tok}」（非首屏）")

# ---- 6 结构自包含 ----
for f in ("figma-plugin/manifest.json", "figma-plugin/code.js", "figma-plugin/ui.html",
          "USER_GUIDE.md", "release-checklist.md", "SETUP.md", "README.md",
          "assets/examples/export/files/home@2x.png", "assets/examples/export/files/home.svg",
          "assets/examples/export/files/health-design-brief.json"):
    check(os.path.isfile(os.path.join(SKILL, f)), f"6 存在 {f}")
man = json.load(io.open(os.path.join(SKILL, "figma-plugin/manifest.json"), encoding="utf-8"))
check(man["main"] == "code.js" and man["ui"] == "ui.html", "6b figma-plugin manifest 指向同目录文件（自包含）")
mexp = [ (n, json.load(io.open(os.path.join(SKILL, f"assets/examples/export/example-{n}-export.json"), encoding="utf-8"))) for n in ("saas","health") ]
missing = []
for n, mm in mexp:
    for kind in ("png","svg"):
        for e in mm["exports"].get(kind, []):
            p2 = e.get("path")
            if p2 and e.get("existsCheck", True) and not os.path.isfile(os.path.join(ROOT, p2)):
                missing.append(f"{n}/{kind}:{p2}")
check(not missing, f"6c export 示例引用的媒体文件全部存在（缺 {missing}）")

# ---- 7 JSON 可解析 ----
bad = []
for f in glob.glob(SKILL + "/**/*.json", recursive=True):
    try: json.load(io.open(f, encoding="utf-8"))
    except Exception as e: bad.append((f, str(e)[:50]))
check(not bad, f"7 全部 JSON 可解析（坏 {bad}）")

passed = sum(1 for ok, _ in results if ok); failed = len(results) - passed
for ok, name in results: print(("PASS" if ok else "FAIL"), name)
print(f"\n{passed} PASS / {failed} FAIL")
sys.exit(1 if failed else 0)
