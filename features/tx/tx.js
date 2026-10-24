(() => {
  "use strict";

  const FEATURE = "tx";
  const cloud = window.TxCloud || null;
  const STORE_KEY = "norte-tx";
  const CURRENCY = "COP";
  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const TAB_DESC = {
    resumen: "Anota lo de hoy y mira cómo va el mes.",
    movimientos: "Los ingresos de cada día y los egresos del mes.",
    recurrentes: "Gastos que se repiten cada año o cada mes.",
    facturas: "El detalle del mes o del año, listo para imprimir."
  };
  const TABS = Object.keys(TAB_DESC);
  const COLORS = { income: "#3fd49a", expense: "#f07d6e" };
  const SOURCE_COLORS = ["#3fd49a", "#4cc3e6", "#b4dc6a", "#a68cf7", "#f3b65b", "#ec8ec0"];

  const money = (value) => Norte.formatMoney(Number(value) || 0, CURRENCY);
  const compact = (value) => Norte.formatCompact(Number(value) || 0, CURRENCY);
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  // ---------- Fechas ----------

  function today() {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  }

  const daysIn = (y, m) => new Date(y, m, 0).getDate();
  const weekdayOf = (y, m, d, style) =>
    new Date(y, m - 1, d).toLocaleDateString("es-CO", { weekday: style || "long" });
  const clampDay = (y, m, d) => {
    const n = Math.round(Number(d));
    return Math.min(Math.max(1, Number.isFinite(n) ? n : 1), daysIn(y, m));
  };

  function parseAmount(raw) {
    const n = Number(String(raw).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // ---------- Elementos ----------

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value === false || value == null) return;
      if (key === "text") el.textContent = value;
      else if (key === "class") el.className = value;
      else el.setAttribute(key, value === true ? "" : value);
    });
    children.flat().forEach((child) => {
      if (child == null || child === false) return;
      el.append(child);
    });
    return el;
  }

  function metric(label, value, sub, opts) {
    const o = opts || {};
    const strong = h("strong", { text: money(value), class: o.signed && value < 0 ? "negative" : false });
    return h("article", { class: `metric${o.hero ? " is-hero" : ""}` },
      h("div", { class: "label", text: label }),
      strong,
      h("p", { class: "sub", text: sub || "" }));
  }

  function numberInput(value, extra) {
    const input = h("input", Object.assign({
      class: "input",
      type: "number",
      inputmode: "decimal",
      min: "0",
      step: "any",
      placeholder: "0"
    }, extra || {}));
    if (value > 0) input.value = String(value);
    return input;
  }

  // ---------- Datos ----------

  function defaultSources() {
    return [{ id: "main", name: "Ingreso 1" }];
  }

  function emptyData() {
    return { sources: defaultSources(), years: {}, recurring: { annual: [], monthly: [] }, notes: "" };
  }

  function normalizeSources(list) {
    const out = [];
    const seen = {};
    (Array.isArray(list) ? list : []).forEach((row) => {
      const r = row && typeof row === "object" ? row : {};
      const id = typeof r.id === "string" && r.id ? r.id : uid();
      if (seen[id]) return;
      seen[id] = true;
      const name = typeof r.name === "string" ? r.name.trim().slice(0, 40) : "";
      out.push({ id, name: name || `Ingreso ${out.length + 1}` });
    });
    return out.length ? out : defaultSources();
  }

  function normalizeRecurring(list, annual) {
    return (Array.isArray(list) ? list : []).map((row) => {
      const r = row && typeof row === "object" ? row : {};
      const amount = Number(r.amount);
      const item = {
        id: typeof r.id === "string" && r.id ? r.id : uid(),
        day: Math.min(31, Math.max(1, Math.round(Number(r.day)) || 1)),
        concept: typeof r.concept === "string" ? r.concept : "",
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0
      };
      if (annual) item.month = Math.min(12, Math.max(1, Math.round(Number(r.month)) || 1));
      return item;
    }).filter((item) => item.concept || item.amount > 0);
  }

  function normalizeData(raw) {
    const out = emptyData();
    const src = raw && typeof raw === "object" ? raw : {};
    out.sources = normalizeSources(src.sources);
    const ensureSource = (sid) => {
      if (!out.sources.some((s) => s.id === sid)) {
        out.sources.push({ id: sid, name: `Ingreso ${out.sources.length + 1}` });
      }
    };
    Object.keys(src.years || {}).forEach((yk) => {
      const y = Number(yk);
      if (!Number.isInteger(y)) return;
      const year = src.years[yk];
      const months = (year && year.months) || {};
      Object.keys(months).forEach((mk) => {
        const m = Number(mk);
        if (!(m >= 1 && m <= 12)) return;
        const entry = months[mk] || {};
        const mo = { incomes: {}, expenses: [] };
        const put = (sid, dk, value) => {
          const d = Number(dk);
          const amount = Number(value);
          if (!(d >= 1 && d <= daysIn(y, m)) || !Number.isFinite(amount) || amount <= 0) return;
          ensureSource(sid);
          if (!mo.incomes[sid]) mo.incomes[sid] = {};
          mo.incomes[sid][d] = amount;
        };
        const rawIncomes = entry.incomes && typeof entry.incomes === "object" ? entry.incomes : {};
        Object.keys(rawIncomes).forEach((key) => {
          const value = rawIncomes[key];
          if (value && typeof value === "object") {
            // Formato actual: { fuente: { día: valor } }
            Object.keys(value).forEach((dk) => put(key, dk, value[dk]));
          } else {
            // Formato anterior: { día: valor }, pertenece a la primera fuente
            put(out.sources[0].id, key, value);
          }
        });
        (Array.isArray(entry.expenses) ? entry.expenses : []).forEach((row) => {
          const r = row && typeof row === "object" ? row : {};
          const amount = Number(r.amount);
          const concept = typeof r.concept === "string" ? r.concept : "";
          const value = Number.isFinite(amount) && amount > 0 ? amount : 0;
          if (!value && !concept) return;
          const item = {
            id: typeof r.id === "string" && r.id ? r.id : uid(),
            day: clampDay(y, m, r.day),
            concept,
            amount: value
          };
          if (typeof r.recId === "string" && r.recId) item.recId = r.recId;
          mo.expenses.push(item);
        });
        if (!out.years[y]) out.years[y] = { months: {} };
        out.years[y].months[pad(m)] = mo;
      });
    });
    const rec = src.recurring || {};
    out.recurring.annual = normalizeRecurring(rec.annual, true);
    out.recurring.monthly = normalizeRecurring(rec.monthly, false);
    out.notes = typeof src.notes === "string" ? src.notes.slice(0, 4000) : "";
    return out;
  }

  let data = emptyData();

  // Copia en este dispositivo (para abrir rápido y sin conexión)
  function saveLocal() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (error) {
      // Sin almacenamiento disponible: los datos siguen en memoria y en la nube.
    }
  }

  // Cada cambio se guarda aquí y se sincroniza con la nube.
  function save() {
    saveLocal();
    if (cloud) cloud.changed();
  }

  function hasContent(raw) {
    const d = normalizeData(raw);
    if (d.recurring.annual.length || d.recurring.monthly.length || d.notes.trim()) return true;
    return Object.keys(d.years).some((y) => Object.keys(d.years[y].months).some((mk) => {
      const mo = d.years[y].months[mk];
      return Object.keys(mo.incomes).length > 0 || mo.expenses.length > 0;
    }));
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function getMonth(y, m, create) {
    const year = data.years[y];
    if (!year) {
      if (!create) return null;
      data.years[y] = { months: {} };
    }
    const months = data.years[y].months;
    const key = pad(m);
    if (!months[key]) {
      if (!create) return null;
      months[key] = { incomes: {}, expenses: [] };
    }
    return months[key];
  }

  function recurringFor(y, m) {
    const list = [];
    data.recurring.monthly.forEach((rec) => {
      list.push({ rec, kind: "mensual", day: clampDay(y, m, rec.day) });
    });
    data.recurring.annual.forEach((rec) => {
      if (Number(rec.month) === m) list.push({ rec, kind: "anual", day: clampDay(y, m, rec.day) });
    });
    list.sort((a, b) => a.day - b.day);
    return list.filter(({ rec }) => rec.concept || rec.amount > 0);
  }

  const sum = (list) => list.reduce((acc, v) => acc + v, 0);

  function monthTotals(y, m) {
    const n = daysIn(y, m);
    const mo = getMonth(y, m, false);
    const inc = new Array(n).fill(0);
    const out = new Array(n).fill(0);
    const bySource = {};
    data.sources.forEach((s) => {
      bySource[s.id] = { values: new Array(n).fill(0), total: 0 };
    });
    if (mo) {
      Object.keys(mo.incomes).forEach((sid) => {
        const days = mo.incomes[sid];
        if (!bySource[sid] || !days) return;
        Object.keys(days).forEach((dk) => {
          const d = Number(dk);
          if (!(d >= 1 && d <= n)) return;
          const value = Number(days[dk]) || 0;
          bySource[sid].values[d - 1] += value;
          inc[d - 1] += value;
        });
      });
      mo.expenses.forEach((exp) => {
        out[clampDay(y, m, exp.day) - 1] += Number(exp.amount) || 0;
      });
    }
    Object.keys(bySource).forEach((sid) => {
      bySource[sid].total = sum(bySource[sid].values);
    });
    let pending = 0;
    let pendingCount = 0;
    recurringFor(y, m).forEach(({ rec }) => {
      if (!(rec.amount > 0)) return;
      const done = mo && mo.expenses.some((exp) => exp.recId === rec.id);
      if (!done) {
        pending += rec.amount;
        pendingCount += 1;
      }
    });
    const income = sum(inc);
    const expense = sum(out);
    return { n, inc, out, bySource, income, expense, balance: income - expense, pending, pendingCount };
  }

  function monthsWithData() {
    const list = [];
    Object.keys(data.years).map(Number).sort((a, b) => a - b).forEach((y) => {
      Object.keys(data.years[y].months).map(Number).sort((a, b) => a - b).forEach((m) => {
        const t = monthTotals(y, m);
        if (t.income > 0 || t.expense > 0) list.push({ y, m, totals: t });
      });
    });
    return list;
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(data));
  }

  // ---------- Estado de la interfaz ----------

  const start = today();
  const ui = {
    tab: "resumen",
    scope: "mes",
    source: null,
    quickSource: null,
    invSource: "all",
    mv: { y: start.y, m: start.m },
    inv: { y: start.y, m: start.m, scope: "mes" }
  };
  let dayKey = `${start.y}-${start.m}-${start.d}`;
  let dayInputs = {};

  function shiftMonth(ref, delta) {
    const index = ref.y * 12 + (ref.m - 1) + delta;
    ref.y = Math.floor(index / 12);
    ref.m = (index % 12) + 1;
  }

  const isCurrent = (ref) => {
    const t = today();
    return ref.y === t.y && ref.m === t.m;
  };

  // ---------- Encabezado ----------

  function renderHead() {
    const t = today();
    const day = cap(weekdayOf(t.y, t.m, t.d));
    $("tx-eyebrow").textContent = `tx · ${MONTHS[t.m - 1]} ${t.y}`;
    $("tx-today").textContent = `${day} ${t.d}`;
    $("quick-date").textContent = `${day} ${t.d} de ${MONTHS[t.m - 1].toLowerCase()} de ${t.y}`;
  }

  // ---------- Resumen: registro rápido ----------

  function validSource(id) {
    return data.sources.some((s) => s.id === id) ? id : data.sources[0].id;
  }

  function sourceName(id) {
    const found = data.sources.find((s) => s.id === id);
    return found ? found.name : "Ingreso";
  }

  function sourceColor(id) {
    const index = data.sources.findIndex((s) => s.id === id);
    return SOURCE_COLORS[(index < 0 ? 0 : index) % SOURCE_COLORS.length];
  }

  const hasManySources = () => data.sources.length > 1;

  function getIncome(y, m, sid, d) {
    const mo = getMonth(y, m, false);
    return mo && mo.incomes[sid] ? Number(mo.incomes[sid][d]) || 0 : 0;
  }

  function setIncome(y, m, sid, d, value) {
    const mo = getMonth(y, m, true);
    if (value > 0) {
      if (!mo.incomes[sid]) mo.incomes[sid] = {};
      mo.incomes[sid][d] = value;
    } else if (mo.incomes[sid]) {
      delete mo.incomes[sid][d];
      if (!Object.keys(mo.incomes[sid]).length) delete mo.incomes[sid];
    }
    save();
  }

  function todayIncome(sid) {
    const t = today();
    return getIncome(t.y, t.m, sid, t.d);
  }

  // Botones de fuente de ingreso (opcionalmente con "Todos" y el valor de cada una)
  function sourceChips(box, activeId, onPick, opts) {
    const o = opts || {};
    box.replaceChildren();
    const items = (o.all ? [{ id: "all", name: "Todos" }] : []).concat(data.sources);
    items.forEach((s) => {
      const on = s.id === activeId;
      const kids = [h("span", { class: "tx-chip-name", text: s.name })];
      if (o.amountOf && s.id !== "all") kids.push(h("span", { class: "tx-chip-amt", text: money(o.amountOf(s.id)) }));
      const btn = h("button", {
        class: `chip tx-source${on ? " is-active" : ""}`,
        type: "button",
        "data-source": s.id,
        "aria-pressed": on ? "true" : "false"
      }, kids);
      btn.addEventListener("click", () => onPick(s.id));
      box.append(btn);
    });
  }

  function renderToday() {
    const t = today();
    const mo = getMonth(t.y, t.m, false);
    const many = hasManySources();
    $("quick-source-field").hidden = !many;
    if (many) {
      ui.quickSource = validSource(ui.quickSource);
      sourceChips($("quick-sources"), ui.quickSource, (id) => {
        ui.quickSource = id;
        renderToday();
      });
    }
    const box = $("quick-today");
    box.replaceChildren();
    const incomes = data.sources
      .map((s) => ({ source: s, amount: todayIncome(s.id) }))
      .filter((row) => row.amount > 0);
    const expenses = mo ? mo.expenses.filter((exp) => clampDay(t.y, t.m, exp.day) === t.d && exp.amount > 0) : [];

    if (!incomes.length && !expenses.length) {
      box.append(h("p", { class: "empty-note", text: "Aún no has anotado nada hoy." }));
      return;
    }

    incomes.forEach(({ source, amount }) => {
      const remove = h("button", { class: "icon-btn", type: "button", "aria-label": `Quitar el ingreso de hoy: ${source.name}`, text: "×" });
      remove.addEventListener("click", () => {
        setIncome(t.y, t.m, source.id, t.d, 0);
        refreshAfterChange();
      });
      box.append(h("div", { class: "tx-today-item is-income" },
        h("span", { class: "tx-today-label", text: many ? source.name : "Ingresos de hoy" }),
        h("strong", { text: money(amount) }),
        remove));
    });

    expenses.forEach((exp) => {
      const remove = h("button", { class: "icon-btn", type: "button", "aria-label": "Quitar este egreso", text: "×" });
      remove.addEventListener("click", () => {
        mo.expenses = mo.expenses.filter((row) => row.id !== exp.id);
        save();
        refreshAfterChange();
      });
      box.append(h("div", { class: "tx-today-item is-expense" },
        h("span", { class: "tx-today-label", text: exp.concept || "Egreso" }),
        h("strong", { text: `−${money(exp.amount)}` }),
        remove));
    });
  }

  function setupQuick() {
    const incomeInput = $("quick-income");
    const conceptInput = $("quick-concept");
    const amountInput = $("quick-amount");

    $("quick-income-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const value = parseAmount(incomeInput.value);
      if (!value) {
        incomeInput.focus();
        Norte.toast("Escribe el valor del ingreso.", "error");
        return;
      }
      const t = today();
      const sid = validSource(ui.quickSource);
      setIncome(t.y, t.m, sid, t.d, todayIncome(sid) + value);
      incomeInput.value = "";
      refreshAfterChange();
      Norte.toast(hasManySources()
        ? `${sourceName(sid)}: ${money(value)}`
        : `Ingreso anotado: ${money(value)}`);
    });

    $("quick-expense-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const value = parseAmount(amountInput.value);
      if (!value) {
        amountInput.focus();
        Norte.toast("Escribe el valor del egreso.", "error");
        return;
      }
      const t = today();
      const mo = getMonth(t.y, t.m, true);
      mo.expenses.push({
        id: uid(),
        day: t.d,
        concept: conceptInput.value.trim() || "Egreso",
        amount: value
      });
      save();
      conceptInput.value = "";
      amountInput.value = "";
      refreshAfterChange();
      conceptInput.focus();
      Norte.toast(`Egreso anotado: ${money(value)}`);
    });
  }

  // ---------- Resumen: periodo ----------

  // Texto bajo "Ingresos" cuando hay varios: "Ingreso 1 $60 · Ingreso 2 $20"
  function incomeBreakdown(tot) {
    const parts = data.sources
      .filter((s) => tot.bySource[s.id] && tot.bySource[s.id].total > 0)
      .map((s) => `${s.name} ${money(tot.bySource[s.id].total)}`);
    return parts.length > 1 ? parts.join(" · ") : "";
  }

  // Fuentes que se dibujan en una gráfica: las que tienen valores (o la primera si no hay ninguno)
  function chartSources(totalOf) {
    const withData = data.sources.filter((s) => totalOf(s) > 0);
    return withData.length ? withData : data.sources.slice(0, 1);
  }

  const seriesName = (s) => (hasManySources() ? s.name : "Ingresos");

  function renderSummary() {
    const t = today();
    const box = $("sum-metrics");
    box.replaceChildren();

    if (ui.scope === "mes") {
      const tot = monthTotals(t.y, t.m);
      $("scope-note").textContent = `${MONTHS[t.m - 1]} ${t.y} · día ${t.d} de ${tot.n}`;
      box.append(
        metric("Te quedó este mes", tot.balance, "Ingresos menos egresos", { hero: true, signed: true }),
        metric("Ingresos", tot.income,
          incomeBreakdown(tot) || (tot.income > 0 ? "Lo que ha entrado" : "Aún sin ingresos")),
        metric("Egresos", tot.expense, tot.expense > 0 ? "Lo que ha salido" : "Aún sin egresos"),
        metric("Por registrar", tot.pending,
          tot.pendingCount
            ? `${tot.pendingCount} recurrente${tot.pendingCount === 1 ? "" : "s"} sin escribir`
            : "Nada pendiente"));
      $("sum-chart-title").textContent = "Día a día";
      $("sum-chart-sub").textContent = `Lo que entró y lo que salió cada día de ${MONTHS[t.m - 1].toLowerCase()}.`;
      const labels = tot.inc.map((_, i) => `${i + 1}`);
      const srcs = chartSources((s) => tot.bySource[s.id].total);
      NorteCharts.columns($("sum-chart"), {
        labels,
        shortLabels: labels,
        series: srcs.map((s) => ({
          name: seriesName(s),
          color: sourceColor(s.id),
          stack: "entra",
          values: tot.bySource[s.id].values
        })).concat([{ name: "Egresos", color: COLORS.expense, stack: "sale", values: tot.out }]),
        format: money,
        formatAxis: compact,
        tipTitle: (i) => `${cap(weekdayOf(t.y, t.m, i + 1))} ${i + 1} de ${MONTHS[t.m - 1].toLowerCase()}`,
        tipRows: (i) => srcs.map((s) => ({
          name: seriesName(s),
          color: sourceColor(s.id),
          value: money(tot.bySource[s.id].values[i])
        })).concat([
          { name: "Egresos", color: COLORS.expense, value: money(tot.out[i]) },
          { name: "Balance del día", color: "#4cc3e6", value: money(tot.inc[i] - tot.out[i]), total: true }
        ]),
        title: "Ingresos y egresos de cada día",
        empty: "Aún no hay movimientos este mes.",
        height: 260
      });
      return;
    }

    const list = monthsWithData();
    const income = sum(list.map((row) => row.totals.income));
    const expense = sum(list.map((row) => row.totals.expense));
    $("scope-note").textContent = list.length
      ? "Todos los meses con movimientos"
      : "Todavía no hay movimientos";
    const incomeSub = data.sources
      .map((s) => ({ s, v: sum(list.map((row) => row.totals.bySource[s.id].total)) }))
      .filter((row) => row.v > 0);
    box.append(
      metric("Balance total", income - expense, "Ingresos menos egresos", { hero: true, signed: true }),
      metric("Ingresos", income,
        incomeSub.length > 1 ? incomeSub.map((row) => `${row.s.name} ${money(row.v)}`).join(" · ") : "En todos los meses"),
      metric("Egresos", expense, "En todos los meses"),
      h("article", { class: "metric" },
        h("div", { class: "label", text: "Meses con movimientos" }),
        h("strong", { text: String(list.length) }),
        h("p", { class: "sub", text: list.length ? "Con algún ingreso o egreso" : "Anota el primero arriba" })));
    $("sum-chart-title").textContent = "Mes a mes";
    $("sum-chart-sub").textContent = "Lo que entró y lo que salió en cada mes con movimientos.";
    const labels = list.map((row) => `${MONTHS[row.m - 1]} ${row.y}`);
    const srcs = chartSources((s) => sum(list.map((row) => row.totals.bySource[s.id].total)));
    NorteCharts.columns($("sum-chart"), {
      labels,
      shortLabels: list.map((row) => `${MONTHS[row.m - 1].slice(0, 3)} ${String(row.y).slice(2)}`),
      series: srcs.map((s) => ({
        name: seriesName(s),
        color: sourceColor(s.id),
        stack: "entra",
        values: list.map((row) => row.totals.bySource[s.id].total)
      })).concat([{ name: "Egresos", color: COLORS.expense, stack: "sale", values: list.map((row) => row.totals.expense) }]),
      format: money,
      formatAxis: compact,
      tipTitle: (i) => labels[i],
      tipRows: (i) => srcs.map((s) => ({
        name: seriesName(s),
        color: sourceColor(s.id),
        value: money(list[i].totals.bySource[s.id].total)
      })).concat([
        { name: "Egresos", color: COLORS.expense, value: money(list[i].totals.expense) },
        { name: "Balance", color: "#4cc3e6", value: money(list[i].totals.balance), total: true }
      ]),
      title: "Ingresos y egresos de cada mes",
      empty: "Aún no hay movimientos.",
      height: 260
    });
  }

  function setScope(scope) {
    ui.scope = scope;
    document.querySelectorAll("[data-scope]").forEach((btn) => {
      const on = btn.dataset.scope === scope;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    renderSummary();
  }

  // ---------- Navegador de mes ----------

  function bindMonthNav(id, ref, onChange, stepFn) {
    const root = $(id);
    root.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-nav]");
      if (!btn || btn.dataset.nav === "label") return;
      const step = stepFn ? stepFn() : 1;
      if (btn.dataset.nav === "prev") shiftMonth(ref, -step);
      else if (btn.dataset.nav === "next") shiftMonth(ref, step);
      else {
        const t = today();
        ref.y = t.y;
        ref.m = t.m;
      }
      onChange();
    });
  }

  function paintMonthNav(id, ref, yearOnly) {
    const root = $(id);
    root.querySelector('[data-nav="label"]').textContent = yearOnly ? String(ref.y) : `${MONTHS[ref.m - 1]} ${ref.y}`;
    root.querySelector('[data-nav="now"]').disabled = yearOnly ? ref.y === today().y : isCurrent(ref);
  }

  // ---------- Movimientos ----------

  function renderSourceBar(totals) {
    const { y, m } = ui.mv;
    const tot = totals || monthTotals(y, m);
    ui.source = validSource(ui.source);
    sourceChips($("mv-sources"), ui.source, (id) => {
      ui.source = id;
      renderIncomeSection();
    }, { amountOf: (id) => (tot.bySource[id] ? tot.bySource[id].total : 0) });
  }

  function renderSourceEdit() {
    const sid = validSource(ui.source);
    $("mv-source-name").value = sourceName(sid);
    $("mv-source-remove").hidden = !hasManySources();
  }

  function renderIncomeSection() {
    renderSourceBar();
    renderSourceEdit();
    renderIncomeDays();
  }

  function addSource() {
    const names = {};
    data.sources.forEach((s) => { names[s.name] = true; });
    let n = data.sources.length + 1;
    while (names[`Ingreso ${n}`]) n += 1;
    const source = { id: uid(), name: `Ingreso ${n}` };
    data.sources.push(source);
    ui.source = source.id;
    save();
    renderIncomeSection();
    updateMovementTotals();
    const field = $("mv-source-name");
    field.focus();
    if (field.select) field.select();
  }

  function renameSource(final) {
    const source = data.sources.find((s) => s.id === validSource(ui.source));
    const field = $("mv-source-name");
    const name = field.value.trim().slice(0, 40);
    if (name) {
      source.name = name;
      save();
      renderSourceBar();
      renderIncomeDays();
    }
    if (final) field.value = source.name;
  }

  function removeSource() {
    if (!hasManySources()) return;
    const sid = validSource(ui.source);
    const source = data.sources.find((s) => s.id === sid);
    const hasData = Object.keys(data.years).some((y) =>
      Object.keys(data.years[y].months).some((mk) => {
        const days = data.years[y].months[mk].incomes[sid];
        return days && Object.keys(days).length > 0;
      }));
    if (hasData && !window.confirm(`¿Quitar "${source.name}"? Se borrarán sus ingresos de todos los meses.`)) return;
    data.sources = data.sources.filter((s) => s.id !== sid);
    Object.keys(data.years).forEach((y) => {
      Object.keys(data.years[y].months).forEach((mk) => {
        delete data.years[y].months[mk].incomes[sid];
      });
    });
    ui.source = data.sources[0].id;
    ui.quickSource = data.sources[0].id;
    if (ui.invSource === sid) ui.invSource = "all";
    save();
    renderIncomeSection();
    updateMovementTotals();
  }

  function updateMovementTotals() {
    const { y, m } = ui.mv;
    const tot = monthTotals(y, m);
    const box = $("mv-metrics");
    box.replaceChildren(
      metric("Te quedó", tot.balance, `${MONTHS[m - 1]} ${y}`, { hero: true, signed: true }),
      metric("Ingresos", tot.income, incomeBreakdown(tot) || "Del mes"),
      metric("Egresos", tot.expense, "Del mes"));
    $("mv-income-total").textContent = money(tot.income);
    $("mv-expense-total").textContent = money(tot.expense);
    $("mv-pending").textContent = tot.pendingCount
      ? `Recurrentes sin escribir: ${money(tot.pending)} (${tot.pendingCount}). No cuentan hasta que escribas su valor.`
      : "";
    renderSourceBar(tot);
  }

  function renderIncomeDays() {
    const { y, m } = ui.mv;
    const n = daysIn(y, m);
    const t = today();
    const now = isCurrent(ui.mv);
    const sid = validSource(ui.source);
    dayInputs = {};

    const makeInput = (d) => {
      const input = numberInput(getIncome(y, m, sid, d), { "aria-label": `${sourceName(sid)}, día ${d}` });
      (dayInputs[d] = dayInputs[d] || []).push(input);
      input.addEventListener("input", () => {
        setIncome(y, m, sid, d, parseAmount(input.value));
        dayInputs[d].forEach((other) => {
          if (other !== input) other.value = input.value;
        });
        updateMovementTotals();
      });
      return input;
    };

    const pin = $("mv-pin");
    pin.replaceChildren();
    pin.hidden = !now;
    if (now) {
      pin.append(
        h("div", { class: "tx-pin-info" },
          h("span", { class: "tx-chip", text: "Hoy" }),
          h("strong", { text: `${cap(weekdayOf(y, m, t.d))} ${t.d}${hasManySources() ? ` · ${sourceName(sid)}` : ""}` })),
        makeInput(t.d));
    }

    const grid = $("mv-days");
    grid.replaceChildren();
    for (let d = 1; d <= n; d += 1) {
      const dow = new Date(y, m - 1, d).getDay();
      const cls = ["tx-day"];
      if (now && d === t.d) cls.push("is-today");
      if (dow === 0 || dow === 6) cls.push("is-weekend");
      grid.append(h("label", { class: cls.join(" ") },
        h("span", { class: "tx-day-n", text: String(d) }),
        h("span", { class: "tx-day-w", text: weekdayOf(y, m, d, "short") }),
        makeInput(d)));
    }
  }

  function expenseRow(y, m, exp) {
    const mo = getMonth(y, m, true);
    const day = numberInput(0, { min: "1", max: String(daysIn(y, m)), step: "1", placeholder: "Día", "aria-label": "Día del egreso" });
    day.value = String(clampDay(y, m, exp.day));
    day.addEventListener("input", () => {
      const n = Math.round(Number(day.value));
      if (n >= 1) {
        exp.day = clampDay(y, m, n);
        save();
      }
    });
    day.addEventListener("change", () => {
      exp.day = clampDay(y, m, day.value);
      save();
      renderExpenseRows();
      updateMovementTotals();
    });

    const concept = h("input", { class: "input", type: "text", placeholder: "Concepto", maxlength: "80", "aria-label": "Concepto del egreso" });
    concept.value = exp.concept || "";
    concept.addEventListener("input", () => {
      exp.concept = concept.value;
      save();
    });

    const amount = numberInput(exp.amount, { "aria-label": "Valor del egreso" });
    amount.addEventListener("input", () => {
      exp.amount = parseAmount(amount.value);
      save();
      updateMovementTotals();
    });

    const remove = h("button", { class: "icon-btn", type: "button", "aria-label": "Quitar egreso", text: "×" });
    remove.addEventListener("click", () => {
      mo.expenses = mo.expenses.filter((row) => row.id !== exp.id);
      save();
      renderExpenseRows();
      updateMovementTotals();
    });

    const tag = exp.recId
      ? h("span", { class: "tx-tag", text: "Recurrente" })
      : null;
    return h("div", { class: `row tx-expense${exp.recId ? " is-registered" : ""}`, "data-exp": exp.id },
      day,
      h("div", { class: "tx-concept" }, concept, tag),
      amount,
      remove);
  }

  function plannedRow(y, m, item) {
    const { rec, kind, day } = item;
    const mo = getMonth(y, m, true);
    let exp = null;
    const row = h("div", { class: "row tx-expense is-planned", "data-rec": rec.id });
    const amount = numberInput(0, {
      placeholder: money(rec.amount),
      "aria-label": `Valor de ${rec.concept || "recurrente"}. Planeado ${money(rec.amount)}`
    });
    amount.addEventListener("input", () => {
      const value = parseAmount(amount.value);
      if (value > 0) {
        if (!exp) {
          exp = { id: uid(), day, concept: rec.concept, amount: value, recId: rec.id };
          mo.expenses.push(exp);
          row.classList.remove("is-planned");
          row.classList.add("is-registered");
        } else {
          exp.amount = value;
        }
      } else if (exp) {
        mo.expenses = mo.expenses.filter((entry) => entry.id !== exp.id);
        exp = null;
        row.classList.remove("is-registered");
        row.classList.add("is-planned");
      }
      save();
      updateMovementTotals();
    });
    row.append(
      h("span", { class: "tx-static tx-static-day", text: String(day) }),
      h("div", { class: "tx-concept" },
        h("span", { class: "tx-static", text: rec.concept || "Recurrente" }),
        h("span", { class: "tx-tag", text: kind === "anual" ? "Anual" : "Mensual" })),
      amount,
      h("span", { class: "tx-spacer", "aria-hidden": "true" }));
    return row;
  }

  function renderExpenseRows() {
    const { y, m } = ui.mv;
    const box = $("mv-expense-rows");
    box.replaceChildren();
    const mo = getMonth(y, m, true);
    const entries = [];
    mo.expenses.forEach((exp) => {
      entries.push({ type: "exp", day: clampDay(y, m, exp.day), exp });
    });
    recurringFor(y, m).forEach((item) => {
      if (mo.expenses.some((exp) => exp.recId === item.rec.id)) return;
      entries.push({ type: "plan", day: item.day, item });
    });
    entries.sort((a, b) => a.day - b.day || (a.type === b.type ? 0 : a.type === "exp" ? -1 : 1));
    if (!entries.length) {
      box.append(h("p", { class: "empty-note", text: "Aún no hay egresos este mes." }));
      return;
    }
    entries.forEach((entry) => {
      box.append(entry.type === "exp" ? expenseRow(y, m, entry.exp) : plannedRow(y, m, entry.item));
    });
  }

  function renderMovements() {
    paintMonthNav("mv-nav", ui.mv);
    renderIncomeSection();
    renderExpenseRows();
    updateMovementTotals();
  }

  function addExpense() {
    const { y, m } = ui.mv;
    const t = today();
    const mo = getMonth(y, m, true);
    const exp = { id: uid(), day: isCurrent(ui.mv) ? t.d : 1, concept: "", amount: 0 };
    mo.expenses.push(exp);
    save();
    renderExpenseRows();
    const row = $("mv-expense-rows").querySelector(`[data-exp="${exp.id}"]`);
    const field = row && row.querySelector(".tx-concept input");
    if (field) field.focus();
  }

  // ---------- Recurrentes ----------

  function updateRecurringTotals() {
    const annual = sum(data.recurring.annual.map((r) => r.amount));
    const monthly = sum(data.recurring.monthly.map((r) => r.amount));
    $("annual-total").textContent = money(annual);
    $("monthly-total").textContent = money(monthly);
    const hint = $("rec-hint");
    if (annual > 0 || monthly > 0) {
      hint.textContent = annual > 0
        ? `Entre los mensuales y los anuales repartidos, tus gastos fijos pesan ≈ ${money(monthly + annual / 12)} al mes.`
        : `Tus gastos fijos mensuales suman ${money(monthly)}.`;
    } else {
      hint.textContent = "";
    }
  }

  function recurringRow(rec, annual) {
    const list = annual ? data.recurring.annual : data.recurring.monthly;
    const day = numberInput(0, { min: "1", max: "31", step: "1", placeholder: "Día", "aria-label": "Día del mes" });
    day.value = String(rec.day);
    day.addEventListener("change", () => {
      rec.day = Math.min(31, Math.max(1, Math.round(Number(day.value)) || 1));
      day.value = String(rec.day);
      save();
    });

    const concept = h("input", { class: "input", type: "text", placeholder: "Concepto", maxlength: "80", "aria-label": "Concepto" });
    concept.value = rec.concept || "";
    concept.addEventListener("input", () => {
      rec.concept = concept.value;
      save();
    });

    const amount = numberInput(rec.amount, { "aria-label": "Valor" });
    amount.addEventListener("input", () => {
      rec.amount = parseAmount(amount.value);
      save();
      updateRecurringTotals();
    });

    const remove = h("button", { class: "icon-btn", type: "button", "aria-label": "Quitar recurrente", text: "×" });
    remove.addEventListener("click", () => {
      const index = list.indexOf(rec);
      if (index >= 0) list.splice(index, 1);
      save();
      renderRecurring();
    });

    const cells = [day];
    if (annual) {
      cells.push(Norte.menuSelect(String(rec.month), MONTHS.map((label, i) => ({ value: String(i + 1), label })), (value) => {
        rec.month = Number(value);
        save();
      }));
    }
    cells.push(concept, amount, remove);
    return h("div", { class: `row tx-rec ${annual ? "is-annual" : "is-monthly"}`, "data-rec-id": rec.id }, cells);
  }

  function renderRecurring() {
    const fill = (id, list, annual, empty) => {
      const box = $(id);
      box.replaceChildren();
      if (!list.length) box.append(h("p", { class: "empty-note", text: empty }));
      list.forEach((rec) => box.append(recurringRow(rec, annual)));
    };
    fill("annual-rows", data.recurring.annual, true, "Aún no hay gastos anuales. Por ejemplo, un seguro o un impuesto.");
    fill("monthly-rows", data.recurring.monthly, false, "Aún no hay gastos mensuales. Por ejemplo, el arriendo o una suscripción.");
    updateRecurringTotals();
    const notes = $("rec-notes");
    notes.value = data.notes || "";
    updateNotesCount();
  }

  function updateNotesCount() {
    const len = (data.notes || "").length;
    $("rec-notes-count").textContent = len > 3500 ? `${len} de 4000 caracteres` : "";
  }

  function addRecurring(annual) {
    const t = today();
    const rec = { id: uid(), day: t.d, concept: "", amount: 0 };
    if (annual) rec.month = t.m;
    // Se mantiene aunque esté vacío mientras se edita; al recargar se descartan los vacíos.
    (annual ? data.recurring.annual : data.recurring.monthly).push(rec);
    save();
    renderRecurring();
    const row = document.querySelector(`[data-rec-id="${rec.id}"]`);
    const field = row && row.querySelector('input[type="text"]');
    if (field) field.focus();
  }

  // ---------- Facturas ----------

  function invoiceFilter() {
    if (!hasManySources()) return "all";
    if (ui.invSource !== "all" && !data.sources.some((s) => s.id === ui.invSource)) ui.invSource = "all";
    return ui.invSource;
  }

  // Renglones de ingreso de un mes (o del año): una por fuente con valor, según el filtro
  function invoiceIncomeLines(tot, filter) {
    if (!hasManySources()) {
      return tot.income > 0 ? [{ id: data.sources[0].id, name: "Ingresos", amount: tot.income }] : [];
    }
    return data.sources
      .filter((s) => (filter === "all" || filter === s.id) && tot.bySource[s.id].total > 0)
      .map((s) => ({ id: s.id, name: s.name, amount: tot.bySource[s.id].total }));
  }

  function invoiceLine(name, amount) {
    return h("div", { class: "invoice-row indent" },
      h("span", { text: name }),
      h("span", { text: money(amount) }));
  }

  function invoiceMonthBlock(y, m, tot, summary, filter) {
    const mo = getMonth(y, m, false);
    const lines = invoiceIncomeLines(tot, filter);
    const block = h("section", { class: "invoice-month" }, h("h3", { text: `${MONTHS[m - 1]} ${y}` }));
    const balanceRow = h("div", { class: "invoice-row total" },
      h("span", { text: `Balance ${MONTHS[m - 1]}` }),
      h("span", { text: money(tot.balance) }));

    if (summary) {
      lines.forEach((l) => block.append(invoiceLine(l.name, l.amount)));
      if (filter === "all" && lines.length > 1) block.append(invoiceLine("Total ingresos", tot.income));
      block.append(invoiceLine("Egresos", tot.expense), balanceRow);
      return block;
    }

    const many = hasManySources();
    lines.forEach((l) => {
      block.append(h("div", { class: "invoice-row invoice-group" },
        h("span", { text: many ? l.name : "Ingresos" }),
        many ? h("span", { text: money(l.amount) }) : null));
      tot.bySource[l.id].values.forEach((value, i) => {
        if (value > 0) block.append(invoiceLine(`${cap(weekdayOf(y, m, i + 1, "short"))} ${i + 1}`, value));
      });
    });
    if (filter === "all" && lines.length > 1) block.append(invoiceLine("Total ingresos", tot.income));

    const expenses = (mo ? mo.expenses : [])
      .filter((exp) => exp.amount > 0)
      .map((exp) => ({
        day: clampDay(y, m, exp.day),
        name: `${clampDay(y, m, exp.day)} · ${exp.concept || "Egreso"}${exp.recId ? " · Recurrente" : ""}`,
        amount: exp.amount
      }))
      .sort((a, b) => a.day - b.day);
    if (expenses.length) {
      block.append(h("div", { class: "invoice-row invoice-group", text: "Egresos" }));
      expenses.forEach((row) => block.append(invoiceLine(row.name, row.amount)));
    }

    block.append(balanceRow);
    return block;
  }

  function renderInvoice() {
    const { y, m, scope } = ui.inv;
    const filter = invoiceFilter();
    const only = filter !== "all";
    const sourceLabel = only ? sourceName(filter) : "";
    const box = $("invoice");
    box.replaceChildren();

    // El filtro solo cambia qué ingresos se detallan; egresos, balance y meses quedan como siempre.
    const months = [];
    if (scope === "mes") {
      months.push({ y, m, totals: monthTotals(y, m) });
    } else {
      for (let i = 1; i <= 12; i += 1) months.push({ y, m: i, totals: monthTotals(y, i) });
    }
    const withData = months.filter((row) => row.totals.income > 0 || row.totals.expense > 0);
    const income = sum(withData.map((row) => row.totals.income));
    const expense = sum(withData.map((row) => row.totals.expense));
    const balance = income - expense;
    const label = scope === "mes" ? `${MONTHS[m - 1]} ${y}` : String(y);

    box.append(h("div", { class: "invoice-head" },
      h("div", {},
        h("div", { class: "brand-line", text: "Norte · tx" }),
        h("h2", { text: `Factura ${label}` }),
        h("p", { text: only ? `Ingresos: ${sourceLabel}` : "Ingresos y egresos" })),
      h("div", { class: "invoice-stamp" },
        h("p", { text: scope === "mes" ? "Te quedó en el mes" : "Te quedó en el año" }),
        h("strong", { class: balance >= 0 ? false : "negative", text: money(balance) }))));

    if (!withData.length) {
      box.append(h("p", {
        class: "invoice-empty",
        text: scope === "mes"
          ? "No hay movimientos en este mes. Anótalos en Movimientos."
          : "No hay movimientos en este año. Anótalos en Movimientos."
      }));
      return;
    }

    withData.forEach((row) => box.append(invoiceMonthBlock(row.y, row.m, row.totals, scope === "anio", filter)));

    const foot = h("section", { class: "invoice-foot" });
    if (hasManySources()) {
      data.sources.forEach((s) => {
        if (only && s.id !== filter) return;
        const value = sum(withData.map((row) => row.totals.bySource[s.id].total));
        if (value > 0) foot.append(invoiceLine(`Total ${s.name}`, value));
      });
    }
    foot.append(
      h("div", { class: "invoice-row total" },
        h("span", { text: "Total ingresos" }), h("span", { text: money(income) })),
      h("div", { class: "invoice-row total" },
        h("span", { text: "Total egresos" }), h("span", { text: money(expense) })),
      h("div", { class: "invoice-row total" },
        h("span", { text: `Balance ${scope === "mes" ? "del mes" : "del año"}` }), h("span", { text: money(balance) })));
    box.append(foot);
  }

  function renderInvoiceBar() {
    const yearOnly = ui.inv.scope === "anio";
    paintMonthNav("inv-nav", ui.inv, yearOnly);
    document.querySelectorAll("[data-iscope]").forEach((btn) => {
      const on = btn.dataset.iscope === ui.inv.scope;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const many = hasManySources();
    $("inv-filter").hidden = !many;
    if (many) {
      sourceChips($("inv-sources"), invoiceFilter(), (id) => {
        ui.invSource = id;
        renderInvoiceBar();
        renderInvoice();
      }, { all: true });
    }
  }

  // ---------- Pestañas y refresco ----------

  function renderActive() {
    if (ui.tab === "resumen") {
      renderToday();
      renderSummary();
    } else if (ui.tab === "movimientos") {
      renderMovements();
    } else if (ui.tab === "recurrentes") {
      renderRecurring();
    } else {
      renderInvoiceBar();
      renderInvoice();
    }
  }

  function renderAll() {
    renderHead();
    renderActive();
  }

  function refreshAfterChange() {
    renderToday();
    renderSummary();
  }

  function setTab(tab, updateHash) {
    ui.tab = TABS.includes(tab) ? tab : "resumen";
    document.querySelectorAll('[role="tab"][data-tab]').forEach((btn) => {
      const on = btn.dataset.tab === ui.tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    TABS.forEach((name) => {
      $(`panel-${name}`).hidden = name !== ui.tab;
    });
    $("tab-desc").textContent = TAB_DESC[ui.tab];
    if (updateHash && location.hash !== `#${ui.tab}`) {
      history.replaceState(null, "", `#${ui.tab}`);
    }
    renderActive();
  }

  function readHash() {
    const name = (location.hash || "").replace("#", "");
    return TABS.includes(name) ? name : "resumen";
  }

  function applySnapshot(raw) {
    data = normalizeData(raw);
    save();
    renderAll();
  }

  // ---------- Acceso y nube ----------

  let appShown = false;

  const STATUS_TEXT = {
    saved: "Guardado en la nube",
    pending: "Cambios sin guardar…",
    saving: "Sincronizando…",
    offline: "Sin conexión · se guardará al volver",
    error: "No se pudo guardar · reintentando",
    auth: "Sesión vencida"
  };

  function showGate(message) {
    appShown = false;
    $("contenido").hidden = true;
    $("auth-gate").hidden = false;
    $("auth-form").hidden = !cloud;
    $("auth-submit").disabled = false;
    $("auth-msg").textContent = cloud ? (message || "Inicia sesión para continuar.") : "No se pudo cargar el acceso. Recarga la página.";
    if (cloud) $("auth-email").focus();
  }

  function showApp() {
    appShown = true;
    $("auth-gate").hidden = true;
    $("contenido").hidden = false;
    const user = cloud && cloud.user();
    $("tx-account-email").textContent = user && user.email ? user.email : "";
    renderHead();
    setScope(ui.scope);
    setTab(readHash(), false);
  }

  const adapter = {
    getData: () => data,
    hasContent,
    apply(raw) {
      data = normalizeData(raw);
      saveLocal();
      if (appShown) renderAll();
    },
    clearLocal() {
      data = emptyData();
      try {
        localStorage.removeItem(STORE_KEY);
      } catch (error) {
        // nada
      }
    },
    onAuthLost() {
      showGate("La sesión venció. Inicia sesión de nuevo.");
    }
  };

  async function boot() {
    if (!cloud) {
      showGate();
      return;
    }
    const hadSession = cloud.hasSession();
    const result = await cloud.start(adapter);
    if (result === "auth") {
      showGate(hadSession && !cloud.hasSession() ? "La sesión venció. Inicia sesión de nuevo." : "");
    } else {
      showApp();
    }
  }

  function setupAuth() {
    if (!cloud) return;
    cloud.onStatus((state) => {
      const el = $("sync-status");
      el.textContent = STATUS_TEXT[state] || "";
      el.className = `tx-sync is-${state}`;
    });

    $("auth-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = $("auth-email").value.trim();
      const password = $("auth-password").value;
      if (!email || !password) {
        $("auth-msg").textContent = "Escribe tu correo y tu contraseña.";
        return;
      }
      $("auth-submit").disabled = true;
      $("auth-msg").textContent = "Entrando…";
      const result = await cloud.signIn(email, password);
      if (!result.ok) {
        $("auth-submit").disabled = false;
        $("auth-password").value = "";
        $("auth-msg").textContent = result.message;
        $("auth-password").focus();
        return;
      }
      $("auth-password").value = "";
      $("auth-msg").textContent = "Cargando tus datos…";
      const started = await cloud.start(adapter);
      if (started === "auth") showGate("No se pudieron cargar tus datos. Inténtalo de nuevo.");
      else showApp();
    });

    $("btn-salir").addEventListener("click", async () => {
      if (cloud.isDirty()) {
        await cloud.flush();
        if (cloud.isDirty() && !window.confirm("Hay cambios que aún no se guardaron en la nube y se perderán al salir. ¿Salir de todos modos?")) return;
      }
      await cloud.signOut();
      adapter.clearLocal();
      $("sync-status").textContent = "";
      showGate("Sesión cerrada.");
    });
  }

  function checkNewDay() {
    if (!appShown) return;
    const t = today();
    const key = `${t.y}-${t.m}-${t.d}`;
    if (key === dayKey) return;
    dayKey = key;
    ui.mv = { y: t.y, m: t.m };
    ui.inv.y = t.y;
    ui.inv.m = t.m;
    renderAll();
  }

  function init() {
    data = normalizeData(loadStored());

    document.querySelectorAll('[role="tab"][data-tab]').forEach((btn) => {
      btn.addEventListener("click", () => setTab(btn.dataset.tab, true));
    });
    document.querySelectorAll("[data-scope]").forEach((btn) => {
      btn.addEventListener("click", () => setScope(btn.dataset.scope));
    });
    document.querySelectorAll("[data-iscope]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ui.inv.scope = btn.dataset.iscope;
        renderInvoiceBar();
        renderInvoice();
      });
    });

    bindMonthNav("mv-nav", ui.mv, renderMovements);
    bindMonthNav("inv-nav", ui.inv, () => {
      renderInvoiceBar();
      renderInvoice();
    }, () => (ui.inv.scope === "anio" ? 12 : 1));

    setupQuick();
    $("mv-add-expense").addEventListener("click", addExpense);
    $("mv-add-source").addEventListener("click", addSource);
    $("mv-source-name").addEventListener("input", () => renameSource(false));
    $("mv-source-name").addEventListener("change", () => renameSource(true));
    $("mv-source-remove").addEventListener("click", removeSource);
    $("add-annual").addEventListener("click", () => addRecurring(true));
    $("add-monthly").addEventListener("click", () => addRecurring(false));
    $("rec-notes").addEventListener("input", () => {
      data.notes = $("rec-notes").value;
      save();
      updateNotesCount();
    });
    $("btn-print-invoice").addEventListener("click", () => window.print());

    $("btn-guardar").addEventListener("click", () => {
      Norte.downloadSnapshot(FEATURE, snapshot());
    });
    Norte.bindFileInput($("file-input"), FEATURE, applySnapshot);
    $("btn-cargar").addEventListener("click", () => $("file-input").click());
    Norte.enableDrop(document.body, FEATURE, applySnapshot);

    window.addEventListener("hashchange", () => {
      if (appShown) setTab(readHash(), false);
    });
    document.addEventListener("visibilitychange", () => {
      if (!appShown) return;
      if (document.hidden) {
        if (cloud) cloud.flush();
        return;
      }
      checkNewDay();
      if (cloud) {
        cloud.pullIfChanged().then((changed) => {
          if (changed) Norte.toast("Datos actualizados desde otro dispositivo.");
        });
      }
    });
    window.addEventListener("pagehide", () => {
      if (cloud) cloud.flush();
    });

    setupAuth();
    boot();
  }

  init();
})();
