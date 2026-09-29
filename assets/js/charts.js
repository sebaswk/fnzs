(() => {
  const NS = "http://www.w3.org/2000/svg";

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

  function lineChart(svg, series, options = {}) {
    clear(svg);
    const wrap = svg.closest(".chart-wrap") || svg.parentElement;
    wrap.querySelectorAll(".chart-tip").forEach((node) => node.remove());

    const formatY = options.formatY || ((n) => String(n));
    const formatX = options.formatX || ((n) => String(n));
    const all = series.flatMap((item) => item.points);
    if (!all.length) return;

    const minX = Math.min(...all.map((p) => p.x));
    const maxX = Math.max(...all.map((p) => p.x));
    const maxY = Math.max(...all.map((p) => p.y), 0);
    const minY = 0;
    const longest = formatY(maxY);
    const left = Math.min(120, Math.max(72, 18 + longest.length * 7.4));
    const width = 760;
    const height = 320;
    const pad = { top: 20, right: 20, bottom: 38, left };
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.style.overflow = "visible";

    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const xOf = (x) => pad.left + ((x - minX) / spanX) * innerW;
    const yOf = (y) => pad.top + innerH - ((y - minY) / spanY) * innerH;

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
        y: height - 10,
        fill: "#6f6960",
        "font-size": "11",
        "text-anchor": "middle",
        "font-family": "Outfit, sans-serif"
      });
      label.textContent = formatX(value);
      grid.appendChild(label);
    }
    svg.appendChild(grid);

    series.forEach((item) => {
      if (!item.points.length) return;
      const d = item.points
        .map((point, index) => `${index ? "L" : "M"}${xOf(point.x)} ${yOf(point.y)}`)
        .join(" ");
      svg.appendChild(
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

    const tip = document.createElement("div");
    tip.className = "chart-tip";
    wrap.appendChild(tip);

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
      tip.classList.add("is-on");

      const wrapBox = wrap.getBoundingClientRect();
      const tipW = tip.offsetWidth;
      const tipH = tip.offsetHeight;
      const localX = event.clientX - wrapBox.left;
      const localY = event.clientY - wrapBox.top;
      const leftPos = localX + 18 + tipW > wrapBox.width - 8
        ? localX - tipW - 14
        : localX + 18;
      const topPos = localY - tipH - 12 < 8
        ? localY + 16
        : localY - tipH - 12;
      tip.style.left = `${Math.max(8, Math.min(leftPos, wrapBox.width - tipW - 8))}px`;
      tip.style.top = `${Math.max(8, topPos)}px`;
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
    const width = 420;
    const height = 320;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0);
    const cx = 118;
    const cy = 160;
    const outer = 86;
    const inner = 54;

    if (total <= 0) {
      const empty = el("text", {
        x: width / 2,
        y: height / 2,
        fill: "#6f6960",
        "text-anchor": "middle",
        "font-size": "13",
        "font-family": "Outfit, sans-serif"
      });
      empty.textContent = options.empty || "Sin datos todavía";
      svg.appendChild(empty);
      return;
    }

    let angle = -Math.PI / 2;
    slices.forEach((slice) => {
      const portion = Math.max(slice.value, 0) / total;
      if (portion <= 0) return;
      const next = angle + portion * Math.PI * 2;
      const large = portion > 0.5 ? 1 : 0;
      const [x1, y1] = polar(cx, cy, outer, angle);
      const [x2, y2] = polar(cx, cy, outer, next);
      const [x3, y3] = polar(cx, cy, inner, next);
      const [x4, y4] = polar(cx, cy, inner, angle);
      const path = el("path", {
        d: `M${x1} ${y1} A${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`,
        fill: slice.color
      });
      svg.appendChild(path);
      angle = next;
    });

    const center = el("text", {
      x: cx,
      y: cy - 4,
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

    let legendY = 36;
    slices.forEach((slice) => {
      if (slice.value <= 0) return;
      svg.appendChild(el("rect", { x: 230, y: legendY, width: 10, height: 10, rx: 2, fill: slice.color }));
      const label = el("text", {
        x: 248,
        y: legendY + 9,
        fill: "#9a9286",
        "font-size": "12",
        "font-family": "Outfit, sans-serif"
      });
      const pct = ((slice.value / total) * 100).toFixed(0);
      label.textContent = `${slice.label}  ${pct}%`;
      svg.appendChild(label);
      legendY += 22;
    });
  }

  function barsChart(svg, bars, options = {}) {
    clear(svg);
    const width = 520;
    const height = 220;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const pad = { top: 12, right: 16, bottom: 28, left: 16 };
    const max = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1);
    const innerW = width - pad.left - pad.right;
    const rowH = (height - pad.top - pad.bottom) / bars.length;

    bars.forEach((bar, index) => {
      const y = pad.top + index * rowH + 10;
      const w = (Math.abs(bar.value) / max) * (innerW * 0.72);
      svg.appendChild(
        el("rect", {
          x: pad.left,
          y,
          width: Math.max(w, 4),
          height: 18,
          rx: 9,
          fill: bar.color
        })
      );
      const name = el("text", {
        x: pad.left,
        y: y - 4,
        fill: "#9a9286",
        "font-size": "11",
        "font-family": "Outfit, sans-serif"
      });
      name.textContent = bar.label;
      const value = el("text", {
        x: pad.left + Math.max(w, 4) + 10,
        y: y + 13,
        fill: "#efe8dc",
        "font-size": "12",
        "font-family": "Outfit, sans-serif"
      });
      value.textContent = (options.format || String)(bar.value);
      svg.append(name, value);
    });
  }

  window.NorteCharts = { lineChart, donutChart, barsChart };
})();
