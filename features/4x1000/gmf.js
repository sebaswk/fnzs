(() => {
  const FEATURE = "4x1000";
  const CURRENCY = "COP";
  const RATE = 0.004;
  const DEFAULT_CAP = 18331000;
  const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const QUICK = [50000, 100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000, 20000000, 50000000, 100000000];

  const state = {
    amount: 1000000,
    base: "send",
    monthly: 3000000,
    exempt: false,
    cap: DEFAULT_CAP,
    tab: "recopilado"
  };

  const fields = {
    amount: document.getElementById("amount"),
    monthly: document.getElementById("monthly"),
    cap: document.getElementById("cap")
  };

  const TAB_DESC = {
    recopilado: "Lo que pagas por tu movimiento, en el mes y en el año.",
    tabla: "El 4x1000 de valores comunes, listo para consultar."
  };

  function money(value) {
    return Norte.formatMoney(value, CURRENCY);
  }

  function tax(value) {
    return Math.round(Math.max(0, value) * RATE);
  }

  function fromBalance(balance) {
    const total = Math.max(0, balance);
    let out = Math.floor(total / (1 + RATE));
    while (out > 0 && out + tax(out) > total) out -= 1;
    while (out + 1 + tax(out + 1) <= total) out += 1;
    return { out, tax: total - out };
  }

  function monthTax(monthly, exempt) {
    const total = Math.max(0, monthly);
    const taxable = exempt ? Math.max(0, total - Math.max(0, state.cap)) : total;
    return { taxable, tax: tax(taxable) };
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

  function cell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  function read() {
    state.amount = Math.max(0, Number.parseFloat(fields.amount.value) || 0);
    state.monthly = Math.max(0, Number.parseFloat(fields.monthly.value) || 0);
    state.cap = Math.max(0, Number.parseFloat(fields.cap.value) || 0);
  }

  function syncForm() {
    fields.amount.value = state.amount || "";
    fields.monthly.value = state.monthly || "";
    fields.cap.value = state.cap || "";
    const send = state.base === "send";
    document.getElementById("base-send").classList.toggle("is-active", send);
    document.getElementById("base-balance").classList.toggle("is-active", !send);
    document.getElementById("base-hint").textContent = send
      ? "El impuesto se cobra aparte, encima de lo que envías."
      : "Te decimos cuánto puedes sacar para que el impuesto también alcance.";
    document.getElementById("exempt-no").classList.toggle("is-active", !state.exempt);
    document.getElementById("exempt-yes").classList.toggle("is-active", state.exempt);
    document.getElementById("exempt-hint").textContent = state.exempt
      ? "Lo que sale de esa cuenta no paga 4x1000 hasta el tope del mes."
      : "Puedes marcar una sola cuenta de ahorros como exenta en tu banco.";
    document.getElementById("cap-field").hidden = !state.exempt;
  }

  function renderMetrics() {
    const list = [];
    if (state.base === "send") {
      const fee = tax(state.amount);
      list.push(metric(
        "El 4x1000 de este movimiento",
        money(fee),
        `Por enviar ${money(state.amount)} te descuentan ${money(state.amount + fee)} en total.`,
        "",
        true
      ));
    } else {
      const { out, tax: fee } = fromBalance(state.amount);
      list.push(metric(
        "Puedes sacar",
        money(out),
        `De tu saldo de ${money(state.amount)}, ${money(fee)} se van en 4x1000.`,
        "",
        true
      ));
    }

    const plain = monthTax(state.monthly, false);
    const relief = monthTax(state.monthly, true);
    const mine = state.exempt ? relief : plain;
    let monthSub = `Es el 0,4% de ${money(state.monthly)}.`;
    if (state.exempt) {
      monthSub = mine.taxable > 0
        ? `Pagas sobre ${money(mine.taxable)}, lo que pasa del tope exento.`
        : "Todo lo que mueves está dentro del tope exento.";
    }
    const yearTax = mine.tax * 12;
    list.push(metric("4x1000 al mes", money(mine.tax), monthSub, "negative"));
    list.push(metric(
      "4x1000 al año",
      money(yearTax),
      yearTax > 0 ? `Si cada mes mueves lo mismo. La mitad, ${money(yearTax / 2)}, es deducible en la renta.` : "Si cada mes mueves lo mismo.",
      "negative"
    ));

    const saving = (plain.tax - relief.tax) * 12;
    if (state.exempt) {
      list.push(metric(
        "Te ahorras con la cuenta exenta",
        money(saving),
        "Al año, frente a no tenerla.",
        "positive"
      ));
    } else {
      list.push(metric(
        "Con una cuenta exenta pagarías",
        money(relief.tax * 12),
        saving > 0 ? `Al año. Te ahorrarías ${money(saving)}.` : "Al año. Lo mismo que ahora.",
        "positive"
      ));
    }
    document.getElementById("metrics").replaceChildren(...list);
  }

  function renderMoveChart() {
    const send = state.base === "send";
    const title = document.getElementById("move-title");
    const desc = document.getElementById("move-desc");
    let slices;
    let totalLabel;
    if (send) {
      const fee = tax(state.amount);
      title.textContent = "A dónde va tu dinero";
      desc.textContent = "Lo que envías y lo que se queda el impuesto.";
      slices = [
        { label: "Lo que envías", value: state.amount, color: "#3fd49a" },
        { label: "4x1000", value: fee, color: "#f07d6e" }
      ];
      totalLabel = "Te descuentan";
    } else {
      const { out, tax: fee } = fromBalance(state.amount);
      title.textContent = "Cómo se reparte tu saldo";
      desc.textContent = "Lo que puedes sacar y lo que se va en impuesto.";
      slices = [
        { label: "Puedes sacar", value: out, color: "#3fd49a" },
        { label: "4x1000", value: fee, color: "#f07d6e" }
      ];
      totalLabel = "Tu saldo";
    }
    NorteCharts.breakdown(document.getElementById("move-chart"), slices, {
      format: money,
      totalLabel,
      sort: false,
      empty: "Escribe un valor para ver cuánto es el impuesto."
    });
  }

  function renderYearChart() {
    const plain = monthTax(state.monthly, false).tax;
    const relief = monthTax(state.monthly, true).tax;
    const compact = (value) => `$${Norte.formatCompact(value, CURRENCY)}`;
    NorteCharts.columns(document.getElementById("year-chart"), {
      labels: MONTHS,
      series: [
        { name: "Sin cuenta exenta", color: "#f07d6e", values: MONTHS.map((_, i) => plain * (i + 1)) },
        { name: "Con cuenta exenta", color: "#3fd49a", values: MONTHS.map((_, i) => relief * (i + 1)) }
      ],
      format: money,
      formatAxis: compact,
      empty: "Escribe lo que sale de tus cuentas al mes para ver la gráfica."
    });
  }

  function renderTable() {
    const body = document.getElementById("quick-body");
    body.replaceChildren();
    QUICK.forEach((value) => {
      const tr = document.createElement("tr");
      tr.append(
        cell(money(value)),
        cell(money(tax(value))),
        cell(money(value + tax(value))),
        cell(money(fromBalance(value).out))
      );
      body.appendChild(tr);
    });
  }

  function setTab(tab) {
    state.tab = tab;
    document.getElementById("tab-desc").textContent = TAB_DESC[tab] || "";
    document.getElementById("panel-recopilado").hidden = tab !== "recopilado";
    document.getElementById("panel-tabla").hidden = tab !== "tabla";
    document.querySelectorAll(".gmf-tabs [data-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tab === tab);
    });
  }

  function render() {
    syncForm();
    renderMetrics();
    renderMoveChart();
    renderYearChart();
    setTab(state.tab);
  }

  function applySnapshot(data) {
    if (!data) return;
    state.amount = Math.max(0, Number(data.amount) || 0);
    state.base = data.base === "balance" ? "balance" : "send";
    state.monthly = Math.max(0, Number(data.monthly) || 0);
    state.exempt = Boolean(data.exempt);
    state.cap = data.cap === undefined ? DEFAULT_CAP : Math.max(0, Number(data.cap) || 0);
    render();
  }

  ["move-form", "month-form"].forEach((id) => {
    const form = document.getElementById(id);
    form.addEventListener("input", () => {
      read();
      renderMetrics();
      renderMoveChart();
      renderYearChart();
    });
    form.addEventListener("submit", (event) => event.preventDefault());
  });
  document.getElementById("base-send").addEventListener("click", () => {
    state.base = "send";
    render();
  });
  document.getElementById("base-balance").addEventListener("click", () => {
    state.base = "balance";
    render();
  });
  document.getElementById("exempt-no").addEventListener("click", () => {
    state.exempt = false;
    render();
  });
  document.getElementById("exempt-yes").addEventListener("click", () => {
    state.exempt = true;
    render();
  });
  document.querySelectorAll(".gmf-tabs [data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  document.getElementById("btn-guardar").addEventListener("click", () => {
    read();
    Norte.downloadSnapshot(FEATURE, {
      amount: state.amount,
      base: state.base,
      monthly: state.monthly,
      exempt: state.exempt,
      cap: state.cap
    });
  });
  Norte.bindFileInput(document.getElementById("file-input"), FEATURE, applySnapshot);
  document.getElementById("btn-cargar").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });
  Norte.enableDrop(document.body, FEATURE, applySnapshot);

  renderTable();
  render();
})();
