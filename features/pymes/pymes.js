(() => {
  const FEATURE = "pymes";
  const CURRENCY = "COP";

  function uid() {
    return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const state = {
    name: "",
    year: new Date().getFullYear(),
    taxRate: 15,
    uncertainty: 12,
    incomes: [{ id: uid(), name: "Ventas", amount: 0 }],
    costs: [{ id: uid(), name: "Mercancía / insumos", amount: 0 }],
    expenses: [{ id: uid(), name: "Arriendo", amount: 0, type: "fijo" }]
  };

  function money(value) {
    return Norte.formatMoney(value, CURRENCY);
  }

  function sum(rows) {
    return rows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
  }

  function totals() {
    const income = sum(state.incomes);
    const cogs = sum(state.costs);
    const opex = sum(state.expenses);
    const gross = income - cogs;
    const operating = gross - opex;
    const tax = Math.max(0, operating) * (state.taxRate / 100);
    const net = operating - tax;
    const u = state.uncertainty / 100;
    const fixed = state.expenses.filter((row) => row.type === "fijo").reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    const variable = cogs + state.expenses.filter((row) => row.type === "variable").reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    const contrib = income > 0 ? 1 - variable / income : 0;
    const breakEven = contrib > 0 ? fixed / contrib : null;
    return {
      income, cogs, opex, gross, operating, tax, net,
      low: net * (1 - u),
      high: net * (1 + u),
      marginGross: income ? (gross / income) * 100 : 0,
      marginNet: income ? (net / income) * 100 : 0,
      breakEven,
      fixed,
      variable
    };
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
        const select = document.createElement("select");
        [["fijo", "Fijo"], ["variable", "Variable"]].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          if (row.type === value) option.selected = true;
          select.appendChild(option);
        });
        select.addEventListener("change", () => {
          row.type = select.value;
          renderTotals();
        });
        wrap.appendChild(select);
      }
      wrap.append(
        makeInput(row.amount || "", (input) => {
          row.amount = Number.parseFloat(input.value) || 0;
          renderTotals();
        }, { type: "number", min: "0", step: "any", placeholder: "0" }),
        removeButton(() => {
          if (rows.length === 1) {
            row.name = "";
            row.amount = 0;
          } else rows.splice(index, 1);
          renderLists();
          renderTotals();
        })
      );
      box.appendChild(wrap);
    });
  }

  function renderLists() {
    renderList("income-rows", state.incomes, "income");
    renderList("cost-rows", state.costs, "cost");
    renderList("expense-rows", state.expenses, "expense");
  }

  function renderTotals() {
    const t = totals();
    document.getElementById("metrics").replaceChildren(
      metric("Ganancia bruta", money(t.gross), `Margen ${Norte.formatPct(t.marginGross)} · ventas menos costos`, t.gross >= 0 ? "positive" : "negative"),
      metric("Ganancia neta", money(t.net), `Después de gastos e impuestos ${Norte.formatPct(state.taxRate)}`, t.net >= 0 ? "positive" : "negative"),
      metric(
        "Rango con incertidumbre",
        `${money(t.low)} → ${money(t.high)}`,
        `±${Norte.formatPct(state.uncertainty)} sobre la neta`
      ),
      metric(
        "Punto de equilibrio",
        t.breakEven === null ? "—" : money(t.breakEven),
        t.breakEven === null ? "Marca gastos fijos y variables" : "Ventas mínimas para no perder"
      )
    );

    NorteCharts.barsChart(document.getElementById("pnl-chart"), [
      { label: "Ingresos", value: t.income, color: "#9cbaa4" },
      { label: "Costos directos", value: t.cogs, color: "#c98970" },
      { label: "Ganancia bruta", value: Math.max(0, t.gross), color: "#d4c4a0" },
      { label: "Gastos", value: t.opex, color: "#8aa4c4" },
      { label: "Impuestos", value: t.tax, color: "#c47a8a" },
      { label: "Ganancia neta", value: Math.max(0, t.net), color: "#7dcea0" }
    ], { format: money });

    NorteCharts.barsChart(document.getElementById("range-chart"), [
      { label: "Escenario bajo", value: Math.abs(t.low), color: "#c98970" },
      { label: "Esperado", value: Math.abs(t.net), color: "#d4c4a0" },
      { label: "Escenario alto", value: Math.abs(t.high), color: "#9cbaa4" }
    ], { format: money });

    const slices = [
      ...state.costs.filter((row) => row.amount > 0).map((row) => ({
        label: row.name || "Costo",
        value: row.amount,
        color: "#c98970"
      })),
      ...state.expenses.filter((row) => row.amount > 0).map((row, index) => ({
        label: row.name || "Gasto",
        value: row.amount,
        color: ["#8aa4c4", "#d4c4a0", "#b8a1d4", "#7dcea0", "#e0c07a"][index % 5]
      }))
    ];
    NorteCharts.donutChart(document.getElementById("mix-donut"), slices, {
      centerLabel: "Salidas",
      centerValue: money(t.cogs + t.opex),
      empty: "Añade costos o gastos",
      format: money
    });
  }

  function render() {
    document.getElementById("biz-name").value = state.name;
    document.getElementById("biz-year").value = state.year;
    document.getElementById("tax").value = state.taxRate;
    document.getElementById("uncertainty").value = state.uncertainty;
    renderLists();
    renderTotals();
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function applySnapshot(data) {
    if (!data) return;
    Object.assign(state, data);
    if (!Array.isArray(state.incomes) || !state.incomes.length) {
      state.incomes = [{ id: uid(), name: "Ventas", amount: 0 }];
    }
    if (!Array.isArray(state.costs) || !state.costs.length) {
      state.costs = [{ id: uid(), name: "Insumos", amount: 0 }];
    }
    if (!Array.isArray(state.expenses) || !state.expenses.length) {
      state.expenses = [{ id: uid(), name: "Arriendo", amount: 0, type: "fijo" }];
    }
    render();
  }

  function loadExample() {
    state.name = "Café Norte";
    state.year = new Date().getFullYear();
    state.taxRate = 15;
    state.uncertainty = 12;
    state.incomes = [
      { id: uid(), name: "Ventas del local", amount: 18000000 },
      { id: uid(), name: "Domicilios", amount: 4200000 }
    ];
    state.costs = [
      { id: uid(), name: "Café e insumos", amount: 6200000 },
      { id: uid(), name: "Empaques", amount: 480000 }
    ];
    state.expenses = [
      { id: uid(), name: "Arriendo", amount: 2800000, type: "fijo" },
      { id: uid(), name: "Nómina", amount: 4500000, type: "fijo" },
      { id: uid(), name: "Servicios", amount: 620000, type: "fijo" },
      { id: uid(), name: "Publicidad", amount: 350000, type: "variable" }
    ];
    render();
    Norte.toast("Ejemplo de cafetería cargado.");
  }

  document.getElementById("biz-name").addEventListener("input", (event) => {
    state.name = event.target.value;
  });
  document.getElementById("biz-year").addEventListener("input", (event) => {
    state.year = Number.parseInt(event.target.value, 10) || state.year;
  });
  document.getElementById("tax").addEventListener("input", (event) => {
    state.taxRate = Number.parseFloat(event.target.value) || 0;
    renderTotals();
  });
  document.getElementById("uncertainty").addEventListener("input", (event) => {
    state.uncertainty = Number.parseFloat(event.target.value) || 0;
    renderTotals();
  });
  document.getElementById("add-income").addEventListener("click", () => {
    state.incomes.push({ id: uid(), name: "", amount: 0 });
    renderLists();
  });
  document.getElementById("add-cost").addEventListener("click", () => {
    state.costs.push({ id: uid(), name: "", amount: 0 });
    renderLists();
  });
  document.getElementById("add-expense").addEventListener("click", () => {
    state.expenses.push({ id: uid(), name: "", amount: 0, type: "fijo" });
    renderLists();
  });
  document.getElementById("btn-ejemplo").addEventListener("click", loadExample);
  document.getElementById("btn-guardar").addEventListener("click", () => {
    Norte.downloadSnapshot(FEATURE, snapshot());
  });
  Norte.bindFileInput(document.getElementById("file-input"), FEATURE, applySnapshot);
  document.getElementById("btn-cargar").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });
  Norte.enableDrop(document.body, FEATURE, applySnapshot);

  render();
})();
