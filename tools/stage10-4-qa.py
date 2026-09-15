#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stage 10.4 QA — L2 Design System Generation 设计态产物校验（docs/stage10-4 §9）
四项检查：QA1 JSON 可解析 / QA2 Token 无未知颜色 / QA3 Component 覆盖与数量 / QA4 DS 单源原则
用法：python tools/stage10-4-qa.py  （以仓库根为工作目录）
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRESets_DIR = ROOT / "skills/ai-ui-designer/assets/style-library"
EXAMPLES_DIR = ROOT / "skills/ai-ui-designer/assets/examples"
SCHEMA_PATH = ROOT / "skills/ai-ui-designer/assets/templates/design-system-spec.json"

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

failures = []
passed = []


def check(cond, msg):
    if cond:
        passed.append(msg)
    else:
        failures.append(msg)


def hx(c):
    return int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)


def mix(base, other, ratio):
    """ratio = base 占比；逐通道线性混合后取整（与 RD 规则公式一致）。"""
    b, o = hx(base), hx(other)
    return "#{:02X}{:02X}{:02X}".format(*(int(bv * ratio + ov * (1 - ratio) + 0.5) for bv, ov in zip(b, o)))


# ---------- 载入 ----------
presets = {}
for p in sorted(PRESets_DIR.glob("*.json")):
    presets[json.loads(p.read_text(encoding="utf-8"))["id"]] = json.loads(p.read_text(encoding="utf-8"))

briefs = {}
for p in sorted(EXAMPLES_DIR.glob("example-*.json")):
    if p.name.endswith(".dsspec.json"):
        continue
    briefs[p.name.replace(".json", "")] = json.loads(p.read_text(encoding="utf-8"))

# QA1 — JSON 可解析 + Schema 顶层字段
try:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    spec_required = schema["required"]
    check(True, f"QA1 Schema 可解析：{SCHEMA_PATH.name}（required={len(spec_required)} 字段）")
except Exception as e:
    spec_required = []
    failures.append(f"QA1 Schema 解析失败：{e}")

specs = {}
for name in briefs:
    path = EXAMPLES_DIR / f"{name}.dsspec.json"
    try:
        specs[name] = json.loads(path.read_text(encoding="utf-8"))
        missing = [f for f in spec_required if f not in specs[name]]
        check(not missing, f"QA1 {path.name} 可解析且顶层必填字段齐备（缺 {missing or '无'}）")
    except Exception as e:
        failures.append(f"QA1 {path.name} 解析失败：{e}")

# QA2 — Token 无未知颜色（含 derived 公式复算）
def collect_preset_palette(preset):
    vs = preset["visualSystem"]
    palette = set()
    for v in [vs.get("primaryColor"), vs.get("background"), vs.get("surface"), vs.get("stroke")]:
        if v and HEX_RE.match(v):
            palette.add(v.upper())
    for lst in [vs.get("textColors", []), vs.get("chartColors", [])]:
        palette.update(c.upper() for c in lst if HEX_RE.match(c))
    palette.update({"#FFFFFF", "#000000"})  # RD 规则混合基
    return palette


def token_paths(node, prefix=""):
    """展开 tokens.color 为 {路径: token对象}。"""
    out = {}
    for k, v in node.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict) and "value" in v:
            out[path] = v
        elif isinstance(v, dict):
            out.update(token_paths(v, path))
    return out


for name, spec in specs.items():
    pid = spec["brand"]["stylePresetId"]
    palette = collect_preset_palette(presets[pid])
    toks = token_paths(spec["tokens"]["color"], "tokens.color")
    bad, bad_derived = [], []
    for path, tok in toks.items():
        val = tok["value"].upper()
        src = tok.get("source", "")
        if val in palette:
            continue
        m = re.match(r"^derived:(RD-\d[^@]*)@(.+)$", src)
        if not m:
            bad.append(f"{path}={val} (source={src})")
            continue
        rule, parent = m.group(1), m.group(2)
        parent_tok = toks.get(parent)
        if parent_tok is None:
            bad_derived.append(f"{path} 父 token {parent} 不存在")
            continue
        pv = parent_tok["value"]
        bg = spec["tokens"]["color"]["background"]["page"]["value"]
        sf = spec["tokens"]["color"]["surface"]["card"]["value"]
        dark = sum(hx(bg)) / 3 < 128
        if rule.startswith("RD-1"):
            expect = mix(pv, bg if dark else "#FFFFFF", 0.88)
        elif rule.startswith("RD-2"):
            expect = mix(pv, "#000000", 0.92)
        elif rule.startswith("RD-3"):
            expect = mix(pv, sf if dark else "#FFFFFF", 0.5)
        else:
            bad_derived.append(f"{path} 未知派生规则 {rule}")
            continue
        if val == expect.upper():
            passed.append(f"QA2 {name} {path} 派生复算一致（{rule}: {val}）")
        else:
            bad_derived.append(f"{path}={val} 但 {rule} 复算应为 {expect}")
    check(not bad, f"QA2 {name} 非派生色全部命中 preset 色板（违例 {bad or '无'}）")
    check(not bad_derived, f"QA2 {name} 派生色公式复算一致（违例 {bad_derived or '无'}）")

