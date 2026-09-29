(() => {
  const FEATURE = "finanzas-personales";
  const CURRENCY = "COP";
  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const CATEGORIES = [
    { id: "vivienda", label: "Vivienda", color: "#d4c4a0" },
    { id: "alimentacion", label: "Alimentación", color: "#9cbaa4" },
    { id: "servicios", label: "Servicios", color: "#8aa4c4" },
    { id: "transporte", label: "Transporte", color: "#7f9bb8" },
    { id: "vehiculos", label: "Vehículos", color: "#6f8aa8" },
    { id: "salud", label: "Salud", color: "#c98970" },
    { id: "educacion", label: "Educación", color: "#b8a1d4" },
    { id: "ocio", label: "Ocio", color: "#e0c07a" },
    { id: "deudas", label: "Deudas", color: "#c47a8a" },
    { id: "otros", label: "Otros", color: "#7a7f8a" }
  ];

  function uid() {
    return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function monthKey(index) {
    return String(index + 1).padStart(2, "0");
  }

  function emptyMonth() {
    return {
      notes: "",
      incomes: [{ id: uid(), name: "", amount: 0 }],
      expenses: [{ id: uid(), name: "", category: "vivienda", amount: 0 }],
      contributions: [],
      investments: []
    };
  }

  function normalizeMonth(entry) {
    if (!entry) return emptyMonth();
    if (!Array.isArray(entry.investments)) entry.investments = [];
    if (!Array.isArray(entry.contributions)) entry.contributions = [];
    return entry;
  }

  const now = new Date();
  const state = {
    profile: { name: "" },
    viewYear: now.getFullYear(),
    openMonth: null,
    tab: "recopilado",
    savings: [],
    investments: [],
    years: {}
  };

  const overview = document.getElementById("view-overview");
  const monthView = document.getElementById("view-month");
  const nameInput = document.getElementById("nombre");
  const notesInput = document.getElementById("month-notes");
  const panels = {
    recopilado: document.getElementById("panel-recopilado"),
    meses: document.getElementById("panel-meses"),
    factura: document.getElementById("panel-factura")
  };

  function money(value) {
    return Norte.formatMoney(value, CURRENCY);
  }

  function categoryById(id) {
    if (id === "ahorros" || id === "ahorro" || id === "inversion") {
      return CATEGORIES.find((item) => item.id === "otros");
    }
    return CATEGORIES.find((item) => item.id === id) || CATEGORIES.at(-1);
  }

  function ensureYear(year) {
    const key = String(year);
    if (!state.years[key]) state.years[key] = { months: {} };
    return state.years[key];
  }

  function getMonth(year, key, create) {
    const y = ensureYear(year);
    if (!y.months[key] && create) y.months[key] = emptyMonth();
    if (y.months[key]) normalizeMonth(y.months[key]);
    return y.months[key] || null;
  }

  function currentMonth() {
    if (!state.openMonth) return null;
    return getMonth(state.openMonth.year, state.openMonth.month, true);
  }

  function sumList(rows) {
    return (rows || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  }

  function monthTotals(entry) {
    const income = sumList(entry && entry.incomes);
    const expense = sumList(entry && entry.expenses);
    const contrib = sumList(entry && entry.contributions);
    const invest = sumList(entry && entry.investments);
    return {
      income,
      expense,
      contrib,
      invest,
      egresos: expense,
      ahorros: contrib,
      inversiones: invest,
      balance: income - expense - contrib - invest
    };
  }

  function yearTotals(year) {
    const y = state.years[String(year)];
    const acc = {
      income: 0, expense: 0, contrib: 0, invest: 0,
      egresos: 0, ahorros: 0, inversiones: 0, balance: 0
    };
    if (!y) return acc;
    Object.values(y.months).forEach((entry) => {
      const t = monthTotals(normalizeMonth(entry));
      acc.income += t.income;
      acc.expense += t.expense;
      acc.contrib += t.contrib;
      acc.invest += t.invest;
      acc.egresos += t.egresos;
      acc.ahorros += t.ahorros;
      acc.inversiones += t.inversiones;
    });
    acc.balance = acc.income - acc.expense - acc.contrib - acc.invest;
    return acc;
  }

  function allYearsList() {
    const keys = Object.keys(state.years).map(Number);
    keys.push(state.viewYear);
    return [...new Set(keys)].sort((a, b) => a - b);
  }

  function potTotal(kind, id) {
    const field = kind === "saving" ? "contributions" : "investments";
    const key = kind === "saving" ? "savingId" : "investmentId";
    let total = 0;
    Object.values(state.years).forEach((year) => {
      Object.values(year.months || {}).forEach((entry) => {
        (entry[field] || []).forEach((row) => {
          if (row[key] === id) total += Number(row.amount) || 0;
        });
      });
    });
    return total;
  }

  function expenseSlices(expenses, contrib, invest) {
    const map = {};
    (expenses || []).forEach((row) => {
      const cat = categoryById(row.category).id;
      map[cat] = (map[cat] || 0) + (Number(row.amount) || 0);
    });
    const slices = CATEGORIES.map((category) => ({
      ...category,
      value: map[category.id] || 0
    }));
    if (contrib > 0) {
      slices.push({ id: "aportes-ahorro", label: "Aportes a ahorros", color: "#7dcea0", value: contrib });
    }
    if (invest > 0) {
      slices.push({ id: "aportes-inversion", label: "Aportes a inversiones", color: "#8aa4c4", value: invest });
    }
    return slices.filter((item) => item.value > 0);
  }

  function yearOutflowSlices(year) {
    const y = state.years[String(year)];
    const expenses = [];
    let contrib = 0;
    let invest = 0;
    if (y) {
      Object.values(y.months).forEach((entry) => {
        (entry.expenses || []).forEach((row) => expenses.push(row));
        contrib += sumList(entry.contributions);
        invest += sumList(entry.investments);
      });
    }
    return expenseSlices(expenses, contrib, invest);
  }

  function metric(label, value, sub, extraClass) {
    const article = document.createElement("article");
    article.className = "metric";
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
    return t.income > 0 || t.expense > 0 || t.contrib > 0 || t.invest > 0;
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
    document.querySelectorAll(".overview-tabs [data-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tab === tab);
    });
    if (tab === "factura") renderInvoice();
    if (tab === "meses") renderMonthGrid();
    if (tab === "recopilado") {
      renderSavings();
      renderInvestments();
    }
  }

  function openMonth(year, key) {
    state.viewYear = Number(year);
    state.openMonth = { year: Number(year), month: key };
    getMonth(year, key, true);
    if (location.hash !== `#${year}-${key}`) location.hash = `${year}-${key}`;
    render();
  }

  function closeMonth() {
    state.openMonth = null;
    state.tab = "meses";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    render();
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

  function renderOverview() {
    const totals = yearTotals(state.viewYear);
    const rate = totals.income > 0 ? ((totals.income - totals.expense) / totals.income) * 100 : 0;
    document.getElementById("year-metrics").replaceChildren(
      metric("Ingresos del año", money(totals.income), `${state.viewYear}`),
      metric("Egresos del año", money(totals.egresos), "Gastos del día a día"),
      metric("Ahorros e inversiones", money(totals.ahorros + totals.inversiones), `Ahorros ${money(totals.ahorros)} · Inversiones ${money(totals.inversiones)}`),
      metric("Balance del año", money(totals.balance), `Tasa de ahorro ${Norte.formatPct(rate)}`, totals.balance >= 0 ? "positive" : "negative")
    );

    const points = MONTHS.map((name, index) => {
      const entry = getMonth(state.viewYear, monthKey(index), false);
      const t = monthTotals(entry);
      return { x: index + 1, ...t, name };
    });
    NorteCharts.lineChart(document.getElementById("year-chart"), [
      { name: "Ingresos", color: "#9cbaa4", points: points.map((p) => ({ x: p.x, y: p.income })) },
      { name: "Egresos", color: "#c98970", points: points.map((p) => ({ x: p.x, y: p.egresos })) },
      { name: "Ahorros", color: "#d4c4a0", points: points.map((p) => ({ x: p.x, y: p.ahorros })) },
      { name: "Inversiones", color: "#8aa4c4", points: points.map((p) => ({ x: p.x, y: p.inversiones })) }
    ], {
      formatY: (value) => Norte.formatCompact(value, CURRENCY),
      formatX: (value) => MONTHS[Math.max(0, Math.round(value) - 1)].slice(0, 3)
    });

    NorteCharts.donutChart(document.getElementById("year-donut"), yearOutflowSlices(state.viewYear), {
      centerLabel: "Salidas",
      centerValue: money(totals.expense + totals.contrib + totals.invest),
      empty: "Aún no hay egresos ni aportes este año",
      format: money
    });

    renderSavings();
    renderInvestments();
    renderMonthGrid();
    renderInvoice();
    setTab(state.tab);
  }

  function renderPots(kind) {
    const list = kind === "saving" ? state.savings : state.investments;
    const box = document.getElementById(kind === "saving" ? "savings-list" : "invest-list");
    const emptyText = kind === "saving"
      ? "Crea un ahorro y luego aporta desde cada mes. El total se acumula."
      : "Crea una inversión (CDT, fondo, acciones…) y aporta mes a mes.";
    box.replaceChildren();
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = emptyText;
      box.appendChild(p);
      return;
    }
    list.forEach((pot, index) => {
      const card = document.createElement("article");
      card.className = "saving-card";
      const nameField = document.createElement("div");
      nameField.className = "field";
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Nombre";
      const name = makeInput(pot.name, (input) => {
        pot.name = input.value;
        if (state.openMonth) {
          renderContribs();
          renderPlacements();
        }
      }, { type: "text", placeholder: kind === "saving" ? "Fondo de emergencia" : "CDT o fondo" });
      nameField.append(nameLabel, name);

      const total = potTotal(kind, pot.id);
      const targetField = document.createElement("div");
      targetField.className = "field";
      const targetLabel = document.createElement("label");
      targetLabel.textContent = "Meta (opcional)";
      const done = document.createElement("div");
      done.className = "field";
      const doneLabel = document.createElement("label");
      doneLabel.textContent = "Acumulado";
      const strong = document.createElement("strong");
      strong.textContent = money(total);
      const meta = document.createElement("div");
      meta.className = "saving-meta";
      const bar = document.createElement("div");
      bar.className = "progress";
      const fill = document.createElement("span");
      const paint = () => {
        meta.textContent = pot.target
          ? `${Norte.formatPct(Math.min((total / pot.target) * 100, 999))} de la meta`
          : "Sin meta definida";
        fill.style.width = pot.target ? `${Math.min(100, (total / pot.target) * 100)}%` : (total > 0 ? "100%" : "0%");
      };
      const target = makeInput(pot.target || "", (input) => {
        pot.target = Number.parseFloat(input.value) || 0;
        paint();
      }, { type: "number", min: "0", step: "any", placeholder: "0" });
      targetField.append(targetLabel, target);
      paint();
      done.append(doneLabel, strong, meta);
      bar.appendChild(fill);
      card.append(nameField, targetField, done, removeButton(() => {
        list.splice(index, 1);
        Object.values(state.years).forEach((year) => {
          Object.values(year.months || {}).forEach((entry) => {
            if (kind === "saving") {
              entry.contributions = (entry.contributions || []).filter((row) => row.savingId !== pot.id);
            } else {
              entry.investments = (entry.investments || []).filter((row) => row.investmentId !== pot.id);
            }
          });
        });
        render();
      }), bar);
      box.appendChild(card);
    });
  }

  function renderSavings() {
    renderPots("saving");
  }

  function renderInvestments() {
    renderPots("investment");
  }

  function renderMonthGrid() {
    const grid = document.getElementById("month-grid");
    grid.replaceChildren();
    MONTHS.forEach((name, index) => {
      const key = monthKey(index);
      const entry = getMonth(state.viewYear, key, false);
      const t = monthTotals(entry);
      const filled = monthHasData(entry);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `month-card${filled ? "" : " is-empty"}`;
      const title = document.createElement("div");
      title.className = "name";
      title.textContent = name;
      const mini = document.createElement("div");
      mini.className = "mini";
      if (filled) {
        mini.append(
          Object.assign(document.createElement("span"), { textContent: `Ingresos ${money(t.income)}` }),
          Object.assign(document.createElement("span"), { textContent: `Egresos ${money(t.egresos)}` }),
          Object.assign(document.createElement("span"), { textContent: `Balance ${money(t.balance)}`, className: t.balance >= 0 ? "positive" : "negative" })
        );
      } else {
        mini.append(Object.assign(document.createElement("span"), { textContent: "Sin datos · abrir para anotar" }));
      }
      button.append(title, mini);
      button.addEventListener("click", () => openMonth(state.viewYear, key));
      grid.appendChild(button);
    });
  }

  function addInvoiceRows(box, title, rows, indent) {
    if (!rows.length) return;
    const h = document.createElement("div");
    h.className = indent ? "invoice-row indent" : "invoice-row";
    h.style.color = "var(--faint)";
    h.textContent = title;
    box.appendChild(h);
    rows.filter((row) => Number(row.amount) > 0).forEach((row) => {
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
    brand.textContent = "Norte · Flujo personal";
    const title = document.createElement("h2");
    title.textContent = `Factura ${state.viewYear}`;
    const who = document.createElement("p");
    who.textContent = state.profile.name ? `A nombre de ${state.profile.name}` : "Sin nombre";
    left.append(brand, title, who);
    const right = document.createElement("div");
    right.style.textAlign = "right";
    const stamp = document.createElement("p");
    stamp.className = "faint";
    stamp.textContent = "Resumen del año";
    const big = document.createElement("strong");
    big.style.fontFamily = "var(--serif)";
    big.style.fontSize = "1.6rem";
    big.textContent = money(totals.balance);
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
      addInvoiceRows(block, "Ingresos", entry.incomes || []);
      addInvoiceRows(block, "Egresos", (entry.expenses || []).map((row) => ({
        name: `${row.name || "Gasto"} · ${categoryById(row.category).label}`,
        amount: row.amount
      })));
      addInvoiceRows(block, "Ahorros", (entry.contributions || []).map((row) => ({
        name: (state.savings.find((s) => s.id === row.savingId) || {}).name || "Ahorro",
        amount: row.amount
      })));
      addInvoiceRows(block, "Inversiones", (entry.investments || []).map((row) => ({
        name: (state.investments.find((s) => s.id === row.investmentId) || {}).name || "Inversión",
        amount: row.amount
      })));
      const sub = document.createElement("div");
      sub.className = "invoice-row total";
      sub.append(
        Object.assign(document.createElement("span"), { textContent: `Balance ${name}` }),
        Object.assign(document.createElement("span"), { textContent: money(t.balance) })
      );
      block.appendChild(sub);
      box.appendChild(block);
    });

    if (!any) {
      const empty = document.createElement("p");
      empty.className = "invoice-empty";
      empty.textContent = "Todavía no hay movimientos este año. Anótalos en la pestaña Meses.";
      box.appendChild(empty);
      return;
    }

    const foot = document.createElement("section");
    foot.className = "invoice-foot";
    [
      ["Ingresos", totals.income],
      ["Egresos", totals.egresos],
      ["Ahorros", totals.ahorros],
      ["Inversiones", totals.inversiones],
      ["Balance del año", totals.balance]
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

  function renderIncomes() {
    const box = document.getElementById("income-rows");
    const entry = currentMonth();
    box.replaceChildren();
    entry.incomes.forEach((row, index) => {
      const wrap = document.createElement("div");
      wrap.className = "row";
      wrap.append(
        makeInput(row.name, (input) => { row.name = input.value; }, { type: "text", placeholder: "Concepto" }),
        makeInput(row.amount || "", (input) => {
          row.amount = Number.parseFloat(input.value) || 0;
          renderMonthTotals();
        }, { type: "number", min: "0", step: "any", placeholder: "0" }),
        removeButton(() => {
          if (entry.incomes.length === 1) { row.name = ""; row.amount = 0; }
          else entry.incomes.splice(index, 1);
          renderIncomes();
          renderMonthTotals();
        })
      );
      box.appendChild(wrap);
    });
  }

  function renderExpenses() {
    const box = document.getElementById("expense-rows");
    const entry = currentMonth();
    box.replaceChildren();
    entry.expenses.forEach((row, index) => {
      const wrap = document.createElement("div");
      wrap.className = "row expense";
      const select = document.createElement("select");
      CATEGORIES.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.label;
        if (category.id === categoryById(row.category).id) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", () => {
        row.category = select.value;
        renderMonthTotals();
      });
      wrap.append(
        makeInput(row.name, (input) => { row.name = input.value; }, { type: "text", placeholder: "Concepto" }),
        select,
        makeInput(row.amount || "", (input) => {
          row.amount = Number.parseFloat(input.value) || 0;
          renderMonthTotals();
        }, { type: "number", min: "0", step: "any", placeholder: "0" }),
        removeButton(() => {
          if (entry.expenses.length === 1) {
            row.name = ""; row.amount = 0; row.category = "vivienda";
          } else entry.expenses.splice(index, 1);
          renderExpenses();
          renderMonthTotals();
        })
      );
      box.appendChild(wrap);
    });
  }

  function renderLinkedRows(kind) {
    const isSaving = kind === "saving";
    const box = document.getElementById(isSaving ? "contrib-rows" : "placement-rows");
    const hint = document.getElementById(isSaving ? "contrib-hint" : "invest-hint");
    const entry = currentMonth();
    const pots = isSaving ? state.savings : state.investments;
    const field = isSaving ? "contributions" : "investments";
    const idKey = isSaving ? "savingId" : "investmentId";
    box.replaceChildren();
    if (!pots.length) {
      hint.textContent = isSaving
        ? "Crea un ahorro en Recopilado y vuelve a este mes para aportar."
        : "Crea una inversión en Recopilado y vuelve a este mes para aportar.";
      return;
    }
    hint.textContent = "Elige el fondo y el monto. Se resta del mes y se suma al acumulado.";
    if (!entry[field]) entry[field] = [];
    entry[field].forEach((row, index) => {
      const wrap = document.createElement("div");
      wrap.className = "row contrib";
      const select = document.createElement("select");
      pots.forEach((pot) => {
        const option = document.createElement("option");
        option.value = pot.id;
        option.textContent = pot.name || "Sin nombre";
        if (pot.id === row[idKey]) option.selected = true;
        select.appendChild(option);
      });
      if (!row[idKey] && pots[0]) row[idKey] = pots[0].id;
      select.addEventListener("change", () => { row[idKey] = select.value; });
      wrap.append(
        select,
        makeInput(row.amount || "", (input) => {
          row.amount = Number.parseFloat(input.value) || 0;
          renderMonthTotals();
        }, { type: "number", min: "0", step: "any", placeholder: "0" }),
        removeButton(() => {
          entry[field].splice(index, 1);
          renderLinkedRows(kind);
          renderMonthTotals();
        })
      );
      box.appendChild(wrap);
    });
  }

  function renderContribs() {
    renderLinkedRows("saving");
  }

  function renderPlacements() {
    renderLinkedRows("investment");
  }

  function renderMonthTotals() {
    const entry = currentMonth();
    const t = monthTotals(entry);
    document.getElementById("income-total").textContent = money(t.income);
    document.getElementById("expense-total").textContent = money(t.expense);
    document.getElementById("contrib-total").textContent = money(t.contrib);
    document.getElementById("placement-total").textContent = money(t.invest);
    const slices = expenseSlices(entry.expenses, t.contrib, t.invest);
    document.getElementById("month-metrics").replaceChildren(
      metric("Balance del mes", money(t.balance), "Ingresos − egresos − aportes", t.balance >= 0 ? "positive" : "negative"),
      metric("Ingresos", money(t.income), ""),
      metric("Ahorrado", money(t.contrib), "Va a tus ahorros"),
      metric("Invertido", money(t.invest), "Va a tus inversiones")
    );
    NorteCharts.donutChart(document.getElementById("month-donut"), slices, {
      centerLabel: "Salidas",
      centerValue: money(t.expense + t.contrib + t.invest),
      empty: "Añade egresos o aportes para ver la composición",
      format: money
    });
  }

  function renderMonth() {
    const { year, month } = state.openMonth;
    document.getElementById("month-title").textContent = `${MONTHS[Number(month) - 1]} ${year}`;
    notesInput.value = currentMonth().notes || "";
    renderIncomes();
    renderExpenses();
    renderContribs();
    renderPlacements();
    renderMonthTotals();
  }

  function render() {
    nameInput.value = state.profile.name || "";
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
      profile: { ...state.profile },
      viewYear: state.viewYear,
      savings: state.savings.map((row) => ({ ...row })),
      investments: state.investments.map((row) => ({ ...row })),
      years: JSON.parse(JSON.stringify(state.years))
    };
  }

  function applySnapshot(data) {
    if (!data) return;
    if (data.years) {
      state.profile = { name: (data.profile && data.profile.name) || "" };
      state.viewYear = Number(data.viewYear) || state.viewYear;
      state.savings = Array.isArray(data.savings) ? data.savings : [];
      state.investments = Array.isArray(data.investments) ? data.investments : [];
      state.years = data.years;
      state.openMonth = null;
    } else if (data.incomes || data.expenses) {
      const period = (data.profile && data.profile.period) || `${state.viewYear}-01`;
      const [year, month] = period.split("-");
      state.profile.name = (data.profile && data.profile.name) || "";
      state.viewYear = Number(year) || state.viewYear;
      state.savings = [];
      state.investments = [];
      state.years = {
        [year]: {
          months: {
            [month]: {
              notes: (data.profile && data.profile.notes) || "",
              incomes: data.incomes || [],
              expenses: data.expenses || [],
              contributions: [],
              investments: []
            }
          }
        }
      };
    }
    render();
  }

  function loadExample() {
    const a = uid();
    const b = uid();
    const c = uid();
    const year = String(now.getFullYear());
    state.profile = { name: "Ana" };
    state.viewYear = Number(year);
    state.openMonth = null;
    state.tab = "recopilado";
    state.savings = [
      { id: a, name: "Fondo de emergencia", target: 10000000 },
      { id: b, name: "Viaje", target: 4500000 }
    ];
    state.investments = [
      { id: c, name: "CDT", target: 8000000 }
    ];
    state.years = {
      [year]: {
        months: {
          "01": {
            notes: "Arranque de año.",
            incomes: [{ id: uid(), name: "Salario", amount: 4800000 }],
            expenses: [
              { id: uid(), name: "Arriendo", category: "vivienda", amount: 1600000 },
              { id: uid(), name: "Mercado", category: "alimentacion", amount: 820000 },
              { id: uid(), name: "Luz y agua", category: "servicios", amount: 280000 }
            ],
            contributions: [{ id: uid(), savingId: a, amount: 500000 }],
            investments: [{ id: uid(), investmentId: c, amount: 400000 }]
          },
          "02": {
            notes: "",
            incomes: [
              { id: uid(), name: "Salario", amount: 4800000 },
              { id: uid(), name: "Freelance", amount: 900000 }
            ],
            expenses: [
              { id: uid(), name: "Arriendo", category: "vivienda", amount: 1600000 },
              { id: uid(), name: "Mercado", category: "alimentacion", amount: 790000 },
              { id: uid(), name: "Taller", category: "vehiculos", amount: 410000 }
            ],
            contributions: [{ id: uid(), savingId: b, amount: 300000 }],
            investments: [{ id: uid(), investmentId: c, amount: 500000 }]
          },
          "03": {
            notes: "",
            incomes: [{ id: uid(), name: "Salario", amount: 4800000 }],
            expenses: [
              { id: uid(), name: "Arriendo", category: "vivienda", amount: 1600000 },
              { id: uid(), name: "Mercado", category: "alimentacion", amount: 800000 }
            ],
            contributions: [{ id: uid(), savingId: a, amount: 400000 }],
            investments: [{ id: uid(), investmentId: c, amount: 400000 }]
          }
        }
      }
    };
    render();
    Norte.toast("Ejemplo cargado con ahorros e inversiones.");
  }

  document.querySelectorAll(".overview-tabs [data-tab]").forEach((button) => {
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
  nameInput.addEventListener("input", () => { state.profile.name = nameInput.value; });
  notesInput.addEventListener("input", () => {
    const entry = currentMonth();
    if (entry) entry.notes = notesInput.value;
  });
  document.getElementById("add-saving").addEventListener("click", () => {
    state.savings.push({ id: uid(), name: "Nuevo ahorro", target: 0 });
    renderSavings();
  });
  document.getElementById("add-invest").addEventListener("click", () => {
    state.investments.push({ id: uid(), name: "Nueva inversión", target: 0 });
    renderInvestments();
  });
  document.getElementById("add-income").addEventListener("click", () => {
    currentMonth().incomes.push({ id: uid(), name: "", amount: 0 });
    renderIncomes();
  });
  document.getElementById("add-expense").addEventListener("click", () => {
    currentMonth().expenses.push({ id: uid(), name: "", category: "otros", amount: 0 });
    renderExpenses();
  });
  document.getElementById("add-contrib").addEventListener("click", () => {
    if (!state.savings.length) {
      Norte.toast("Crea un ahorro en Recopilado primero.", "error");
      return;
    }
    currentMonth().contributions.push({ id: uid(), savingId: state.savings[0].id, amount: 0 });
    renderContribs();
  });
  document.getElementById("add-placement").addEventListener("click", () => {
    if (!state.investments.length) {
      Norte.toast("Crea una inversión en Recopilado primero.", "error");
      return;
    }
    currentMonth().investments.push({ id: uid(), investmentId: state.investments[0].id, amount: 0 });
    renderPlacements();
  });
  document.getElementById("btn-back").addEventListener("click", closeMonth);
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
