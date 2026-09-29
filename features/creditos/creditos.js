(() => {
  const FEATURE = "creditos";
  const CURRENCY = "COP";
  const MONTH_NAMES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];

  function uid() {
    return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const state = {
    principal: 40000000,
    termValue: 5,
    termUnit: "years",
    insurance: 45000,
    actualPayment: 1018000,
    rate: 18,
    mode: "plazo",
    extras: [{ id: uid(), amount: 500000, month: 6, recur: "once" }],
    tab: "recopilado"
  };

  const fields = {
    principal: document.getElementById("principal"),
    term: document.getElementById("term"),
    insurance: document.getElementById("insurance"),
    actual: document.getElementById("actual"),
    rate: document.getElementById("rate")
  };

  function money(value) {
    return Norte.formatMoney(value, CURRENCY);
  }

  function totalMonths() {
    const value = Math.max(1, Math.round(state.termValue || 1));
    return state.termUnit === "months" ? value : value * 12;
  }

  function pmt(principal, annualRate, months) {
    const r = annualRate / 100 / 12;
    if (months <= 0) return 0;
    if (Math.abs(r) < 1e-10) return principal / months;
    const factor = (1 + r) ** months;
    return principal * r * factor / (factor - 1);
  }

  function impliedAnnualRate(principal, monthlyPmt, months) {
    if (principal <= 0 || months <= 0 || monthlyPmt <= 0) return 0;
    if (monthlyPmt <= principal / months + 0.01) return 0;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 80; i += 1) {
      const mid = (lo + hi) / 2;
      const calc = pmt(principal, mid * 12 * 100, months);
      if (calc > monthlyPmt) hi = mid;
      else lo = mid;
    }
    return ((lo + hi) / 2) * 12 * 100;
  }

  function workingRate() {
    const quota = Math.max(0, state.actualPayment - state.insurance);
    if (state.actualPayment > 0 && quota > 0) {
      return impliedAnnualRate(state.principal, quota, totalMonths());
    }
    return state.rate;
  }

  function extraAt(month) {
    return state.extras.reduce((sum, item) => {
      const amount = Number(item.amount) || 0;
      if (item.recur === "once" && Number(item.month) === month) return sum + amount;
      if (item.recur === "monthly" && month >= Number(item.month)) return sum + amount;
      return sum;
    }, 0);
  }

  function read() {
    state.principal = Number.parseFloat(fields.principal.value) || 0;
    state.termValue = Math.max(1, Math.round(Number.parseFloat(fields.term.value) || 1));
    state.insurance = Number.parseFloat(fields.insurance.value) || 0;
    state.actualPayment = Number.parseFloat(fields.actual.value) || 0;
    if (!(state.actualPayment > 0)) {
      state.rate = Number.parseFloat(fields.rate.value) || 0;
    }
  }

  function syncForm() {
    fields.principal.value = state.principal;
    fields.term.value = state.termValue;
    fields.insurance.value = state.insurance;
    fields.actual.value = state.actualPayment || "";
    const derived = workingRate();
    fields.rate.value = derived.toFixed(2);
    const locked = state.actualPayment > 0;
    fields.rate.readOnly = locked;
    document.getElementById("rate-hint").textContent = locked
      ? "Ajustada a la cuota + seguros que pusiste."
      : "Si no pones la cuota real, puedes escribir la tasa a mano.";
    document.getElementById("unit-months").classList.toggle("is-active", state.termUnit === "months");
    document.getElementById("unit-years").classList.toggle("is-active", state.termUnit === "years");
    document.getElementById("mode-plazo").classList.toggle("is-active", state.mode === "plazo");
    document.getElementById("mode-cuota").classList.toggle("is-active", state.mode === "cuota");
    document.getElementById("mode-hint").textContent = state.mode === "plazo"
      ? "La cuota se mantiene y el crédito termina antes."
      : "El plazo se mantiene y la cuota baja después de cada abono.";
  }

  function simulate(useExtra) {
    const months = totalMonths();
    const rate = workingRate();
    const r = rate / 100 / 12;
    const quota = Math.max(0, state.actualPayment - state.insurance);
    const base = state.actualPayment > 0
      ? quota
      : pmt(state.principal, rate, months);
    const rows = [];
    let balance = state.principal;
    let payment = base;
    const cap = useExtra && state.mode === "plazo" ? months * 3 : months;
    for (let m = 1; m <= cap && balance > 1; m += 1) {
      const interest = balance * r;
      const extra = useExtra ? extraAt(m) : 0;
      const scheduled = state.mode === "cuota" && useExtra ? payment : base;
      let capital = scheduled - interest + extra;
      if (capital > balance) capital = balance;
      if (capital < 0) capital = 0;
      balance = Math.max(0, balance - capital);
      rows.push({
        month: m,
        yearIndex: Math.ceil(m / 12),
        monthName: MONTH_NAMES[(m - 1) % 12],
        interest,
        capital,
        insurance: state.insurance,
        extra,
        payment: scheduled + state.insurance + extra,
        scheduled,
        balance
      });
      if (useExtra && state.mode === "cuota") {
        const left = months - m;
        if (left > 0 && balance > 1) payment = pmt(balance, rate, left);
      }
      if (!useExtra && m >= months) break;
    }
    return { base, rate, rows };
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

  function cell(text, cls) {
    const td = document.createElement("td");
    td.textContent = text;
    if (cls) td.className = cls;
    return td;
  }

  function renderExtras() {
    const box = document.getElementById("extra-rows");
    box.replaceChildren();
    if (!state.extras.length) {
      const p = document.createElement("p");
      p.className = "faint";
      p.textContent = "Sin abonos todavía. Añade uno único o uno que se repita cada mes.";
      box.appendChild(p);
      return;
    }
    state.extras.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "extra-row";
      const amount = document.createElement("input");
      amount.type = "number";
      amount.min = "0";
      amount.step = "any";
      amount.placeholder = "Monto";
      amount.value = item.amount || "";
      amount.addEventListener("input", () => {
        item.amount = Number.parseFloat(amount.value) || 0;
        render();
      });
      const month = document.createElement("input");
      month.type = "number";
      month.min = "1";
      month.step = "1";
      month.title = "Mes";
      month.value = item.month || 1;
      month.addEventListener("input", () => {
        item.month = Math.max(1, Math.round(Number.parseFloat(month.value) || 1));
        render();
      });
      const select = document.createElement("select");
      [["once", "Solo ese mes"], ["monthly", "Cada mes desde ahí"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        if (item.recur === value) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", () => {
        item.recur = select.value;
        render();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn";
      remove.setAttribute("aria-label", "Eliminar");
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        state.extras.splice(index, 1);
        renderExtras();
        render();
      });
      row.append(amount, month, select, remove);
      box.appendChild(row);
    });
  }

  function setTab(tab) {
    state.tab = tab;
    document.getElementById("panel-recopilado").hidden = tab !== "recopilado";
    document.getElementById("panel-meses").hidden = tab !== "meses";
    document.getElementById("panel-anos").hidden = tab !== "anos";
    document.querySelectorAll(".credit-tabs [data-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tab === tab);
    });
  }

  function renderTables(original, boosted) {
    const monthBody = document.getElementById("month-body");
    const yearBody = document.getElementById("year-body");
    monthBody.replaceChildren();
    yearBody.replaceChildren();
    const origByMonth = new Map(original.rows.map((row) => [row.month, row]));
    const maxLen = Math.max(original.rows.length, boosted.rows.length);
    const yearMap = {};

    for (let i = 0; i < maxLen; i += 1) {
      const withExtra = boosted.rows[i];
      const plain = origByMonth.get(i + 1) || original.rows[i];
      if (!withExtra && !plain) continue;
      const row = withExtra || plain;
      const tr = document.createElement("tr");
      tr.append(
        cell(`${row.month} · ${row.monthName}`),
        cell(money((withExtra || row).interest)),
        cell(money((withExtra || row).capital)),
        cell(money((withExtra || row).insurance)),
        cell(money((withExtra || row).extra)),
        cell(money((withExtra || row).payment)),
        cell(money((withExtra || row).balance)),
        cell(plain ? money(plain.balance) : "—")
      );
      monthBody.appendChild(tr);

      const year = row.yearIndex;
      if (!yearMap[year]) {
        yearMap[year] = {
          year,
          interest: 0,
          capital: 0,
          extra: 0,
          insurance: 0,
          payment: 0,
          balance: 0,
          plainInterest: 0,
          plainBalance: 0
        };
      }
      const bucket = yearMap[year];
      const src = withExtra || row;
      bucket.interest += src.interest;
      bucket.capital += src.capital;
      bucket.extra += src.extra;
      bucket.insurance += src.insurance;
      bucket.payment += src.payment;
      bucket.balance = src.balance;
      if (plain) {
        bucket.plainInterest += plain.interest;
        bucket.plainBalance = plain.balance;
      }
    }

    Object.values(yearMap).forEach((bucket) => {
      const tr = document.createElement("tr");
      tr.append(
        cell(`Año ${bucket.year}`),
        cell(money(bucket.interest)),
        cell(money(bucket.capital)),
        cell(money(bucket.extra)),
        cell(money(bucket.insurance)),
        cell(money(bucket.payment)),
        cell(money(bucket.balance)),
        cell(money(bucket.plainInterest)),
        cell(money(bucket.plainBalance))
      );
      yearBody.appendChild(tr);
    });
  }

  function render() {
    syncForm();
    const original = simulate(false);
    const boosted = simulate(true);
    const rate = original.rate;
    const origPay = original.base + state.insurance;
    const origMonths = original.rows.length;
    const boostMonths = boosted.rows.length;
    const origInterest = sum(original.rows, "interest");
    const boostInterest = sum(boosted.rows, "interest");
    const lastBoostPay = boosted.rows.length ? boosted.rows.at(-1).payment : origPay;

    document.getElementById("metrics").replaceChildren(
      metric("Cuota + seguros", money(origPay), `Tasa ${Norte.formatPct(rate)} · ${totalMonths()} meses`),
      metric(
        state.mode === "plazo" ? "Tiempo con abonos" : "Cuota con abonos",
        state.mode === "plazo"
          ? `${boostMonths} meses`
          : money(lastBoostPay),
        state.mode === "plazo"
          ? `Ahorras ${Math.max(0, origMonths - boostMonths)} meses`
          : "La cuota baja después de cada abono"
      ),
      metric("Intereses sin abonos", money(origInterest), `Total pagado ${money(sum(original.rows, "payment"))}`),
      metric(
        "Intereses con abonos",
        money(boostInterest),
        `Ahorras ${money(Math.max(0, origInterest - boostInterest))} en intereses`,
        "positive"
      )
    );

    const origPts = sample([{ month: 0, year: 0, balance: state.principal }, ...original.rows.map((row) => ({ ...row, year: row.month / 12 }))]);
    const boostPts = sample([{ month: 0, year: 0, balance: state.principal }, ...boosted.rows.map((row) => ({ ...row, year: row.month / 12 }))]);
    NorteCharts.lineChart(document.getElementById("balance-chart"), [
      { name: "Sin abonos", color: "#c98970", points: origPts.map((row) => ({ x: row.year, y: row.balance })) },
      { name: "Con abonos", color: "#9cbaa4", points: boostPts.map((row) => ({ x: row.year, y: row.balance })) }
    ], {
      formatY: (value) => Norte.formatCompact(value, CURRENCY),
      formatX: (value) => {
        const years = Math.round(value);
        if (years === 0) return "Inicio";
        return `${years} ${years === 1 ? "Año" : "Años"}`;
      }
    });

    const yearly = [];
    boosted.rows.forEach((row) => {
      if (!yearly[row.yearIndex]) yearly[row.yearIndex] = { year: row.yearIndex, interest: 0, capital: 0 };
      yearly[row.yearIndex].interest += row.interest;
      yearly[row.yearIndex].capital += row.capital;
    });
    const yearRows = yearly.filter(Boolean);
    if (yearRows.length) {
      NorteCharts.lineChart(document.getElementById("mix-chart"), [
        { name: "Intereses", color: "#c98970", points: yearRows.map((row) => ({ x: row.year, y: row.interest })) },
        { name: "Capital", color: "#d4c4a0", points: yearRows.map((row) => ({ x: row.year, y: row.capital })) }
      ], {
        formatY: (value) => Norte.formatCompact(value, CURRENCY),
        formatX: (value) => `${Math.round(value)} ${Math.round(value) === 1 ? "Año" : "Años"}`
      });
    }

    renderTables(original, boosted);
    setTab(state.tab);
  }

  function applySnapshot(data) {
    if (!data) return;
    state.principal = Number(data.principal) || 0;
    state.insurance = Number(data.insurance) || 0;
    state.actualPayment = Number(data.actualPayment) || 0;
    state.rate = Number(data.rate) || 0;
    state.mode = data.mode === "cuota" ? "cuota" : "plazo";
    if (data.termValue) {
      state.termValue = Number(data.termValue) || 1;
      state.termUnit = data.termUnit === "months" ? "months" : "years";
    } else if (data.years) {
      state.termValue = Number(data.years) || 1;
      state.termUnit = "years";
    }
    if (Array.isArray(data.extras)) {
      state.extras = data.extras.map((item) => ({
        id: item.id || uid(),
        amount: Number(item.amount) || 0,
        month: Number(item.month) || 1,
        recur: item.recur === "monthly" ? "monthly" : "once"
      }));
    } else if (data.extra) {
      state.extras = [{
        id: uid(),
        amount: Number(data.extra) || 0,
        month: Number(data.extraFrom) || 1,
        recur: "monthly"
      }];
    }
    renderExtras();
    render();
  }

  document.getElementById("loan-form").addEventListener("input", () => {
    read();
    render();
  });
  document.getElementById("unit-months").addEventListener("click", () => {
    if (state.termUnit !== "months") {
      state.termValue = totalMonths();
      state.termUnit = "months";
    }
    render();
  });
  document.getElementById("unit-years").addEventListener("click", () => {
    if (state.termUnit !== "years") {
      state.termValue = Math.max(1, Math.round(totalMonths() / 12));
      state.termUnit = "years";
    }
    render();
  });
  document.getElementById("mode-plazo").addEventListener("click", () => {
    state.mode = "plazo";
    render();
  });
  document.getElementById("mode-cuota").addEventListener("click", () => {
    state.mode = "cuota";
    render();
  });
  document.getElementById("add-extra").addEventListener("click", () => {
    state.extras.push({ id: uid(), amount: 0, month: 1, recur: "once" });
    renderExtras();
  });
  document.querySelectorAll(".credit-tabs [data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  document.getElementById("btn-guardar").addEventListener("click", () => {
    read();
    Norte.downloadSnapshot(FEATURE, {
      principal: state.principal,
      termValue: state.termValue,
      termUnit: state.termUnit,
      insurance: state.insurance,
      actualPayment: state.actualPayment,
      rate: workingRate(),
      mode: state.mode,
      extras: state.extras.map((item) => ({ ...item }))
    });
  });
  Norte.bindFileInput(document.getElementById("file-input"), FEATURE, applySnapshot);
  document.getElementById("btn-cargar").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });
  Norte.enableDrop(document.body, FEATURE, applySnapshot);

  renderExtras();
  render();
})();
