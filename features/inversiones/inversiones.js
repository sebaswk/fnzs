(() => {
  const FEATURE = "inversiones";
  const PRESETS = {
    USD: [
      { id: "us", label: "Estados Unidos 2,5%", value: 2.5, hint: "Referencia CPI de largo plazo, no un dato en vivo." },
      { id: "eu", label: "Eurozona 2,0%", value: 2, hint: "Referencia HICP de largo plazo, no un dato en vivo." },
      { id: "custom", label: "Personalizada", value: null, hint: "Escribe la inflación anual que quieras usar." }
    ],
    COP: [
      { id: "co", label: "Colombia 5,5%", value: 5.5, hint: "Referencia IPC de largo plazo, no un dato en vivo." },
      { id: "custom", label: "Personalizada", value: null, hint: "Escribe la inflación anual que quieras usar." }
    ]
  };

  const state = {
    currency: "USD",
    USD: {
      principal: 2500,
      monthly: 300,
      rate: 8,
      years: 12,
      inflation: 2.5,
      preset: "us"
    },
    COP: {
      principal: 8000000,
      monthly: 400000,
      rate: 11,
      years: 10,
      inflation: 5.5,
      preset: "co"
    }
  };

  const form = document.getElementById("calc-form");
  const fields = {
    principal: document.getElementById("principal"),
    monthly: document.getElementById("monthly"),
    rate: document.getElementById("rate"),
    years: document.getElementById("years"),
    inflation: document.getElementById("inflation")
  };
  const presetBox = document.getElementById("inflation-presets");
  const hint = document.getElementById("inflation-hint");
  const metrics = document.getElementById("metrics");
  const yearBody = document.getElementById("year-body");
  const chart = document.getElementById("chart");
  const tabUsd = document.getElementById("tab-usd");
  const tabCop = document.getElementById("tab-cop");

  function current() {
    return state[state.currency];
  }

  function readNumber(input) {
    const value = Number.parseFloat(input.value);
    return Number.isFinite(value) ? value : 0;
  }

  function syncFormFromState() {
    const data = current();
    Object.keys(fields).forEach((key) => {
      fields[key].value = data[key];
    });
    document.getElementById("principal-suffix").textContent = state.currency;
    document.getElementById("monthly-suffix").textContent = state.currency;
    renderPresets();
  }

  function syncStateFromForm() {
    const data = current();
    data.principal = readNumber(fields.principal);
    data.monthly = readNumber(fields.monthly);
    data.rate = readNumber(fields.rate);
    data.years = Math.max(1, Math.round(readNumber(fields.years)));
    data.inflation = readNumber(fields.inflation);
    const preset = PRESETS[state.currency].find((item) => item.id === data.preset);
    if (preset && preset.value !== null && Math.abs(preset.value - data.inflation) > 0.001) {
      data.preset = "custom";
    }
    renderPresets();
  }

  function renderPresets() {
    const data = current();
    presetBox.replaceChildren();
    PRESETS[state.currency].forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chip${data.preset === item.id ? " is-active" : ""}`;
      button.textContent = item.label;
      button.addEventListener("click", () => {
        data.preset = item.id;
        if (item.value !== null) {
          data.inflation = item.value;
          fields.inflation.value = item.value;
        }
        hint.textContent = item.hint;
        renderPresets();
        render();
      });
      presetBox.appendChild(button);
    });
    const active = PRESETS[state.currency].find((item) => item.id === data.preset) || PRESETS[state.currency].at(-1);
    hint.textContent = active.hint;
  }

  function project(data) {
    const months = Math.max(1, Math.round(data.years)) * 12;
    const monthlyRate = (data.rate || 0) / 100 / 12;
    const inflation = (data.inflation || 0) / 100;
    let balance = data.principal || 0;
    const points = [{
      month: 0,
      year: 0,
      nominal: balance,
      real: balance,
      contributed: data.principal || 0,
      interest: 0,
      monthInterest: 0,
      realMonthInterest: 0
    }];

    for (let month = 1; month <= months; month += 1) {
      const monthInterest = balance * monthlyRate;
      balance += monthInterest + (data.monthly || 0);
      const yearsElapsed = month / 12;
      const real = inflation > 0 ? balance / (1 + inflation) ** yearsElapsed : balance;
      const contributed = (data.principal || 0) + (data.monthly || 0) * month;
      const deflator = (1 + inflation) ** yearsElapsed || 1;
      points.push({
        month,
        year: month / 12,
        nominal: balance,
        real,
        contributed,
        interest: balance - contributed,
        monthInterest,
        realMonthInterest: monthInterest / deflator
      });
    }
    return points;
  }

  function yearlyRows(points) {
    return points.filter((point) => point.month > 0 && point.month % 12 === 0);
  }

  function sample(points) {
    if (points.length <= 120) return points;
    const step = Math.ceil(points.length / 120);
    return points.filter((point, index) => index % step === 0 || index === points.length - 1);
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

  function render() {
    const currency = state.currency;
    const data = current();
    const points = project(data);
    const last = points.at(-1);
    const months = Math.max(1, points.length - 1);
    const money = (value) => Norte.formatMoney(value, currency);
    const nominalEffective = (1 + (data.rate || 0) / 100 / 12) ** 12 - 1;
    const realAnnual = ((1 + nominalEffective) / (1 + (data.inflation || 0) / 100) - 1) * 100;
    document.getElementById("chart-caption").textContent =
      `Tasa real aproximada ${Norte.formatPct(realAnnual)} anual · valor de la cuenta frente al poder adquisitivo`;

    metrics.replaceChildren(
      metric("Valor futuro", money(last.nominal), `En dinero de hoy: ${money(last.real)} · ${data.years} años`),
      metric("Poder adquisitivo", money(last.real), `Inflación ${Norte.formatPct(data.inflation)} anual`),
      metric(
        "Intereses ganados",
        money(last.interest),
        `Promedio mensual ${money(last.interest / months)} · aportado ${money(last.contributed)}`
      ),
      metric(
        "Ganancia del último mes",
        money(last.monthInterest),
        `Con inflación: ${money(Math.max(last.realMonthInterest, 0))} en dinero de hoy`
      )
    );

    const sampled = sample(points);
    NorteCharts.lineChart(chart, [
      {
        name: "Valor",
        color: "#d4c4a0",
        points: sampled.map((point) => ({ x: point.year, y: point.nominal }))
      },
      {
        name: "Real",
        color: "#9cbaa4",
        points: sampled.map((point) => ({ x: point.year, y: point.real }))
      },
      {
        name: "Aportado",
        color: "#6f6960",
        dashed: true,
        width: 1.6,
        points: sampled.map((point) => ({ x: point.year, y: point.contributed }))
      }
    ], {
      formatY: (value) => Norte.formatCompact(value, currency),
      formatX: (value) => {
        const years = Math.round(value);
        if (years === 0) return "Inicio";
        return `${years} ${years === 1 ? "Año" : "Años"}`;
      }
    });

    yearBody.replaceChildren();
    yearlyRows(points).forEach((row, index) => {
      const tr = document.createElement("tr");
      const cells = [
        `Año ${index + 1}`,
        money(row.contributed),
        money(row.interest),
        money(row.nominal),
        money(row.real)
      ];
      cells.forEach((text, cellIndex) => {
        const td = document.createElement("td");
        td.textContent = text;
        if (cellIndex === 0) td.style.textAlign = "left";
        tr.appendChild(td);
      });
      yearBody.appendChild(tr);
    });
  }

  function setCurrency(currency) {
    state.currency = currency;
    tabUsd.classList.toggle("is-active", currency === "USD");
    tabCop.classList.toggle("is-active", currency === "COP");
    tabUsd.setAttribute("aria-selected", String(currency === "USD"));
    tabCop.setAttribute("aria-selected", String(currency === "COP"));
    syncFormFromState();
    render();
  }

  function snapshot() {
    return {
      currency: state.currency,
      USD: { ...state.USD },
      COP: { ...state.COP }
    };
  }

  function applySnapshot(data) {
    if (!data) return;
    if (data.USD) Object.assign(state.USD, data.USD);
    if (data.COP) Object.assign(state.COP, data.COP);
    if (data.currency === "USD" || data.currency === "COP") {
      setCurrency(data.currency);
    } else {
      syncFormFromState();
      render();
    }
  }

  tabUsd.addEventListener("click", () => setCurrency("USD"));
  tabCop.addEventListener("click", () => setCurrency("COP"));
  form.addEventListener("input", () => {
    syncStateFromForm();
    render();
  });

  document.getElementById("btn-guardar").addEventListener("click", () => {
    Norte.downloadSnapshot(FEATURE, snapshot());
  });
  Norte.bindFileInput(document.getElementById("file-input"), FEATURE, applySnapshot);
  document.getElementById("btn-cargar").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });
  Norte.enableDrop(document.body, FEATURE, applySnapshot);

  syncFormFromState();
  render();
})();
