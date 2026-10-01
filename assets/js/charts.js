(() => {
  const NS = "http://www.w3.org/2000/svg";
  let clipSeq = 0;

  function el(name, attrs = {}) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    });
    return node;
  }

  function clear(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function ensureTip(wrap) {
    wrap.querySelectorAll(".chart-tip").forEach((node) => node.remove());
    const tip = document.createElement("div");
    tip.className = "chart-tip";
    wrap.appendChild(tip);
    return tip;
  }

  function placeTip(tip, wrap, event) {
    const wrapBox = wrap.getBoundingClientRect();
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    const localX = event.clientX - wrapBox.left;
    const localY = event.clientY - wrapBox.top;
    let leftPos = localX + 16;
    if (leftPos + tipW > wrapBox.width - 8) leftPos = localX - tipW - 12;
    leftPos = Math.max(8, Math.min(leftPos, wrapBox.width - tipW - 8));
    let topPos = localY - tipH - 10;
    if (topPos < 8) topPos = localY + 14;
    topPos = Math.max(8, Math.min(topPos, wrapBox.height - tipH - 8));
    tip.style.left = `${leftPos}px`;
    tip.style.top = `${topPos}px`;
    tip.classList.add("is-on");
  }

  function lineChart(svg, series, options = {}) {
    clear(svg);
    const wrap = svg.closest(".chart-wrap") || svg.parentElement;
    wrap.querySelectorAll(".chart-tip, .donut-legend").forEach((node) => {
      if (node.classList.contains("donut-legend")) return;
      if (node.classList.contains("chart-tip")) node.remove();
    });
    wrap.querySelectorAll(":scope > .chart-tip").forEach((node) => node.remove());

    const formatY = options.formatY || ((n) => String(n));
    const formatX = options.formatX || ((n) => String(n));
    const all = series.flatMap((item) => item.points);
    if (!all.length) return;

    const minX = Math.min(...all.map((p) => p.x));
    const maxX = Math.max(...all.map((p) => p.x));
    const rawMinY = Math.min(0, ...all.map((p) => p.y));
    const rawMaxY = Math.max(0, ...all.map((p) => p.y));
    const minY = rawMinY;
    const maxY = rawMaxY === rawMinY ? rawMinY + 1 : rawMaxY;
    const longest = formatY(Math.abs(maxY) > Math.abs(minY) ? maxY : minY);
    const left = Math.min(120, Math.max(72, 18 + longest.length * 7.4));
    const width = 760;
    const height = 320;
    const pad = { top: 18, right: 44, bottom: 42, left };
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.style.overflow = "hidden";

    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const xOf = (x) => pad.left + ((x - minX) / spanX) * innerW;
    const yOf = (y) => pad.top + innerH - ((y - minY) / spanY) * innerH;

    const clipId = `plot-clip-${clipSeq += 1}`;
    const defs = el("defs");
    const clip = el("clipPath", { id: clipId });
    clip.appendChild(el("rect", {
      x: pad.left,
      y: pad.top,
      width: innerW,
      height: innerH
    }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    const grid = el("g", { class: "grid" });
    const ticks = 4;
    for (let i = 0; i <= ticks; i += 1) {
      const value = minY + (spanY / ticks) * i;
      const y = yOf(value);
      grid.appendChild(
        el("line", {
          x1: pad.left,
          x2: width - pad.right,
          y1: y,
          y2: y,
          stroke: "rgba(239,232,220,0.08)",
          "stroke-width": "1"
        })
      );
      const label = el("text", {
        x: pad.left - 10,
        y: y + 4,
        fill: "#6f6960",
        "font-size": "11",
        "text-anchor": "end",
        "font-family": "Outfit, sans-serif"
      });
      label.textContent = formatY(value);
      grid.appendChild(label);
    }

    const xTicks = Math.min(6, Math.round(spanX) || 1);
    for (let i = 0; i <= xTicks; i += 1) {
      const value = minX + (spanX / xTicks) * i;
      const x = xOf(value);
      const label = el("text", {
        x,
        y: height - 12,
        fill: "#6f6960",
        "font-size": "11",
        "text-anchor": "middle",
        "font-family": "Outfit, sans-serif"
      });
      label.textContent = formatX(value);
      grid.appendChild(label);
    }
    svg.appendChild(grid);

    const plot = el("g", { "clip-path": `url(#${clipId})` });
    series.forEach((item) => {
      if (!item.points.length) return;
      const d = item.points
        .map((point, index) => `${index ? "L" : "M"}${xOf(point.x)} ${yOf(point.y)}`)
        .join(" ");
      plot.appendChild(
        el("path", {
          d,
          fill: "none",
          stroke: item.color,
          "stroke-width": item.width || 2.2,
          "stroke-dasharray": item.dashed ? "5 6" : "none",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        })
      );
    });
    svg.appendChild(plot);

    const vline = el("line", {
      y1: pad.top,
      y2: height - pad.bottom,
      stroke: "rgba(239,232,220,0.28)",
      "stroke-width": "1",
      visibility: "hidden"
    });
    svg.appendChild(vline);

    const catcher = el("rect", {
      x: pad.left,
      y: pad.top,
      width: innerW,
      height: innerH,
      fill: "transparent"
    });
    svg.appendChild(catcher);

    const tip = ensureTip(wrap);
    const base = series[0];
    catcher.addEventListener("mousemove", (event) => {
      const box = svg.getBoundingClientRect();
      const svgX = ((event.clientX - box.left) / box.width) * width;
      const dataX = minX + ((svgX - pad.left) / innerW) * spanX;
      const clamped = Math.min(maxX, Math.max(minX, dataX));
      let nearest = base.points[0];
      let best = Infinity;
      base.points.forEach((point) => {
        const dist = Math.abs(point.x - clamped);
        if (dist < best) {
          best = dist;
          nearest = point;
        }
      });
      const x = xOf(nearest.x);
      vline.setAttribute("x1", x);
      vline.setAttribute("x2", x);
      vline.setAttribute("visibility", "visible");

      tip.replaceChildren();
      const year = document.createElement("div");
      year.className = "tip-year";
      year.textContent = formatX(nearest.x);
      tip.appendChild(year);
      series.forEach((item) => {
        const match = item.points.find((p) => p.x === nearest.x) || item.points.at(-1);
        const row = document.createElement("div");
        row.className = "tip-row";
        const name = document.createElement("span");
        name.textContent = item.name;
        const value = document.createElement("strong");
        value.textContent = formatY(match.y);
        row.append(name, value);
        tip.appendChild(row);
      });
      placeTip(tip, wrap, event);
    });
    catcher.addEventListener("mouseleave", () => {
      vline.setAttribute("visibility", "hidden");
      tip.classList.remove("is-on");
    });
  }

  function polar(cx, cy, r, angle) {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function donutChart(svg, slices, options = {}) {
    clear(svg);
    const wrap = svg.closest(".chart-wrap") || svg.parentElement;
    wrap.querySelectorAll(":scope > .chart-tip, :scope > .donut-legend").forEach((node) => node.remove());

    const width = 280;
    const height = 280;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.overflow = "visible";
    const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0);
    const cx = width / 2;
    const cy = height / 2;
    const outer = 92;
    const inner = 56;
    const format = options.format || ((n) => String(n));

    wrap.classList.add("donut-wrap");

    if (total <= 0) {
      const empty = el("text", {
        x: cx,
        y: cy,
        fill: "#6f6960",
        "text-anchor": "middle",
        "font-size": "13",
        "font-family": "Outfit, sans-serif"
      });
      empty.textContent = options.empty || "Sin datos todavía";
      svg.appendChild(empty);
      return;
    }

    const tip = ensureTip(wrap);
    let angle = -Math.PI / 2;
    const visible = slices.filter((slice) => slice.value > 0);

    function showSlice(slice, event) {
      const pct = ((slice.value / total) * 100).toFixed(0);
      tip.replaceChildren();
      const title = document.createElement("div");
      title.className = "tip-year";
      title.textContent = slice.label;
      const row = document.createElement("div");
      row.className = "tip-row";
      const name = document.createElement("span");
      name.textContent = `${pct}%`;
      const value = document.createElement("strong");
      value.textContent = format(slice.value);
      row.append(name, value);
      tip.append(title, row);
      if (event) placeTip(tip, wrap, event);
      else {
        tip.style.left = "50%";
        tip.style.top = "12px";
        tip.style.transform = "translateX(-50%)";
        tip.classList.add("is-on");
      }
    }

    function hideTip() {
      tip.classList.remove("is-on");
      tip.style.transform = "";
    }

    visible.forEach((slice) => {
      const portion = slice.value / total;
      const next = angle + portion * Math.PI * 2;
      const large = portion > 0.5 ? 1 : 0;
      const [x1, y1] = polar(cx, cy, outer, angle);
      const [x2, y2] = polar(cx, cy, outer, next);
      const [x3, y3] = polar(cx, cy, inner, next);
      const [x4, y4] = polar(cx, cy, inner, angle);
      const path = el("path", {
        d: `M${x1} ${y1} A${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`,
        fill: slice.color,
        class: "donut-slice"
      });
      path.style.cursor = "pointer";
      path.addEventListener("mousemove", (event) => showSlice(slice, event));
      path.addEventListener("mouseleave", hideTip);
      svg.appendChild(path);
      angle = next;
    });

    const center = el("text", {
      x: cx,
      y: cy - 6,
      fill: "#efe8dc",
      "text-anchor": "middle",
      "font-size": "13",
      "font-family": "Outfit, sans-serif"
    });
    center.textContent = options.centerLabel || "Total";
    const amount = el("text", {
      x: cx,
      y: cy + 16,
      fill: "#d4c4a0",
      "text-anchor": "middle",
      "font-size": "14",
      "font-family": "Fraunces, serif"
    });
    amount.textContent = options.centerValue || "";
    svg.append(center, amount);

    const legend = document.createElement("div");
    legend.className = "donut-legend";
    visible.forEach((slice) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "donut-legend-item";
      const swatch = document.createElement("i");
      swatch.style.background = slice.color;
      const label = document.createElement("span");
      const pct = ((slice.value / total) * 100).toFixed(0);
      label.textContent = `${slice.label} · ${pct}%`;
      item.append(swatch, label);
      item.addEventListener("mouseenter", (event) => showSlice(slice, event));
      item.addEventListener("mouseleave", hideTip);
      legend.appendChild(item);
    });
    wrap.appendChild(legend);
  }

  function barsChart(svg, bars, options = {}) {
    clear(svg);
    const format = options.format || String;
    const list = bars.length ? bars : [{ label: "Sin datos", value: 0, color: "#7a7f8a" }];
    const width = 760;
    const rowH = 68;
    const height = 8 + list.length * rowH;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    const padX = 2;
    const innerW = width - padX * 2;
    const max = Math.max(...list.map((bar) => Math.abs(Number(bar.value) || 0)), 1);

    list.forEach((bar, index) => {
      const y = 6 + index * rowH;
      const name = el("text", {
        x: padX,
        y: y + 16,
        fill: "#efe8dc",
        "font-size": "15",
        "font-family": "Outfit, sans-serif"
      });
      const fullLabel = bar.label || "Posición";
      name.textContent = fullLabel.length > 42 ? `${fullLabel.slice(0, 40)}…` : fullLabel;
      const title = el("title");
      title.textContent = `${fullLabel}: ${format(bar.value)}`;
      name.appendChild(title);
      const value = el("text", {
        x: width - padX,
        y: y + 16,
        fill: "#9a9286",
        "font-size": "14",
        "font-family": "Outfit, sans-serif",
        "text-anchor": "end"
      });
      value.textContent = format(bar.value);
      const amount = Math.abs(Number(bar.value) || 0);
      const w = (amount / max) * innerW;
      svg.appendChild(el("rect", {
        x: padX,
        y: y + 28,
        width: innerW,
        height: 18,
        rx: 9,
        fill: "rgba(239,232,220,0.06)"
      }));
      if (w > 0) {
        svg.appendChild(el("rect", {
          x: padX,
          y: y + 28,
          width: Math.max(w, 8),
          height: 18,
          rx: 9,
          fill: bar.color || "#8aa4c4"
        }));
      }
      svg.append(name, value);
    });
  }

  window.NorteCharts = { lineChart, donutChart, barsChart };
})();
