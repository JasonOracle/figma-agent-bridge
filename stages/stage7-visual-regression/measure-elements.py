#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Measure precise element bboxes in Figma render vs Vue screenshots."""
import json
import numpy as np
from PIL import Image

ST = r"C:\Users\Administrator\figma-vibe-bridge\.vibe\stage7"

def arr(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.int16)

F = arr(ST + r"\figma-baseline\figma-19-330-render.png")
V = arr(ST + r"\vue-1920-hover.png")

def mask_color(a, region, pred):
    x0, y0, x1, y1 = region
    sub = a[y0:y1, x0:x1]
    r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
    m = pred(r, g, b)
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return None, 0
    return [int(x0 + xs.min()), int(y0 + ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)], int(m.sum())

blue = lambda r, g, b: (b > 140) & (b - r > 40) & (b - g > 30) & (r < 150)          # #5470C6-ish
chartblue = lambda r, g, b: (np.abs(r - 84) < 45) & (np.abs(g - 112) < 45) & (np.abs(b - 198) < 45)
green = lambda r, g, b: (g > 130) & (g - r > 40) & (g - b > 20)
kpi_blue = lambda r, g, b: (b > 200) & (b - r > 60) & (g > 120) & (g < 210)
purple = lambda r, g, b: (np.abs(r - 90) < 40) & (np.abs(g - 92) < 40) & (b > 200)
dark = lambda r, g, b: (r < 90) & (g < 90) & (b < 90)

MEAS = [
    # name, region(x0,y0,x1,y1), predicate
    ("bar-badge-green-text", (1600, 200, 1900, 330), green),
    ("line-y-pointer-badge", (200, 560, 290, 880), chartblue),
    ("line-x-pill", (240, 820, 560, 870), chartblue),
    ("kpi1-icon", (215, 100, 280, 170), kpi_blue),
    ("kpi3-icon", (1073, 100, 1140, 170), lambda r, g, b: (r > 180) & (r - b > 60) & (g < 140)),  # red
    ("topbar-gear", (1690, 0, 1780, 40), dark),
    ("topbar-fullscreen", (1600, 0, 1690, 40), dark),
    ("sidebar-moremenu-icon", (28, 190, 70, 240), dark),
    ("sidebar-menu2-icon", (28, 400, 70, 460), dark),
    ("sidebar-logo", (10, 0, 60, 40), lambda r, g, b: (g > 120) & (g - r > 30)),
    ("pie-blue-sector", (204, 210, 480, 500), chartblue),
    ("tagsbar-active-pill", (190, 45, 320, 75), purple),
]

out = {}
for name, region, pred in MEAS:
    fb, fn = mask_color(F, region, pred)
    vb, vn = mask_color(V, region, pred)
    out[name] = {"figma_bbox": fb, "figma_px": fn, "vue_bbox": vb, "vue_px": vn,
                 "diff": (fb and vb) and [vb[i] - fb[i] for i in range(4)] or None}
    print(f"{name:24s} figma={fb} ({fn}px)   vue={vb} ({vn}px)   diff={out[name]['diff']}")

json.dump(out, open(ST + r"\element-measurements.json", "w", encoding="utf-8"), indent=1)
