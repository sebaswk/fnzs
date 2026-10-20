(() => {
  const NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["#3fd49a", "#6c9eff", "#f3b65b", "#f07d6e", "#a68cf7", "#4cc3e6", "#ec8ec0", "#b4dc6a", "#8a94a3", "#f59e6b"];
  const GRID = "rgba(255,255,255,0.07)";
  const AXIS = "rgba(255,255,255,0.22)";
  const TEXT = "#7d848f";
  let gradientSeq = 0;
  const drawers = new WeakMap();
  let observer = null;

  function svgEl(name, attrs = {}) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    });
    return node;
  }

  function htmlEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function resolve(target) {
    if (!target) return null;
    if (target.namespaceURI === NS) return target.parentElement;
    return target;
  }

  function watch(container, draw) {
    drawers.set(container, draw);
    if (typeof ResizeObserver === "undefined") return;
    if (!observer) {
      observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const node = entry.target;
          const width = Math.round(entry.contentRect.width);
          if (!width || Math.abs(width - (node._chartWidth || 0)) < 2) return;
          const fn = drawers.get(node);
          if (fn) requestAnimationFrame(fn);
        });
      });
    }
    if (!container._chartObserved) {
      observer.observe(container);
      container._chartObserved = true;
    }
  }

  function frame(container) {
    container.classList.add("chart");
    container.replaceChildren();
    const width = Math.round(container.clientWidth);
    container._chartWidth = width;
    if (!width) return null;
    const plot = htmlEl("div", "chart-plot");
    container.appendChild(plot);
    return { plot, width };
  }

  function showEmpty(container, text) {
    container.replaceChildren(htmlEl("div", "chart-empty", text || "Sin datos todavía"));
  }

  function niceStep(span, count) {
    const raw = span / Math.max(1, count);
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  function domain(min, max, count) {
    let lo = Math.min(0, min);
    let hi = Math.max(0, max);
    if (hi === lo) hi = lo + 1;
    const step = niceStep(hi - lo, count);
    lo = Math.floor(lo / step - 1e-9) * step;
    hi = Math.ceil(hi / step - 1e-9) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
    return { min: lo, max: hi, ticks };
  }

  function textWidth(text, size = 11.5) {
    return String(text).length * size * 0.58;
  }

  function legend(container, items) {
    if (!items.length) return;
    const box = htmlEl("div", "chart-legend");
    items.forEach((item) => {
      const span = htmlEl("span");
      const swatch = htmlEl("i", item.kind === "line" ? (item.dashed ? "is-dashed" : "is-line") : "");
      if (item.dashed) swatch.style.color = item.color;
      else swatch.style.background = item.color;
      span.append(swatch, document.createTextNode(item.name));
      box.appendChild(span);
    });
    container.appendChild(box);
  }

  function makeTip(plot) {
    const tip = htmlEl("div", "chart-tip");
    plot.appendChild(tip);
    return tip;
  }

  function fillTip(tip, title, rows) {
    tip.replaceChildren();
    if (title) tip.appendChild(htmlEl("div", "tip-title", title));
    rows.forEach((row) => {
      const line = htmlEl("div", `tip-row${row.total ? " is-total" : ""}`);
      const swatch = htmlEl("i");
      if (row.color) swatch.style.background = row.color;
      line.append(swatch, htmlEl("span", "", row.name), htmlEl("strong", "", row.value));
      tip.appendChild(line);
    });
  }

  function placeTip(tip, plot, anchorX, anchorY) {
    const width = plot.clientWidth;
    const height = plot.clientHeight;
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    let left = anchorX + 14;
    if (left + tipW > width - 4) left = anchorX - tipW - 14;
    left = Math.max(4, Math.min(left, width - tipW - 4));
    let top = anchorY - tipH / 2;
    top = Math.max(4, Math.min(top, height - tipH - 4));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.classList.add("is-on");
  }

  const touchTips = new Set();
  document.addEventListener("pointerdown", (event) => {
    touchTips.forEach((entry) => {
      if (!entry.plot.isConnected) {
        touchTips.delete(entry);
        return;
      }
      if (!entry.plot.contains(event.target)) {
        touchTips.delete(entry);
        entry.leave();
      }
    });
  }, { passive: true });

  function bindHover(svg, plot, onMove, onLeave) {
    const entry = { plot, leave: onLeave };
    const local = (event) => {
      const box = svg.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    svg.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch" && !touchTips.has(entry)) return;
      onMove(local(event));
    });
    svg.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") {
        touchTips.add(entry);
        onMove(local(event));
      }
    });
    svg.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") onLeave();
    });
  }

  function roundedBar(x, yTop, w, h, radius, roundTop) {
    const r = Math.max(0, Math.min(radius, w / 2, h));
    if (r < 0.5) return `M${x} ${yTop}h${w}v${h}h${-w}Z`;
    if (roundTop) {
      return `M${x} ${yTop + h}V${yTop + r}Q${x} ${yTop} ${x + r} ${yTop}H${x + w - r}Q${x + w} ${yTop} ${x + w} ${yTop + r}V${yTop + h}Z`;
    }
    return `M${x} ${yTop}H${x + w}V${yTop + h - r}Q${x + w} ${yTop + h} ${x + w - r} ${yTop + h}H${x + r}Q${x} ${yTop + h} ${x} ${yTop + h - r}Z`;
  }

  function yAxis(svg, dom, yOf, pad, width, formatAxis) {
    dom.ticks.forEach((tick) => {
      const y = yOf(tick);
      svg.appendChild(svgEl("line", {
        x1: pad.left,
        x2: width - pad.right,
        y1: y,
        y2: y,
        stroke: tick === 0 ? AXIS : GRID,
        "stroke-width": 1,
        "shape-rendering": "crispEdges"
      }));
      const label = svgEl("text", {
        x: pad.left - 10,
        y: y + 4,
        fill: TEXT,
        "font-size": 11.5,
        "text-anchor": "end"
      });
      label.textContent = formatAxis(tick);
      svg.appendChild(label);
    });
  }

  function leftPad(dom, formatAxis) {
    const longest = Math.max(...dom.ticks.map((tick) => textWidth(formatAxis(tick))));
    return Math.ceil(longest + 18);
  }

  /* Columnas agrupadas o apiladas, con líneas opcionales */
  function columns(target, config) {
    const container = resolve(target);
    if (!container) return;
    const draw = () => drawColumns(container, config);
    watch(container, draw);
    draw();
  }

  function drawColumns(container, cfg) {
    const labels = cfg.labels || [];
    const series = (cfg.series || []).filter(Boolean);
    const lines = (cfg.lines || []).filter(Boolean);
    const format = cfg.format || String;
    const formatAxis = cfg.formatAxis || format;
    const hasData = series.some((s) => s.values.some((v) => Number(v))) || lines.some((l) => l.values.some((v) => Number(v)));
    if (!labels.length || !hasData) {
      container._chartWidth = Math.round(container.clientWidth);
      showEmpty(container, cfg.empty);
      return;
    }
    const box = frame(container);
    if (!box) return;
    const { plot, width } = box;
    const height = cfg.height || (width < 520 ? 230 : 280);

    const stacks = [];
    series.forEach((s) => {
      const key = s.stack || s.name;
      if (!stacks.includes(key)) stacks.push(key);
    });

    let maxV = 0;
    let minV = 0;
    labels.forEach((_, i) => {
      stacks.forEach((key) => {
        let pos = 0;
        let neg = 0;
        series.filter((s) => (s.stack || s.name) === key).forEach((s) => {
          const v = Number(s.values[i]) || 0;
          if (v >= 0) pos += v;
          else neg += v;
        });
        maxV = Math.max(maxV, pos);
        minV = Math.min(minV, neg);
      });
      lines.forEach((line) => {
        const v = Number(line.values[i]) || 0;
        maxV = Math.max(maxV, v);
        minV = Math.min(minV, v);
      });
    });

    const dom = domain(minV, maxV, height < 250 ? 4 : 5);
    const pad = { top: 12, right: 6, bottom: 30, left: leftPad(dom, formatAxis) };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const yOf = (v) => pad.top + innerH - ((v - dom.min) / (dom.max - dom.min)) * innerH;
    const band = innerW / labels.length;
    const colGap = stacks.length > 1 ? Math.max(2, Math.min(4, band * 0.05)) : 0;
    const groupW = Math.min(band * 0.74, stacks.length * 28 + colGap * (stacks.length - 1));
    const colW = (groupW - colGap * (stacks.length - 1)) / stacks.length;

    const svg = svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
    if (cfg.title) svg.setAttribute("aria-label", cfg.title);
    plot.appendChild(svg);
    yAxis(svg, dom, yOf, pad, width, formatAxis);

    const shortLabels = cfg.shortLabels || labels;
    const maxLabel = Math.max(...shortLabels.map((label) => textWidth(label, 11.5)));
    const every = Math.max(1, Math.ceil((maxLabel + 8) / band));
    shortLabels.forEach((label, i) => {
      if (i % every !== 0) return;
      const text = svgEl("text", {
        x: pad.left + band * i + band / 2,
        y: height - 9,
        fill: TEXT,
        "font-size": 11.5,
        "text-anchor": "middle"
      });
      text.textContent = label;
      svg.appendChild(text);
    });

    const highlight = svgEl("rect", {
      y: pad.top,
      height: innerH,
      width: band,
      rx: 6,
      fill: "rgba(255,255,255,0.045)",
      visibility: "hidden"
    });
    svg.appendChild(highlight);

    const zeroY = yOf(0);
    labels.forEach((_, i) => {
      const groupX = pad.left + band * i + (band - groupW) / 2;
      stacks.forEach((key, j) => {
        const members = series.filter((s) => (s.stack || s.name) === key);
        const x = groupX + j * (colW + colGap);
        const positives = members.filter((s) => (Number(s.values[i]) || 0) > 0);
        let acc = 0;
        positives.forEach((s, k) => {
          const v = Number(s.values[i]) || 0;
          const top = yOf(acc + v);
          const bottom = yOf(acc);
          const isTop = k === positives.length - 1;
          const gap = k > 0 && bottom - top > 3 ? 1 : 0;
          svg.appendChild(svgEl("path", {
            d: roundedBar(x, top, colW, Math.max(1, bottom - top - gap), isTop ? 4 : 0, true),
            fill: s.color
          }));
          acc += v;
        });
        let neg = 0;
        const negatives = members.filter((s) => (Number(s.values[i]) || 0) < 0);
        negatives.forEach((s, k) => {
          const v = Number(s.values[i]) || 0;
          const top = yOf(neg);
          const bottom = yOf(neg + v);
          const isLast = k === negatives.length - 1;
          svg.appendChild(svgEl("path", {
            d: roundedBar(x, top, colW, Math.max(1, bottom - top), isLast ? 4 : 0, false),
            fill: s.color,
            opacity: 0.85
          }));
          neg += v;
        });
      });
    });

    lines.forEach((line) => {
      const pts = labels.map((_, i) => [pad.left + band * i + band / 2, yOf(Number(line.values[i]) || 0)]);
      svg.appendChild(svgEl("path", {
        d: pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(""),
        fill: "none",
        stroke: line.color,
        "stroke-width": 2,
        "stroke-dasharray": line.dashed ? "5 5" : null,
        "stroke-linejoin": "round",
        "stroke-linecap": "round"
      }));
      if (band > 14) {
        pts.forEach((p) => {
          svg.appendChild(svgEl("circle", {
            cx: p[0],
            cy: p[1],
            r: 3.2,
            fill: "#121418",
            stroke: line.color,
            "stroke-width": 2
          }));
        });
      }
    });

    if (zeroY > pad.top && zeroY < pad.top + innerH) {
      svg.appendChild(svgEl("line", {
        x1: pad.left,
        x2: width - pad.right,
        y1: zeroY,
        y2: zeroY,
        stroke: AXIS,
        "stroke-width": 1,
        "shape-rendering": "crispEdges"
      }));
    }

    const tip = makeTip(plot);
    const tipTitle = cfg.tipTitle || ((i) => labels[i]);
    bindHover(svg, plot, (pt) => {
      if (pt.x < pad.left || pt.x > width - pad.right) {
        highlight.setAttribute("visibility", "hidden");
        tip.classList.remove("is-on");
        return;
      }
      const i = Math.max(0, Math.min(labels.length - 1, Math.floor((pt.x - pad.left) / band)));
      highlight.setAttribute("x", pad.left + band * i);
      highlight.setAttribute("visibility", "visible");
      let rows;
      if (cfg.tipRows) rows = cfg.tipRows(i);
      else {
        rows = series.map((s) => ({ name: s.name, color: s.color, value: format(Number(s.values[i]) || 0) }));
        lines.forEach((line) => rows.push({ name: line.name, color: line.color, value: format(Number(line.values[i]) || 0), total: !!line.total }));
        if (cfg.tipExtra) cfg.tipExtra(i).forEach((row) => rows.push(row));
      }
      fillTip(tip, tipTitle(i), rows);
      placeTip(tip, plot, pad.left + band * i + band / 2, pt.y);
    }, () => {
      highlight.setAttribute("visibility", "hidden");
      tip.classList.remove("is-on");
    });

    if (cfg.legend !== false) {
      legend(container, [
        ...series.map((s) => ({ name: s.name, color: s.color })),
        ...lines.map((l) => ({ name: l.name, color: l.color, kind: "line", dashed: l.dashed }))
      ]);
    }
  }

  /* Áreas suavizadas */
  function monotonePath(points) {
    const n = points.length;
    if (n < 2) return points.length ? `M${points[0][0]} ${points[0][1]}` : "";
    if (n === 2) return `M${points[0][0]} ${points[0][1]}L${points[1][0]} ${points[1][1]}`;
    const dx = [];
    const slope = [];
    for (let i = 0; i < n - 1; i += 1) {
      dx[i] = points[i + 1][0] - points[i][0];
      slope[i] = dx[i] ? (points[i + 1][1] - points[i][1]) / dx[i] : 0;
    }
    const tangent = [slope[0]];
    for (let i = 1; i < n - 1; i += 1) {
      if (slope[i - 1] * slope[i] <= 0) tangent[i] = 0;
      else {
        const w1 = 2 * dx[i] + dx[i - 1];
        const w2 = dx[i] + 2 * dx[i - 1];
        tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
      }
    }
    tangent[n - 1] = slope[n - 2];
    let d = `M${points[0][0]} ${points[0][1]}`;
    for (let i = 0; i < n - 1; i += 1) {
      const h = dx[i] / 3;
      d += `C${points[i][0] + h} ${points[i][1] + tangent[i] * h} ${points[i + 1][0] - h} ${points[i + 1][1] - tangent[i + 1] * h} ${points[i + 1][0]} ${points[i + 1][1]}`;
    }
    return d;
  }

  function area(target, config) {
    const container = resolve(target);
    if (!container) return;
    const draw = () => drawArea(container, config);
    watch(container, draw);
    draw();
  }

  function drawArea(container, cfg) {
    const series = (cfg.series || []).filter((s) => s && s.points.length);
    const formatY = cfg.formatY || String;
    const formatAxis = cfg.formatAxis || formatY;
    const formatX = cfg.formatX || String;
    const all = series.flatMap((s) => s.points);
    if (!all.length || !all.some((p) => Number(p.y))) {
      container._chartWidth = Math.round(container.clientWidth);
      showEmpty(container, cfg.empty);
      return;
    }
    const box = frame(container);
    if (!box) return;
    const { plot, width } = box;
    const height = cfg.height || (width < 520 ? 230 : 290);
    const minX = Math.min(...all.map((p) => p.x));
    const maxX = Math.max(...all.map((p) => p.x));
    const dom = domain(Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y)), height < 250 ? 4 : 5);
    const pad = { top: 12, right: 14, bottom: 30, left: leftPad(dom, formatAxis) };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const spanX = Math.max(maxX - minX, 1e-9);
    const xOf = (x) => pad.left + ((x - minX) / spanX) * innerW;
    const yOf = (v) => pad.top + innerH - ((v - dom.min) / (dom.max - dom.min)) * innerH;

    const svg = svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
    plot.appendChild(svg);
    yAxis(svg, dom, yOf, pad, width, formatAxis);

    const xTicks = cfg.xTicks ? cfg.xTicks(minX, maxX, innerW) : (() => {
      const step = Math.max(1, niceStep(spanX, Math.max(2, Math.floor(innerW / 80))));
      const ticks = [];
      for (let v = Math.ceil(minX / step) * step; v <= maxX + 1e-9; v += step) ticks.push(v);
      return ticks;
    })();
    xTicks.forEach((tick) => {
      const text = svgEl("text", {
        x: xOf(tick),
        y: height - 9,
        fill: TEXT,
        "font-size": 11.5,
        "text-anchor": tick === minX ? "start" : tick === maxX ? "end" : "middle"
      });
      text.textContent = formatX(tick);
      svg.appendChild(text);
    });

    const defs = svgEl("defs");
    svg.appendChild(defs);
    const baseY = yOf(Math.max(dom.min, Math.min(0, dom.max)));
    series.forEach((s) => {
      const pts = s.points.map((p) => [xOf(p.x), yOf(p.y)]);
      const path = monotonePath(pts);
      if (s.fill !== false) {
        gradientSeq += 1;
        const id = `area-grad-${gradientSeq}`;
        const grad = svgEl("linearGradient", { id, x1: 0, x2: 0, y1: 0, y2: 1 });
        grad.append(
          svgEl("stop", { offset: "0%", "stop-color": s.color, "stop-opacity": s.fillOpacity || 0.28 }),
          svgEl("stop", { offset: "100%", "stop-color": s.color, "stop-opacity": 0 })
        );
        defs.appendChild(grad);
        svg.appendChild(svgEl("path", {
          d: `${path}L${pts.at(-1)[0]} ${baseY}L${pts[0][0]} ${baseY}Z`,
          fill: `url(#${id})`
        }));
      }
    });
    series.forEach((s) => {
      const pts = s.points.map((p) => [xOf(p.x), yOf(p.y)]);
      svg.appendChild(svgEl("path", {
        d: monotonePath(pts),
        fill: "none",
        stroke: s.color,
        "stroke-width": s.width || 2.2,
        "stroke-dasharray": s.dashed ? "5 5" : null,
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      }));
    });

    const cross = svgEl("line", {
      y1: pad.top,
      y2: pad.top + innerH,
      stroke: "rgba(255,255,255,0.3)",
      "stroke-width": 1,
      "stroke-dasharray": "3 3",
      visibility: "hidden"
    });
    svg.appendChild(cross);
    const dots = series.map((s) => {
      const dot = svgEl("circle", { r: 4.5, fill: "#121418", stroke: s.color, "stroke-width": 2.2, visibility: "hidden" });
      svg.appendChild(dot);
      return dot;
    });

    const tip = makeTip(plot);
    const base = series.reduce((longest, s) => (s.points.length > longest.points.length ? s : longest), series[0]);
    bindHover(svg, plot, (pt) => {
      const dataX = minX + ((Math.min(Math.max(pt.x, pad.left), width - pad.right) - pad.left) / innerW) * spanX;
      let nearest = base.points[0];
      base.points.forEach((p) => {
        if (Math.abs(p.x - dataX) < Math.abs(nearest.x - dataX)) nearest = p;
      });
      const x = xOf(nearest.x);
      cross.setAttribute("x1", x);
      cross.setAttribute("x2", x);
      cross.setAttribute("visibility", "visible");
      const rows = [];
      series.forEach((s, i) => {
        const match = s.points.find((p) => p.x === nearest.x);
        if (!match) {
          dots[i].setAttribute("visibility", "hidden");
          rows.push({ name: s.name, color: s.color, value: s.afterEnd || "—" });
          return;
        }
        dots[i].setAttribute("cx", x);
        dots[i].setAttribute("cy", yOf(match.y));
        dots[i].setAttribute("visibility", "visible");
        rows.push({ name: s.name, color: s.color, value: formatY(match.y) });
      });
      if (cfg.tipExtra) cfg.tipExtra(nearest.x).forEach((row) => rows.push(row));
      fillTip(tip, (cfg.tipTitle || formatX)(nearest.x), rows);
      placeTip(tip, plot, x, pt.y);
    }, () => {
      cross.setAttribute("visibility", "hidden");
      dots.forEach((dot) => dot.setAttribute("visibility", "hidden"));
      tip.classList.remove("is-on");
    });

    if (cfg.legend !== false) {
      legend(container, series.map((s) => ({ name: s.name, color: s.color, kind: "line", dashed: s.dashed })));
    }
  }

  /* Cascada: de un total a otro con sumas y restas */
  function waterfall(target, config) {
    const container = resolve(target);
    if (!container) return;
    const draw = () => drawWaterfall(container, config);
    watch(container, draw);
    draw();
  }

  function drawWaterfall(container, cfg) {
    const steps = cfg.steps || [];
    const format = cfg.format || String;
    const formatShort = cfg.formatShort || format;
    if (!steps.some((s) => Number(s.value))) {
      container._chartWidth = Math.round(container.clientWidth);
      showEmpty(container, cfg.empty);
      return;
    }
    const box = frame(container);
    if (!box) return;
    const { plot, width } = box;
    const height = cfg.height || (width < 520 ? 250 : 290);
    let running = 0;
    const bars = steps.map((step) => {
      const value = Number(step.value) || 0;
      if (step.kind === "total") {
        running = value;
        return { ...step, from: 0, to: value };
      }
      const from = running;
      running += value;
      return { ...step, from, to: running };
    });
    const values = bars.flatMap((b) => [b.from, b.to]);
    const dom = domain(Math.min(...values), Math.max(...values), 4);
    const pad = { top: 24, right: 6, bottom: 30, left: leftPad(dom, formatShort) };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const yOf = (v) => pad.top + innerH - ((v - dom.min) / (dom.max - dom.min)) * innerH;
    const band = innerW / bars.length;
    const colW = Math.min(band * 0.62, 64);

    const svg = svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
    plot.appendChild(svg);
    yAxis(svg, dom, yOf, pad, width, formatShort);

    bars.forEach((bar, i) => {
      const x = pad.left + band * i + (band - colW) / 2;
      const top = yOf(Math.max(bar.from, bar.to));
      const bottom = yOf(Math.min(bar.from, bar.to));
      const color = bar.color || (bar.kind === "total" ? "#6c9eff" : (bar.to >= bar.from ? "#3fd49a" : "#f07d6e"));
      svg.appendChild(svgEl("path", {
        d: roundedBar(x, top, colW, Math.max(2, bottom - top), 4, bar.to >= bar.from),
        fill: color
      }));
      if (i < bars.length - 1) {
        const yLink = yOf(bar.to);
        svg.appendChild(svgEl("line", {
          x1: x + colW,
          x2: x + band,
          y1: yLink,
          y2: yLink,
          stroke: "rgba(255,255,255,0.25)",
          "stroke-dasharray": "3 3"
        }));
      }
      const amount = bar.kind === "total" ? bar.to : bar.to - bar.from;
      const label = svgEl("text", {
        x: x + colW / 2,
        y: top - 7,
        fill: "#cdd1d8",
        "font-size": 11.5,
        "font-weight": 600,
        "text-anchor": "middle"
      });
      label.textContent = formatShort(amount);
      svg.appendChild(label);
      const name = svgEl("text", {
        x: x + colW / 2,
        y: height - 9,
        fill: TEXT,
        "font-size": 11.5,
        "text-anchor": "middle"
      });
      name.textContent = bar.short || bar.label;
      svg.appendChild(name);
    });

    const tip = makeTip(plot);
    bindHover(svg, plot, (pt) => {
      if (pt.x < pad.left) {
        tip.classList.remove("is-on");
        return;
      }
      const i = Math.max(0, Math.min(bars.length - 1, Math.floor((pt.x - pad.left) / band)));
      const bar = bars[i];
      const amount = bar.kind === "total" ? bar.to : bar.to - bar.from;
      fillTip(tip, bar.label, [{ name: bar.kind === "total" ? "Total" : (amount >= 0 ? "Suma" : "Resta"), value: format(amount) }]);
      placeTip(tip, plot, pad.left + band * i + band / 2, pt.y);
    }, () => tip.classList.remove("is-on"));
  }

  /* Desglose: barra segmentada + lista ordenada */
  function formatShare(value, total) {
    const pct = (value / total) * 100;
    if (!(pct > 0)) return "0%";
    let digits = 1;
    while (Number(pct.toFixed(digits)) === 0 && digits < 4) digits += 1;
    return `${pct.toLocaleString("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
  }

  function breakdown(target, slices, options = {}) {
    const container = resolve(target);
    if (!container) return;
    container.classList.add("chart");
    container.classList.remove("is-focus");
    container.replaceChildren();
    const format = options.format || String;
    const list = (slices || []).filter((s) => Number(s.value) > 0);
    if (options.sort !== false) list.sort((a, b) => b.value - a.value);
    if (!list.length) {
      showEmpty(container, options.empty);
      return;
    }
    container.classList.add("bd");
    const total = list.reduce((sum, s) => sum + Number(s.value), 0);
    const top = Math.max(...list.map((s) => Number(s.value)));

    const head = htmlEl("div", "bd-head");
    head.append(htmlEl("span", "", options.totalLabel || "Total"), htmlEl("strong", "", options.totalValue || format(total)));

    const bar = htmlEl("div", "bd-bar");
    const rows = htmlEl("ul", "bd-list");
    list.forEach((slice, index) => {
      const color = slice.color || PALETTE[index % PALETTE.length];
      const share = formatShare(slice.value, total);
      const seg = htmlEl("span");
      seg.style.flex = `${slice.value} 1 0`;
      seg.style.background = color;
      seg.title = `${slice.label}: ${format(slice.value)} · ${share}`;
      bar.appendChild(seg);

      const row = htmlEl("li", "bd-row");
      const swatch = htmlEl("i");
      swatch.style.background = color;
      const label = htmlEl("span", "bd-label", slice.label);
      label.title = slice.label;
      if (slice.note) label.appendChild(htmlEl("small", "", slice.note));
      const meter = htmlEl("span", "bd-meter");
      const fill = htmlEl("b");
      fill.style.width = `${Math.max(2, (slice.value / top) * 100)}%`;
      fill.style.background = color;
      meter.appendChild(fill);
      row.append(swatch, label, htmlEl("span", "bd-value", format(slice.value)), htmlEl("span", "bd-pct", share), meter);
      const focus = (on) => {
        container.classList.toggle("is-focus", on);
        row.classList.toggle("is-hot", on);
        seg.classList.toggle("is-hot", on);
      };
      row.addEventListener("mouseenter", () => focus(true));
      row.addEventListener("mouseleave", () => focus(false));
      seg.addEventListener("mouseenter", () => focus(true));
      seg.addEventListener("mouseleave", () => focus(false));
      rows.appendChild(row);
    });
    container.append(head, bar, rows);
  }

  /* Barras divergentes: ganancias a la derecha, pérdidas a la izquierda */
  function diverging(target, bars, options = {}) {
    const container = resolve(target);
    if (!container) return;
    container.classList.add("chart", "dv");
    container.replaceChildren();
    const format = options.format || String;
    const list = (bars || []).filter(Boolean);
    if (!list.length) {
      container.classList.remove("dv");
      showEmpty(container, options.empty);
      return;
    }
    const maxPos = Math.max(0, ...list.map((b) => Number(b.value) || 0));
    const maxNeg = Math.max(0, ...list.map((b) => -(Number(b.value) || 0)));
    const span = maxPos + maxNeg || 1;
    const zero = (maxNeg / span) * 100;
    list.forEach((bar, index) => {
      const value = Number(bar.value) || 0;
      const row = htmlEl("div", "dv-row");
      const label = htmlEl("span", "dv-label", bar.label);
      label.title = bar.label;
      const amount = htmlEl("span", `dv-value ${value > 0 ? "positive" : value < 0 ? "negative" : "muted"}`, `${value > 0 ? "+" : ""}${format(value)}`);
      const track = htmlEl("div", "dv-track");
      if (maxNeg > 0) {
        const axis = htmlEl("span", "dv-axis");
        axis.style.left = `${zero}%`;
        track.appendChild(axis);
      }
      if (value !== 0) {
        const fill = htmlEl("span", "dv-bar");
        const widthPct = (Math.abs(value) / span) * 100;
        fill.style.width = `${widthPct}%`;
        fill.style.left = value > 0 ? `${zero}%` : `${zero - widthPct}%`;
        fill.style.background = value > 0 ? (bar.color || PALETTE[index % PALETTE.length]) : "#f07d6e";
        track.appendChild(fill);
      }
      row.append(label, amount, track);
      container.appendChild(row);
    });
  }

  /* Rango: escenario bajo, esperado y alto */
  function range(target, config) {
    const container = resolve(target);
    if (!container) return;
    container.classList.add("chart");
    container.replaceChildren();
    const format = config.format || String;
    const low = Number(config.low) || 0;
    const mid = Number(config.mid) || 0;
    const high = Number(config.high) || 0;
    if (!low && !mid && !high) {
      showEmpty(container, config.empty);
      return;
    }
    const lo = Math.min(low, high, mid, 0);
    const hi = Math.max(low, high, mid, 0);
    const padSpan = (hi - lo) * 0.08 || 1;
    const min = lo === 0 ? 0 : lo - padSpan;
    const max = hi === 0 ? 0 : hi + padSpan;
    const pos = (v) => ((v - min) / ((max - min) || 1)) * 100;

    const track = htmlEl("div", "rg-track");
    track.appendChild(htmlEl("span", "rg-line"));
    const band = htmlEl("span", "rg-band");
    band.style.left = `${pos(Math.min(low, high))}%`;
    band.style.width = `${Math.max(1, pos(Math.max(low, high)) - pos(Math.min(low, high)))}%`;
    track.appendChild(band);
    if (min < 0 && max > 0) {
      const zero = htmlEl("span", "rg-zero");
      zero.style.left = `${pos(0)}%`;
      zero.appendChild(htmlEl("span", "", "0"));
      track.appendChild(zero);
    }
    const mark = htmlEl("span", "rg-mark");
    mark.style.left = `${pos(mid)}%`;
    mark.title = `${config.midLabel || "Esperado"}: ${format(mid)}`;
    track.appendChild(mark);

    const values = htmlEl("div", "rg-values");
    [
      [config.lowLabel || "Escenario bajo", low, low < 0 ? "negative" : ""],
      [config.midLabel || "Esperado", mid, mid < 0 ? "negative" : ""],
      [config.highLabel || "Escenario alto", high, high < 0 ? "negative" : "positive"]
    ].forEach(([name, value, cls]) => {
      const cell = htmlEl("div");
      cell.append(htmlEl("span", "", name), htmlEl("strong", cls, format(value)));
      values.appendChild(cell);
    });
    container.append(track, values);
  }

  window.NorteCharts = { columns, area, waterfall, breakdown, diverging, range, palette: PALETTE, formatShare };
})();
