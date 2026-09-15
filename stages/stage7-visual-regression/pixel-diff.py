#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Stage 7 pixel diff: FIGMA_RENDER_BASELINE vs Vue screenshot.
Outputs: diff-statistics.json, heatmap png, side-by-side, region stats, bboxes.
"""
import json, sys, os
import numpy as np
from PIL import Image

STAGE7 = r"C:\Users\Administrator\figma-vibe-bridge\.vibe\stage7"

def load(p):
    im = Image.open(p).convert("RGB")
    return im, np.asarray(im).astype(np.int16)

def global_ssim(a, b):
    """SSIM on grayscale, gaussian 11x11 sigma 1.5, valid mode (numpy impl)."""
    ga = np.dot(a, [0.299, 0.587, 0.114])
    gb = np.dot(b, [0.299, 0.587, 0.114])
    # gaussian kernel
    r = 5; sigma = 1.5
    ax = np.arange(-r, r + 1)
    k = np.exp(-(ax ** 2) / (2 * sigma ** 2)); k = k / k.sum()
    def blur(x):
        c = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 0, x)
        c = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 1, c)
        return c
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ma, mb = blur(ga), blur(gb)
    va, vb = blur(ga * ga) - ma * ma, blur(gb * gb) - mb * mb
    cov = blur(ga * gb) - ma * mb
    s = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))
    return float(np.mean(s))

def diff_stats(a, b, thresh=12):
    d = np.abs(a - b).max(axis=2)
    mask = d > thresh
    count = int(mask.sum())
    total = mask.size
    return {
        "threshold_per_channel": thresh,
        "diff_pixel_count": count,
        "total_pixels": total,
        "diff_percentage": round(count / total * 100, 3),
        "mean_abs_diff_all": round(float(np.abs(a - b).mean()), 3),
        "mean_abs_diff_diffpx": round(float(d[mask].mean()), 2) if count else 0,
        "p99_diff": int(np.percentile(d, 99)),
    }, mask, d

def bboxes_from_mask(mask, grid=32, max_boxes=40, min_density=0.08):
    """Cluster diff pixels into grid-cell bboxes; merge adjacent dense cells."""
    h, w = mask.shape
    gh, gw = (h + grid - 1) // grid, (w + grid - 1) // grid
    cells = np.zeros((gh, gw), dtype=bool)
    for gy in range(gh):
        for gx in range(gw):
            blk = mask[gy*grid:(gy+1)*grid, gx*grid:(gx+1)*grid]
            if blk.mean() >= min_density:
                cells[gy, gx] = True
    # connected components on cells (4-neighb, BFS)
    seen = np.zeros_like(cells)
    boxes = []
    from collections import deque
    for gy in range(gh):
        for gx in range(gw):
            if cells[gy, gx] and not seen[gy, gx]:
                q = deque([(gy, gx)]); seen[gy, gx] = True
                y0=y1=gy; x0=x1=gx; n=0
                while q:
                    cy, cx = q.popleft(); n += 1
                    y0=min(y0,cy); y1=max(y1,cy); x0=min(x0,cx); x1=max(x1,cx)
                    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny,nx=cy+dy,cx+dx
                        if 0<=ny<gh and 0<=nx<gw and cells[ny,nx] and not seen[ny,nx]:
                            seen[ny,nx]=True; q.append((ny,nx))
                boxes.append({"x":x0*grid,"y":y0*grid,"w":(x1-x0+1)*grid,"h":(y1-y0+1)*grid,"cells":n})
    boxes.sort(key=lambda b:-b["cells"])
    return boxes[:max_boxes]

REGIONS = {
    "TopBar":       (0, 0, 1920, 40),
    "Sidebar":      (0, 40, 180, 990),
    "TagsBar":      (180, 40, 1740, 36),
    "KPI-Card-1":   (204, 100, 405, 72),
    "KPI-Card-2":   (633, 100, 405, 72),
    "KPI-Card-3":   (1062, 100, 405, 72),
    "KPI-Card-4":   (1491, 100, 405, 72),
    "PieChartCard": (204, 196, 717, 300),
    "BarChartCard": (945, 196, 951, 300),
    "LineChartCard":(204, 520, 1692, 352),
    "Footer":       (204, 896, 1692, 60),
}

def main():
    figma_png = os.path.join(STAGE7, "figma-baseline", "figma-19-330-render.png")
    vue_png = os.path.join(STAGE7, sys.argv[1] if len(sys.argv) > 1 else "vue-1920-default.png")
    tag = sys.argv[2] if len(sys.argv) > 2 else "default"

    im_f, a = load(figma_png)
    im_v, b = load(vue_png)
    meta = {"figma_render": {"path": figma_png, "size": list(im_f.size)},
            "vue_screenshot": {"path": vue_png, "size": list(im_v.size)}}
    if im_f.size != im_v.size:
        im_v = im_v.resize(im_f.size, Image.LANCZOS)
        b = np.asarray(im_v).astype(np.int16)
        meta["resized_to"] = list(im_f.size)

    stats, mask, dmap = diff_stats(a, b)
    ssim = global_ssim(a.astype(np.float64), b.astype(np.float64))
    boxes = bboxes_from_mask(mask)

    # heatmap
    heat = np.zeros((*mask.shape, 3), dtype=np.uint8)
    heat[..., 0] = (np.clip(dmap, 0, 255)).astype(np.uint8)
    heat[..., 1] = (np.clip(dmap, 0, 255) * 0.35).astype(np.uint8)
    heat[mask, 2] = 40
    Image.fromarray(heat).save(os.path.join(STAGE7, f"heatmap-{tag}.png"))
    # side-by-side + diff view
    sbs = Image.new("RGB", (im_f.size[0], im_f.size[1] * 3 + 20), (30, 30, 30))
    sbs.paste(im_f, (0, 0)); sbs.paste(im_v, (0, im_f.size[1] + 10))
    sbs.paste(Image.fromarray(heat), (0, im_f.size[1] * 2 + 20))
    sbs.thumbnail((1400, 10000))
    sbs.save(os.path.join(STAGE7, f"side-by-side-{tag}.png"))

    # region stats
    regions = {}
    for name, (x, y, w, h) in REGIONS.items():
        rm = mask[y:y+h, x:x+w]
        rd = dmap[y:y+h, x:x+w]
        regions[name] = {
            "bbox_in_page": [x, y, w, h],
            "diff_pixels": int(rm.sum()),
            "area": int(rm.size),
            "diff_pct": round(float(rm.mean()) * 100, 2),
            "mean_diff": round(float(rd.mean()), 2),
        }
    # round-trip each bbox region diff%
    for bx in boxes:
        bx["density"] = round(bx["cells"] * 32 * 32 / bx["w"] / bx["h"], 2)
        rm = mask[bx["y"]:bx["y"]+bx["h"], bx["x"]:bx["x"]+bx["w"]]
        bx["diff_pct_in_box"] = round(float(rm.mean()) * 100, 1)

    result = {
        "comparison": f"FIGMA_RENDER_BASELINE vs VUE({tag})",
        **meta,
        "global": {"ssim": round(ssim, 4), **stats},
        "regions": regions,
        "diff_bboxes": boxes,
    }
    outp = os.path.join(STAGE7, f"diff-statistics-{tag}.json")
    with open(outp, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print(json.dumps({"ssim": result["global"]["ssim"], "diff_pct": result["global"]["diff_percentage"],
                      "diff_px": result["global"]["diff_pixel_count"]}, ensure_ascii=False))
    for n, r in regions.items():
        print(f"  {n:15s} diff%={r['diff_pct']:6.2f}  mean={r['mean_diff']:6.2f}")
    print("top boxes:")
    for bx in boxes[:12]:
        print(f"  box({bx['x']},{bx['y']},{bx['w']},{bx['h']}) density={bx['density']} pct={bx['diff_pct_in_box']}")

if __name__ == "__main__":
    main()
