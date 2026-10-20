(() => {
  const FEATURE = "creditos";
  const CURRENCY = "COP";

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

  function duration(months) {
    const total = Math.max(0, Math.round(months));
    const years = Math.floor(total / 12);
    const rest = total % 12;
    const y = years ? `${years} ${years === 1 ? "año" : "años"}` : "";
    const m = rest ? `${rest} ${rest === 1 ? "mes" : "meses"}` : "";
    if (y && m) return `${y} y ${m}`;
    return y || m || "0 meses";
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
      ? "Calculada con lo que pagas cada mes. Borra ese valor si prefieres escribir la tasa."
      : "Si no sabes tu pago mensual, escribe aquí la tasa.";
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

  function metric(label, value, sub, extraClass, hero) {
    const article = document.createElement("article");
    article.className = `metric${hero ? " is-hero" : ""}`;
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

  function cell(text, cls) {
    const td = document.createElement("td");
    td.textContent = text;
    if (cls) td.className = cls;
    return td;
  }

  function extraHintText(item) {
    const amount = money(Number(item.amount) || 0);
    const month = Math.max(1, Number(item.month) || 1);
    return item.recur === "monthly"
      ? `Abonas ${amount} cada mes, desde la cuota ${month}.`
      : `Abonas ${amount} una sola vez, en la cuota ${month}.`;
  }

  function monthChoices(selected) {
    const chosen = Math.max(1, Number(selected) || 1);
    const maxMonth = Math.max(totalMonths(), chosen, 12);
    const options = [];
    for (let month = 1; month <= maxMonth; month += 1) {
      options.push({ value: String(month), label: String(month) });
    }
    return { chosen: String(chosen), options };
  }

  function fillMonthSelect(select, selected) {
    const { chosen, options } = monthChoices(selected);
    if (select.setOptions) {
      select.setOptions(options, chosen);
      return;
    }
    select.replaceChildren();
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === chosen) option.selected = true;
      select.appendChild(option);
    });
  }

  function refreshExtraMonths() {
    document.querySelectorAll(".extra-month").forEach((select) => {
      const item = state.extras.find((row) => row.id === select.dataset.id);
      if (item) fillMonthSelect(select, item.month);
    });
  }

  function renderExtras() {
    const box = document.getElementById("extra-rows");
    box.replaceChildren();
    if (!state.extras.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = "Aún no tienes abonos. Añade uno para ver cuánto te ahorras.";
      box.appendChild(p);
      return;
    }
    state.extras.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "extra-card";

      const head = document.createElement("div");
      head.className = "extra-card-head";
      const title = document.createElement("strong");
      title.textContent = `Abono ${index + 1}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-btn";
      remove.textContent = "×";
      remove.title = "Quitar este abono";
      remove.setAttribute("aria-label", `Quitar abono ${index + 1}`);
      remove.addEventListener("click", () => {
        state.extras.splice(index, 1);
        renderExtras();
        render();
      });
      head.append(title, remove);

      const amountField = document.createElement("div");
      amountField.className = "field";
      const amountLabel = document.createElement("label");
      amountLabel.setAttribute("for", `extra-amount-${item.id}`);
      amountLabel.textContent = "Cuánto abonas";
      const suffix = document.createElement("div");
      suffix.className = "input-suffix";
      const amount = document.createElement("input");
      amount.id = `extra-amount-${item.id}`;
      amount.className = "extra-amount";
      amount.type = "number";
      amount.min = "0";
      amount.step = "any";
      amount.placeholder = "0";
      amount.inputMode = "decimal";
      amount.value = item.amount || "";
      const currency = document.createElement("em");
      currency.textContent = "COP";
      amount.addEventListener("input", () => {
        item.amount = Number.parseFloat(amount.value) || 0;
        hint.textContent = extraHintText(item);
        render();
      });
      suffix.append(amount, currency);
      amountField.append(amountLabel, suffix);

      const whenField = document.createElement("div");
      whenField.className = "field";
      const whenLabel = document.createElement("label");
      whenLabel.setAttribute("for", `extra-month-${item.id}`);
      whenLabel.textContent = "En la cuota n.º";
      const monthChoicesNow = monthChoices(item.month || 1);
      const month = Norte.menuSelect(monthChoicesNow.chosen, monthChoicesNow.options, (value) => {
        item.month = Number.parseInt(value, 10) || 1;
        hint.textContent = extraHintText(item);
        render();
      });
      month.id = `extra-month-${item.id}`;
      month.classList.add("extra-month");
      month.dataset.id = item.id;
      whenField.append(whenLabel, month);

      const pair = document.createElement("div");
      pair.className = "extra-pair";
      pair.append(amountField, whenField);

      const howField = document.createElement("div");
      howField.className = "field";
      const howLabel = document.createElement("span");
      howLabel.className = "field-label";
      howLabel.textContent = "Cada cuánto";
      const tabs = document.createElement("div");
      tabs.className = "tabs tabs-block";
      tabs.setAttribute("role", "tablist");
      const onceBtn = document.createElement("button");
      onceBtn.type = "button";
      onceBtn.textContent = "Solo una vez";
      const monthlyBtn = document.createElement("button");
      monthlyBtn.type = "button";
      monthlyBtn.textContent = "Todos los meses";
      function syncRecurTabs() {
        onceBtn.classList.toggle("is-active", item.recur !== "monthly");
        monthlyBtn.classList.toggle("is-active", item.recur === "monthly");
      }
      onceBtn.addEventListener("click", () => {
        item.recur = "once";
        syncRecurTabs();
        hint.textContent = extraHintText(item);
        render();
      });
      monthlyBtn.addEventListener("click", () => {
        item.recur = "monthly";
        syncRecurTabs();
        hint.textContent = extraHintText(item);
        render();
      });
      syncRecurTabs();
      tabs.append(onceBtn, monthlyBtn);
      howField.append(howLabel, tabs);

      const hint = document.createElement("p");
      hint.className = "extra-hint";
      hint.textContent = extraHintText(item);

      card.append(head, pair, howField, hint);
      box.appendChild(card);
    });
  }

  const TAB_DESC = {
    recopilado: "Lo más importante de tu crédito, con y sin abonos.",
    meses: "El detalle de cada cuota: cuánto es interés, cuánto baja la deuda.",
    anos: "Los totales de cada año del crédito."
  };

  function setTab(tab) {
    state.tab = tab;
    document.getElementById("tab-desc").textContent = TAB_DESC[tab] || "";
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
    const plan = boosted.rows.length ? boosted.rows : original.rows;
    const yearMap = {};

    plan.forEach((withExtra) => {
      const plain = origByMonth.get(withExtra.month);
      const row = withExtra;
      const tr = document.createElement("tr");
      tr.append(
        cell(String(row.month)),
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
    });

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

    const savedMonths = Math.max(0, origMonths - boostMonths);
    const savedInterest = Math.max(0, origInterest - boostInterest);
    document.getElementById("metrics").replaceChildren(
      metric("Pagas cada mes", money(origPay), `Con seguros incluidos · tasa ${Norte.formatPct(rate)} anual · plazo de ${duration(totalMonths())}`, "", true),
      state.mode === "plazo"
        ? metric(
          "Con abonos terminas en",
          duration(boostMonths),
          savedMonths ? `${duration(savedMonths)} antes que sin abonos.` : "Añade abonos para terminar antes."
        )
        : metric("Tu cuota al final", money(lastBoostPay), "Baja un poco después de cada abono."),
      metric("Intereses sin abonos", money(origInterest), `En total pagarías ${money(sum(original.rows, "payment"))}.`),
      metric(
        "Intereses con abonos",
        money(boostInterest),
        savedInterest ? `Te ahorras ${money(savedInterest)} en intereses.` : "Igual que sin abonos.",
        "positive"
      )
    );

    const compact = (value) => `$${Norte.formatCompact(value, CURRENCY)}`;
    const toPoints = (rows) => [{ x: 0, y: state.principal }, ...rows.map((row) => ({ x: row.month, y: row.balance }))];
    NorteCharts.area(document.getElementById("balance-chart"), {
      series: [
        { name: "Sin abonos", color: "#f07d6e", points: toPoints(original.rows), fillOpacity: 0.16 },
        { name: "Con abonos", color: "#3fd49a", points: toPoints(boosted.rows), fillOpacity: 0.24, afterEnd: "Ya pagado" }
      ],
      formatY: money,
      formatAxis: compact,
      formatX: (month) => {
        if (month === 0) return "Hoy";
        return month % 12 === 0 ? `Año ${month / 12}` : `Mes ${month}`;
      },
      xTicks: (min, max, innerW) => {
        const ticks = [];
        let step;
        if (max <= 24) step = max <= 12 ? 3 : 6;
        else {
          const room = Math.max(2, Math.floor(innerW / 80));
          const raw = max / 12 / room;
          step = ([1, 2, 3, 5, 10].find((n) => n >= raw) || 10) * 12;
        }
        for (let m = 0; m <= max; m += step) ticks.push(m);
        return ticks;
      },
      tipTitle: (month) => (month === 0 ? "Hoy" : `Cuota ${month} · año ${Math.ceil(month / 12)}`),
      empty: "Escribe el valor del crédito para ver la gráfica."
    });

    const yearly = [];
    boosted.rows.forEach((row) => {
      if (!yearly[row.yearIndex]) yearly[row.yearIndex] = { year: row.yearIndex, interest: 0, capital: 0, insurance: 0 };
      yearly[row.yearIndex].interest += row.interest;
      yearly[row.yearIndex].capital += row.capital;
      yearly[row.yearIndex].insurance += row.insurance;
    });
    const yearRows = yearly.filter(Boolean);
    NorteCharts.columns(document.getElementById("mix-chart"), {
      labels: yearRows.map((row) => `Año ${row.year}`),
      series: [
        { name: "Baja la deuda", color: "#3fd49a", values: yearRows.map((row) => row.capital), stack: "pago" },
        { name: "Intereses", color: "#f07d6e", values: yearRows.map((row) => row.interest), stack: "pago" },
        { name: "Seguros", color: "#f3b65b", values: yearRows.map((row) => row.insurance), stack: "pago" }
      ],
      format: money,
      formatAxis: compact,
      tipExtra: (i) => [{ name: "Pagaste en el año", value: money(yearRows[i].capital + yearRows[i].interest + yearRows[i].insurance), total: true }],
      empty: "Escribe el valor del crédito para ver la gráfica."
    });

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

  document.getElementById("loan-form").addEventListener("input", (event) => {
    read();
    if (event.target.id === "term") refreshExtraMonths();
    render();
  });
  document.getElementById("unit-months").addEventListener("click", () => {
    if (state.termUnit !== "months") {
      state.termValue = totalMonths();
      state.termUnit = "months";
    }
    refreshExtraMonths();
    render();
  });
  document.getElementById("unit-years").addEventListener("click", () => {
    if (state.termUnit !== "years") {
      state.termValue = Math.max(1, Math.round(totalMonths() / 12));
      state.termUnit = "years";
    }
    refreshExtraMonths();
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
    render();
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
