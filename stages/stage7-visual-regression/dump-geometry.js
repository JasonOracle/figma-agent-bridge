/* Stage 7 - Vue DOM geometry + computed style dump (run via playwright-cli eval) */
(() => {
  const R = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10];
  };
  const CS = (el, props) => {
    if (!el) return null;
    const c = getComputedStyle(el);
    const o = {};
    (props || ["backgroundColor", "color", "fontSize", "fontWeight", "lineHeight", "fontFamily", "borderRadius", "border", "boxShadow", "padding", "gap", "display", "justifyContent", "alignItems"]).forEach((p) => {
      const v = c[p];
      if (v && v !== "none" && v !== "normal" && v !== "rgba(0, 0, 0, 0)") o[p] = v;
    });
    return o;
  };
  const node = (el, name, deep) => {
    if (!el) return { name, missing: true };
    const o = { name, tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || "", rect: R(el) };
    const st = CS(el);
    if (Object.keys(st).length) o.styles = st;
    const t = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (t && t.length < 60) o.text = t;
    if (deep && el.children.length) o.children = [...el.children].map((c) => node(c, c.tagName.toLowerCase(), false));
    return o;
  };

  const app = document.querySelector("#app > div");
  const bodyRow = app.children[1];
  const sidebar = bodyRow.children[0];
  const main = bodyRow.children[1];
  const tagsBar = main.children[0];
  const content = main.children[1];
  const kpiRow = content.children[0];
  const chartsRow = content.children[1];
  const pieCard = chartsRow.children[0];
  const barCard = chartsRow.children[1];
  const lineCard = content.children[2];
  const footer = content.children[3];

  const out = { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollHeight: document.documentElement.scrollHeight };

  out.topBar = node(app.children[0], "TopBar", true);
  out.sidebar = node(sidebar, "Sidebar", true);
  out.tagsBar = node(tagsBar, "TagsBar", true);
  out.kpiRow = { rect: R(kpiRow), styles: CS(kpiRow), cards: [...kpiRow.children].map((c) => node(c, "KpiCard", true)) };
  out.pieCard = node(pieCard, "PieCard", true);
  out.barCard = node(barCard, "BarCard", true);
  out.lineCard = node(lineCard, "LineCard", true);
  out.footer = node(footer, "Footer", true);

  // SVG 内部几何（饼图 / 柱图 / 折线）
  const svgDump = (svg) => {
    if (!svg) return null;
    const o = { viewBox: svg.getAttribute("viewBox"), rect: R(svg) };
    o.shapes = [...svg.querySelectorAll("path,rect,circle,text")].slice(0, 80).map((s) => ({
      t: s.tagName.toLowerCase(),
      d: s.getAttribute("d") ? s.getAttribute("d").slice(0, 120) : undefined,
      x: s.getAttribute("x"), y: s.getAttribute("y"), cx: s.getAttribute("cx"), cy: s.getAttribute("cy"),
      w: s.getAttribute("width"), h: s.getAttribute("height"), r: s.getAttribute("r"), rx: s.getAttribute("rx"),
      fill: s.getAttribute("fill"), stroke: s.getAttribute("stroke"), fs: s.getAttribute("font-size"),
      text: s.tagName.toLowerCase() === "text" ? (s.textContent || "").trim() : undefined,
    }));
    return o;
  };
  out.pieSvg = svgDump(pieCard.querySelector("svg"));
  out.barSvg = svgDump(barCard.querySelector("svg"));
  out.lineSvg = svgDump(lineCard.querySelector("svg"));

  // 折线 hover 目标坐标：viewBox 1660 宽，二月 xFor(1)=246
  const lineSvg = lineCard.querySelector("svg");
  const lr = lineSvg.getBoundingClientRect();
  const scale = lr.width / 1660;
  out.hoverTarget = { screenX: Math.round((lr.left + 246 * scale) * 10) / 10, screenY: Math.round((lr.top + lr.height * 0.5) * 10) / 10, svgLeft: lr.left, svgTop: lr.top, svgW: lr.width, svgH: lr.height, scale: Math.round(scale * 10000) / 10000 };

  return JSON.stringify(out);
})()
