#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stage 10.6 QA — L4 Visual Critic 设计态产物校验（docs/stage10-6 §7）
检查项：
  QA1 Schema 可解析
  QA2 三份 example Critic Report 顶层字段完整
  QA3 五维评分完整且 0-10，average 与实算一致（half-up 一位小数）
  QA4 issue 必填 evidence/suggestion，severity 合法
  QA5 targetLayer 必须合法（L1/L2/L3）
  QA6 Critic Loop：round ≤ 3、maxLoop==3、history 长度 ≤ round、action 与分数规则自洽
用法：python tools/stage10-6-qa.py  （以仓库根为工作目录）
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "skills/ai-ui-designer/assets/templates/critic-report.json"
EXAMPLES = ["example-saas", "example-health", "example-highway"]
EX_BASE = ROOT / "skills/ai-ui-designer/assets/examples"

SCORE_KEYS = ["layout", "color", "consistency", "commercial", "usability"]
LAYERS = {"L1", "L2", "L3"}
SEVERITIES = {"low", "medium", "high", "critical"}
ACTIONS = {"PASS", "FIX", "STOP_MAX_LOOP"}

failures = []
passed = []


def check(cond, msg):
    (passed if cond else failures).append(msg)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


# ---------- QA1 Schema 可解析 ----------
try:
    schema = load(TEMPLATE)
    req = schema.get("required", [])
    check("project" in req and "page" in req and "scores" in req and "average" in req
          and "issues" in req and "action" in req,
          f"QA1 Schema 可解析且必填字段齐备：{TEMPLATE.name}（required={req}）")
    layer_enum = schema["properties"]["issues"]["items"]["properties"]["targetLayer"]["enum"]
    check(sorted(layer_enum) == sorted(LAYERS), f"QA1 Schema targetLayer enum = {layer_enum}")
except Exception as e:
    failures.append(f"QA1 Schema 解析失败：{e}")
    sys.exit(1)

# ---------- 载入三份 example ----------
reports = {}
for name in EXAMPLES:
    path = EX_BASE / name / "critic-report.json"
    try:
        reports[name] = load(path)
    except Exception as e:
        failures.append(f"QA2 {path} 解析失败：{e}")

# ---------- QA2 顶层字段完整 ----------
for name, r in reports.items():
    missing = [f for f in req if f not in r]
    check(not missing, f"QA2 {name}/critic-report.json 顶层必填字段齐备（缺 {missing or '无'}）")

# ---------- QA3 五维评分 + average 实算 ----------
for name, r in reports.items():
    scores = r.get("scores", {})
    missing = [k for k in SCORE_KEYS if k not in scores]
    check(not missing, f"QA3 {name} 五维评分完整（缺 {missing or '无'}）")
    in_range = all(isinstance(scores.get(k), (int, float)) and 0 <= scores[k] <= 10 for k in SCORE_KEYS)
    check(in_range, f"QA3 {name} 五维评分均为 0-10 数值")
    if in_range and scores:
        raw = sum(scores[k] for k in SCORE_KEYS) / 5
        expect = int(raw * 10 + 0.5) / 10  # half-up 一位小数
        check(abs(r.get("average", -1) - expect) < 1e-9,
              f"QA3 {name} average={r.get('average')} 与实算 {expect} 一致（half-up）")
    for k, v in scores.items():
        check(isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 10,
              f"QA3 {name} scores.{k}={v} 数值合法") if not in_range else None

# ---------- QA4 issue 必填 evidence/suggestion，severity 合法 ----------
for name, r in reports.items():
    issues = r.get("issues", [])
    check(len(issues) > 0 or r.get("action") == "PASS",
          f"QA4 {name} issues 非空或明确 PASS")
    for i, issue in enumerate(issues):
        ev = issue.get("evidence", "")
        sg = issue.get("suggestion", "")
        check(isinstance(ev, str) and ev.strip() != "",
              f"QA4 {name} issue[{i}] evidence 非空")
        check(isinstance(sg, str) and sg.strip() != "",
              f"QA4 {name} issue[{i}] suggestion 非空（必须可执行）")
        check(issue.get("severity") in SEVERITIES,
              f"QA4 {name} issue[{i}] severity={issue.get('severity')} 合法")
        check(isinstance(issue.get("location", ""), str) and issue["location"].strip() != "",
              f"QA4 {name} issue[{i}] location 非空")
        # evidence 须含实测痕迹（数字/色值/px/档位），防"感觉不对"
        ev = ev.lower()
        has_measure = any(t in ev for t in ["px", "#", ":", "%", "档", "级", "分", "实测", "readback", "对比度"])
        check(has_measure, f"QA4 {name} issue[{i}] evidence 含可复现实测痕迹")

# ---------- QA5 targetLayer 合法 ----------
for name, r in reports.items():
    for i, issue in enumerate(r.get("issues", [])):
        check(issue.get("targetLayer") in LAYERS,
              f"QA5 {name} issue[{i}] targetLayer={issue.get('targetLayer')} ∈ {{L1,L2,L3}}")

# ---------- QA6 Critic Loop ----------
for name, r in reports.items():
    loop = r.get("_loop", {})
    check(loop.get("round", 0) <= 3, f"QA6 {name} _loop.round={loop.get('round')} ≤ 3")
    check(loop.get("maxLoop") == 3, f"QA6 {name} _loop.maxLoop == 3")
    hist = loop.get("history", [])
    check(len(hist) <= loop.get("round", 0), f"QA6 {name} history 长度 {len(hist)} ≤ round {loop.get('round')}")
    check(all(isinstance(h, (int, float)) and 0 <= h <= 10 for h in hist),
          f"QA6 {name} history 数值均为 0-10")
    action = r.get("action")
    check(action in ACTIONS, f"QA6 {name} action={action} 合法")
    scores = r.get("scores", {})
    avg = r.get("average", 0)
    min_score = min([scores.get(k, 10) for k in SCORE_KEYS]) if scores else 0
    if action == "PASS":
        check(avg >= 8 and min_score >= 7,
              f"QA6 {name} PASS 自洽：average={avg}≥8 且最低分 {min_score}≥7")
    elif action == "STOP_MAX_LOOP":
        check(loop.get("round") == 3 and avg < 8,
              f"QA6 {name} STOP_MAX_LOOP 自洽：round=3 且 average={avg}<8")
        check(avg >= hist[0] if hist else False,
              f"QA6 {name} STOP_MAX_LOOP 前提：3 轮循环确实发生过（history[0]={hist[0] if hist else '-'}）")
    elif action == "FIX":
        check(avg < 8 or min_score < 7,
              f"QA6 {name} FIX 自洽：average={avg}<8 或最低分 {min_score}<7")

# ---------- 汇总 ----------
print("=" * 64)
for m in passed:
    print(" PASS", m)
for m in failures:
    print(" FAIL", m)
print("=" * 64)
print(f"结果: {len(passed)} PASS / {len(failures)} FAIL")
sys.exit(1 if failures else 0)
