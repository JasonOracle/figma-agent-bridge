#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Compare fresh Figma geometry (19:330) vs Vue DOM geometry dump."""
import json

FG = r"C:\Users\Administrator\figma-vibe-bridge\.vibe\stage7\figma-geometry.json"
VG = r"C:\Users\Administrator\figma-vibe-bridge\.vibe\stage7\vue-geometry.json"

fig = json.load(open(FG, encoding="utf-8"))
vue = json.load(open(VG, encoding="utf-8"))

# ---- flatten figma tree with absolute coords relative to frame root ----
flat = []
def walk(n, ox, oy):
    x = n.get("x", 0); y = n.get("y", 0)
    ax, ay = ox + x, oy + y
    flat.append({
        "name": n.get("name"), "type": n.get("type"),
        "x": round(ax, 1), "y": round(ay, 1),
        "w": round(n.get("width", 0), 1), "h": round(n.get("height", 0), 1),
        "fills": n.get("fills"), "strokes": n.get("strokes"),
        "cornerRadius": n.get("cornerRadius"),
        "fontSize": n.get("fontSize"), "fontWeight": n.get("fontWeight"),
        "fontFamily": n.get("fontFamily"),
        "layoutMode": n.get("layoutMode"), "itemSpacing": n.get("itemSpacing"),
        "padding": n.get("padding"), "opacity": n.get("opacity"),
        "characters": n.get("characters"),
    })
    for c in n.get("children", []) or []:
        walk(c, ax, ay)
walk(fig, 0, 0)

def find(name=None, contains=None, ftype=None, chars=None, idx=0):
    res = [f for f in flat if
           (name is None or f["name"] == name) and
           (ftype is None or f["type"] == ftype) and
           (contains is None or contains in (f["name"] or "")) and
           (chars is None or chars in (f["characters"] or ""))]
    return res[idx] if idx < len(res) else None

def all_of(name=None, contains=None, ftype=None, chars=None):
    return [f for f in flat if
            (name is None or f["name"] == name) and
            (ftype is None or f["type"] == ftype) and
            (contains is None or contains in (f["name"] or "")) and
            (chars is None or chars in (f["characters"] or ""))]

out = {"figma_total_nodes": len(flat), "figma_root": [fig["width"], fig["height"]]}

# regions
pairs = []
def cmp_region(label, fnode, ventry, vrect):
    if not fnode or not vrect:
        pairs.append({"element": label, "figma": fnode and [fnode["x"], fnode["y"], fnode["w"], fnode["h"]], "vue": vrect, "missing": not (fnode and vrect)})
        return
    f = [round(fnode["x"],1), round(fnode["y"],1), round(fnode["w"],1), round(fnode["h"],1)]
    d = [round(vrect[i]-f[i],1) for i in range(4)]
    pairs.append({"element": label, "figma": f, "vue": vrect, "diff": d})

# TopBar
top = find(name="Top Bar")
cmp_region("TopBar", top, None, vue["topBar"]["rect"])

# Sidebar
side = find(name="Sidebar")
cmp_region("Sidebar", side, None, vue["sidebar"]["rect"])

# TagsBar
tags = find(name="Tags Bar")
cmp_region("TagsBar", tags, None, vue["tagsBar"]["rect"])

# KPI cards (figma names?)
kpis = all_of(contains="KPI", ftype="FRAME")
vueK = vue["kpiRow"]["cards"]
for i, k in enumerate(kpis[:4]):
    cmp_region(f"KPI-Card-{i+1} ({k['name']})", k, None, vueK[i]["rect"] if i < len(vueK) else None)

# pie card / bar card / line card / footer
pie = find(contains="用户访问来源", ftype="FRAME")
bar = find(contains="每周用户活跃", ftype="FRAME")
line = find(contains="每月销售量", ftype="FRAME")
foot = find(contains="Copyright", ftype="FRAME")
cmp_region("PieCard", pie, None, vue["pieCard"]["rect"])
cmp_region("BarCard", bar, None, vue["barCard"]["rect"])
cmp_region("LineCard", line, None, vue["lineCard"]["rect"])
cmp_region("Footer", foot, None, vue["footer"]["rect"])

# content padding / gaps from figma content frame
content = find(name="Content") or find(contains="Content")
if content:
    out["figma_content"] = {"x": content["x"], "y": content["y"], "w": content["w"], "h": content["h"], "padding": content["padding"], "itemSpacing": content["itemSpacing"]}
out["comparisons"] = pairs

# pie sector geometry quantification
sectors = all_of(contains="Sector") or all_of(contains="sector")
pieS = []
for s in sectors:
    pieS.append({"name": s["name"], "x": s["x"], "y": s["y"], "w": s["w"], "h": s["h"], "fills": s["fills"]})
out["figma_pie_sectors"] = pieS

# pie callout labels
labels = all_of(ftype="TEXT", contains="营销") + all_of(ftype="TEXT", contains="访问") + all_of(ftype="TEXT", contains="引擎") + all_of(ftype="TEXT", contains="广告")
out["figma_pie_labels"] = [{"text": l["characters"], "x": l["x"], "y": l["y"]} for l in labels]

# bar rects
bars = all_of(contains="Bar", ftype="RECTANGLE") or all_of(ftype="RECTANGLE", contains="bar")
out["figma_bar_count"] = len(bars)
if bars:
    out["figma_bar_sample"] = [{"name": b["name"], "x": b["x"], "y": b["y"], "w": b["w"], "h": b["h"]} for b in bars[:8]]

# sample texts with font info
texts = all_of(ftype="TEXT")
out["figma_text_samples"] = [{"chars": t["characters"], "x": t["x"], "y": t["y"], "fs": t["fontSize"], "fw": t["fontWeight"], "family": t["fontFamily"]} for t in texts if t["characters"]][:60]

json.dump(out, open(r"C:\Users\Administrator\figma-vibe-bridge\.vibe\stage7\geometry-comparison.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for p in pairs:
    print(f"{p['element'][:28]:30s} figma={p['figma']} vue={p['vue']} diff={p.get('diff','?')}")
print("\nfigma pie sectors:", len(pieS))
for s in pieS: print("  ", s["name"], s["x"], s["y"], s["w"], s["h"], s["fills"])
print("figma bars:", out["figma_bar_count"])
print("content:", out.get("figma_content"))
