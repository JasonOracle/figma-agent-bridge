#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stage 10.7 QA — L5 Export Layer 契约与产物校验（docs/stage10-7 §4）
QA1 Manifest Schema           —— 模板可解析 + 三份 example 必填字段/枚举
QA2 所有导出文件存在           —— existsCheck!=false 的路径逐一落盘检查
QA3 Figma node id 可回读       —— id 格式 + live-build 交叉引用（exports ⊆ rootNodeIds）
QA4 Component Mapping 完整     —— A/B 类必须有 frontendComponent+props，C 类必须有 manualNote
QA5 Token Mapping 完整         —— 五类齐备 + dsToken 沿点路径回溯 dsspec + cssVariable 命名规则
QA6 Frontend Mapping 无孤儿    —— mapping.dsName 与 dsspec 组件双向覆盖 + Export Gate 自洽
QA7 Freeze 文件零修改          —— src//bridge/cli 等禁区 git 工作树干净
目标：PASS >= 50，FAIL = 0
用法：python tools/stage10-7-qa.py  （以仓库根为工作目录）
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "skills/ai-ui-designer/assets/templates/export-manifest.json"
EX_DIR = ROOT / "skills/ai-ui-designer/assets/examples/export"
EXAMPLES = ["example-saas-export.json", "example-health-export.json", "example-highway-export.json"]

NODE_ID_RE = re.compile(r"^\d+:\d+$")
CSS_VAR_RE = re.compile(r"^--ds-[a-z0-9-]+$")
TOKEN_PATH_RE = re.compile(r"^tokens\.[a-zA-Z0-9.]+$")
SOURCE_PREFIX_RE = re.compile(r"^(preset|brief|rule|derived|existing-ds):")
CLASSES = {"A-direct", "B-composite", "C-manual"}
PROTECTED = ["src", "stage6-element-admin/src", "bridge", "cli", "stage6-element-admin/tailwind.config.js"]

failures = []
passed = []


def check(cond, msg):
    (passed if cond else failures).append(msg)


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def rel_exists(p):
    return (ROOT / p).exists()


# ---------- QA1 Manifest Schema ----------
try:
    schema = load(TEMPLATE)
    req = schema.get("required", [])
    need = {"project", "version", "source", "exports", "mapping", "tokens", "audit"}
    check(need.issubset(req), f"QA1 Schema 可解析且顶层必填齐备：{TEMPLATE.name}（required={req}）")
    check(schema["properties"]["audit"]["properties"]["freezeStatus"]["enum"] == ["passed", "failed", "pending"],
          "QA1 Schema audit.freezeStatus 枚举 = passed|failed|pending")
except Exception as e:
    failures.append(f"QA1 Schema 解析失败：{e}")
    sys.exit(1)

manifests = {}
for name in EXAMPLES:
    path = EX_DIR / name
    try:
        m = load(path)
        manifests[name] = m
        missing = [f for f in need if f not in m]
        check(not missing, f"QA1 {name} 顶层必填字段齐备（缺 {missing or '无'}）")
        check(isinstance(m.get("project"), str) and m["project"].strip() != "", f"QA1 {name} project 非空")
        check(isinstance(m.get("version"), str) and m["version"].strip() != "", f"QA1 {name} version 非空")
        src = m.get("source", {})
        check(all(isinstance(src.get(k), str) and src[k] for k in ("brief", "dsSpec")),
              f"QA1 {name} source.brief/dsSpec 路径非空")
        audit = m.get("audit", {})
        cs = audit.get("criticScore")
        check(isinstance(cs, (int, float)) and 0 <= cs <= 10, f"QA1 {name} audit.criticScore={cs} ∈ 0-10")
        check(audit.get("freezeStatus") in ("passed", "failed", "pending"),
              f"QA1 {name} audit.freezeStatus={audit.get('freezeStatus')} 合法")
    except Exception as e:
        failures.append(f"QA1 {path.name} 解析失败：{e}")