# QA3 — briefRefs 并集覆盖 + P0 覆盖 + 数量约束
for name in briefs:
    brief, spec = briefs[name], specs[name]
    brief_names = [c["name"] for c in brief["componentExpectation"]]
    covered = set()
    for c in spec["components"]:
        covered.update(c.get("briefRefs", []))
    missing = [n for n in brief_names if n not in covered]
    extra = [n for n in covered if n not in brief_names]
    check(not missing and not extra, f"QA3 {name} briefRefs 并集 = Brief 全量（缺 {missing or '无'}，多 {extra or '无'}）")

    p0_brief = [c["name"] for c in brief["componentExpectation"] if c["priority"] == "P0"]
    p0_missing = [n for n in p0_brief if n not in covered]
    check(not p0_missing, f"QA3 {name} P0 覆盖率 100%（缺 {p0_missing or '无'}）")

    gen = [c for c in spec["components"] if c["decision"] == "generate-core"]
    existing = spec["sourceMapping"]["existingDsRefs"]
    if existing:
        check(not gen, f"QA3 {name} 存量项目 generate-core = 0（实际 {len(gen)}）")
    else:
        check(len(gen) <= 12, f"QA3 {name} 绿地项目 generate-core ≤ 12（实际 {len(gen)}）")

    rejects = [c for c in spec["components"] if c["decision"] == "reject"]
    bad_rej = [c["name"] for c in rejects if c["priority"] == "P0"]
    check(not bad_rej, f"QA3 {name} reject 仅限 P1/P2（P0 违例 {bad_rej or '无'}）")

# QA4 — DS 单源原则
for name, spec in specs.items():
    bad_naming = [c["name"] for c in spec["components"]
                  if c["decision"] == "create-local" and c.get("figmaNaming", "").startswith("DS/")]
    check(not bad_naming, f"QA4 {name} create-local 无 DS/ 前缀命名（违例 {bad_naming or '无'}）")

    st_map = {c["name"]: set(c["states"]) for c in spec["components"]}
    joined = {}
    for c in spec["components"]:
        for ref in c.get("briefRefs", []):
            joined[ref] = set(c["states"])
        joined.setdefault(c["name"], set(c["states"]))  # CD-3 补充组件（briefRefs 可为空）也纳入状态校验

    for comp, required in [("Button", {"primary", "secondary", "disabled", "loading"}),
                           ("Input", {"default", "focus", "error", "disabled"}),
                           ("Table", {"header", "row", "empty", "loading"}),
                           ("Card", {"default", "hover"})]:
        if any(comp in c.get("briefRefs", []) or c["name"] == comp for c in spec["components"]):
            states = joined.get(comp)
            if states is None:
                failures.append(f"QA4 {name} 必选组件 {comp} 未出现在任何 componentPlan 条目")
            else:
                miss = required - states
                check(not miss, f"QA4 {name} {comp} 状态矩阵完整（缺 {sorted(miss) or '无'}）")

    over = [b["estOps"] for b in spec.get("buildPlan", {}).get("batches", []) if b["estOps"] > 30]
    check(not over, f"QA4 {name} buildPlan.estOps 全部 ≤30（超限 {over or '无'}）")

    pid = spec["brand"]["stylePresetId"]
    pc = presets[pid]["visualSystem"]["chartColors"]
    sc = [spec["tokens"]["color"]["chart"][f"series{i}"]["value"].upper() for i in range(1, 6)]
    check(sc == [c.upper() for c in pc], f"QA4 {name} chart 色板与 preset 逐字一致")

# ---------- 汇总 ----------
print(f"{'=' * 62}")
for msg in passed:
    print(f"  PASS  {msg}")
print(f"{'=' * 62}")
if failures:
    for msg in failures:
        print(f"  FAIL  {msg}")
    print(f"\n结果：{len(passed)} PASS / {len(failures)} FAIL")
    sys.exit(1)
print(f"\n结果：{len(passed)} PASS / 0 FAIL —— STAGE 10.4 QA ALL GREEN")
