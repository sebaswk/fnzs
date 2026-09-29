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
    { id: "ahorro", label: "Ahorro", color: "#7dcea0" },
    { id: "inversion", label: "Inversión", color: "#c5e0cc" },
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
      contributions: []
    };
  }

  const now = new Date();
  const state = {
    profile: { name: "" },
    viewYear: now.getFullYear(),
    openMonth: null,
    savings: [],
    years: {}
  };

  const overview = document.getElementById("view-overview");
  const monthView = document.getElementById("view-month");
  const nameInput = document.getElementById("nombre");
  const notesInput = document.getElementById("month-notes");

  function money(value) {
    return Norte.formatMoney(value, CURRENCY);
  }

  function categoryById(id) {
    const mapped = id === "ahorros" ? "ahorro" : id;
    return CATEGORIES.find((item) => item.id === mapped) || CATEGORIES.at(-1);
  }

  function ensureYear(year) {
    const key = String(year);
    if (!state.years[key]) state.years[key] = { months: {} };
    return state.years[key];
  }

  function getMonth(year, key, create) {
    const y = ensureYear(year);
    if (!y.months[key] && create) y.months[key] = emptyMonth();
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
    return {
      income,
      expense,
      contrib,
      balance: income - expense - contrib,
      spent: expense + contrib
    };
  }

  function yearTotals(year) {
    const y = state.years[String(year)];
    const acc = { income: 0, expense: 0, contrib: 0, balance: 0 };
    if (!y) return acc;
    Object.values(y.months).forEach((entry) => {
      const t = monthTotals(entry);
      acc.income += t.income;
      acc.expense += t.expense;
      acc.contrib += t.contrib;
    });
    acc.balance = acc.income - acc.expense - acc.contrib;
    return acc;
  }

  function allYearsList() {
    const keys = Object.keys(state.years).map(Number);
    keys.push(state.viewYear);
    return [...new Set(keys)].sort((a, b) => a - b);
  }

  function savingTotal(id) {
    let total = 0;
    Object.values(state.years).forEach((year) => {
      Object.values(year.months || {}).forEach((entry) => {
        (entry.contributions || []).forEach((row) => {
          if (row.savingId === id) total += Number(row.amount) || 0;
        });
      });
    });
    return total;
  }

  function yearCategories(year) {
    const y = state.years[String(year)];
    const map = {};
    if (y) {
      Object.values(y.months).forEach((entry) => {
        (entry.expenses || []).forEach((row) => {
          const cat = categoryById(row.category).id;
          map[cat] = (map[cat] || 0) + (Number(row.amount) || 0);
        });
      });
    }
    return CATEGORIES.map((category) => ({
      ...category,
      value: map[category.id] || 0
    })).filter((item) => item.value > 0);
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
    return sumList(entry.incomes) > 0 || sumList(entry.expenses) > 0 || sumList(entry.contributions) > 0;
  }

  function setView(mode) {
    overview.hidden = mode !== "overview";
    monthView.hidden = mode !== "month";
  }

  function openMonth(year, key) {
    state.viewYear = Number(year);
    state.openMonth = { year: Number(year), month: key };
    getMonth(year, key, true);
    if (location.hash !== `#${year}-${key}`) {
      location.hash = `${year}-${key}`;
    }
    render();
  }

  function closeMonth() {
    state.openMonth = null;
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    render();
  }

  function readHash() {
    const match = /^#(\d{4})-(\d{2})$/.exec(location.hash);
    if (!match) return null;
    return { year: Number(match[1]), month: match[2] };
  }

  function renderYearBar() {
    document.getElementById("year-label").textContent = String(state.viewYear);
    document.getElementById("months-year").textContent = String(state.viewYear);
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
    const historic = allYearsList().reduce((acc, year) => {
      const t = yearTotals(year);
      acc.contrib += t.contrib;
      return acc;
    }, { contrib: 0 });

    document.getElementById("year-metrics").replaceChildren(
      metric("Ingresos del año", money(totals.income), `${state.viewYear}`),
      metric("Egresos del año", money(totals.expense), "Sin contar aportes a ahorros"),
      metric("Aportes a ahorros", money(totals.contrib), `Acumulado de todos los años: ${money(historic.contrib)}`),
      metric("Balance del año", money(totals.balance), `Tasa de ahorro ${Norte.formatPct(rate)}`, totals.balance >= 0 ? "positive" : "negative")
    );

    const points = MONTHS.map((name, index) => {
      const entry = getMonth(state.viewYear, monthKey(index), false);
      const t = monthTotals(entry);
      return { x: index + 1, income: t.income, expense: t.expense, contrib: t.contrib, name };
    });
    NorteCharts.lineChart(document.getElementById("year-chart"), [
      { name: "Ingresos", color: "#9cbaa4", points: points.map((p) => ({ x: p.x, y: p.income })) },
      { name: "Egresos", color: "#c98970", points: points.map((p) => ({ x: p.x, y: p.expense })) },
      { name: "Ahorros", color: "#d4c4a0", points: points.map((p) => ({ x: p.x, y: p.contrib })) }
    ], {
      formatY: (value) => Norte.formatCompact(value, CURRENCY),
      formatX: (value) => MONTHS[Math.max(0, Math.round(value) - 1)].slice(0, 3)
    });

    const slices = yearCategories(state.viewYear);
    const yearContrib = totals.contrib;
    if (yearContrib > 0) {
      slices.push({ id: "aportes", label: "Aportes a ahorros", color: "#efe0bf", value: yearContrib });
    }
    NorteCharts.donutChart(document.getElementById("year-donut"), slices, {
      centerLabel: "Salidas",
      centerValue: money(totals.expense + totals.contrib),
      empty: "Aún no hay egresos este año"
    });

    renderSavings();
    renderMonthGrid();
  }

  function renderSavings() {
    const box = document.getElementById("savings-list");
    box.replaceChildren();
    if (!state.savings.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = "Crea un ahorro (viaje, emergencia, vivienda…) y luego aporta desde cada mes. El total se acumula.";
      box.appendChild(p);
      return;
    }
    state.savings.forEach((saving, index) => {
      const card = document.createElement("article");
      card.className = "saving-card";
      const nameField = document.createElement("div");
      nameField.className = "field";
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Nombre";
      const name = makeInput(saving.name, (input) => {
        saving.name = input.value;
        if (state.openMonth) renderContribs();
      }, { type: "text", placeholder: "Fondo de emergencia" });
      nameField.append(nameLabel, name);

      const targetField = document.createElement("div");
      targetField.className = "field";
      const targetLabel = document.createElement("label");
      targetLabel.textContent = "Meta (opcional)";
      const target = makeInput(saving.target || "", (input) => {
        saving.target = Number.parseFloat(input.value) || 0;
        const pct = saving.target ? Math.min((total / saving.target) * 100, 999) : 0;
        meta.textContent = saving.target
          ? `${Norte.formatPct(pct)} de la meta`
          : "Sin meta definida";
        fill.style.width = saving.target ? `${Math.min(100, (total / saving.target) * 100)}%` : (total > 0 ? "100%" : "0%");
      }, { type: "number", min: "0", step: "any", placeholder: "0" });
      targetField.append(targetLabel, target);

      const total = savingTotal(saving.id);
      const done = document.createElement("div");
      done.className = "field";
      const doneLabel = document.createElement("label");
      doneLabel.textContent = "Acumulado";
      const strong = document.createElement("strong");
      strong.textContent = money(total);
      const meta = document.createElement("div");
      meta.className = "saving-meta";
      meta.textContent = saving.target
        ? `${Norte.formatPct(Math.min((total / saving.target) * 100, 999))} de la meta`
        : "Sin meta definida";
      done.append(doneLabel, strong, meta);

      const bar = document.createElement("div");
      bar.className = "progress";
      const fill = document.createElement("span");
      fill.style.width = saving.target ? `${Math.min(100, (total / saving.target) * 100)}%` : (total > 0 ? "100%" : "0%");
      bar.appendChild(fill);

      card.append(nameField, targetField, done, removeButton(() => {
        state.savings.splice(index, 1);
        Object.values(state.years).forEach((year) => {
          Object.values(year.months || {}).forEach((entry) => {
            entry.contributions = (entry.contributions || []).filter((row) => row.savingId !== saving.id);
          });
        });
        render();
      }), bar);
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
      const button = document.createElement("button");
      button.type = "button";
      button.className = `month-card${filled ? "" : " is-empty"}`;
      const title = document.createElement("div");
      title.className = "name";
      title.textContent = name;
      const mini = document.createElement("div");
      mini.className = "mini";
      if (filled) {
        const a = document.createElement("span");
        a.textContent = `Ingresos ${money(t.income)}`;
        const b = document.createElement("span");
        b.textContent = `Egresos ${money(t.expense)}`;
        const c = document.createElement("span");
        c.className = t.balance >= 0 ? "positive" : "negative";
        c.textContent = `Balance ${money(t.balance)}`;
        mini.append(a, b, c);
      } else {
        const empty = document.createElement("span");
        empty.textContent = "Sin datos · abrir para anotar";
        mini.appendChild(empty);
      }
      button.append(title, mini);
      button.addEventListener("click", () => openMonth(state.viewYear, key));
      grid.appendChild(button);
    });
  }

  function renderIncomes() {
    const box = document.getElementById("income-rows");
    const entry = currentMonth();
    box.replaceChildren();
    entry.incomes.forEach((row, index) => {
      const wrap = document.createElement("div");
      wrap.className = "row";
      const name = makeInput(row.name, (input) => {
        row.name = input.value;
      }, { type: "text", placeholder: "Concepto", "aria-label": "Concepto de ingreso" });
      const amount = makeInput(row.amount || "", (input) => {
        row.amount = Number.parseFloat(input.value) || 0;
        renderMonthTotals();
      }, { type: "number", min: "0", step: "any", placeholder: "0" });
      wrap.append(name, amount, removeButton(() => {
        if (entry.incomes.length === 1) {
          row.name = "";
          row.amount = 0;
        } else {
          entry.incomes.splice(index, 1);
        }
        renderIncomes();
        renderMonthTotals();
      }));
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
      const name = makeInput(row.name, (input) => {
        row.name = input.value;
      }, { type: "text", placeholder: "Concepto" });
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
      const amount = makeInput(row.amount || "", (input) => {
        row.amount = Number.parseFloat(input.value) || 0;
        renderMonthTotals();
      }, { type: "number", min: "0", step: "any", placeholder: "0" });
      wrap.append(name, select, amount, removeButton(() => {
        if (entry.expenses.length === 1) {
          row.name = "";
          row.amount = 0;
          row.category = "vivienda";
        } else {
          entry.expenses.splice(index, 1);
        }
        renderExpenses();
        renderMonthTotals();
      }));
      box.appendChild(wrap);
    });
  }

  function renderContribs() {
    const box = document.getElementById("contrib-rows");
    const hint = document.getElementById("contrib-hint");
    const entry = currentMonth();
    box.replaceChildren();
    if (!state.savings.length) {
      hint.textContent = "Primero crea un ahorro en el recopilado. Luego vuelve a este mes y registra el aporte.";
      return;
    }
    hint.textContent = "Elige el ahorro y el monto. Se resta del mes y se suma al acumulado.";
    entry.contributions.forEach((row, index) => {
      const wrap = document.createElement("div");
      wrap.className = "row contrib";
      const select = document.createElement("select");
      state.savings.forEach((saving) => {
        const option = document.createElement("option");
        option.value = saving.id;
        option.textContent = saving.name || "Sin nombre";
        if (saving.id === row.savingId) option.selected = true;
        select.appendChild(option);
      });
      if (!row.savingId && state.savings[0]) row.savingId = state.savings[0].id;
      select.addEventListener("change", () => {
        row.savingId = select.value;
      });
      const amount = makeInput(row.amount || "", (input) => {
        row.amount = Number.parseFloat(input.value) || 0;
        renderMonthTotals();
      }, { type: "number", min: "0", step: "any", placeholder: "0" });
      wrap.append(select, amount, removeButton(() => {
        entry.contributions.splice(index, 1);
        renderContribs();
        renderMonthTotals();
      }));
      box.appendChild(wrap);
    });
  }

  function renderMonthTotals() {
    const entry = currentMonth();
    const t = monthTotals(entry);
    document.getElementById("income-total").textContent = money(t.income);
    document.getElementById("expense-total").textContent = money(t.expense);
    document.getElementById("contrib-total").textContent = money(t.contrib);
    const byCategory = CATEGORIES.map((category) => ({
      ...category,
      value: (entry.expenses || [])
        .filter((row) => categoryById(row.category).id === category.id)
        .reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    })).filter((item) => item.value > 0);
    const top = [...byCategory].sort((a, b) => b.value - a.value)[0];
    document.getElementById("month-metrics").replaceChildren(
      metric("Balance del mes", money(t.balance), "Ingresos − egresos − aportes", t.balance >= 0 ? "positive" : "negative"),
      metric("Ingresos", money(t.income), `${(entry.incomes || []).filter((row) => row.amount > 0).length} partidas`),
      metric("Egresos", money(t.expense), top ? `Mayor: ${top.label}` : "Sin egresos"),
      metric("Ahorrado este mes", money(t.contrib), "Va al acumulado de cada ahorro")
    );
    NorteCharts.donutChart(document.getElementById("month-donut"), byCategory, {
      centerLabel: "Egresos",
      centerValue: money(t.expense),
      empty: "Añade egresos para ver la composición"
    });
  }

  function renderMonth() {
    const { year, month } = state.openMonth;
    const idx = Number(month) - 1;
    document.getElementById("month-title").textContent = `${MONTHS[idx]} ${year}`;
    notesInput.value = currentMonth().notes || "";
    renderIncomes();
    renderExpenses();
    renderContribs();
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
      years: JSON.parse(JSON.stringify(state.years))
    };
  }

  function applySnapshot(data) {
    if (!data) return;
    if (data.years) {
      state.profile = { name: (data.profile && data.profile.name) || "" };
      state.viewYear = Number(data.viewYear) || state.viewYear;
      state.savings = Array.isArray(data.savings) ? data.savings.map((row) => ({
        id: row.id || uid(),
        name: row.name || "",
        target: Number(row.target) || 0
      })) : [];
      state.years = data.years;
      state.openMonth = null;
    } else if (data.incomes || data.expenses) {
      const period = (data.profile && data.profile.period) || `${state.viewYear}-01`;
      const [year, month] = period.split("-");
      state.profile.name = (data.profile && data.profile.name) || "";
      state.viewYear = Number(year) || state.viewYear;
      state.savings = [];
      state.years = {
        [year]: {
          months: {
            [month]: {
              notes: (data.profile && data.profile.notes) || "",
              incomes: data.incomes || [],
              expenses: (data.expenses || []).map((row) => ({
                ...row,
                category: categoryById(row.category).id
              })),
              contributions: []
            }
          }
        }
      };
      state.openMonth = null;
    }
    render();
  }

  function loadExample() {
    const a = uid();
    const b = uid();
    const year = String(now.getFullYear());
    state.profile = { name: "Ana" };
    state.viewYear = Number(year);
    state.openMonth = null;
    state.savings = [
      { id: a, name: "Fondo de emergencia", target: 10000000 },
      { id: b, name: "Viaje", target: 4500000 }
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
              { id: uid(), name: "Luz y agua", category: "servicios", amount: 280000 },
              { id: uid(), name: "Gasolina", category: "vehiculos", amount: 320000 }
            ],
            contributions: [{ id: uid(), savingId: a, amount: 600000 }]
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
              { id: uid(), name: "SOAT / taller", category: "vehiculos", amount: 410000 },
              { id: uid(), name: "Curso", category: "educacion", amount: 250000 }
            ],
            contributions: [
              { id: uid(), savingId: a, amount: 700000 },
              { id: uid(), savingId: b, amount: 300000 }
            ]
          },
          "03": {
            notes: "Más ahorro al viaje.",
            incomes: [{ id: uid(), name: "Salario", amount: 4800000 }],
            expenses: [
              { id: uid(), name: "Arriendo", category: "vivienda", amount: 1600000 },
              { id: uid(), name: "Mercado", category: "alimentacion", amount: 800000 },
              { id: uid(), name: "Internet y celular", category: "servicios", amount: 190000 }
            ],
            contributions: [
              { id: uid(), savingId: a, amount: 500000 },
              { id: uid(), savingId: b, amount: 400000 }
            ]
          }
        }
      }
    };
    const prev = String(Number(year) - 1);
    state.years[prev] = {
      months: {
        "11": {
          notes: "Año anterior.",
          incomes: [{ id: uid(), name: "Salario", amount: 4500000 }],
          expenses: [{ id: uid(), name: "Arriendo", category: "vivienda", amount: 1500000 }],
          contributions: [{ id: uid(), savingId: a, amount: 400000 }]
        }
      }
    };
    render();
    Norte.toast("Ejemplo cargado: hay dos años y ahorros que se acumulan.");
  }

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
  nameInput.addEventListener("input", () => {
    state.profile.name = nameInput.value;
  });
  notesInput.addEventListener("input", () => {
    const entry = currentMonth();
    if (entry) entry.notes = notesInput.value;
  });
  document.getElementById("add-saving").addEventListener("click", () => {
    state.savings.push({ id: uid(), name: "Nuevo ahorro", target: 0 });
    renderSavings();
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
      Norte.toast("Crea un ahorro en el recopilado primero.", "error");
      return;
    }
    currentMonth().contributions.push({
      id: uid(),
      savingId: state.savings[0].id,
      amount: 0
    });
    renderContribs();
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