# ---------- QA2 导出文件存在 ----------
for name, m in manifests.items():
    exports = m.get("exports", {})
    for kind in ("png", "svg"):
        for i, e in enumerate(exports.get(kind, [])):
            p = e.get("path", "")
            check(isinstance(p, str) and p.strip() != "", f"QA2 {name} exports.{kind}[{i}] path 非空")
            if e.get("existsCheck", True):
                check(rel_exists(p), f"QA2 {name} exports.{kind}[{i}] 文件存在：{p}")
            else:
                check("_meta" in m, f"QA2 {name} exports.{kind}[{i}] 为规划路径（existsCheck=false），_meta 必须说明")
    fj = exports.get("figmaJson", {})
    fp = fj.get("path")
    if fp:
        check(rel_exists(fp), f"QA2 {name} exports.figmaJson 文件存在：{fp}")
    else:
        check(fj.get("note"), f"QA2 {name} figmaJson.path 为空必须带 note 说明")
    ds = exports.get("designSpec", {})
    for k in ("brief", "dsSpec"):
        p = ds.get(k, "")
        check(isinstance(p, str) and p.strip() != "", f"QA2 {name} designSpec.{k} 路径非空")
        if p:
            check(rel_exists(p), f"QA2 {name} designSpec.{k} 文件存在：{p}")
    cr = ds.get("criticReport")
    if cr:
        check(rel_exists(cr), f"QA2 {name} designSpec.criticReport 文件存在：{cr}")

# ---------- QA3 Figma node id 可回读 ----------
for name, m in manifests.items():
    src = m.get("source", {})
    status = m.get("_meta", {}).get("status", "live-build")
    roots = src.get("rootNodeIds", [])
    check(all(NODE_ID_RE.match(r) for r in roots), f"QA3 {name} rootNodeIds 全部匹配 ^\\d+:\\d+$（{roots}）")
    if status == "live-build":
        check(src.get("figmaFileKey"), f"QA3 {name} live-build 必须 有 figmaFileKey")
        check(len(roots) > 0, f"QA3 {name} live-build 必须 有 rootNodeIds")
        exported = [e.get("nodeId") for kind in ("png", "svg") for e in m.get("exports", {}).get(kind, [])]
        check(all(n in roots for n in exported),
              f"QA3 {name} 全部导出 nodeId ∈ rootNodeIds（交叉引用，可在 Figma 按 fileKey+id 回读）")
    else:
        check(src.get("figmaFileKey") is None, f"QA3 {name} design-phase figmaFileKey=null（诚实标注未建画布）")
        check(m.get("_meta", {}).get("note"), f"QA3 {name} design-phase 必须 在 _meta.note 说明")

# ---------- QA4 Component Mapping 完整 ----------
for name, m in manifests.items():
    comps = m.get("mapping", {}).get("components", [])
    check(len(comps) >= 1, f"QA4 {name} mapping.components 非空（{len(comps)} 条）")
    for i, c in enumerate(comps):
        check(c.get("class") in CLASSES, f"QA4 {name} comp[{i}] class={c.get('class')} 合法")
        check(isinstance(c.get("figmaComponent"), str) and c["figmaComponent"].strip() != "",
              f"QA4 {name} comp[{i}] figmaComponent 非空")
        check(isinstance(c.get("dsName"), str) and c["dsName"].strip() != "",
              f"QA4 {name} comp[{i}] dsName 非空")
        if c.get("class") in ("A-direct", "B-composite"):
            check(isinstance(c.get("frontendComponent"), str) and c["frontendComponent"].strip() != "",
                  f"QA4 {name} comp[{i}]({c['dsName']}) A/B 类 frontendComponent 非空")
            check(len(c.get("props", [])) > 0,
                  f"QA4 {name} comp[{i}]({c['dsName']}) A/B 类 props 非空（映射可执行）")
        else:
            check(isinstance(c.get("manualNote"), str) and c["manualNote"].strip() != "",
                  f"QA4 {name} comp[{i}]({c['dsName']}) C 类 manualNote 必填")
    check(len(m.get("mapping", {}).get("layoutRules", [])) >= 3,
          f"QA4 {name} layoutRules ≥3 条（Layout → Implementation Rules 随包交付）")

# ---------- QA5 Token Mapping 完整 ----------
def resolve_token(dsspec, ds_token):
    node = dsspec
    for part in ds_token.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, dict) and "source" in node else None


def kebab(ds_token):
    """tokens. 后路径转 kebab：'.' → '-'，camelCase 边界 → '-'（cardPadding → card-padding）。"""
    tail = ds_token[len("tokens."):]
    parts = []
    for seg in tail.split("."):
        word = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "-", seg)
        parts.append(word.lower())
    return "--ds-" + "-".join(parts)


