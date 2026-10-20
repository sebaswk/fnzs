(() => {
  const FEATURE = "pymes";
  const CURRENCY = "COP";
  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const SLICE_COLORS = NorteCharts.palette;
  const COLORS = {
    sales: "#3fd49a",
    costs: "#f07d6e",
    expenses: "#f3b65b",
    tax: "#a68cf7",
    total: "#6c9eff",
    net: "#4cc3e6"
  };
  const TAB_DESC = {
    recopilado: "Tu año de un vistazo: productos, ventas, costos y ganancia.",
    meses: "Toca un mes para anotar ventas, costos y gastos.",
    factura: "Todo el año en una sola hoja, lista para imprimir o guardar en PDF."
  };

  function uid() {
    return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function monthKey(index) {
    return String(index + 1).padStart(2, "0");
  }

  function emptyMonth() {
    return {
      notes: "",
      sales: [],
      costs: [{ id: uid(), name: "", amount: 0 }],
      expenses: [{ id: uid(), name: "", amount: 0, type: "fijo" }]
    };
  }

  const now = new Date();
  const state = {
    name: "",
    viewYear: now.getFullYear(),
    taxRate: 15,
    uncertainty: 12,
    tab: "recopilado",
    openMonth: null,
    products: [{ id: uid(), name: "", unitPrice: 0 }],
    years: {}
  };

  const overview = document.getElementById("view-overview");
  const monthView = document.getElementById("view-month");
  const notesInput = document.getElementById("month-notes");
  const panels = {
    recopilado: document.getElementById("panel-recopilado"),
    meses: document.getElementById("panel-meses"),
    factura: document.getElementById("panel-factura")
  };

  function money(value) {
    return Norte.formatMoney(value, CURRENCY);
  }

  function productById(id) {
    return state.products.find((item) => item.id === id) || null;
  }

  function ensureYear(year) {
    const key = String(year);
    if (!state.years[key]) state.years[key] = { months: {} };
    return state.years[key];
  }

  function getMonth(year, key, create) {
    const y = ensureYear(year);
    if (!y.months[key] && create) y.months[key] = emptyMonth();
    if (y.months[key]) syncSales(y.months[key]);
    return y.months[key] || null;
  }

  function currentMonth() {
    if (!state.openMonth) return null;
    return getMonth(state.openMonth.year, state.openMonth.month, true);
  }

  function syncSales(entry) {
    const byProduct = new Map((entry.sales || []).map((row) => [row.productId, row]));
    entry.sales = state.products.map((product) => {
      const existing = byProduct.get(product.id);
      return existing || { id: uid(), productId: product.id, qty: 0 };
    });
  }

  function saleAmount(sale) {
    const product = productById(sale.productId);
    return (Number(sale.qty) || 0) * (Number(product && product.unitPrice) || 0);
  }

  function sumList(rows, key = "amount") {
    return (rows || []).reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  }

  function monthIncome(entry) {
    if (!entry) return 0;
    return (entry.sales || []).reduce((sum, sale) => sum + saleAmount(sale), 0);
  }

  function monthTotals(entry) {
    const income = monthIncome(entry);
    const cogs = sumList(entry && entry.costs);
    const opex = sumList(entry && entry.expenses);
    const gross = income - cogs;
    const operating = gross - opex;
    const tax = Math.max(0, operating) * (state.taxRate / 100);
    const net = operating - tax;
    const fixed = (entry && entry.expenses || [])
      .filter((row) => row.type === "fijo")
      .reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    const variableOpex = (entry && entry.expenses || [])
      .filter((row) => row.type === "variable")
      .reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    return {
      income,
      cogs,
      opex,
      gross,
      operating,
      tax,
      net,
      fixed,
      variable: cogs + variableOpex,
      marginGross: income ? (gross / income) * 100 : 0,
      marginNet: income ? (net / income) * 100 : 0
    };
  }

  function yearTotals(year) {
    const y = state.years[String(year)];
    const acc = {
      income: 0, cogs: 0, opex: 0, gross: 0, operating: 0, tax: 0, net: 0, fixed: 0, variable: 0
    };
    if (!y) return finishTotals(acc);
    Object.values(y.months).forEach((entry) => {
      syncSales(entry);
      const t = monthTotals(entry);
      acc.income += t.income;
      acc.cogs += t.cogs;
      acc.opex += t.opex;
      acc.gross += t.gross;
      acc.operating += t.operating;
      acc.tax += t.tax;
      acc.net += t.net;
      acc.fixed += t.fixed;
      acc.variable += t.variable;
    });
    return finishTotals(acc);
  }

  function finishTotals(t) {
    const u = state.uncertainty / 100;
    const contrib = t.income > 0 ? 1 - t.variable / t.income : 0;
    return {
      ...t,
      low: t.net - Math.abs(t.net) * u,
      high: t.net + Math.abs(t.net) * u,
      marginGross: t.income ? (t.gross / t.income) * 100 : 0,
      marginNet: t.income ? (t.net / t.income) * 100 : 0,
      breakEven: contrib > 0 ? t.fixed / contrib : null
    };
  }

  function allYearsList() {
    const keys = Object.keys(state.years).map(Number);
    keys.push(state.viewYear);
    return [...new Set(keys)].sort((a, b) => a - b);
  }

  function productYearStats(productId, year) {
    let qty = 0;
    const y = state.years[String(year)];
    if (y) {
      Object.values(y.months).forEach((entry) => {
        (entry.sales || []).forEach((sale) => {
          if (sale.productId === productId) qty += Number(sale.qty) || 0;
        });
      });
    }
    const product = productById(productId);
    return { qty, revenue: qty * (Number(product && product.unitPrice) || 0) };
  }

  function outflowSlices(costs, expenses) {
    const slices = [];
    (costs || []).forEach((row) => {
      if (Number(row.amount) > 0) {
        slices.push({ label: row.name || "Costo", value: Number(row.amount) });
      }
    });
    (expenses || []).forEach((row) => {
      if (Number(row.amount) > 0) {
        slices.push({ label: row.name || "Gasto", value: Number(row.amount) });
      }
    });
    return slices.map((slice, index) => ({
      ...slice,
      color: SLICE_COLORS[index % SLICE_COLORS.length]
    }));
  }

  function yearOutflowSlices(year) {
    const y = state.years[String(year)];
    const map = {};
    if (y) {
      Object.values(y.months).forEach((entry) => {
        [...(entry.costs || []), ...(entry.expenses || [])].forEach((row) => {
          const amount = Number(row.amount) || 0;
          if (amount <= 0) return;
          const label = row.name || "Sin nombre";
          map[label] = (map[label] || 0) + amount;
        });
      });
    }
    return Object.entries(map)
      .map(([label, value], index) => ({
        label,
        value,
        color: SLICE_COLORS[index % SLICE_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);
  }

  function metric(label, value, sub, extraClass, hero) {
    const article = document.createElement("article");
    article.className = hero ? "metric is-hero" : "metric";
    const k = document.createElement("div");
    k.className = "label";
    k.textContent = label;
    const strong = document.createElement("strong");
    if (extraClass) strong.className = extraClass;
    strong.textContent = value;
    article.append(k, strong);
    if (sub) {
      const p = document.createElement("p");
      p.className = "sub";
      p.textContent = sub;
      article.appendChild(p);
    }
    return article;
  }

  function makeInput(value, onChange, attrs = {}) {
    const input = document.createElement("input");
    input.className = "input";
    input.value = value;
    Object.entries(attrs).forEach(([key, val]) => input.setAttribute(key, val));
    input.addEventListener("input", () => onChange(input));
    return input;
  }

  function removeButton(onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-btn";
    button.setAttribute("aria-label", "Eliminar");
    button.textContent = "×";
    button.addEventListener("click", onClick);
    return button;
  }

  function monthHasData(entry) {
    if (!entry) return false;
    const t = monthTotals(entry);
    return t.income > 0 || t.cogs > 0 || t.opex > 0;
  }

  function setView(mode) {
    overview.hidden = mode !== "overview";
    monthView.hidden = mode !== "month";
  }

  function setTab(tab) {
    state.tab = tab;
    Object.entries(panels).forEach(([name, node]) => {
      node.hidden = name !== tab;
    });
    document.querySelectorAll(".overview-tabbar [data-tab]").forEach((button) => {
      const active = button.dataset.tab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.getElementById("tab-desc").textContent = TAB_DESC[tab] || "";
    if (tab === "factura") renderInvoice();
    if (tab === "meses") renderMonthGrid();
    if (tab === "recopilado") renderProducts();
  }

  function openMonth(year, key) {
    state.viewYear = Number(year);
    state.openMonth = { year: Number(year), month: key };
    getMonth(year, key, true);
    if (location.hash !== `#${year}-${key}`) location.hash = `${year}-${key}`;
    render();
    Norte.scrollTop();
  }

  function shiftMonth(delta) {
    if (!state.openMonth) return;
    const index = state.openMonth.year * 12 + Number(state.openMonth.month) - 1 + delta;
    openMonth(Math.floor(index / 12), monthKey(((index % 12) + 12) % 12));
  }

  function closeMonth() {
    state.openMonth = null;
    state.tab = "meses";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    render();
    Norte.scrollTop();
  }

  function readHash() {
    const match = /^#(\d{4})-(\d{2})$/.exec(location.hash);
    if (!match) return null;
    return { year: Number(match[1]), month: match[2] };
  }

  function renderYearBar() {
    document.getElementById("year-label").textContent = String(state.viewYear);
    const monthsYear = document.getElementById("months-year");
    if (monthsYear) monthsYear.textContent = String(state.viewYear);
    document.getElementById("biz-name").value = state.name;
    document.getElementById("tax").value = state.taxRate;
    document.getElementById("uncertainty").value = state.uncertainty;
    const chips = document.getElementById("year-chips");
    chips.replaceChildren();
    allYearsList().forEach((year) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chip${year === state.viewYear ? " is-active" : ""}`;
      button.textContent = String(year);
      button.addEventListener("click", () => {
        state.viewYear = year;
        ensureYear(year);
        if (state.openMonth) closeMonth();
        else render();
      });
      chips.appendChild(button);
    });
  }

  function renderProducts() {
    const box = document.getElementById("product-list");
    box.replaceChildren();
    if (!state.products.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = "Crea un producto con su precio. Luego, en cada mes, solo escribes cuántos vendiste.";
      box.appendChild(p);
      return;
    }
    state.products.forEach((product, index) => {
      const card = document.createElement("article");
      card.className = "product-card";

      const nameField = document.createElement("div");
      nameField.className = "field";
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Producto";
      const name = makeInput(product.name, (input) => {
        product.name = input.value;
      }, { type: "text", placeholder: "Café americano" });
      nameField.append(nameLabel, name);

      const priceField = document.createElement("div");
      priceField.className = "field";
      const priceLabel = document.createElement("label");
      priceLabel.textContent = "Precio por unidad";
      const suffix = document.createElement("div");
      suffix.className = "input-suffix";
      const price = makeInput(product.unitPrice || "", (input) => {
        product.unitPrice = Number.parseFloat(input.value) || 0;
        paint();
        renderOverviewCharts();
      }, { type: "number", min: "0", step: "any", placeholder: "0" });
      const em = document.createElement("em");
      em.textContent = "COP";
      suffix.append(price, em);
      priceField.append(priceLabel, suffix);

      const done = document.createElement("div");
      done.className = "field product-done";
      const doneLabel = document.createElement("label");
      doneLabel.textContent = "Este año";
      const strong = document.createElement("strong");
      const meta = document.createElement("p");
      meta.className = "saving-meta";
      const paint = () => {
        const stats = productYearStats(product.id, state.viewYear);
        strong.textContent = money(stats.revenue);
        meta.textContent = stats.qty
          ? `${stats.qty.toLocaleString("es-CO")} vendidos`
          : "Aún no hay ventas";
      };
      paint();
      done.append(doneLabel, strong, meta);

      card.append(nameField, priceField, done, removeButton(() => {
        if (state.products.length === 1) {
          product.name = "";
          product.unitPrice = 0;
        } else {
          const removed = state.products[index].id;
          state.products.splice(index, 1);
          Object.values(state.years).forEach((year) => {
            Object.values(year.months || {}).forEach((entry) => {
              entry.sales = (entry.sales || []).filter((row) => row.productId !== removed);
            });
          });
        }
        render();
      }));
      box.appendChild(card);
    });
  }

  function renderMonthGrid() {
    const grid = document.getElementById("month-grid");
    grid.replaceChildren();
    MONTHS.forEach((name, index) => {
      const key = monthKey(index);
      const entry = getMonth(state.viewYear, key, false);
      const t = monthTotals(entry);
      const filled = monthHasData(entry);
      const isNow = state.viewYear === now.getFullYear() && index === now.getMonth();
      const card = document.createElement("article");
      card.className = `month-card${filled ? "" : " is-empty"}${isNow ? " is-now" : ""}`;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Abrir ${name} de ${state.viewYear}`);

      const head = document.createElement("div");
      head.className = "month-card-head";
      head.appendChild(Object.assign(document.createElement("h3"), { textContent: name }));
      if (isNow) head.appendChild(Object.assign(document.createElement("span"), { className: "month-now", textContent: "Este mes" }));

      const body = document.createElement("div");
      body.className = "month-card-body";
      if (filled) {
        const out = t.cogs + t.opex;
        [
          ["Ventas", money(t.income), ""],
          ["Costos y gastos", money(out), ""],
          ["Ganancia neta", money(t.net), t.net >= 0 ? "positive" : "negative"]
        ].forEach(([label, value, cls]) => {
          const line = document.createElement("div");
          line.className = "month-line";
          const strong = Object.assign(document.createElement("strong"), { textContent: value });
          if (cls) strong.className = cls;
          line.append(Object.assign(document.createElement("span"), { textContent: label }), strong);
          body.appendChild(line);
        });
        const top = Math.max(t.income, out, 1);
        const meter = document.createElement("div");
        meter.className = "month-meter";
        meter.setAttribute("aria-hidden", "true");
        [["is-in", t.income], ["is-out", out]].forEach(([cls, value]) => {
          const bar = document.createElement("span");
          bar.className = cls;
          bar.style.width = `${Math.max(value > 0 ? 3 : 0, (value / top) * 100)}%`;
          meter.appendChild(bar);
        });
        body.appendChild(meter);
      } else {
        body.appendChild(Object.assign(document.createElement("p"), {
          className: "month-empty",
          textContent: "Sin movimientos. Toca para anotar."
        }));
      }

      const foot = document.createElement("div");
      foot.className = "month-card-foot";
      foot.appendChild(Object.assign(document.createElement("span"), { className: "month-open", textContent: "Abrir mes →" }));

      card.append(head, body, foot);
      card.addEventListener("click", () => openMonth(state.viewYear, key));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openMonth(state.viewYear, key);
        }
      });
      grid.appendChild(card);
    });
  }

  function addInvoiceRows(box, title, rows) {
    const visible = rows.filter((row) => Number(row.amount) > 0);
    if (!visible.length) return;
    const h = document.createElement("div");
    h.className = "invoice-row invoice-group";
    h.textContent = title;
    box.appendChild(h);
    visible.forEach((row) => {
      const line = document.createElement("div");
      line.className = "invoice-row indent";
      const left = document.createElement("span");
      left.textContent = row.name || row.label || "Sin nombre";
      const right = document.createElement("span");
      right.textContent = money(row.amount);
      line.append(left, right);
      box.appendChild(line);
    });
  }

  function renderInvoice() {
    const box = document.getElementById("invoice");
    box.replaceChildren();
    const totals = yearTotals(state.viewYear);
    const head = document.createElement("div");
    head.className = "invoice-head";
    const left = document.createElement("div");
    const brand = document.createElement("div");
    brand.className = "brand-line";
    brand.textContent = "Norte · Pymes";
    const title = document.createElement("h2");
    title.textContent = `Factura ${state.viewYear}`;
    const who = document.createElement("p");
    who.textContent = state.name ? state.name : "Tu negocio";
    left.append(brand, title, who);
    const right = document.createElement("div");
    right.className = "invoice-stamp";
    const stamp = document.createElement("p");
    stamp.textContent = "Ganancia neta del año";
    const big = document.createElement("strong");
    big.className = totals.net >= 0 ? "" : "negative";
    big.textContent = money(totals.net);
    right.append(stamp, big);
    head.append(left, right);
    box.appendChild(head);

    let any = false;
    MONTHS.forEach((name, index) => {
      const entry = getMonth(state.viewYear, monthKey(index), false);
      if (!monthHasData(entry)) return;
      any = true;
      const t = monthTotals(entry);
      const block = document.createElement("section");
      block.className = "invoice-month";
      const h3 = document.createElement("h3");
      h3.textContent = name;
      block.appendChild(h3);
      addInvoiceRows(block, "Ventas", (entry.sales || []).map((sale) => {
        const product = productById(sale.productId);
        const qty = Number(sale.qty) || 0;
        const price = Number(product && product.unitPrice) || 0;
        return {
          name: `${product && product.name ? product.name : "Producto"} · ${qty.toLocaleString("es-CO")} unidades a ${money(price)}`,
          amount: saleAmount(sale)
        };
      }));
      addInvoiceRows(block, "Costos directos", entry.costs || []);
      addInvoiceRows(block, "Gastos", (entry.expenses || []).map((row) => ({
        name: `${row.name || "Gasto"} · ${row.type === "variable" ? "Variable" : "Fijo"}`,
        amount: row.amount
      })));
      const sub = document.createElement("div");
      sub.className = "invoice-row total";
      sub.append(
        Object.assign(document.createElement("span"), { textContent: `Ganancia neta ${name}` }),
        Object.assign(document.createElement("span"), { textContent: money(t.net) })
      );
      block.appendChild(sub);
      box.appendChild(block);
    });

    if (!any) {
      const empty = document.createElement("p");
      empty.className = "invoice-empty";
      empty.textContent = "Aún no hay movimientos este año. Anótalos en Movimientos.";
      box.appendChild(empty);
      return;
    }

    const foot = document.createElement("section");
    foot.className = "invoice-foot";
    [
      ["Ventas", totals.income],
      ["Costos directos", totals.cogs],
      ["Ganancia bruta", totals.gross],
      ["Gastos", totals.opex],
      ["Impuestos", totals.tax],
      ["Ganancia neta del año", totals.net]
    ].forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "invoice-row total";
      row.append(
        Object.assign(document.createElement("span"), { textContent: label }),
        Object.assign(document.createElement("span"), { textContent: money(value) })
      );
      foot.appendChild(row);
    });
    box.appendChild(foot);
  }

  function monthsOfYear() {
    return MONTHS.map((name, index) => monthTotals(getMonth(state.viewYear, monthKey(index), false)));
  }

  function renderOverviewCharts() {
    const totals = yearTotals(state.viewYear);
    const compact = (value) => Norte.formatCompact(value, CURRENCY);
    document.getElementById("year-metrics").replaceChildren(
      metric(
        "Ganancia neta del año",
        money(totals.net),
        totals.income ? `Te queda el ${Norte.formatPct(totals.marginNet)} de cada venta, después de impuestos` : "Anota ventas en Movimientos para verla",
        totals.net >= 0 ? "positive" : "negative",
        true
      ),
      metric("Ventas", money(totals.income), "Lo que vendiste en el año"),
      metric("Ganancia bruta", money(totals.gross), `Margen ${Norte.formatPct(totals.marginGross)} sobre las ventas`, totals.gross >= 0 ? "" : "negative"),
      metric("Costos y gastos", money(totals.cogs + totals.opex), `Más ${money(totals.tax)} en impuestos`),
      metric(
        "Punto de equilibrio",
        totals.breakEven === null ? "—" : money(totals.breakEven),
        totals.breakEven === null ? "Aparece cuando tengas ventas y gastos" : "Lo mínimo que debes vender en el año para no perder"
      )
    );

    const pnl = document.getElementById("pnl-chart");
    const narrow = pnl.clientWidth > 0 && pnl.clientWidth < 460;
    NorteCharts.waterfall(pnl, {
      steps: [
        { label: "Ventas", short: "Ventas", value: totals.income, kind: "total", color: COLORS.sales },
        { label: "Costos directos", short: "Costos", value: -totals.cogs, color: COLORS.costs },
        { label: "Ganancia bruta", short: "Bruta", value: totals.gross, kind: "total", color: COLORS.total },
        { label: "Gastos del negocio", short: "Gastos", value: -totals.opex, color: COLORS.expenses },
        { label: "Impuestos", short: narrow ? "Imp." : "Impuestos", value: -totals.tax, color: COLORS.tax },
        { label: "Ganancia neta", short: "Neta", value: totals.net, kind: "total", color: totals.net >= 0 ? COLORS.net : COLORS.costs }
      ],
      format: money,
      formatShort: compact,
      empty: "Anota ventas en Movimientos para ver el recorrido."
    });

    NorteCharts.breakdown(document.getElementById("mix-donut"), yearOutflowSlices(state.viewYear), {
      format: money,
      totalLabel: "Salió en total",
      empty: "Anota costos o gastos en Movimientos."
    });

    const months = monthsOfYear();
    NorteCharts.columns(document.getElementById("year-chart"), {
      labels: MONTHS,
      shortLabels: MONTHS.map((name) => name.slice(0, 3)),
      series: [
        { name: "Ventas", color: COLORS.sales, stack: "entra", values: months.map((t) => t.income) },
        { name: "Costos", color: COLORS.costs, stack: "sale", values: months.map((t) => t.cogs) },
        { name: "Gastos", color: COLORS.expenses, stack: "sale", values: months.map((t) => t.opex) }
      ],
      lines: [{ name: "Ganancia neta", color: COLORS.net, values: months.map((t) => t.net) }],
      format: money,
      formatAxis: compact,
      tipTitle: (i) => `${MONTHS[i]} ${state.viewYear}`,
      tipRows: (i) => {
        const t = months[i];
        return [
          { name: "Ventas", color: COLORS.sales, value: money(t.income) },
          { name: "Costos", color: COLORS.costs, value: money(t.cogs) },
          { name: "Gastos", color: COLORS.expenses, value: money(t.opex) },
          { name: "Impuestos", color: COLORS.tax, value: money(t.tax) },
          { name: "Ganancia neta", color: COLORS.net, value: money(t.net), total: true }
        ];
      },
      title: "Ventas, costos y gastos de cada mes",
      empty: "Anota ventas en Movimientos para ver cada mes."
    });

    document.getElementById("range-note").textContent = state.uncertainty
      ? `Si la ganancia neta varía ${Norte.formatPct(state.uncertainty, 0)} hacia abajo o hacia arriba.`
      : "Sube el margen de error para ver un escenario bajo y uno alto.";
    NorteCharts.range(document.getElementById("range-chart"), {
      low: totals.low,
      mid: totals.net,
      high: totals.high,
      lowLabel: "Si va peor",
      midLabel: "Lo esperado",
      highLabel: "Si va mejor",
      format: money,
      empty: "Anota ventas en Movimientos para ver los escenarios."
    });
  }

  function renderOverview() {
    renderOverviewCharts();
    renderProducts();
    renderMonthGrid();
    renderInvoice();
    setTab(state.tab);
  }

  function renderList(boxId, rows, kind) {
    const box = document.getElementById(boxId);
    box.replaceChildren();
    rows.forEach((row, index) => {
      const wrap = document.createElement("div");
      wrap.className = kind === "expense" ? "row expense" : "row";
      wrap.append(
        makeInput(row.name, (input) => { row.name = input.value; }, { type: "text", placeholder: "Concepto" })
      );
      if (kind === "expense") {
        wrap.appendChild(Norte.menuSelect(row.type || "fijo", [
          { value: "fijo", label: "Fijo" },
          { value: "variable", label: "Variable" }
        ], (value) => {
          row.type = value;
          renderMonthTotals();
        }));
      }
      wrap.append(
        makeInput(row.amount || "", (input) => {
          row.amount = Number.parseFloat(input.value) || 0;
          renderMonthTotals();
        }, { type: "number", min: "0", step: "any", placeholder: "0" }),
        removeButton(() => {
          if (rows.length === 1) {
            row.name = "";
            row.amount = 0;
            if (kind === "expense") row.type = "fijo";
          } else rows.splice(index, 1);
          renderMonthLists();
          renderMonthTotals();
        })
      );
      box.appendChild(wrap);
    });
  }

  function renderSales() {
    const box = document.getElementById("sales-rows");
    const hint = document.getElementById("sales-hint");
    const entry = currentMonth();
    box.replaceChildren();
    if (!state.products.length) {
      hint.textContent = "Primero crea un producto con «Producto» o en Resumen.";
      return;
    }
    hint.textContent = "";
    syncSales(entry);
    entry.sales.forEach((sale) => {
      const product = productById(sale.productId);
      if (!product) return;
      const wrap = document.createElement("div");
      wrap.className = "sale-row";

      const info = document.createElement("div");
      info.className = "sale-info";
      const name = document.createElement("div");
      name.className = "sale-name";
      name.textContent = product.name || "Producto sin nombre";
      const price = document.createElement("div");
      price.className = "sale-price";
      price.textContent = `${money(product.unitPrice || 0)} por unidad`;
      info.append(name, price);

      const qtyField = document.createElement("div");
      qtyField.className = "field";
      const qtyLabel = document.createElement("label");
      qtyLabel.textContent = "Unidades";
      const qty = makeInput(sale.qty || "", (input) => {
        sale.qty = Number.parseFloat(input.value) || 0;
        total.textContent = money(saleAmount(sale));
        renderMonthTotals();
      }, { type: "number", min: "0", step: "any", placeholder: "0" });
      qtyField.append(qtyLabel, qty);

      const totalField = document.createElement("div");
      totalField.className = "field sale-total";
      const totalLabel = document.createElement("label");
      totalLabel.textContent = "Total";
      const total = document.createElement("strong");
      total.className = "line-total";
      total.textContent = money(saleAmount(sale));
      totalField.append(totalLabel, total);

      wrap.append(info, qtyField, totalField);
      box.appendChild(wrap);
    });
  }

  function renderMonthLists() {
    const entry = currentMonth();
    renderSales();
    renderList("cost-rows", entry.costs, "cost");
    renderList("expense-rows", entry.expenses, "expense");
  }

  function renderMonthTotals() {
    const entry = currentMonth();
    const t = monthTotals(entry);
    document.getElementById("income-total").textContent = money(t.income);
    document.getElementById("cost-total").textContent = money(t.cogs);
    document.getElementById("expense-total").textContent = money(t.opex);
    document.getElementById("month-metrics").replaceChildren(
      metric("Ganancia neta del mes", money(t.net), "Después de costos, gastos e impuestos", t.net >= 0 ? "positive" : "negative", true),
      metric("Ventas", money(t.income)),
      metric("Ganancia bruta", money(t.gross), `Margen ${Norte.formatPct(t.marginGross)}`),
      metric("Costos y gastos", money(t.cogs + t.opex)),
      metric("Impuestos", money(t.tax), `${Norte.formatPct(state.taxRate)} de la ganancia`)
    );
    NorteCharts.breakdown(document.getElementById("month-donut"), outflowSlices(entry.costs, entry.expenses), {
      format: money,
      totalLabel: "Salió este mes",
      empty: "Anota costos o gastos para verlos aquí."
    });
  }

  function renderMonth() {
    const { year, month } = state.openMonth;
    document.getElementById("month-title").textContent = `${MONTHS[Number(month) - 1]} ${year}`;
    notesInput.value = currentMonth().notes || "";
    renderMonthLists();
    renderMonthTotals();
  }

  function render() {
    renderYearBar();
    if (state.openMonth) {
      setView("month");
      renderMonth();
    } else {
      setView("overview");
      renderOverview();
    }
  }

  function snapshot() {
    return {
      name: state.name,
      viewYear: state.viewYear,
      taxRate: state.taxRate,
      uncertainty: state.uncertainty,
      products: state.products.map((row) => ({ ...row })),
      years: JSON.parse(JSON.stringify(state.years))
    };
  }

  function applySnapshot(data) {
    if (!data) return;
    if (data.years) {
      state.name = data.name || "";
      state.viewYear = Number(data.viewYear || data.year) || state.viewYear;
      state.taxRate = Number(data.taxRate) || 0;
      state.uncertainty = Number(data.uncertainty) || 0;
      state.products = Array.isArray(data.products) && data.products.length
        ? data.products
        : [{ id: uid(), name: "", unitPrice: 0 }];
      state.years = data.years;
      state.openMonth = null;
    } else if (data.incomes || data.costs || data.expenses) {
      const year = Number(data.year) || state.viewYear;
      state.name = data.name || "";
      state.viewYear = year;
      state.taxRate = Number(data.taxRate) || 0;
      state.uncertainty = Number(data.uncertainty) || 0;
      state.products = (data.incomes || []).map((row) => ({
        id: row.id || uid(),
        name: row.name || "Producto",
        unitPrice: Number(row.amount) || 0
      }));
      if (!state.products.length) {
        state.products = [{ id: uid(), name: "Producto", unitPrice: 0 }];
      }
      state.years = {
        [String(year)]: {
          months: {
            "01": {
              notes: "",
              sales: state.products.map((product) => ({ id: uid(), productId: product.id, qty: 1 })),
              costs: Array.isArray(data.costs) && data.costs.length
                ? data.costs
                : [{ id: uid(), name: "", amount: 0 }],
              expenses: Array.isArray(data.expenses) && data.expenses.length
                ? data.expenses
                : [{ id: uid(), name: "", amount: 0, type: "fijo" }]
            }
          }
        }
      };
      state.openMonth = null;
    }
    render();
  }

  function loadExample() {
    const americano = uid();
    const latte = uid();
    const torta = uid();
    const year = String(now.getFullYear());
    state.name = "Café Norte";
    state.viewYear = Number(year);
    state.openMonth = null;
    state.tab = "recopilado";
    state.taxRate = 15;
    state.uncertainty = 12;
    state.products = [
      { id: americano, name: "Café americano", unitPrice: 8000 },
      { id: latte, name: "Latte", unitPrice: 12000 },
      { id: torta, name: "Porción de torta", unitPrice: 7500 }
    ];

    function monthData(sales, costsScale, extraExpense) {
      return {
        notes: "",
        sales: [
          { id: uid(), productId: americano, qty: sales[0] },
          { id: uid(), productId: latte, qty: sales[1] },
          { id: uid(), productId: torta, qty: sales[2] }
        ],
        costs: [
          { id: uid(), name: "Café e insumos", amount: Math.round(6200000 * costsScale) },
          { id: uid(), name: "Empaques", amount: Math.round(480000 * costsScale) }
        ],
        expenses: [
          { id: uid(), name: "Arriendo", amount: 2800000, type: "fijo" },
          { id: uid(), name: "Nómina", amount: 4500000, type: "fijo" },
          { id: uid(), name: "Servicios", amount: 620000, type: "fijo" },
          { id: uid(), name: "Publicidad", amount: extraExpense, type: "variable" }
        ]
      };
    }

    state.years = {
      [year]: {
        months: {
          "01": Object.assign(monthData([1200, 700, 400], 1, 350000), { notes: "Arranque de año, buena afluencia." }),
          "02": monthData([1100, 620, 340], 0.92, 280000),
          "03": monthData([1300, 760, 450], 1.08, 420000)
        }
      }
    };
    render();
    Norte.toast("Cargamos un ejemplo para que explores.");
  }

  function addProduct() {
    state.products.push({ id: uid(), name: "", unitPrice: 0 });
    if (state.openMonth) {
      syncSales(currentMonth());
      renderMonth();
    } else {
      renderProducts();
    }
  }

  document.querySelectorAll(".overview-tabbar [data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  document.getElementById("year-prev").addEventListener("click", () => {
    state.viewYear -= 1;
    ensureYear(state.viewYear);
    render();
  });
  document.getElementById("year-next").addEventListener("click", () => {
    state.viewYear += 1;
    ensureYear(state.viewYear);
    render();
  });
  document.getElementById("biz-name").addEventListener("input", (event) => {
    state.name = event.target.value;
  });
  document.getElementById("tax").addEventListener("input", (event) => {
    state.taxRate = Number.parseFloat(event.target.value) || 0;
    if (state.openMonth) renderMonthTotals();
    else renderOverviewCharts();
  });
  document.getElementById("uncertainty").addEventListener("input", (event) => {
    state.uncertainty = Number.parseFloat(event.target.value) || 0;
    if (!state.openMonth) renderOverviewCharts();
  });
  notesInput.addEventListener("input", () => {
    const entry = currentMonth();
    if (entry) entry.notes = notesInput.value;
  });
  document.getElementById("add-product").addEventListener("click", addProduct);
  document.getElementById("add-product-month").addEventListener("click", addProduct);
  document.getElementById("add-cost").addEventListener("click", () => {
    currentMonth().costs.push({ id: uid(), name: "", amount: 0 });
    renderMonthLists();
  });
  document.getElementById("add-expense").addEventListener("click", () => {
    currentMonth().expenses.push({ id: uid(), name: "", amount: 0, type: "fijo" });
    renderMonthLists();
  });
  document.getElementById("btn-back").addEventListener("click", closeMonth);
  document.getElementById("month-prev").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("month-next").addEventListener("click", () => shiftMonth(1));
  document.getElementById("btn-print-invoice").addEventListener("click", () => window.print());
  document.getElementById("btn-ejemplo").addEventListener("click", loadExample);
  document.getElementById("btn-guardar").addEventListener("click", () => {
    Norte.downloadSnapshot(FEATURE, snapshot());
  });
  Norte.bindFileInput(document.getElementById("file-input"), FEATURE, applySnapshot);
  document.getElementById("btn-cargar").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });
  Norte.enableDrop(document.body, FEATURE, applySnapshot);
  window.addEventListener("hashchange", () => {
    const hash = readHash();
    if (hash) openMonth(hash.year, hash.month);
    else {
      state.openMonth = null;
      render();
    }
  });

  ensureYear(state.viewYear);
  const initial = readHash();
  if (initial) {
    state.viewYear = initial.year;
    state.openMonth = initial;
    getMonth(initial.year, initial.month, true);
  }
  render();
})();
