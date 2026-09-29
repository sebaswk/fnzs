(() => {
  const FEATURE = "creditos";
  const CURRENCY = "COP";
  const state = {
    principal: 40000000,
    rate: 18,
    years: 5,
    insurance: 45000,
    extra: 200000,
    extraFrom: 1,
    mode: "plazo"
  };

  const fields = {
    principal: document.getElementById("principal"),
    rate: document.getElementById("rate"),
    years: document.getElementById("years"),
    insurance: document.getElementById("insurance"),
    extra: document.getElementById("extra"),
    extraFrom: document.getElementById("extra-from")
  };

  function money(value) {
    return Norte.formatMoney(value, CURRENCY);
  }

  function read() {
    state.principal = Number.parseFloat(fields.principal.value) || 0;
    state.rate = Number.parseFloat(fields.rate.value) || 0;
    state.years = Math.max(1, Math.round(Number.parseFloat(fields.years.value) || 1));
    state.insurance = Number.parseFloat(fields.insurance.value) || 0;
    state.extra = Number.parseFloat(fields.extra.value) || 0;
    state.extraFrom = Math.max(1, Math.round(Number.parseFloat(fields.extraFrom.value) || 1));
  }

  function syncForm() {
    Object.keys(fields).forEach((key) => {
      fields[key].value = state[key];
    });
    document.getElementById("mode-plazo").classList.toggle("is-active", state.mode === "plazo");
    document.getElementById("mode-cuota").classList.toggle("is-active", state.mode === "cuota");
    document.getElementById("mode-hint").textContent = state.mode === "plazo"
      ? "La cuota se mantiene y el crédito termina antes."
      : "El plazo se mantiene y la cuota baja después de cada abono.";
  }

  function pmt(principal, annualRate, months) {
    const r = annualRate / 100 / 12;
    if (months <= 0) return 0;
    if (Math.abs(r) < 1e-10) return principal / months;
    const factor = (1 + r) ** months;
    return principal * r * factor / (factor - 1);
  }

  function simulate(useExtra) {
    const months = state.years * 12;
    const r = state.rate / 100 / 12;
    const base = pmt(state.principal, state.rate, months);
    const rows = [];
    let balance = state.principal;
    let payment = base;
    const cap = useExtra && state.mode === "plazo" ? months * 3 : months;
    for (let m = 1; m <= cap && balance > 1; m += 1) {
      const interest = balance * r;
      const extra = useExtra && m >= state.extraFrom ? state.extra : 0;
      const scheduled = state.mode === "cuota" && useExtra ? payment : base;
      let capital = scheduled - interest + extra;
      if (capital > balance) capital = balance;
      if (capital < 0) capital = 0;
      balance = Math.max(0, balance - capital);
      const totalPay = scheduled + state.insurance + extra;
      rows.push({
        month: m,
        year: m / 12,
        interest,
        capital,
        insurance: state.insurance,
        extra,
        payment: totalPay,
        balance
      });
      if (useExtra && state.mode === "cuota") {
        const left = months - m;
        if (left > 0 && balance > 1) payment = pmt(balance, state.rate, left);
      }
      if (!useExtra && m >= months) break;
    }
    return { base, rows };
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

  function sum(rows, key) {
    return rows.reduce((acc, row) => acc + row[key], 0);
  }

  function sample(rows) {
    if (rows.length <= 80) return rows;
    const step = Math.ceil(rows.length / 80);
    return rows.filter((row, index) => index % step === 0 || index === rows.length - 1);
  }

  function render() {
    const original = simulate(false);
    const boosted = simulate(true);
    const origPay = original.base + state.insurance;
    const lastBoost = boosted.rows.at(-1);
    const lastOrig = original.rows.at(-1);
    const origMonths = original.rows.length;
    const boostMonths = boosted.rows.length;
    const origInterest = sum(original.rows, "interest");
    const boostInterest = sum(boosted.rows, "interest");
    const firstBoostPay = (boosted.rows[0] && boosted.rows[0].payment) || origPay;
    const lastBoostPay = (lastBoost && lastBoost.payment) || origPay;

    const metrics = document.getElementById("metrics");
    metrics.replaceChildren(
      metric("Cuota + seguros", money(origPay), `Cuota ${money(original.base)} · seguros ${money(state.insurance)}`),
      metric(
        state.mode === "plazo" ? "Tiempo con abonos" : "Cuota con abonos",
        state.mode === "plazo"
          ? `${Math.ceil(boostMonths / 12)} años · ${boostMonths} meses`
          : money(lastBoostPay),
        state.mode === "plazo"
          ? `Ahorras ${Math.max(0, origMonths - boostMonths)} meses`
          : `Empieza en ${money(firstBoostPay)}`
      ),
      metric("Intereses sin abonos", money(origInterest), `Total pagado ${money(sum(original.rows, "payment"))}`),
      metric(
        "Intereses con abonos",
        money(boostInterest),
        `Ahorras ${money(Math.max(0, origInterest - boostInterest))} en intereses`,
        "positive"
      )
    );

    const origPts = sample([{ month: 0, year: 0, balance: state.principal }, ...original.rows]);
    const boostPts = sample([{ month: 0, year: 0, balance: state.principal }, ...boosted.rows]);
    NorteCharts.lineChart(document.getElementById("balance-chart"), [
      { name: "Sin abonos", color: "#c98970", points: origPts.map((row) => ({ x: row.year, y: row.balance })) },
      { name: "Con abonos", color: "#9cbaa4", points: boostPts.map((row) => ({ x: row.year, y: row.balance })) }
    ], {
      formatY: (value) => Norte.formatCompact(value, CURRENCY),
      formatX: (value) => {
        const years = Math.round(value);
        return `${years} ${years === 1 ? "Año" : "Años"}`;
      }
    });

    const yearly = [];
    boosted.rows.forEach((row) => {
      const year = Math.ceil(row.month / 12);
      if (!yearly[year]) yearly[year] = { year, interest: 0, capital: 0 };
      yearly[year].interest += row.interest;
      yearly[year].capital += row.capital;
    });
    const yearRows = yearly.filter(Boolean);
    if (yearRows.length) {
      NorteCharts.lineChart(document.getElementById("mix-chart"), [
        { name: "Intereses", color: "#c98970", points: yearRows.map((row) => ({ x: row.year, y: row.interest })) },
        { name: "Capital", color: "#d4c4a0", points: yearRows.map((row) => ({ x: row.year, y: row.capital })) }
      ], {
        formatY: (value) => Norte.formatCompact(value, CURRENCY),
        formatX: (value) => {
          const years = Math.round(value);
          return `${years} ${years === 1 ? "Año" : "Años"}`;
        }
      });
    }
  }

  function applySnapshot(data) {
    if (!data) return;
    Object.assign(state, data);
    syncForm();
    render();
  }

  document.getElementById("loan-form").addEventListener("input", () => { read(); render(); });
  document.getElementById("extra-form").addEventListener("input", () => { read(); render(); });
  document.getElementById("mode-plazo").addEventListener("click", () => {
    state.mode = "plazo";
    syncForm();
    render();
  });
  document.getElementById("mode-cuota").addEventListener("click", () => {
    state.mode = "cuota";
    syncForm();
    render();
  });
  document.getElementById("btn-guardar").addEventListener("click", () => {
    read();
    Norte.downloadSnapshot(FEATURE, { ...state });
  });
  Norte.bindFileInput(document.getElementById("file-input"), FEATURE, applySnapshot);
  document.getElementById("btn-cargar").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });
  Norte.enableDrop(document.body, FEATURE, applySnapshot);

  syncForm();
  render();
})();
