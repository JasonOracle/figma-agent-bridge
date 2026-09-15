/**
 * 与 tools/stage5-build.js 完全同源的路径生成函数——
 * 保证浏览器里的 SVG 几何与 Figma 中的矢量节点逐点一致。
 */
const f = (n) => Math.round(n * 100) / 100;

/** 饼图扇形：arc → 三次贝塞尔（与 Figma create-vector 数据同式） */
export function arcSectorPath(cx, cy, r, a0, a1) {
  const segs = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / 2)));
  const pt = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [sx, sy] = pt(a0);
  let d = `M ${f(cx)} ${f(cy)} L ${f(sx)} ${f(sy)}`;
  let prev = a0;
  for (let i = 1; i <= segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs;
    const [px, py] = pt(prev);
    const [qx, qy] = pt(a);
    const k = (4 / 3) * Math.tan((a - prev) / 4);
    const c1 = [px + k * r * -Math.sin(prev), py + k * r * Math.cos(prev)];
    const c2 = [qx - k * r * -Math.sin(a), qy - k * r * Math.cos(a)];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(qx)} ${f(qy)}`;
    prev = a;
  }
  return d + " Z";
}

/** 水平网格线组 */
export const gridPath = (x0, x1, ys) =>
  ys.map((y) => `M ${f(x0)} ${f(y)} L ${f(x1)} ${f(y)}`).join(" ");

/** 垂直虚线（分段合成，与 Figma dashed vector 同参数 dash=5 gap=5） */
export function dashPath(x, y0, y1, dash = 5, gap = 5) {
  const parts = [];
  for (let y = y0; y < y1; y += dash + gap)
    parts.push(`M ${f(x)} ${f(y)} L ${f(x)} ${f(Math.min(y + dash, y1))}`);
  return parts.join(" ");
}

/** Catmull-Rom → 三次贝塞尔（与 Figma 折线矢量同式） */
export function smoothPath(pts) {
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