for name, m in manifests.items():
    toks = m.get("tokens", {})
    cats = ["color", "typography", "spacing", "radius", "shadow"]
    missing = [c for c in cats if c not in toks]
    check(not missing, f"QA5 {name} token 五类齐备（缺 {missing or '无'}）")
    check(len(toks.get("color", [])) >= 8, f"QA5 {name} color 映射 ≥8 条（实际 {len(toks.get('color', []))}）")
    check(len(toks.get("typography", [])) >= 5, f"QA5 {name} typography 映射 ≥5 条（实际 {len(toks.get('typography', []))}）")
    for c in cats:
        for e in toks.get(c, []):
            dt = e.get("dsToken", "")
            cv = e.get("cssVariable", "")
            tag = f"{name} {dt}"
            check(bool(TOKEN_PATH_RE.match(dt)), f"QA5 {tag} dsToken 路径格式合法")
            check(bool(CSS_VAR_RE.match(cv)), f"QA5 {tag} cssVariable={cv} 命名规则合法")
            expect_var = kebab(dt)
            check(cv == expect_var, f"QA5 {tag} cssVariable 与命名规则一致（应为 {expect_var}）")
            check(bool(SOURCE_PREFIX_RE.match(e.get("source", ""))),
                  f"QA5 {tag} source 带 preset/brief/rule/derived/existing-ds 前缀（可追溯）")
    dsspec_path = m.get("source", {}).get("dsSpec")
    if dsspec_path and rel_exists(dsspec_path):
        dsspec = load(ROOT / dsspec_path)
        for c in cats:
            for e in toks.get(c, []):
                node = resolve_token(dsspec, e.get("dsToken", ""))
                check(node is not None,
                      f"QA5 {name} {e.get('dsToken')} 在 dsspec 中可回溯（含 source）")

# ---------- QA6 Frontend Mapping 无孤儿组件 ----------
for name, m in manifests.items():
    comps = m.get("mapping", {}).get("components", [])
    dsspec_path = m.get("source", {}).get("dsSpec")
    if not (dsspec_path and rel_exists(dsspec_path)):
        continue
    dsspec = load(ROOT / dsspec_path)
    spec_names = {c["name"] for c in dsspec.get("components", []) if c.get("decision") != "reject"}
    map_names = [c.get("dsName") for c in comps]
    uncovered = spec_names - set(map_names)
    check(not uncovered, f"QA6 {name} dsspec 组件全部被映射（未覆盖：{sorted(uncovered) or '无'}）")
    orphans = [n for n in map_names if n not in spec_names]
    check(not orphans, f"QA6 {name} 无孤儿映射（映射名不在 dsspec 中：{sorted(orphans) or '无'}）")
    check(len(map_names) == len(set(map_names)), f"QA6 {name} dsName 无重复（同名多决策已按名归并）")
    # Export Gate 自洽：criticScore <8 只允许 design-phase；criticReport JSON 的 average 必须与 audit 一致
    cs = m.get("audit", {}).get("criticScore", 0)
    status = m.get("_meta", {}).get("status", "live-build")
    if cs < 8:
        check(status == "design-phase",
              f"QA6 {name} criticScore={cs}<8 → 必须 design-phase（Export Gate：PASS 后才可正式导出）")
    cr = m.get("exports", {}).get("designSpec", {}).get("criticReport")
    if cr and rel_exists(cr) and cr.endswith(".json"):
        report = load(ROOT / cr)
        check(abs(report.get("average", -1) - cs) < 1e-9,
              f"QA6 {name} audit.criticScore={cs} 与 Critic Report average={report.get('average')} 一致")

# ---------- QA7 Freeze 文件零修改 ----------
try:
    out = subprocess.run(["git", "status", "--porcelain", "--"] + PROTECTED,
                         cwd=ROOT, capture_output=True, text=True, timeout=30)
    dirty = [l for l in out.stdout.splitlines() if l.strip()]
    check(out.returncode == 0, "QA7 git status 可执行")
    check(not dirty, f"QA7 冻结禁区零修改（src//stage6/bridge/cli 工作树干净，脏文件：{dirty or '无'}）")
except Exception as e:
    failures.append(f"QA7 git status 执行失败：{e}")

# ---------- 汇总 ----------
print("=" * 64)
for msg in passed:
    print(" PASS", msg)
for msg in failures:
    print(" FAIL", msg)
print("=" * 64)
print(f"结果: {len(passed)} PASS / {len(failures)} FAIL（目标：PASS>=50 且 FAIL=0）")
sys.exit(1 if failures or len(passed) < 50 else 0)
