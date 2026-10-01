(() => {
  const FEATURE = "finanzas-personales";
  const CURRENCY = "COP";
  const DEFAULT_TAX_PCT = 4;
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
  const INVEST_TYPES = [
    { id: "cdt", label: "CDT" },
    { id: "alta_rentabilidad", label: "Cuenta de alta rentabilidad" },
    { id: "bolsa", label: "Bolsa" },
    { id: "manual", label: "Inversión manual" }
  ];
  const BOLSA_KINDS = [
    { id: "etf", label: "ETF" },
    { id: "acciones", label: "Acciones" },
    { id: "cripto", label: "Cripto" }
  ];
  const ACCOUNT_TYPES = [
    { id: "ahorros", label: "Cuenta de ahorros" },
    { id: "corriente", label: "Cuenta corriente" },
    { id: "efectivo", label: "Efectivo" },
    { id: "otro", label: "Otro" }
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
      notesByBank: {},
      incomes: [],
      expenses: [],
      contributions: [],
      investments: [],
      transfers: []
    };
  }

  function normalizeMonth(entry) {
    if (!entry) return emptyMonth();
    if (!Array.isArray(entry.investments)) entry.investments = [];
    if (!Array.isArray(entry.contributions)) entry.contributions = [];
    if (!Array.isArray(entry.incomes)) entry.incomes = [];
    if (!Array.isArray(entry.expenses)) entry.expenses = [];
    if (!Array.isArray(entry.transfers)) entry.transfers = [];
    if (!entry.notesByBank || typeof entry.notesByBank !== "object") entry.notesByBank = {};
    entry.incomes.forEach((row) => {
      if (row.bankId == null) row.bankId = "";
    });
    entry.expenses.forEach((row) => {
      if (row.bankId == null) row.bankId = "";
    });
    entry.contributions.forEach((row) => {
      if (typeof row.concept !== "string") row.concept = "";
      if (row.kind !== "retiro") row.kind = "aporte";
      if (row.bankId == null) {
        const pot = state.savings.find((s) => s.id === row.savingId);
        row.bankId = pot ? (pot.bankId || "") : "";
      }
    });
    entry.investments.forEach((row) => {
      if (typeof row.concept !== "string") row.concept = "";
      if (row.bankId == null) {
        const pot = state.investments.find((s) => s.id === row.investmentId);
        row.bankId = pot ? (pot.bankId || "") : "";
      }
    });
    entry.transfers.forEach((row) => {
      if (!row.id) row.id = uid();
      if (row.fromBankId == null) row.fromBankId = "";
      if (row.toBankId == null) row.toBankId = "";
      if (typeof row.concept !== "string") row.concept = "";
      if (row.investmentId == null) row.investmentId = "";
      row.amount = Number(row.amount) || 0;
    });
    return entry;
  }

  function normalizeSaving(row) {
    return {
      id: row.id || uid(),
      name: row.name || "Ahorro",
      target: Number(row.target) || 0,
      bankId: row.bankId || "",
      initialAmount: Number(row.initialAmount) || 0
    };
  }

  function normalizeHolding(row) {
    return {
      id: row.id || uid(),
      kind: BOLSA_KINDS.some((k) => k.id === row.kind) ? row.kind : "etf",
      name: row.name || "",
      invested: Number(row.invested) || 0,
      available: Number(row.available) || 0,
      commission: Number(row.commission) || 0,
      movements: Array.isArray(row.movements)
        ? row.movements.map((m) => ({
          id: m.id || uid(),
          year: Number(m.year) || new Date().getFullYear(),
          month: m.month || "01",
          amount: Number(m.amount) || 0,
          commission: Number(m.commission) || 0,
          concept: m.concept || ""
        }))
        : []
    };
  }

  function holdingInvested(h) {
    const moves = (h.movements || []).reduce((s, m) => s + (Number(m.amount) || 0), 0);
    return (Number(h.invested) || 0) + moves;
  }

  function holdingCommission(h) {
    const moves = (h.movements || []).reduce((s, m) => s + (Number(m.commission) || 0), 0);
    return (Number(h.commission) || 0) + moves;
  }

  // Rendimiento = disponible − capital aportado − comisiones + dividendos reinvertidos
  function holdingReinvestedDividends(pot, holdingId) {
    return (pot.dividends || [])
      .filter((d) => d.holdingId === holdingId && d.reinvested)
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }

  function holdingReturns(h, pot) {
    const reinvested = pot ? holdingReinvestedDividends(pot, h.id) : 0;
    return (Number(h.available) || 0) - holdingInvested(h) - holdingCommission(h) + reinvested;
  }

  function normalizeDividend(row) {
    return {
      id: row.id || uid(),
      holdingId: row.holdingId || "",
      year: Number(row.year) || new Date().getFullYear(),
      month: row.month || "01",
      amount: Number(row.amount) || 0,
      reinvested: Boolean(row.reinvested)
    };
  }

  function normalizeYieldChange(row) {
    return {
      id: row.id || uid(),
      year: Number(row.year) || new Date().getFullYear(),
      month: row.month || "01",
      annualYieldPct: Number(row.annualYieldPct) || 0
    };
  }

  function normalizeInvestment(row) {
    let type = row.type;
    if (type === "general") type = "bolsa";
    if (!INVEST_TYPES.some((t) => t.id === type)) type = "cdt";
    const termDays = row.termDays != null
      ? Math.max(1, Number(row.termDays) || 180)
      : Math.max(1, (Number(row.termMonths) || 6) * 30);
    const capital = Number(row.initialAmount) || 0;
    let interestRatePct = Number(row.interestRatePct);
    if (!Number.isFinite(interestRatePct)) {
      if (Number(row.interestGross) && capital) {
        interestRatePct = (Number(row.interestGross) / capital) * (365 / termDays) * 100;
      } else if (Number(row.interestAmount) && capital) {
        interestRatePct = (Number(row.interestAmount) / capital) * (365 / termDays) * 100;
      } else {
        interestRatePct = 0;
      }
    }
    const interestGross = capital * (interestRatePct / 100) * (termDays / 365);
    const payout = row.interestPayout === "mensual" ? "mensual" : "final";
    const annualYieldPct = Number(row.annualYieldPct) || 0;
    const yieldChanges = Array.isArray(row.yieldChanges) && row.yieldChanges.length
      ? row.yieldChanges.map(normalizeYieldChange)
      : (annualYieldPct
        ? [normalizeYieldChange({
          year: Number(row.openYear) || new Date().getFullYear(),
          month: row.openMonth || "01",
          annualYieldPct
        })]
        : []);
    return {
      id: row.id || uid(),
      name: row.name || "Producto",
      type,
      bankId: row.bankId || "",
      initialAmount: capital,
      openYear: Number(row.openYear) || new Date().getFullYear(),
      openMonth: row.openMonth || "01",
      openDay: Math.min(31, Math.max(1, Number(row.openDay) || 1)),
      interestGross,
      interestRatePct,
      interestPayout: payout,
      taxPct: row.taxPct == null ? DEFAULT_TAX_PCT : Number(row.taxPct),
      annualYieldPct,
      yieldChanges,
      termDays,
      holdings: Array.isArray(row.holdings) ? row.holdings.map(normalizeHolding) : [],
      dividends: Array.isArray(row.dividends) ? row.dividends.map(normalizeDividend) : []
    };
  }

  function normalizeAccount(row) {
    return {
      id: row.id || uid(),
      name: row.name || "Cuenta",
      bankId: row.bankId || "",
      type: ACCOUNT_TYPES.some((t) => t.id === row.type) ? row.type : "ahorros",
      openingBalance: Number(row.openingBalance) || 0,
      openingYear: Number(row.openingYear) || new Date().getFullYear(),
      openingMonth: row.openingMonth || monthKey(new Date().getMonth()),
      notes: row.notes || ""
    };
  }

  function normalizeBank(row) {
    return {
      id: row.id || uid(),
      name: row.name || "Banco"
    };
  }

  const now = new Date();
  const state = {
    profile: { name: "" },
    viewYear: now.getFullYear(),
    openMonth: null,
    openInvestId: null,
    tab: "recopilado",
    bankFilter: "all",
    usdRate: 0,
    banks: [],
    accounts: [],
    savings: [],
    investments: [],
    years: {}
  };

  const overview = document.getElementById("view-overview");
  const monthView = document.getElementById("view-month");
  const investView = document.getElementById("view-invest");
  const nameInput = document.getElementById("nombre");
  const notesInput = document.getElementById("month-notes");
  const banksModal = document.getElementById("banks-modal");
  const panels = {
    recopilado: document.getElementById("panel-recopilado"),
    meses: document.getElementById("panel-meses"),
    patrimonio: document.getElementById("panel-patrimonio"),
    factura: document.getElementById("panel-factura")
  };

  function money(value) {
    return Norte.formatMoney(value, CURRENCY);
  }

  function moneyDec(value, currency = CURRENCY) {
    const locale = currency === "COP" ? "es-CO" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
  }

  function moneyInv(value, pot) {
    if (pot && pot.type === "bolsa") return moneyDec(value, "USD");
    return moneyDec(value, CURRENCY);
  }

  function usdRate() {
    return Math.max(0, Number(state.usdRate) || 0);
  }

  function toCop(usdAmount) {
    return (Number(usdAmount) || 0) * usdRate();
  }

  function defaultBankId() {
    const active = activeBankId();
    if (active !== null) return active;
    return state.banks[0] ? state.banks[0].id : "";
  }

  function categoryById(id) {
    if (id === "ahorros" || id === "ahorro" || id === "inversion") {
      return CATEGORIES.find((item) => item.id === "otros");
    }
    return CATEGORIES.find((item) => item.id === id) || CATEGORIES.at(-1);
  }

  function investTypeLabel(type) {
    return (INVEST_TYPES.find((item) => item.id === type) || INVEST_TYPES[0]).label;
  }

  function isPositionType(type) {
    return type === "bolsa" || type === "manual";
  }

  function positionUnit(pot) {
    return pot && pot.type === "bolsa" ? "USD" : "COP";
  }

  function bankName(id) {
    if (!id) return "Sin banco";
    const bank = state.banks.find((item) => item.id === id);
    return bank ? bank.name : "Sin banco";
  }

  function matchesBank(bankId) {
    if (state.bankFilter === "all") return true;
    if (state.bankFilter === "none") return !bankId;
    return bankId === state.bankFilter;
  }

  // banco activo para anotar en Meses (null = "Todos", no se anota consolidado)
  function activeBankId() {
    if (state.bankFilter === "all") return null;
    if (state.bankFilter === "none") return "";
    return state.bankFilter;
  }

  function monthRequiresBank() {
    return activeBankId() === null;
  }

  function rowMatchesActiveBank(row) {
    const active = activeBankId();
    if (active === null) return true;
    return (row.bankId || "") === active;
  }

  function filterMonthRows(rows) {
    return (rows || []).filter(rowMatchesActiveBank);
  }

  function monthViewEntry(entry) {
    if (!entry) return emptyMonth();
    const active = activeBankId();
    if (active === null) {
      return {
        notes: entry.notes || "",
        incomes: entry.incomes || [],
        expenses: entry.expenses || [],
        contributions: entry.contributions || [],
        investments: entry.investments || [],
        transfers: entry.transfers || []
      };
    }
    return {
      notes: (entry.notesByBank && entry.notesByBank[active]) || "",
      incomes: filterMonthRows(entry.incomes),
      expenses: filterMonthRows(entry.expenses),
      contributions: filterMonthRows(entry.contributions),
      investments: filterMonthRows(entry.investments),
      transfers: (entry.transfers || []).filter((row) =>
        (row.fromBankId || "") === active || (row.toBankId || "") === active
      )
    };
  }

  function transferEffects(rows, bankScope) {
    let inbound = 0;
    let outbound = 0;
    let linkedInvest = 0;
    (rows || []).forEach((row) => {
      const amount = Math.abs(Number(row.amount) || 0);
      if (!amount) return;
      const from = row.fromBankId || "";
      const to = row.toBankId || "";
      const linked = Boolean(row.investmentId);
      if (bankScope === null) {
        // En "Todos" las transferencias internas se anulan; solo cuentan aportes ligados a inversión
        if (linked) linkedInvest += amount;
        return;
      }
      if (from === bankScope) outbound += amount;
      if (to === bankScope) {
        if (linked) linkedInvest += amount;
        else inbound += amount;
      }
    });
    return { inbound, outbound, linkedInvest, net: inbound - outbound };
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

  function contribSigned(row) {
    const amount = Math.abs(Number(row.amount) || 0);
    return row.kind === "retiro" ? -amount : amount;
  }

  function sumContribs(rows) {
    return (rows || []).reduce((sum, row) => sum + contribSigned(row), 0);
  }

  function monthTotals(entry) {
    const income = sumList(entry && entry.incomes);
    const expense = sumList(entry && entry.expenses);
    const contrib = sumContribs(entry && entry.contributions);
    const investDirect = sumList(entry && entry.investments);
    const active = activeBankId();
    const xfer = transferEffects(entry && entry.transfers, active);
    const invest = investDirect + xfer.linkedInvest;
    const aportes = Math.max(contrib, 0);
    const retiros = Math.max(-contrib, 0);
    return {
      income,
      expense,
      contrib,
      aportes,
      retiros,
      invest,
      transferIn: xfer.inbound,
      transferOut: xfer.outbound,
      transferNet: xfer.net,
      egresos: expense,
      ahorros: contrib,
      inversiones: invest,
      balance: income - expense - Math.max(contrib, 0) - invest + Math.max(-contrib, 0) + xfer.net
    };
  }

  function yearTotals(year) {
    const y = state.years[String(year)];
    const acc = {
      income: 0, expense: 0, contrib: 0, invest: 0,
      egresos: 0, ahorros: 0, inversiones: 0, balance: 0, aportes: 0, retiros: 0,
      transferIn: 0, transferOut: 0, transferNet: 0
    };
    if (!y) return acc;
    Object.values(y.months).forEach((entry) => {
      const t = monthTotals(monthViewEntry(normalizeMonth(entry)));
      acc.income += t.income;
      acc.expense += t.expense;
      acc.contrib += t.contrib;
      acc.invest += t.invest;
      acc.egresos += t.egresos;
      acc.ahorros += t.ahorros;
      acc.inversiones += t.inversiones;
      acc.aportes += t.aportes;
      acc.retiros += t.retiros;
      acc.transferIn += t.transferIn;
      acc.transferOut += t.transferOut;
      acc.transferNet += t.transferNet;
    });
    acc.balance = acc.income - acc.expense - acc.aportes - acc.invest + acc.retiros + acc.transferNet;
    return acc;
  }

  function allYearsList() {
    const keys = Object.keys(state.years).map(Number);
    keys.push(state.viewYear);
    state.accounts.forEach((acc) => keys.push(acc.openingYear));
    state.investments.forEach((inv) => keys.push(inv.openYear));
    return [...new Set(keys)].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  }

  function potFlow(kind, id, untilYear) {
    const field = kind === "saving" ? "contributions" : "investments";
    const key = kind === "saving" ? "savingId" : "investmentId";
    let total = 0;
    Object.entries(state.years).forEach(([yearKey, year]) => {
      if (untilYear != null && Number(yearKey) > untilYear) return;
      Object.values(year.months || {}).forEach((entry) => {
        (entry[field] || []).forEach((row) => {
          if (row[key] !== id) return;
          total += kind === "saving" ? contribSigned(row) : (Number(row.amount) || 0);
        });
        if (kind === "investment") {
          (entry.transfers || []).forEach((row) => {
            if (row.investmentId !== id) return;
            total += Number(row.amount) || 0;
          });
        }
      });
    });
    return total;
  }

  function potTotal(kind, id) {
    const pot = kind === "saving"
      ? state.savings.find((item) => item.id === id)
      : state.investments.find((item) => item.id === id);
    if (kind === "investment" && pot && isPositionType(pot.type)) {
      return bolsaTotals(pot).invested;
    }
    const initial = pot ? (Number(pot.initialAmount) || 0) : 0;
    return initial + potFlow(kind, id);
  }

  // Saldo al cierre de untilYear (incluye capital inicial + flujos de ese año y anteriores)
  function potTotalUntil(kind, id, untilYear) {
    const pot = kind === "saving"
      ? state.savings.find((item) => item.id === id)
      : state.investments.find((item) => item.id === id);
    if (kind === "investment" && pot && isPositionType(pot.type)) {
      return bolsaStockUntil(pot, untilYear);
    }
    const initial = pot ? (Number(pot.initialAmount) || 0) : 0;
    return initial + potFlow(kind, id, untilYear);
  }

  function bolsaStockUntil(pot, untilYear) {
    return (pot.holdings || []).reduce((acc, h) => {
      const base = Number(h.invested) || 0;
      const moves = (h.movements || [])
        .filter((m) => Number(m.year) <= untilYear)
        .reduce((s, m) => s + (Number(m.amount) || 0), 0);
      return acc + base + moves;
    }, 0);
  }

  // Solo flujos de años estrictamente anteriores (sin capital inicial)
  function potFlowBeforeYear(kind, id, year) {
    return potFlow(kind, id, year - 1);
  }

  function carryInTotals(year) {
    let savings = 0;
    let investments = 0;
    let savingsInitial = 0;
    let investmentsInitial = 0;
    state.savings.filter((s) => matchesBank(s.bankId)).forEach((s) => {
      savingsInitial += Number(s.initialAmount) || 0;
      savings += potFlowBeforeYear("saving", s.id, year);
    });
    state.investments.filter((s) => matchesBank(s.bankId)).forEach((s) => {
      if (isPositionType(s.type)) {
        const rate = s.type === "bolsa" ? usdRate() : 1;
        investmentsInitial += (s.holdings || []).reduce((acc, h) => acc + (Number(h.invested) || 0), 0) * rate;
        investments += (s.holdings || []).reduce((acc, h) => acc + (h.movements || [])
          .filter((m) => Number(m.year) < year)
          .reduce((sum, m) => sum + (Number(m.amount) || 0), 0), 0) * rate;
      } else {
        investmentsInitial += Number(s.initialAmount) || 0;
        investments += potFlowBeforeYear("investment", s.id, year);
      }
    });
    return {
      savings,
      investments,
      savingsInitial,
      investmentsInitial,
      opening: savingsInitial + investmentsInitial,
      priorFlow: savings + investments,
      total: savingsInitial + investmentsInitial + savings + investments
    };
  }

  function bolsaValueCop(pot) {
    const snap = bolsaTotals(pot);
    return {
      invested: toCop(snap.invested),
      available: toCop(snap.available),
      commission: toCop(snap.commission),
      returns: toCop(snap.returns)
    };
  }

  function patrimonioBreakdown(year, allBanks) {
    const bankOk = allBanks ? () => true : matchesBank;
    const accountSource = allBanks
      ? state.accounts.filter((acc) => Number(acc.openingYear) <= year)
      : patrimonioVisibleInYear(year);
    const accounts = accountSource
      .filter((acc) => bankOk(acc.bankId))
      .reduce((sum, acc) => sum + (Number(acc.openingBalance) || 0), 0);
    const savings = state.savings
      .filter((s) => bankOk(s.bankId))
      .reduce((sum, s) => sum + potTotalUntil("saving", s.id, year), 0);
    const investments = state.investments
      .filter((s) => bankOk(s.bankId))
      .reduce((sum, s) => {
        if (s.type === "bolsa") return sum + bolsaValueCop(s).available;
        if (s.type === "manual") return sum + bolsaTotals(s).available;
        if (s.type === "cdt") {
          const snap = investmentSnapshot(s);
          return sum + (snap.available || Number(s.initialAmount) || 0);
        }
        const snap = investmentSnapshot(s);
        return sum + (snap.available != null ? snap.available : potTotalUntil("investment", s.id, year));
      }, 0);
    return {
      accounts,
      savings,
      investments,
      total: accounts + savings + investments
    };
  }

  function filteredAccounts() {
    return state.accounts.filter((acc) => matchesBank(acc.bankId));
  }

  function patrimonioTotal() {
    return patrimonioBreakdown(state.viewYear).total;
  }

  function patrimonioVisibleInYear(year) {
    return filteredAccounts().filter((acc) => Number(acc.openingYear) <= year);
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
        const sliced = monthViewEntry(normalizeMonth(entry));
        (sliced.expenses || []).forEach((row) => expenses.push(row));
        contrib += Math.max(sumContribs(sliced.contributions), 0);
        invest += monthTotals(sliced).invest;
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
    input.value = value == null ? "" : value;
    Object.entries(attrs).forEach(([key, val]) => input.setAttribute(key, val));
    input.addEventListener("input", () => onChange(input));
    return input;
  }

  function makeSelect(value, options, onChange) {
    const select = document.createElement("select");
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      if (String(opt.value) === String(value)) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }

  function bankOptions(includeEmpty) {
    const opts = [];
    if (includeEmpty) opts.push({ value: "", label: "Sin banco" });
    state.banks.forEach((bank) => opts.push({ value: bank.id, label: bank.name }));
    return opts;
  }

  function monthOptions() {
    return MONTHS.map((name, index) => ({ value: monthKey(index), label: name }));
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
    return t.income > 0 || t.expense > 0 || t.contrib !== 0 || t.invest > 0
      || t.transferIn > 0 || t.transferOut > 0;
  }

  function setView(mode) {
    overview.hidden = mode !== "overview";
    monthView.hidden = mode !== "month";
    investView.hidden = mode !== "invest";
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
    if (tab === "patrimonio") renderPatrimonio();
    if (tab === "recopilado") {
      renderSavings();
      renderInvestments();
    }
  }

  function openMonth(year, key) {
    state.viewYear = Number(year);
    state.openMonth = { year: Number(year), month: key };
    state.openInvestId = null;
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

  function openInvest(id) {
    state.openInvestId = id;
    state.openMonth = null;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    render();
  }

  function closeInvest() {
    state.openInvestId = null;
    state.tab = "recopilado";
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
        else if (state.openInvestId) closeInvest();
        else render();
      });
      chips.appendChild(button);
    });
    const usdInput = document.getElementById("usd-rate");
    if (usdInput && document.activeElement !== usdInput) {
      usdInput.value = state.usdRate ? String(state.usdRate) : "";
    }
    renderBankChips();
  }

  function renderBankChips() {
    const box = document.getElementById("bank-chips");
    box.replaceChildren();
    const filters = [
      { id: "all", label: "Todos" },
      ...state.banks.map((bank) => ({ id: bank.id, label: bank.name })),
      { id: "none", label: "Sin banco" }
    ];
    filters.forEach((filter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chip${state.bankFilter === filter.id ? " is-active" : ""}`;
      button.textContent = filter.label;
      button.addEventListener("click", () => {
        state.bankFilter = filter.id;
        render();
      });
      box.appendChild(button);
    });
  }

  function moveBank(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= state.banks.length) return;
    const [item] = state.banks.splice(index, 1);
    state.banks.splice(next, 0, item);
    renderBanksModal();
    renderBankChips();
  }

  function renderBanksModal() {
    const box = document.getElementById("banks-list");
    box.replaceChildren();
    if (!state.banks.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = "Añade Bancolombia, Nequi, Davivienda… para filtrar patrimonio, ahorros e inversiones.";
      box.appendChild(p);
      return;
    }
    state.banks.forEach((bank, index) => {
      const card = document.createElement("article");
      card.className = "saving-card bank-card";
      const nameField = document.createElement("div");
      nameField.className = "field";
      const label = document.createElement("label");
      label.textContent = "Nombre del banco";
      nameField.append(
        label,
        makeInput(bank.name, (input) => {
          bank.name = input.value;
          renderBankChips();
        }, { type: "text", placeholder: "Bancolombia" })
      );
      const order = document.createElement("div");
      order.className = "bank-order";
      const up = document.createElement("button");
      up.type = "button";
      up.className = "btn";
      up.textContent = "↑";
      up.setAttribute("aria-label", "Subir banco");
      up.disabled = index === 0;
      up.addEventListener("click", () => moveBank(index, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.className = "btn";
      down.textContent = "↓";
      down.setAttribute("aria-label", "Bajar banco");
      down.disabled = index === state.banks.length - 1;
      down.addEventListener("click", () => moveBank(index, 1));
      order.append(up, down, removeButton(() => {
        const id = bank.id;
        state.banks.splice(index, 1);
        state.accounts.forEach((acc) => { if (acc.bankId === id) acc.bankId = ""; });
        state.savings.forEach((s) => { if (s.bankId === id) s.bankId = ""; });
        state.investments.forEach((s) => { if (s.bankId === id) s.bankId = ""; });
        if (state.bankFilter === id) state.bankFilter = "all";
        renderBanksModal();
        render();
      }));
      card.append(nameField, order);
      box.appendChild(card);
    });
  }

  function renderOverview() {
    const totals = yearTotals(state.viewYear);
    const carry = carryInTotals(state.viewYear);
    const patrimonio = patrimonioBreakdown(state.viewYear);
    const rate = totals.income > 0 ? ((totals.income - totals.expense) / totals.income) * 100 : 0;
    const filterNote = state.bankFilter === "all"
      ? "Todos los bancos"
      : state.bankFilter === "none"
        ? "Sin banco asignado"
        : bankName(state.bankFilter);

    document.getElementById("year-metrics").replaceChildren(
      metric("Patrimonio total", money(patrimonio.total), `${filterNote} · cuentas ${money(patrimonio.accounts)}`),
      metric("Ingresos del año", money(totals.income), `${state.viewYear}`),
      metric("Egresos del año", money(totals.egresos), "Gastos del día a día"),
      metric(
        "Ahorros e inversiones",
        money(patrimonio.savings + patrimonio.investments),
        carry.priorFlow > 0
          ? `Stock actual · arrastre flujos ${money(carry.priorFlow)}`
          : `Ahorros ${money(patrimonio.savings)} · Inv. ${money(patrimonio.investments)}`
      ),
      metric("Balance del flujo", money(totals.balance), `Tasa de ahorro ${Norte.formatPct(rate)}`, totals.balance >= 0 ? "positive" : "negative")
    );

    const points = MONTHS.map((name, index) => {
      const entry = getMonth(state.viewYear, monthKey(index), false);
      const t = monthTotals(monthViewEntry(entry || emptyMonth()));
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
      centerValue: money(totals.expense + totals.aportes + totals.invest),
      empty: "Aún no hay egresos ni aportes este año",
      format: money
    });

    renderSavings();
    renderInvestments();
    renderMonthGrid();
    renderPatrimonio();
    renderInvoice();
    setTab(state.tab);
  }

  function renderSavings() {
    const list = state.savings.filter((s) => matchesBank(s.bankId));
    const box = document.getElementById("savings-list");
    box.replaceChildren();
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = state.savings.length
        ? "No hay ahorros para este filtro de banco."
        : "Crea un ahorro con saldo inicial (lo que ya tienes) y aporta o retira desde cada mes con concepto.";
      box.appendChild(p);
      return;
    }
    list.forEach((pot) => {
      const index = state.savings.findIndex((item) => item.id === pot.id);
      const card = document.createElement("article");
      card.className = "saving-card saving-card-rich";

      const paintTotals = () => {
        const total = potTotal("saving", pot.id);
        const carryFlow = potFlowBeforeYear("saving", pot.id, state.viewYear);
        const strong = card.querySelector("[data-saving-total]");
        const meta = card.querySelector("[data-saving-meta]");
        const fill = card.querySelector(".progress span");
        if (strong) strong.textContent = money(total);
        if (meta) {
          meta.textContent = carryFlow > 0
            ? `Arrastre de flujos ${money(carryFlow)} · total ${money(total)}`
            : (pot.target ? `${Norte.formatPct(Math.min((total / pot.target) * 100, 999))} de la meta` : "Sin meta");
        }
        if (fill) {
          fill.style.width = pot.target
            ? `${Math.min(100, (total / pot.target) * 100)}%`
            : (total > 0 ? "100%" : "0%");
        }
      };

      const nameField = document.createElement("div");
      nameField.className = "field";
      nameField.append(
        Object.assign(document.createElement("label"), { textContent: "Nombre" }),
        makeInput(pot.name, (input) => {
          pot.name = input.value;
          if (state.openMonth) renderContribs();
        }, { type: "text", placeholder: "Vehículos / Emergencia" })
      );

      const bankField = document.createElement("div");
      bankField.className = "field";
      bankField.append(
        Object.assign(document.createElement("label"), { textContent: "Banco" }),
        makeSelect(pot.bankId || "", bankOptions(true), (value) => {
          pot.bankId = value;
          render();
        })
      );

      const initialField = document.createElement("div");
      initialField.className = "field field-money";
      initialField.append(
        Object.assign(document.createElement("label"), { textContent: "Saldo inicial" }),
        moneyField(pot.initialAmount, (val) => {
          pot.initialAmount = val;
          paintTotals();
        })
      );

      const targetField = document.createElement("div");
      targetField.className = "field field-money field-meta";
      targetField.append(
        Object.assign(document.createElement("label"), { textContent: "Meta" }),
        moneyField(pot.target, (val) => {
          pot.target = val;
          paintTotals();
        })
      );

      const done = document.createElement("div");
      done.className = "field";
      const strong = document.createElement("strong");
      strong.dataset.savingTotal = "1";
      const meta = document.createElement("div");
      meta.className = "saving-meta";
      meta.dataset.savingMeta = "1";
      done.append(
        Object.assign(document.createElement("label"), { textContent: "Acumulado" }),
        strong,
        meta
      );

      const bar = document.createElement("div");
      bar.className = "progress";
      bar.appendChild(document.createElement("span"));

      card.append(nameField, bankField, initialField, targetField, done, removeButton(() => {
        state.savings.splice(index, 1);
        Object.values(state.years).forEach((year) => {
          Object.values(year.months || {}).forEach((entry) => {
            entry.contributions = (entry.contributions || []).filter((row) => row.savingId !== pot.id);
          });
        });
        render();
      }), bar);
      paintTotals();
      box.appendChild(card);
    });
  }

  function renderInvestments() {
    const list = state.investments.filter((s) => matchesBank(s.bankId));
    const box = document.getElementById("invest-list");
    box.replaceChildren();
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = state.investments.length
        ? "No hay productos para este filtro de banco."
        : "Crea un producto (CDT, alta rentabilidad, bolsa o inversión manual) e indica el capital que ya tienes invertido.";
      box.appendChild(p);
      return;
    }
    list.forEach((pot) => {
      const index = state.investments.findIndex((item) => item.id === pot.id);
      const card = document.createElement("article");
      card.className = "invest-card";
      const total = potTotal("investment", pot.id);
      const snapshot = investmentSnapshot(pot);
      const fmt = (value) => moneyInv(value, pot);
      const cdtNet = pot.type === "cdt" ? cdtNetInterest(pot) : null;
      const outside = pot.type === "cdt"
        ? {
          invested: snapshot.invested,
          available: snapshot.available,
          returns: cdtNet,
          returnsHint: "Total del plazo"
        }
        : {
          invested: snapshot.invested,
          available: snapshot.available,
          returns: snapshot.returns,
          returnsHint: pot.type === "alta_rentabilidad"
            ? (state.viewYear < now.getFullYear() ? `Año ${state.viewYear}` : "Hasta este mes")
            : ""
        };
      const totalLabel = pot.type === "bolsa"
        ? `${fmt(snapshot.available)} · ${money(toCop(snapshot.available))} COP`
        : money(snapshot.available);

      const top = document.createElement("div");
      top.className = "invest-card-top";
      const title = document.createElement("div");
      const h3 = document.createElement("h3");
      h3.textContent = pot.name || "Sin nombre";
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = investTypeLabel(pot.type);
      const sub = document.createElement("p");
      sub.className = "faint";
      sub.textContent = `${bankName(pot.bankId)} · ${isPositionType(pot.type) ? `disponible ${totalLabel}` : `capital ${money(total)}`}`;
      title.append(h3, badge, sub);

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn";
      openBtn.textContent = "Abrir";
      openBtn.addEventListener("click", () => openInvest(pot.id));

      top.append(title, openBtn);

      const mini = document.createElement("div");
      mini.className = "invest-mini";
      [
        ["Invertido", fmt(outside.invested), ""],
        ["Disponible", fmt(outside.available), ""],
        ["Rendimientos", fmt(outside.returns), outside.returnsHint]
      ].forEach(([label, value, hint]) => {
        const cell = document.createElement("div");
        const k = document.createElement("span");
        k.className = "muted";
        k.textContent = label;
        const strong = document.createElement("strong");
        strong.textContent = value;
        cell.append(k, strong);
        if (hint) {
          const note = document.createElement("p");
          note.className = "invest-mini-hint";
          note.textContent = hint;
          cell.appendChild(note);
        }
        mini.appendChild(cell);
      });

      card.append(top, mini, removeButton(() => {
        state.investments.splice(index, 1);
        Object.values(state.years).forEach((year) => {
          Object.values(year.months || {}).forEach((entry) => {
            entry.investments = (entry.investments || []).filter((row) => row.investmentId !== pot.id);
          });
        });
        if (state.openInvestId === pot.id) state.openInvestId = null;
        render();
      }));
      box.appendChild(card);
    });
  }

  function investmentSnapshot(pot) {
    if (isPositionType(pot.type)) {
      return bolsaTotals(pot);
    }
    const rows = buildInvestSchedule(pot);
    const cap = snapshotCapIndex();
    const visible = rows.filter((row) => ymIndex(row.year, row.month) <= cap);
    const last = visible.at(-1) || {
      invested: Number(pot.initialAmount) || 0,
      commission: 0,
      available: Number(pot.initialAmount) || 0,
      returns: 0,
      periodReturn: 0
    };
    if (pot.type === "alta_rentabilidad") {
      return {
        invested: last.invested,
        commission: last.commission || 0,
        available: last.available,
        returns: visible.reduce((sum, row) => sum + (Number(row.periodReturn) || 0), 0)
      };
    }
    return last;
  }

  function snapshotCapIndex() {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (state.viewYear < currentYear) return ymIndex(state.viewYear, 12);
    if (state.viewYear > currentYear) return ymIndex(state.viewYear, "01") - 1;
    return ymIndex(currentYear, monthKey(currentMonth - 1));
  }

  function bolsaTotals(pot) {
    const holdings = pot.holdings || [];
    return holdings.reduce((acc, h) => {
      acc.invested += holdingInvested(h);
      acc.available += Number(h.available) || 0;
      acc.commission += holdingCommission(h);
      acc.returns += holdingReturns(h, pot);
      return acc;
    }, { invested: 0, available: 0, commission: 0, returns: 0 });
  }

  function ymIndex(year, month) {
    return Number(year) * 12 + (Number(month) - 1);
  }

  function dayOptions() {
    return Array.from({ length: 31 }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1)
    }));
  }

  function cdtOpenDate(pot) {
    const year = Number(pot.openYear) || now.getFullYear();
    const month = Math.max(1, Math.min(12, Number(pot.openMonth) || 1)) - 1;
    const day = Math.max(1, Math.min(31, Number(pot.openDay) || 1));
    return new Date(year, month, day);
  }

  function cdtMaturityDate(pot) {
    const open = cdtOpenDate(pot);
    const days = Math.max(1, Number(pot.termDays) || 180);
    const mature = new Date(open);
    mature.setDate(mature.getDate() + days);
    return mature;
  }

  function cdtGrossInterest(pot) {
    const capital = Number(pot.initialAmount) || 0;
    const rate = (Number(pot.interestRatePct) || 0) / 100;
    const days = Math.max(1, Number(pot.termDays) || 180);
    return capital * rate * (days / 365);
  }

  function cdtImpliedRate(pot) {
    return Number(pot.interestRatePct) || 0;
  }

  function cdtNetInterest(pot) {
    const gross = cdtGrossInterest(pot);
    return gross * (1 - ((Number(pot.taxPct) || 0) / 100));
  }

  function yieldPctForMonth(pot, year, month) {
    const hist = (pot.yieldChanges || [])
      .slice()
      .sort((a, b) => ymIndex(a.year, a.month) - ymIndex(b.year, b.month));
    if (!hist.length) return Number(pot.annualYieldPct) || 0;
    let rate = Number(hist[0].annualYieldPct) || 0;
    const target = ymIndex(year, month);
    hist.forEach((change) => {
      if (ymIndex(change.year, change.month) <= target) {
        rate = Number(change.annualYieldPct) || 0;
      }
    });
    return rate;
  }

  function setAnnualYieldPct(pot, val) {
    const next = Number.isFinite(val) ? val : 0;
    const prev = Number(pot.annualYieldPct) || 0;
    if (!Array.isArray(pot.yieldChanges)) pot.yieldChanges = [];
    if (!pot.yieldChanges.length) {
      pot.yieldChanges.push(normalizeYieldChange({
        year: pot.openYear,
        month: pot.openMonth,
        annualYieldPct: prev
      }));
    }
    const y = now.getFullYear();
    const m = monthKey(now.getMonth());
    const existing = pot.yieldChanges.find((row) => Number(row.year) === y && row.month === m);
    if (existing) existing.annualYieldPct = next;
    else pot.yieldChanges.push(normalizeYieldChange({ year: y, month: m, annualYieldPct: next }));
    pot.annualYieldPct = next;
  }

  function monthsBetweenInclusive(start, end) {
    const rows = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      rows.push({
        year: cursor.getFullYear(),
        month: monthKey(cursor.getMonth()),
        label: `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return rows.length ? rows : [{
      year: start.getFullYear(),
      month: monthKey(start.getMonth()),
      label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`
    }];
  }

  function buildInvestSchedule(pot) {
    const start = ymIndex(pot.openYear, pot.openMonth);
    const endYear = Math.max(state.viewYear, pot.openYear, now.getFullYear());
    const end = ymIndex(endYear, 12);
    const monthsCount = Math.max(1, end - start + 1);
    const rows = [];

    if (pot.type === "cdt") {
      const capital = Number(pot.initialAmount) || 0;
      const grossInterest = cdtGrossInterest(pot);
      pot.interestGross = grossInterest;
      const tax = grossInterest * ((Number(pot.taxPct) || 0) / 100);
      const netInterest = grossInterest - tax;
      const open = cdtOpenDate(pot);
      const mature = cdtMaturityDate(pot);
      const periods = monthsBetweenInclusive(open, mature);
      const payout = pot.interestPayout === "mensual" ? "mensual" : "final";
      const n = periods.length;

      periods.forEach((period, i) => {
        const isLast = i === n - 1;
        let gross = 0;
        let net = 0;
        if (payout === "mensual") {
          gross = grossInterest / n;
          net = netInterest / n;
        } else if (isLast) {
          gross = grossInterest;
          net = netInterest;
        }
        const accruedGross = payout === "mensual" ? grossInterest * ((i + 1) / n) : (isLast ? grossInterest : 0);
        const accruedNet = payout === "mensual" ? netInterest * ((i + 1) / n) : (isLast ? netInterest : 0);
        rows.push({
          year: period.year,
          month: period.month,
          label: period.label + (i === 0 ? ` · día ${pot.openDay}` : "") + (isLast ? " · vencimiento" : ""),
          invested: capital,
          commission: 0,
          availableGross: capital + accruedGross,
          available: capital + accruedNet,
          returnsGross: accruedGross,
          returns: accruedNet,
          tax: accruedGross - accruedNet,
          periodGross: gross,
          periodNet: net,
          note: payout === "mensual" ? "Interés del mes" : (isLast ? "Pago al vencimiento" : "Sin pago este mes")
        });
      });
      return rows;
    }

    if (pot.type === "alta_rentabilidad") {
      let balance = Number(pot.initialAmount) || 0;
      let contributed = balance;
      let cumulativeReturns = 0;
      for (let i = 0; i < monthsCount; i += 1) {
        const absolute = start + i;
        const year = Math.floor(absolute / 12);
        const month = (absolute % 12) + 1;
        const key = monthKey(month - 1);
        const entry = getMonth(year, key, false);
        const add = (entry && (entry.investments || [])
          .filter((row) => row.investmentId === pot.id)
          .reduce((sum, row) => sum + (Number(row.amount) || 0), 0)) || 0;
        const transferAdd = (entry && (entry.transfers || [])
          .filter((row) => row.investmentId === pot.id)
          .reduce((sum, row) => sum + (Number(row.amount) || 0), 0)) || 0;
        const monthlyRate = (yieldPctForMonth(pot, year, key) / 100) / 12;
        const interest = balance * monthlyRate;
        balance += interest + add + transferAdd;
        contributed += add + transferAdd;
        cumulativeReturns += interest;
        rows.push({
          year,
          month: key,
          label: `${MONTHS[month - 1]} ${year}`,
          invested: contributed,
          commission: 0,
          available: balance,
          returns: interest,
          periodReturn: interest,
          cumulativeReturns,
          note: `Rendimiento mes ${moneyInv(interest, pot)}${add || transferAdd ? ` · aporte ${moneyInv(add + transferAdd, pot)}` : ""} · ${Norte.formatPct(yieldPctForMonth(pot, year, key), 2)} EA`
        });
      }
      return rows;
    }

    (pot.holdings || []).forEach((h) => {
      const kindLabel = (BOLSA_KINDS.find((k) => k.id === h.kind) || BOLSA_KINDS[0]).label;
      rows.push({
        year: pot.openYear,
        month: pot.openMonth,
        label: `${kindLabel}${h.name ? ` · ${h.name}` : ""}`,
        invested: holdingInvested(h),
        commission: holdingCommission(h),
        available: Number(h.available) || 0,
        returns: holdingReturns(h, pot),
        note: (h.movements || []).length
          ? `${(h.movements || []).length} aporte(s)`
          : "Sin aportes extra"
      });
    });
    return rows;
  }

  function paintPositionCharts(pot, last) {
    const colors = ["#8aa4c4", "#9cbaa4", "#d4c4a0", "#c98970", "#b8a1d4", "#e0c07a", "#c47a8a"];
    const dist = (pot.holdings || []).map((h, i) => ({
      id: h.id,
      label: h.name || (BOLSA_KINDS.find((k) => k.id === h.kind) || BOLSA_KINDS[0]).label,
      color: colors[i % colors.length],
      value: Math.max(0, Number(h.available) || 0)
    })).filter((s) => s.value > 0);
    NorteCharts.donutChart(document.getElementById("invest-donut"), dist, {
      centerLabel: "Disponible",
      centerValue: moneyInv(last.available, pot),
      empty: "Añade posiciones con disponible para ver la distribución",
      format: (v) => moneyInv(v, pot)
    });
    const bars = (pot.holdings || []).map((h, i) => ({
      label: h.name || (BOLSA_KINDS.find((k) => k.id === h.kind) || BOLSA_KINDS[0]).label,
      value: holdingReturns(h, pot),
      color: holdingReturns(h, pot) >= 0 ? colors[i % colors.length] : "#c98970"
    }));
    NorteCharts.barsChart(document.getElementById("invest-bars"), bars.length ? bars : [{ label: "Sin datos", value: 0, color: "#7a7f8a" }], {
      format: (v) => moneyInv(v, pot)
    });
  }

  function updateInvestSide(pot) {
    const schedule = buildInvestSchedule(pot);
    const last = investmentSnapshot(pot);
    const positioned = isPositionType(pot.type);

    const charts = document.getElementById("invest-charts");
    const barsPanel = document.getElementById("invest-bars-panel");
    if (charts) charts.hidden = !positioned;
    if (barsPanel) barsPanel.hidden = !positioned || !(pot.holdings || []).length;

    if (pot.type === "cdt") {
      const gross = cdtGrossInterest(pot);
      const tax = gross * ((Number(pot.taxPct) || 0) / 100);
      const net = gross - tax;
      const rate = Number(pot.interestRatePct) || 0;
      pot.interestGross = gross;
      document.getElementById("invest-metrics").replaceChildren(
        metric("Capital", moneyInv(Number(pot.initialAmount) || 0, pot), `${Number(pot.termDays) || 0} días · abre día ${pot.openDay}`),
        metric("Intereses brutos", moneyInv(gross, pot), `${Norte.formatPct(rate, 2)} EA`),
        metric("Impuesto", moneyInv(tax, pot), `${Norte.formatPct(pot.taxPct)} retención`),
        metric("Intereses netos", moneyInv(net, pot), pot.interestPayout === "mensual" ? "Pago mes a mes" : "Pago al vencimiento · total del plazo")
      );
    } else if (pot.type === "bolsa") {
      document.getElementById("invest-metrics").replaceChildren(
        metric("Dinero invertido", moneyInv(last.invested, pot), "USD · capital + aportes"),
        metric("Comisión", moneyInv(last.commission, pot), "USD"),
        metric("Dinero disponible", moneyInv(last.available, pot), "USD · valor actual"),
        metric("Rendimientos", moneyInv(last.returns, pot), "USD · incl. dividendos reinvertidos"),
        metric("Dinero disponible en pesos", money(toCop(last.available)), usdRate() ? `TRM ${moneyDec(usdRate())}` : "Define el valor del dólar arriba"),
        metric("Rendimiento en pesos", money(toCop(last.returns)), usdRate() ? `TRM ${moneyDec(usdRate())}` : "Define el valor del dólar arriba")
      );
      paintPositionCharts(pot, last);
    } else if (pot.type === "manual") {
      document.getElementById("invest-metrics").replaceChildren(
        metric("Dinero invertido", moneyInv(last.invested, pot), "Pesos · capital + aportes"),
        metric("Comisión", moneyInv(last.commission, pot), "Pesos"),
        metric("Dinero disponible", moneyInv(last.available, pot), "Pesos · valor actual"),
        metric("Rendimientos", moneyInv(last.returns, pot), "Pesos · incl. dividendos reinvertidos")
      );
      paintPositionCharts(pot, last);
    } else {
      document.getElementById("invest-metrics").replaceChildren(
        metric("Dinero invertido", moneyInv(last.invested, pot), "Capital + aportes hasta hoy"),
        metric("Comisión", moneyInv(last.commission, pot), "—"),
        metric("Dinero disponible", moneyInv(last.available, pot), "Capital + rendimientos hasta hoy"),
        metric("Rendimientos", moneyInv(last.returns, pot), `Hasta ${MONTHS[now.getMonth()]} · ${Norte.formatPct(pot.annualYieldPct, 2)} actual`)
      );
    }

    const head = document.getElementById("invest-table-head");
    const body = document.getElementById("invest-table-body");
    head.replaceChildren();
    body.replaceChildren();
    const hr = document.createElement("tr");
    const cols = pot.type === "cdt"
      ? ["Periodo", "Invertido", "Rend. bruto", "Impuesto", "Rend. neto", "Disp. neto"]
      : isPositionType(pot.type)
        ? ["Posición", "Invertido", "Comisión", "Disponible", "Rendimientos"]
        : ["Mes", "Invertido", "Comisión", "Disponible", "Rendimientos"];
    cols.forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      hr.appendChild(th);
    });
    head.appendChild(hr);

    if (!schedule.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = cols.length;
      td.style.textAlign = "left";
      td.textContent = isPositionType(pot.type)
        ? "Añade un ETF, acción o cripto para ver el detalle."
        : "Sin proyección todavía.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    schedule.forEach((row) => {
      const tr = document.createElement("tr");
      const cells = pot.type === "cdt"
        ? [row.label, moneyInv(row.invested, pot), moneyInv(row.returnsGross || 0, pot), moneyInv(row.tax || 0, pot), moneyInv(row.returns || 0, pot), moneyInv(row.available || 0, pot)]
        : [row.label, moneyInv(row.invested, pot), moneyInv(row.commission, pot), moneyInv(row.available, pot), moneyInv(row.returns, pot)];
      cells.forEach((text, idx) => {
        const td = document.createElement("td");
        td.textContent = text;
        if (idx === 0) td.style.textAlign = "left";
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function fieldWrap(labelText, control) {
    const field = document.createElement("div");
    field.className = "field";
    const label = document.createElement("label");
    label.textContent = labelText;
    field.append(label, control);
    return field;
  }

  function moneyField(value, onChange) {
    return makeInput(value === 0 || value ? value : "", (input) => {
      const raw = input.value;
      const parsed = Number.parseFloat(raw);
      onChange(Number.isFinite(parsed) ? parsed : 0, input);
    }, { type: "number", min: "0", step: "0.01", placeholder: "0", inputmode: "decimal" });
  }

  function pctField(value, onChange) {
    return makeInput(value === 0 || value ? value : "", (input) => {
      const parsed = Number.parseFloat(input.value);
      onChange(Number.isFinite(parsed) ? parsed : 0, input);
    }, { type: "number", min: "0", step: "0.01", placeholder: "0", inputmode: "decimal" });
  }

  function renderBolsaHoldings(pot, container) {
    const section = document.createElement("section");
    section.className = "card card-pad holdings-panel";
    const usd = pot.type === "bolsa";
    const unit = positionUnit(pot);
    const head = document.createElement("div");
    head.className = "list-head";
    const titleWrap = document.createElement("div");
    titleWrap.append(
      Object.assign(document.createElement("h2"), { textContent: usd ? "Posiciones en bolsa" : "Posiciones" }),
      Object.assign(document.createElement("p"), {
        className: "faint",
        textContent: usd
          ? "Rendimiento = disponible − invertido − comisión (+ dividendos reinvertidos). Los aportes llevan monto y comisión del mes. Cifras en USD."
          : "Igual que bolsa, pero todo queda en pesos: no se multiplica por el valor del dólar. Rendimiento = disponible − invertido − comisión (+ dividendos reinvertidos)."
      })
    );
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn";
    addBtn.textContent = "Nueva posición";
    addBtn.addEventListener("click", () => {
      pot.holdings.push(normalizeHolding({ kind: "etf", name: "" }));
      renderInvestDetail();
    });
    head.append(titleWrap, addBtn);
    section.appendChild(head);

    if (!pot.holdings.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "Crea una posición (por ejemplo un ETF) y registra cuánto tienes y los aportes irregulares.";
      section.appendChild(empty);
      container.appendChild(section);
      return;
    }

    pot.holdings.forEach((holding, hIndex) => {
      const card = document.createElement("article");
      card.className = "holding-card";

      const grid = document.createElement("div");
      grid.className = "holding-grid";

      const kindField = document.createElement("div");
      kindField.className = "field";
      kindField.append(
        Object.assign(document.createElement("label"), { textContent: "Tipo" }),
        makeSelect(holding.kind, BOLSA_KINDS.map((k) => ({ value: k.id, label: k.label })), (value) => {
          holding.kind = value;
          renderInvestDetail();
        })
      );

      const nameField = document.createElement("div");
      nameField.className = "field";
      nameField.append(
        Object.assign(document.createElement("label"), {
          textContent: holding.kind === "etf" ? "Nombre del ETF" : holding.kind === "cripto" ? "Cripto" : "Acción"
        }),
        makeInput(holding.name, (input) => {
          holding.name = input.value;
          updateInvestSide(pot);
        }, { type: "text", placeholder: holding.kind === "etf" ? "VOO / QQQ…" : "Nombre" })
      );

      const investedField = document.createElement("div");
      investedField.className = "field field-money";
      investedField.append(
        Object.assign(document.createElement("label"), { textContent: `Dinero invertido (${unit})` }),
        moneyField(holding.invested, (val) => {
          holding.invested = val;
          updateInvestSide(pot);
          const ret = card.querySelector("[data-holding-returns]");
          if (ret) ret.textContent = moneyInv(holdingReturns(holding, pot), pot);
        })
      );

      const availableField = document.createElement("div");
      availableField.className = "field field-money";
      availableField.append(
        Object.assign(document.createElement("label"), { textContent: `Dinero disponible (${unit})` }),
        moneyField(holding.available, (val) => {
          holding.available = val;
          updateInvestSide(pot);
          const ret = card.querySelector("[data-holding-returns]");
          if (ret) ret.textContent = moneyInv(holdingReturns(holding, pot), pot);
        })
      );

      const commissionField = document.createElement("div");
      commissionField.className = "field field-money";
      commissionField.append(
        Object.assign(document.createElement("label"), { textContent: `Comisión base (${unit})` }),
        moneyField(holding.commission, (val) => {
          holding.commission = val;
          updateInvestSide(pot);
          const ret = card.querySelector("[data-holding-returns]");
          if (ret) ret.textContent = moneyInv(holdingReturns(holding, pot), pot);
        })
      );

      const returnsField = document.createElement("div");
      returnsField.className = "field";
      const returnsValue = document.createElement("strong");
      returnsValue.dataset.holdingReturns = "1";
      returnsValue.textContent = moneyInv(holdingReturns(holding, pot), pot);
      const returnsHint = document.createElement("div");
      returnsHint.className = "saving-meta";
      returnsHint.textContent = "Calculado: disponible − invertido − comisión (+ div. reinvertidos)";
      returnsField.append(
        Object.assign(document.createElement("label"), { textContent: "Rendimientos" }),
        returnsValue,
        returnsHint
      );

      grid.append(kindField, nameField, investedField, availableField, commissionField, returnsField);
      card.append(grid, removeButton(() => {
        pot.holdings.splice(hIndex, 1);
        renderInvestDetail();
      }));

      const moves = document.createElement("div");
      moves.className = "holding-moves";
      const movesHead = document.createElement("div");
      movesHead.className = "list-head";
      movesHead.append(
        Object.assign(document.createElement("h3"), { textContent: "Aportes por mes" }),
        (() => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn";
          btn.textContent = "Añadir aporte";
          btn.addEventListener("click", () => {
            holding.movements.push({
              id: uid(),
              year: state.viewYear,
              month: monthKey(now.getMonth()),
              amount: 0,
              commission: 0,
              concept: ""
            });
            renderInvestDetail();
          });
          return btn;
        })()
      );
      moves.appendChild(movesHead);

      if (!holding.movements.length) {
        const hint = document.createElement("p");
        hint.className = "empty-note";
        hint.textContent = "Registra solo los meses en los que aportaste: monto y comisión de ese aporte.";
        moves.appendChild(hint);
      } else {
        const legend = document.createElement("div");
        legend.className = "move-legend";
        ["Año", "Mes", "Monto aportado", "Comisión", "Concepto", ""].forEach((text) => {
          const span = document.createElement("span");
          span.textContent = text;
          legend.appendChild(span);
        });
        moves.appendChild(legend);

        holding.movements.forEach((mov, mIndex) => {
          const row = document.createElement("div");
          row.className = "holding-move-row";
          row.append(
            makeSelect(String(mov.year), allYearsList().map((y) => ({ value: String(y), label: String(y) })), (value) => {
              mov.year = Number(value);
              updateInvestSide(pot);
            }),
            makeSelect(mov.month, monthOptions(), (value) => {
              mov.month = value;
              updateInvestSide(pot);
            }),
            moneyField(mov.amount, (val) => {
              mov.amount = val;
              updateInvestSide(pot);
              const ret = card.querySelector("[data-holding-returns]");
              if (ret) ret.textContent = moneyInv(holdingReturns(holding, pot), pot);
            }),
            moneyField(mov.commission, (val) => {
              mov.commission = val;
              updateInvestSide(pot);
              const ret = card.querySelector("[data-holding-returns]");
              if (ret) ret.textContent = moneyInv(holdingReturns(holding, pot), pot);
            }),
            makeInput(mov.concept, (input) => {
              mov.concept = input.value;
            }, { type: "text", placeholder: "Concepto" }),
            removeButton(() => {
              holding.movements.splice(mIndex, 1);
              renderInvestDetail();
            })
          );
          moves.appendChild(row);
        });
      }
      card.appendChild(moves);
      section.appendChild(card);
    });
    container.appendChild(section);
    renderDividends(pot, container);
  }

  function renderDividends(pot, container) {
    if (!Array.isArray(pot.dividends)) pot.dividends = [];
    const section = document.createElement("section");
    section.className = "card card-pad dividends-panel";
    const head = document.createElement("div");
    head.className = "list-head";
    const titleWrap = document.createElement("div");
    titleWrap.append(
      Object.assign(document.createElement("h2"), { textContent: "Dividendos" }),
      Object.assign(document.createElement("p"), {
        className: "faint",
        textContent: "Registra dividendos por posición. Si marcas reinvertido, se suma al rendimiento de esa posición."
      })
    );
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn";
    addBtn.textContent = "Añadir dividendo";
    addBtn.addEventListener("click", () => {
      const first = (pot.holdings || [])[0];
      pot.dividends.push(normalizeDividend({
        holdingId: first ? first.id : "",
        year: state.viewYear,
        month: monthKey(now.getMonth()),
        amount: 0,
        reinvested: false
      }));
      renderInvestDetail();
    });
    head.append(titleWrap, addBtn);
    section.appendChild(head);

    if (!(pot.holdings || []).length) {
      section.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Crea posiciones primero para poder asignar dividendos."
      }));
      container.appendChild(section);
      return;
    }

    if (!pot.dividends.length) {
      section.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Sin dividendos registrados."
      }));
      container.appendChild(section);
      return;
    }

    const legend = document.createElement("div");
    legend.className = "move-legend dividend-row";
    ["Posición", "Año", "Mes", `Valor (${positionUnit(pot)})`, "Reinvertido", ""].forEach((text) => {
      legend.appendChild(Object.assign(document.createElement("span"), { textContent: text }));
    });
    section.appendChild(legend);

    pot.dividends.forEach((div, index) => {
      const row = document.createElement("div");
      row.className = "dividend-row";
      const holdingOpts = (pot.holdings || []).map((h) => ({
        value: h.id,
        label: h.name || (BOLSA_KINDS.find((k) => k.id === h.kind) || BOLSA_KINDS[0]).label
      }));
      const checkWrap = document.createElement("label");
      checkWrap.className = "check";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = Boolean(div.reinvested);
      check.addEventListener("change", () => {
        div.reinvested = check.checked;
        updateInvestSide(pot);
        renderInvestDetail();
      });
      checkWrap.append(check, document.createTextNode("¿Reinvertido?"));
      row.append(
        makeSelect(div.holdingId, holdingOpts, (value) => {
          div.holdingId = value;
          updateInvestSide(pot);
        }),
        makeSelect(String(div.year), allYearsList().map((y) => ({ value: String(y), label: String(y) })), (value) => {
          div.year = Number(value);
        }),
        makeSelect(div.month, monthOptions(), (value) => {
          div.month = value;
        }),
        moneyField(div.amount, (val) => {
          div.amount = val;
          updateInvestSide(pot);
        }),
        checkWrap,
        removeButton(() => {
          pot.dividends.splice(index, 1);
          renderInvestDetail();
        })
      );
      section.appendChild(row);
    });
    container.appendChild(section);
  }

  function renderInvestDetail() {
    const pot = state.investments.find((item) => item.id === state.openInvestId);
    if (!pot) {
      closeInvest();
      return;
    }
    if (!Array.isArray(pot.holdings)) pot.holdings = [];

    document.getElementById("invest-title").textContent = pot.name || "Producto";
    document.getElementById("invest-lede").textContent =
      pot.type === "cdt"
        ? "CDT: el interés es fijo. Afuera se ve el rendimiento total del plazo; la tabla muestra cómo se causa mes a mes."
        : pot.type === "alta_rentabilidad"
          ? "Alta rentabilidad: si el banco cambia el %, el historial conserva lo ya ganado y aplica la tasa nueva desde el cambio. Afuera solo se ve lo ganado hasta este mes."
          : pot.type === "manual"
            ? "Inversión manual en pesos: posiciones, aportes y dividendos, sin conversión por el valor del dólar."
            : "Bolsa en USD: posiciones, aportes, dividendos y gráficas. El valor del dólar de arriba convierte a pesos en el consolidado.";

    document.getElementById("invest-table-hint").textContent =
      pot.type === "cdt"
        ? "Tabla con rendimiento bruto, impuesto y neto según el tipo de pago. El total del plazo está en los indicadores de arriba."
        : isPositionType(pot.type)
          ? "Resumen por posición: invertido, comisión, disponible y rendimientos calculados"
          : "Tabla mes a mes: invertido, comisión, disponible y rendimientos";

    const form = document.getElementById("invest-form");
    form.replaceChildren();

    const card = document.createElement("section");
    card.className = "card card-pad stack-fields";

    const addField = (label, control, extraClass) => {
      const field = document.createElement("div");
      field.className = extraClass ? `field ${extraClass}` : "field";
      field.append(Object.assign(document.createElement("label"), { textContent: label }), control);
      card.appendChild(field);
    };

    addField("Nombre", makeInput(pot.name, (input) => {
      pot.name = input.value;
      document.getElementById("invest-title").textContent = pot.name || "Producto";
    }, { type: "text", placeholder: "CDT / alta rentabilidad / broker / manual" }));

    addField("Tipo", makeSelect(pot.type, INVEST_TYPES.map((t) => ({ value: t.id, label: t.label })), (value) => {
      pot.type = value;
      renderInvestDetail();
    }));

    addField("Banco / broker", makeSelect(pot.bankId || "", bankOptions(true), (value) => {
      pot.bankId = value;
    }));

    addField("Mes de apertura", makeSelect(pot.openMonth, monthOptions(), (value) => {
      pot.openMonth = value;
      updateInvestSide(pot);
    }));

    if (pot.type === "cdt") {
      addField("Día de apertura", makeSelect(String(pot.openDay || 1), dayOptions(), (value) => {
        pot.openDay = Number(value) || 1;
        updateInvestSide(pot);
      }));
    }

    addField("Año de apertura", makeInput(pot.openYear || "", (input) => {
      pot.openYear = Number.parseInt(input.value, 10) || now.getFullYear();
      updateInvestSide(pot);
    }, { type: "number", step: "1" }));

    if (!isPositionType(pot.type)) {
      addField("Ya invertido (no es ingreso del mes)", moneyField(pot.initialAmount, (val) => {
        pot.initialAmount = val;
        if (pot.type === "cdt") pot.interestGross = cdtGrossInterest(pot);
        updateInvestSide(pot);
      }), "field-money");
    }

    if (pot.type === "cdt") {
      addField("% de interés anual", pctField(pot.interestRatePct, (val) => {
        pot.interestRatePct = val;
        pot.interestGross = cdtGrossInterest(pot);
        updateInvestSide(pot);
      }));
      addField("Impuesto %", pctField(pot.taxPct, (val) => {
        pot.taxPct = Number.isFinite(val) ? val : DEFAULT_TAX_PCT;
        updateInvestSide(pot);
      }));
      addField("Plazo (días)", makeInput(pot.termDays || "", (input) => {
        pot.termDays = Math.max(1, Number.parseInt(input.value, 10) || 180);
        pot.interestGross = cdtGrossInterest(pot);
        updateInvestSide(pot);
      }, { type: "number", min: "1", step: "1" }));
      addField("Pago de intereses", makeSelect(pot.interestPayout || "final", [
        { value: "final", label: "Al vencimiento del CDT" },
        { value: "mensual", label: "Mes a mes" }
      ], (value) => {
        pot.interestPayout = value;
        updateInvestSide(pot);
      }));

      const preview = document.createElement("p");
      preview.className = "saving-meta";
      preview.id = "cdt-preview";
      const gross = cdtGrossInterest(pot);
      const tax = gross * ((Number(pot.taxPct) || 0) / 100);
      const rate = Number(pot.interestRatePct) || 0;
      const mature = cdtMaturityDate(pot);
      preview.textContent = `${Norte.formatPct(rate, 2)} EA · bruto ${moneyInv(gross, pot)} · impuesto ${moneyInv(tax, pot)} · neto ${moneyInv(gross - tax, pot)} · vence ${mature.getDate()}/${mature.getMonth() + 1}/${mature.getFullYear()}`;
      card.appendChild(preview);
    }

    if (pot.type === "alta_rentabilidad") {
      addField("Rentabilidad anual %", pctField(pot.annualYieldPct, (val) => {
        setAnnualYieldPct(pot, val);
        updateInvestSide(pot);
      }));
      const hint = document.createElement("p");
      hint.className = "saving-meta";
      hint.textContent = "Si cambias el %, los meses anteriores conservan la tasa vieja y la nueva aplica desde este mes. Los aportes salen de Flujo → Meses.";
      card.appendChild(hint);
      if ((pot.yieldChanges || []).length) {
        const hist = document.createElement("div");
        hist.className = "yield-history";
        pot.yieldChanges
          .slice()
          .sort((a, b) => ymIndex(a.year, a.month) - ymIndex(b.year, b.month))
          .forEach((change) => {
            const row = document.createElement("div");
            row.className = "yield-history-row";
            row.append(
              Object.assign(document.createElement("span"), {
                textContent: `Desde ${MONTHS[Number(change.month) - 1] || "?"} ${change.year}`
              }),
              Object.assign(document.createElement("strong"), {
                textContent: Norte.formatPct(change.annualYieldPct, 2)
              })
            );
            hist.appendChild(row);
          });
        card.appendChild(hist);
      }
    }

    form.appendChild(card);

    if (isPositionType(pot.type)) {
      renderBolsaHoldings(pot, form);
    }

    updateInvestSide(pot);

    if (pot.type === "cdt") {
      const preview = document.getElementById("cdt-preview");
      if (preview) {
        const syncPreview = () => {
          const gross = cdtGrossInterest(pot);
          const tax = gross * ((Number(pot.taxPct) || 0) / 100);
          const rate = Number(pot.interestRatePct) || 0;
          const mature = cdtMaturityDate(pot);
          preview.textContent = `${Norte.formatPct(rate, 2)} EA · bruto ${moneyInv(gross, pot)} · impuesto ${moneyInv(tax, pot)} · neto ${moneyInv(gross - tax, pot)} · vence ${mature.getDate()}/${mature.getMonth() + 1}/${mature.getFullYear()}`;
        };
        card.querySelectorAll("input, select").forEach((input) => {
          input.addEventListener("input", syncPreview);
          input.addEventListener("change", syncPreview);
        });
      }
    }
  }

  function renderPatrimonioMetrics(metricsBox) {
    const p = patrimonioBreakdown(state.viewYear);
    metricsBox.replaceChildren(
      metric("Patrimonio total", money(p.total), "Cuentas + ahorros + inversiones"),
      metric("Cuentas bancarias", money(p.accounts), "Saldos iniciales (liquidez)"),
      metric("Ahorros", money(p.savings), "Acumulado actual"),
      metric("Inversiones", money(p.investments), "Valor disponible actual")
    );
  }

  function renderPatrimonio() {
    const box = document.getElementById("accounts-list");
    const metricsBox = document.getElementById("patrimonio-metrics");
    renderPatrimonioMetrics(metricsBox);

    box.replaceChildren();

    const linked = document.createElement("section");
    linked.className = "patrimonio-linked";
    const linkedTitle = document.createElement("h3");
    linkedTitle.textContent = "Incluido en el patrimonio";
    linked.appendChild(linkedTitle);
    const linkedGrid = document.createElement("div");
    linkedGrid.className = "patrimonio-linked-grid";

    const savingsPart = document.createElement("div");
    savingsPart.className = "linked-block";
    const sHead = document.createElement("p");
    sHead.className = "faint";
    sHead.textContent = "Ahorros";
    savingsPart.appendChild(sHead);
    const savingsList = state.savings.filter((s) => matchesBank(s.bankId));
    if (!savingsList.length) {
      savingsPart.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Sin ahorros todavía."
      }));
    } else {
      savingsList.forEach((s) => {
        const row = document.createElement("div");
        row.className = "linked-row";
        row.append(
          Object.assign(document.createElement("span"), { textContent: s.name || "Ahorro" }),
          Object.assign(document.createElement("strong"), { textContent: money(potTotal("saving", s.id)) })
        );
        savingsPart.appendChild(row);
      });
    }

    const investPart = document.createElement("div");
    investPart.className = "linked-block";
    const iHead = document.createElement("p");
    iHead.className = "faint";
    iHead.textContent = "Inversiones";
    investPart.appendChild(iHead);
    const investList = state.investments.filter((s) => matchesBank(s.bankId));
    if (!investList.length) {
      investPart.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Sin inversiones todavía."
      }));
    } else {
      investList.forEach((inv) => {
        const snap = investmentSnapshot(inv);
        const row = document.createElement("div");
        row.className = "linked-row";
        row.append(
          Object.assign(document.createElement("span"), {
            textContent: `${inv.name || "Producto"} · ${investTypeLabel(inv.type)}`
          }),
          Object.assign(document.createElement("strong"), {
            textContent: inv.type === "bolsa"
              ? money(bolsaValueCop(inv).available)
              : money(snap.available)
          })
        );
        investPart.appendChild(row);
      });
    }

    linkedGrid.append(savingsPart, investPart);
    linked.appendChild(linkedGrid);
    const note = document.createElement("p");
    note.className = "saving-meta";
    note.textContent = "Si un ahorro ya está dentro del saldo de una cuenta, no lo registres otra vez en cuentas bancarias para no duplicar.";
    linked.appendChild(note);
    box.appendChild(linked);

    const accountsHead = document.createElement("div");
    accountsHead.className = "list-head accounts-subhead";
    accountsHead.append(
      Object.assign(document.createElement("h3"), { textContent: "Cuentas bancarias" }),
      Object.assign(document.createElement("p"), {
        className: "faint",
        textContent: "Liquidez en bancos. El saldo inicial no es ingreso del mes."
      })
    );
    box.appendChild(accountsHead);

    const allFiltered = state.accounts.filter((acc) => matchesBank(acc.bankId));
    if (!allFiltered.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = "Registra tus cuentas con el saldo que ya tenías al empezar (ej. septiembre). Ese monto no suma como ingreso del mes.";
      box.appendChild(p);
      return;
    }

    allFiltered.forEach((acc) => {
      const index = state.accounts.findIndex((item) => item.id === acc.id);
      const card = document.createElement("article");
      card.className = "account-card";

      const nameField = document.createElement("div");
      nameField.className = "field";
      nameField.append(
        Object.assign(document.createElement("label"), { textContent: "Cuenta / producto" }),
        makeInput(acc.name, (input) => { acc.name = input.value; }, { type: "text", placeholder: "Ahorros nómina" })
      );

      const bankField = document.createElement("div");
      bankField.className = "field";
      bankField.append(
        Object.assign(document.createElement("label"), { textContent: "Banco" }),
        makeSelect(acc.bankId || "", bankOptions(true), (value) => {
          acc.bankId = value;
          renderPatrimonio();
          renderBankChips();
        })
      );

      const typeField = document.createElement("div");
      typeField.className = "field";
      typeField.append(
        Object.assign(document.createElement("label"), { textContent: "Tipo" }),
        makeSelect(acc.type, ACCOUNT_TYPES.map((t) => ({ value: t.id, label: t.label })), (value) => {
          acc.type = value;
        })
      );

      const balField = document.createElement("div");
      balField.className = "field field-money";
      balField.append(
        Object.assign(document.createElement("label"), { textContent: "Saldo al iniciar" }),
        moneyField(acc.openingBalance, (val) => {
          acc.openingBalance = val;
          renderPatrimonioMetrics(metricsBox);
        })
      );

      const monthField = document.createElement("div");
      monthField.className = "field";
      monthField.append(
        Object.assign(document.createElement("label"), { textContent: "Mes de corte" }),
        makeSelect(acc.openingMonth, monthOptions(), (value) => {
          acc.openingMonth = value;
        })
      );

      const yearField = document.createElement("div");
      yearField.className = "field";
      yearField.append(
        Object.assign(document.createElement("label"), { textContent: "Año de corte" }),
        makeInput(acc.openingYear || "", (input) => {
          acc.openingYear = Number.parseInt(input.value, 10) || now.getFullYear();
        }, { type: "number", step: "1" })
      );

      const noteLine = document.createElement("p");
      noteLine.className = "saving-meta account-note";
      noteLine.textContent = `Corte ${MONTHS[Number(acc.openingMonth) - 1] || "?"} ${acc.openingYear} · no cuenta como ingreso`;

      const remove = removeButton(() => {
        state.accounts.splice(index, 1);
        render();
      });
      remove.classList.add("account-remove");

      card.append(nameField, bankField, typeField, balField, monthField, yearField, noteLine, remove);
      box.appendChild(card);
    });
  }

  function renderMonthGrid() {
    const grid = document.getElementById("month-grid");
    grid.replaceChildren();

    if (monthRequiresBank()) {
      const notice = document.createElement("div");
      notice.className = "bank-required-note card card-pad";
      notice.innerHTML = "<strong>Elige un banco</strong><p class='faint'>En Meses los movimientos son por banco. Selecciona un banco en la barra de arriba para ver y anotar cada mes. El consolidado de todos los bancos está en Recopilado y Factura.</p>";
      grid.appendChild(notice);
      return;
    }

    MONTHS.forEach((name, index) => {
      const key = monthKey(index);
      const entry = getMonth(state.viewYear, key, false);
      const sliced = monthViewEntry(entry || emptyMonth());
      const t = monthTotals(sliced);
      const filled = monthHasData(sliced);
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
          Object.assign(document.createElement("span"), {
            textContent: `Balance ${money(t.balance)}`,
            className: t.balance >= 0 ? "positive" : "negative"
          })
        );
      } else {
        mini.append(Object.assign(document.createElement("span"), {
          textContent: `Sin datos en ${bankName(activeBankId())} · abrir para anotar`
        }));
      }
      button.append(title, mini);
      button.addEventListener("click", () => openMonth(state.viewYear, key));
      grid.appendChild(button);
    });
  }

  function withBankLabel(name, bankId) {
    return `${name || "Sin nombre"} · ${bankName(bankId)}`;
  }

  function addInvoiceRows(box, title, rows) {
    if (!rows.length) return;
    const h = document.createElement("div");
    h.className = "invoice-row";
    h.style.color = "var(--faint)";
    h.textContent = title;
    box.appendChild(h);
    rows.filter((row) => Number(row.amount) !== 0).forEach((row) => {
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
    const allBanks = state.bankFilter === "all";
    const patrimonio = patrimonioBreakdown(state.viewYear, allBanks);
    const carry = carryInTotals(state.viewYear);
    const savingsAll = state.savings.filter((s) => matchesBank(s.bankId));
    const investAll = state.investments.filter((s) => matchesBank(s.bankId));
    const filterLabel = allBanks
      ? "Todos los bancos"
      : state.bankFilter === "none"
        ? "Sin banco"
        : bankName(state.bankFilter);

    const head = document.createElement("div");
    head.className = "invoice-head";
    const left = document.createElement("div");
    left.append(
      Object.assign(document.createElement("div"), { className: "brand-line", textContent: "Norte · Flujo personal" }),
      Object.assign(document.createElement("h2"), { textContent: `Factura ${state.viewYear}` }),
      Object.assign(document.createElement("p"), {
        textContent: state.profile.name
          ? `A nombre de ${state.profile.name} · ${filterLabel}`
          : filterLabel
      })
    );
    const right = document.createElement("div");
    right.style.textAlign = "right";
    const stamp = document.createElement("p");
    stamp.className = "faint";
    stamp.textContent = "Patrimonio total";
    const big = document.createElement("strong");
    big.style.fontFamily = "var(--serif)";
    big.style.fontSize = "1.6rem";
    big.textContent = money(patrimonio.total);
    right.append(stamp, big);
    head.append(left, right);
    box.appendChild(head);

    const byBankSection = document.createElement("section");
    byBankSection.className = "invoice-month";
    byBankSection.appendChild(Object.assign(document.createElement("h3"), {
      textContent: allBanks ? "Patrimonio por banco" : `Patrimonio · ${filterLabel}`
    }));
    const bankIds = allBanks
      ? [...new Set([
        ...state.accounts.map((a) => a.bankId || ""),
        ...state.savings.map((s) => s.bankId || ""),
        ...state.investments.map((s) => s.bankId || "")
      ])]
      : [state.bankFilter === "none" ? "" : state.bankFilter];
    bankIds.forEach((bankId) => {
      if (!allBanks && !matchesBank(bankId)) return;
      const accountsSum = state.accounts
        .filter((a) => (a.bankId || "") === bankId && Number(a.openingYear) <= state.viewYear)
        .reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);
      const savingsSum = state.savings
        .filter((s) => (s.bankId || "") === bankId)
        .reduce((s, pot) => s + potTotal("saving", pot.id), 0);
      const investSum = state.investments
        .filter((s) => (s.bankId || "") === bankId)
        .reduce((s, pot) => {
          if (pot.type === "bolsa") return s + bolsaValueCop(pot).available;
          return s + (investmentSnapshot(pot).available || potTotal("investment", pot.id));
        }, 0);
      const total = accountsSum + savingsSum + investSum;
      if (!total) return;
      addInvoiceRows(byBankSection, bankName(bankId), [
        { name: "Cuentas", amount: accountsSum },
        { name: "Ahorros", amount: savingsSum },
        { name: "Inversiones", amount: investSum },
        { name: "Subtotal banco", amount: total }
      ].filter((row) => row.amount !== 0 || row.name === "Subtotal banco"));
    });
    box.appendChild(byBankSection);

    if (carry.opening > 0 || carry.priorFlow > 0) {
      const preamble = document.createElement("section");
      preamble.className = "invoice-month";
      preamble.appendChild(Object.assign(document.createElement("h3"), { textContent: "Posición de partida" }));
      if (carry.opening > 0) {
        addInvoiceRows(preamble, "Capital inicial (no es ingreso del año)", [
          { name: "Ahorros · saldo inicial", amount: carry.savingsInitial },
          { name: "Inversiones · capital inicial", amount: carry.investmentsInitial }
        ].filter((row) => row.amount !== 0));
      }
      if (carry.priorFlow > 0) {
        addInvoiceRows(preamble, "Arrastre de flujos de años anteriores", [
          { name: "Aportes netos a ahorros", amount: carry.savings },
          { name: "Aportes a inversiones", amount: carry.investments }
        ].filter((row) => row.amount !== 0));
      }
      box.appendChild(preamble);
    }

    let any = false;
    MONTHS.forEach((name, index) => {
      const entry = getMonth(state.viewYear, monthKey(index), false);
      const sliced = monthViewEntry(entry || emptyMonth());
      if (!monthHasData(sliced) && !(sliced.transfers || []).length) return;
      any = true;
      const t = monthTotals(sliced);
      const block = document.createElement("section");
      block.className = "invoice-month";
      block.appendChild(Object.assign(document.createElement("h3"), { textContent: name }));
      addInvoiceRows(block, "Ingresos", (sliced.incomes || []).map((row) => ({
        name: withBankLabel(row.name || "Ingreso", row.bankId),
        amount: row.amount
      })));
      addInvoiceRows(block, "Egresos", (sliced.expenses || []).map((row) => ({
        name: withBankLabel(`${row.name || "Gasto"} · ${categoryById(row.category).label}`, row.bankId),
        amount: row.amount
      })));
      addInvoiceRows(block, "Ahorros", (sliced.contributions || []).map((row) => {
        const pot = state.savings.find((s) => s.id === row.savingId);
        const verb = row.kind === "retiro" ? "Retiro" : "Aporte";
        const concept = row.concept ? ` · ${row.concept}` : "";
        return {
          name: withBankLabel(`${verb} ${(pot && pot.name) || "Ahorro"}${concept}`, row.bankId || (pot && pot.bankId)),
          amount: contribSigned(row)
        };
      }));
      addInvoiceRows(block, "Inversiones", (sliced.investments || []).map((row) => {
        const pot = state.investments.find((s) => s.id === row.investmentId);
        return {
          name: withBankLabel(`${(pot && pot.name) || "Inversión"}${row.concept ? ` · ${row.concept}` : ""}`, row.bankId || (pot && pot.bankId)),
          amount: row.amount
        };
      }));
      addInvoiceRows(block, "Transferencias", (sliced.transfers || []).map((row) => ({
        name: `${bankName(row.fromBankId)} → ${bankName(row.toBankId)}${row.concept ? ` · ${row.concept}` : ""}${row.investmentId ? " · a inversión" : ""}`,
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

    if (!any && patrimonio.total <= 0) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "invoice-empty",
        textContent: "Todavía no hay movimientos este año. Empieza por Patrimonio o por la pestaña Meses."
      }));
      return;
    }

    const savingsStock = savingsAll.reduce((sum, s) => sum + potTotal("saving", s.id), 0);
    const investStock = investAll.reduce((sum, s) => {
      if (s.type === "bolsa") return sum + bolsaValueCop(s).available;
      return sum + (investmentSnapshot(s).available || potTotal("investment", s.id));
    }, 0);
    const foot = document.createElement("section");
    foot.className = "invoice-foot";
    [
      ["Patrimonio total", patrimonio.total],
      ["Ingresos del año", totals.income],
      ["Egresos del año", totals.egresos],
      ["Aportes a ahorros del año (neto)", totals.ahorros],
      ["Aportes a inversiones del año", totals.inversiones],
      ["Balance del flujo del año", totals.balance],
      ["Saldo ahorros acumulado", savingsStock],
      ["Saldo inversiones acumulado", investStock]
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
    const rows = filterMonthRows(entry.incomes);
    box.replaceChildren();
    if (monthRequiresBank()) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Selecciona un banco para agregar ingresos de ese banco."
      }));
      return;
    }
    if (!rows.length) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: `Sin ingresos en ${bankName(activeBankId())} este mes.`
      }));
      return;
    }
    rows.forEach((row) => {
      const index = entry.incomes.indexOf(row);
      const wrap = document.createElement("div");
      wrap.className = "row";
      wrap.append(
        makeInput(row.name, (input) => { row.name = input.value; }, { type: "text", placeholder: "Concepto" }),
        moneyField(row.amount, (val) => {
          row.amount = val;
          renderMonthTotals();
        }),
        removeButton(() => {
          entry.incomes.splice(index, 1);
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
    const rows = filterMonthRows(entry.expenses);
    box.replaceChildren();
    if (monthRequiresBank()) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Selecciona un banco para agregar egresos de ese banco."
      }));
      return;
    }
    if (!rows.length) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: `Sin egresos en ${bankName(activeBankId())} este mes.`
      }));
      return;
    }
    rows.forEach((row) => {
      const index = entry.expenses.indexOf(row);
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
        moneyField(row.amount, (val) => {
          row.amount = val;
          renderMonthTotals();
        }),
        removeButton(() => {
          entry.expenses.splice(index, 1);
          renderExpenses();
          renderMonthTotals();
        })
      );
      box.appendChild(wrap);
    });
  }

  function renderContribs() {
    const box = document.getElementById("contrib-rows");
    const hint = document.getElementById("contrib-hint");
    const entry = currentMonth();
    const active = activeBankId();
    const pots = state.savings.filter((s) => active === null || (s.bankId || "") === active);
    box.replaceChildren();
    if (monthRequiresBank()) {
      hint.textContent = "Selecciona un banco para mover ahorros de ese banco.";
      return;
    }
    if (!pots.length) {
      hint.textContent = `No hay ahorros en ${bankName(active)}. Créalos en Recopilado con ese banco.`;
      return;
    }
    hint.textContent = `Movimientos de ${bankName(active)}. Aporte o retiro con concepto.`;
    if (!entry.contributions) entry.contributions = [];
    filterMonthRows(entry.contributions).forEach((row) => {
      const index = entry.contributions.indexOf(row);
      const wrap = document.createElement("div");
      wrap.className = "row contrib-rich";
      if (!row.savingId || !pots.some((p) => p.id === row.savingId)) row.savingId = pots[0].id;
      if (!row.bankId) row.bankId = active;
      const select = makeSelect(row.savingId, pots.map((pot) => ({
        value: pot.id,
        label: pot.name || "Sin nombre"
      })), (value) => {
        row.savingId = value;
        const pot = pots.find((p) => p.id === value);
        row.bankId = pot ? (pot.bankId || active) : active;
      });
      const kind = makeSelect(row.kind || "aporte", [
        { value: "aporte", label: "Aporte" },
        { value: "retiro", label: "Retiro" }
      ], (value) => {
        row.kind = value;
        renderMonthTotals();
      });
      wrap.append(
        select,
        kind,
        moneyField(row.amount, (val) => {
          row.amount = val;
          renderMonthTotals();
        }),
        makeInput(row.concept || "", (input) => {
          row.concept = input.value;
        }, { type: "text", placeholder: "Concepto (ej. gasolina)" }),
        removeButton(() => {
          entry.contributions.splice(index, 1);
          renderContribs();
          renderMonthTotals();
        })
      );
      box.appendChild(wrap);
    });
  }

  function renderPlacements() {
    const box = document.getElementById("placement-rows");
    const hint = document.getElementById("invest-hint");
    const entry = currentMonth();
    const active = activeBankId();
    const pots = state.investments.filter((s) => active === null || (s.bankId || "") === active);
    box.replaceChildren();
    if (monthRequiresBank()) {
      hint.textContent = "Selecciona un banco para aportar a inversiones de ese banco.";
      return;
    }
    if (!pots.length) {
      hint.textContent = `No hay productos de inversión en ${bankName(active)}. Créalos en Recopilado.`;
      return;
    }
    hint.textContent = `Aportes de ${bankName(active)} a productos de ese banco.`;
    if (!entry.investments) entry.investments = [];
    filterMonthRows(entry.investments).forEach((row) => {
      const index = entry.investments.indexOf(row);
      const wrap = document.createElement("div");
      wrap.className = "row contrib-rich";
      if (!row.investmentId || !pots.some((p) => p.id === row.investmentId)) row.investmentId = pots[0].id;
      if (!row.bankId) row.bankId = active;
      const select = makeSelect(row.investmentId, pots.map((pot) => ({
        value: pot.id,
        label: `${pot.name || "Sin nombre"} · ${investTypeLabel(pot.type)}`
      })), (value) => {
        row.investmentId = value;
        const pot = pots.find((p) => p.id === value);
        row.bankId = pot ? (pot.bankId || active) : active;
      });
      wrap.append(
        select,
        moneyField(row.amount, (val) => {
          row.amount = val;
          renderMonthTotals();
        }),
        makeInput(row.concept || "", (input) => {
          row.concept = input.value;
        }, { type: "text", placeholder: "Concepto (opcional)" }),
        removeButton(() => {
          entry.investments.splice(index, 1);
          renderPlacements();
          renderMonthTotals();
        })
      );
      box.appendChild(wrap);
    });
  }

  function renderTransfers() {
    const box = document.getElementById("transfer-rows");
    const totalEl = document.getElementById("transfer-total");
    if (!box) return;
    const entry = currentMonth();
    if (!Array.isArray(entry.transfers)) entry.transfers = [];
    box.replaceChildren();
    if (monthRequiresBank()) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Selecciona un banco para ver o crear transferencias."
      }));
      if (totalEl) totalEl.textContent = money(0);
      return;
    }
    const active = activeBankId();
    const rows = entry.transfers.filter((row) =>
      (row.fromBankId || "") === active || (row.toBankId || "") === active
    );
    if (!rows.length) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: `Sin transferencias que involucren a ${bankName(active)} este mes.`
      }));
    }
    rows.forEach((row) => {
      const index = entry.transfers.indexOf(row);
      const wrap = document.createElement("div");
      wrap.className = "transfer-card";
      const grid = document.createElement("div");
      grid.className = "transfer-grid";
      const destInvestOpts = [
        { value: "", label: "No enlazar" },
        ...state.investments
          .filter((s) => (s.bankId || "") === (row.toBankId || ""))
          .map((s) => ({ value: s.id, label: s.name || "Producto" }))
      ];
      grid.append(
        fieldWrap("Desde", makeSelect(row.fromBankId || "", bankOptions(true), (value) => {
          row.fromBankId = value;
          renderTransfers();
          renderMonthTotals();
        })),
        fieldWrap("Hacia", makeSelect(row.toBankId || "", bankOptions(true), (value) => {
          row.toBankId = value;
          if (row.investmentId) {
            const pot = state.investments.find((s) => s.id === row.investmentId);
            if (!pot || (pot.bankId || "") !== value) row.investmentId = "";
          }
          renderTransfers();
          renderMonthTotals();
        })),
        fieldWrap("Monto", moneyField(row.amount, (val) => {
          row.amount = val;
          renderMonthTotals();
        })),
        fieldWrap("Concepto", makeInput(row.concept || "", (input) => {
          row.concept = input.value;
        }, { type: "text", placeholder: "Para qué se mueve" })),
        fieldWrap("Enlazar a inversión", makeSelect(row.investmentId || "", destInvestOpts, (value) => {
          row.investmentId = value;
          renderMonthTotals();
        }))
      );
      wrap.append(grid, removeButton(() => {
        entry.transfers.splice(index, 1);
        renderTransfers();
        renderMonthTotals();
      }));
      box.appendChild(wrap);
    });
    if (totalEl) {
      const t = monthTotals(monthViewEntry(entry));
      totalEl.textContent = money(t.transferNet);
    }
  }

  function renderMonthTotals() {
    const entry = currentMonth();
    const sliced = monthViewEntry(entry);
    const t = monthTotals(sliced);
    document.getElementById("income-total").textContent = money(t.income);
    document.getElementById("expense-total").textContent = money(t.expense);
    document.getElementById("contrib-total").textContent = money(t.contrib);
    document.getElementById("placement-total").textContent = money(t.invest);
    const transferTotal = document.getElementById("transfer-total");
    if (transferTotal) transferTotal.textContent = money(t.transferNet);
    const bankLabel = monthRequiresBank() ? "Todos (elige un banco)" : bankName(activeBankId());
    const slices = expenseSlices(sliced.expenses, t.aportes, t.invest);
    document.getElementById("month-metrics").replaceChildren(
      metric("Balance del mes", money(t.balance), bankLabel, t.balance >= 0 ? "positive" : "negative"),
      metric("Ingresos", money(t.income), bankLabel),
      metric("Ahorrado neto", money(t.contrib), t.retiros ? `Retiros ${money(t.retiros)}` : bankLabel),
      metric("Invertido", money(t.invest), bankLabel),
      metric("Transferencias", money(t.transferNet), t.transferOut || t.transferIn ? `Sale ${money(t.transferOut)} · Entra ${money(t.transferIn)}` : bankLabel)
    );
    NorteCharts.donutChart(document.getElementById("month-donut"), slices, {
      centerLabel: "Salidas",
      centerValue: money(t.expense + t.aportes + t.invest + t.transferOut),
      empty: "Añade egresos o aportes para ver la composición",
      format: money
    });
  }

  function renderMonth() {
    const { year, month } = state.openMonth;
    const bankBit = monthRequiresBank() ? "" : ` · ${bankName(activeBankId())}`;
    document.getElementById("month-title").textContent = `${MONTHS[Number(month) - 1]} ${year}${bankBit}`;
    const entry = currentMonth();
    const active = activeBankId();
    if (active === null) {
      notesInput.value = entry.notes || "";
      notesInput.disabled = true;
      notesInput.placeholder = "Selecciona un banco para notas de ese banco";
    } else {
      notesInput.disabled = false;
      notesInput.placeholder = "Metas, deudas, recordatorios…";
      notesInput.value = (entry.notesByBank && entry.notesByBank[active]) || "";
    }
    const locked = monthRequiresBank();
    ["add-income", "add-expense", "add-contrib", "add-placement", "add-transfer"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = locked;
    });
    let banner = document.getElementById("month-bank-banner");
    if (locked) {
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "month-bank-banner";
        banner.className = "bank-required-note card card-pad";
        const head = document.querySelector("#view-month .page-head");
        head.insertAdjacentElement("afterend", banner);
      }
      banner.hidden = false;
      banner.innerHTML = "<strong>Selecciona un banco</strong><p class='faint'>Los ingresos, egresos, ahorros e inversiones de este mes son por banco. El consolidado está en Recopilado y Factura.</p>";
    } else if (banner) {
      banner.hidden = true;
    }
    renderIncomes();
    renderExpenses();
    renderContribs();
    renderPlacements();
    renderTransfers();
    renderMonthTotals();
  }

  function render() {
    nameInput.value = state.profile.name || "";
    renderYearBar();
    if (state.openInvestId) {
      setView("invest");
      renderInvestDetail();
    } else if (state.openMonth) {
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
      bankFilter: state.bankFilter,
      usdRate: Number(state.usdRate) || 0,
      banks: state.banks.map((row) => ({ ...row })),
      accounts: state.accounts.map((row) => ({ ...row })),
      savings: state.savings.map((row) => ({ ...row })),
      investments: state.investments.map((row) => ({
        ...row,
        holdings: (row.holdings || []).map((h) => ({
          ...h,
          movements: (h.movements || []).map((m) => ({ ...m }))
        })),
        dividends: (row.dividends || []).map((d) => ({ ...d })),
        yieldChanges: (row.yieldChanges || []).map((y) => ({ ...y }))
      })),
      years: JSON.parse(JSON.stringify(state.years))
    };
  }

  function applySnapshot(data) {
    if (!data) return;
    if (data.years) {
      state.profile = { name: (data.profile && data.profile.name) || "" };
      state.viewYear = Number(data.viewYear) || state.viewYear;
      state.bankFilter = data.bankFilter || "all";
      state.usdRate = Number(data.usdRate) || 0;
      state.banks = Array.isArray(data.banks) ? data.banks.map(normalizeBank) : [];
      state.accounts = Array.isArray(data.accounts) ? data.accounts.map(normalizeAccount) : [];
      state.savings = Array.isArray(data.savings) ? data.savings.map(normalizeSaving) : [];
      state.investments = Array.isArray(data.investments) ? data.investments.map(normalizeInvestment) : [];
      state.years = data.years;
      state.openMonth = null;
      state.openInvestId = null;
    } else if (data.incomes || data.expenses) {
      const period = (data.profile && data.profile.period) || `${state.viewYear}-01`;
      const [year, month] = period.split("-");
      state.profile.name = (data.profile && data.profile.name) || "";
      state.viewYear = Number(year) || state.viewYear;
      state.usdRate = 0;
      state.banks = [];
      state.accounts = [];
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
              investments: [],
              transfers: []
            }
          }
        }
      };
    }
    render();
  }

  function loadExample() {
    const bank1 = uid();
    const bank2 = uid();
    const a = uid();
    const b = uid();
    const c = uid();
    const d = uid();
    const e = uid();
    const year = String(now.getFullYear());
    const month = monthKey(now.getMonth());
    state.profile = { name: "Ana" };
    state.viewYear = Number(year);
    state.openMonth = null;
    state.openInvestId = null;
    state.tab = "recopilado";
    state.bankFilter = "all";
    state.usdRate = 4200;
    state.banks = [
      { id: bank1, name: "Bancolombia" },
      { id: bank2, name: "Nequi" }
    ];
    state.accounts = [
      {
        id: uid(),
        name: "Cuenta nómina",
        bankId: bank1,
        type: "ahorros",
        openingBalance: 8500000,
        openingYear: Number(year),
        openingMonth: month,
        notes: ""
      },
      {
        id: uid(),
        name: "Bolsillo",
        bankId: bank2,
        type: "ahorros",
        openingBalance: 1200000,
        openingYear: Number(year),
        openingMonth: month,
        notes: ""
      }
    ];
    state.savings = [
      { id: a, name: "Fondo de emergencia", target: 10000000, bankId: bank1, initialAmount: 3500000 },
      { id: b, name: "Vehículos", target: 4500000, bankId: bank1, initialAmount: 800000 }
    ];
    state.investments = [
      normalizeInvestment({
        id: c,
        name: "Broker bolsa",
        type: "bolsa",
        bankId: bank1,
        openYear: Number(year),
        openMonth: "01",
        holdings: [
          {
            id: uid(),
            kind: "etf",
            name: "VOO",
            invested: 1200,
            available: 1380,
            commission: 8.5,
            movements: [
              { id: uid(), year: Number(year), month: "02", amount: 200, commission: 2.5, concept: "Aporte febrero" }
            ]
          },
          {
            id: uid(),
            kind: "acciones",
            name: "AAPL",
            invested: 450,
            available: 510,
            commission: 3,
            movements: []
          }
        ],
        dividends: []
      }),
      normalizeInvestment({
        id: d,
        name: "CDT 180 días",
        type: "cdt",
        bankId: bank1,
        initialAmount: 10000000,
        interestRatePct: 13.2,
        taxPct: 4,
        termDays: 180,
        openDay: 15,
        interestPayout: "final",
        openYear: Number(year),
        openMonth: month
      }),
      normalizeInvestment({
        id: e,
        name: "Alta rentabilidad",
        type: "alta_rentabilidad",
        bankId: bank2,
        initialAmount: 2000000,
        annualYieldPct: 9.5,
        openYear: Number(year),
        openMonth: "01"
      }),
      normalizeInvestment({
        id: uid(),
        name: "Acciones locales",
        type: "manual",
        bankId: bank2,
        openYear: Number(year),
        openMonth: "01",
        holdings: [
          {
            id: uid(),
            kind: "acciones",
            name: "Éxito",
            invested: 1500000,
            available: 1620000,
            commission: 12000,
            movements: []
          },
          {
            id: uid(),
            kind: "etf",
            name: "HCOL",
            invested: 800000,
            available: 760000,
            commission: 5000,
            movements: []
          }
        ],
        dividends: []
      })
    ];
    state.years = {
      [year]: {
        months: {
          "01": {
            notes: "Arranque de año.",
            notesByBank: {},
            incomes: [{ id: uid(), name: "Salario", amount: 4800000, bankId: bank1 }],
            expenses: [
              { id: uid(), name: "Arriendo", category: "vivienda", amount: 1600000, bankId: bank1 },
              { id: uid(), name: "Mercado", category: "alimentacion", amount: 820000, bankId: bank1 }
            ],
            contributions: [
              { id: uid(), savingId: a, amount: 500000, kind: "aporte", concept: "Aporte mensual", bankId: bank1 }
            ],
            investments: [],
            transfers: [
              {
                id: uid(),
                fromBankId: bank1,
                toBankId: bank2,
                amount: 200000,
                concept: "Fondeo alta rentabilidad",
                investmentId: e
              }
            ]
          },
          "02": {
            notes: "",
            notesByBank: {},
            incomes: [{ id: uid(), name: "Salario", amount: 4800000, bankId: bank1 }],
            expenses: [
              { id: uid(), name: "Arriendo", category: "vivienda", amount: 1600000, bankId: bank1 },
              { id: uid(), name: "Mercado", category: "alimentacion", amount: 790000, bankId: bank1 }
            ],
            contributions: [
              { id: uid(), savingId: b, amount: 150000, kind: "retiro", concept: "Gasolina", bankId: bank1 }
            ],
            investments: [
              { id: uid(), investmentId: e, amount: 150000, concept: "", bankId: bank2 }
            ],
            transfers: []
          }
        }
      }
    };
    render();
    Norte.toast("Ejemplo con patrimonio, bancos e inversiones tipadas.");
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
    if (!entry) return;
    const active = activeBankId();
    if (active === null) {
      entry.notes = notesInput.value;
      return;
    }
    if (!entry.notesByBank) entry.notesByBank = {};
    entry.notesByBank[active] = notesInput.value;
  });
  document.getElementById("btn-manage-banks").addEventListener("click", () => {
    renderBanksModal();
    banksModal.showModal();
  });
  document.getElementById("add-bank").addEventListener("click", () => {
    state.banks.push({ id: uid(), name: "Nuevo banco" });
    renderBanksModal();
    renderBankChips();
  });
  document.getElementById("add-saving").addEventListener("click", () => {
    state.savings.push({
      id: uid(),
      name: "Nuevo ahorro",
      target: 0,
      bankId: defaultBankId(),
      initialAmount: 0
    });
    renderSavings();
  });
  document.getElementById("add-invest").addEventListener("click", () => {
    const pot = normalizeInvestment({
      id: uid(),
      name: "Nuevo producto",
      type: "bolsa",
      bankId: defaultBankId(),
      initialAmount: 0,
      openYear: state.viewYear,
      openMonth: monthKey(now.getMonth()),
      taxPct: DEFAULT_TAX_PCT,
      holdings: []
    });
    state.investments.push(pot);
    openInvest(pot.id);
  });
  document.getElementById("add-account").addEventListener("click", () => {
    state.accounts.push(normalizeAccount({
      id: uid(),
      name: "Nueva cuenta",
      bankId: defaultBankId(),
      type: "ahorros",
      openingBalance: 0,
      openingYear: state.viewYear,
      openingMonth: monthKey(now.getMonth())
    }));
    renderPatrimonio();
  });
  const usdInput = document.getElementById("usd-rate");
  if (usdInput) {
    usdInput.addEventListener("input", () => {
      const parsed = Number.parseFloat(usdInput.value);
      state.usdRate = Number.isFinite(parsed) ? parsed : 0;
      if (!state.openMonth && !state.openInvestId) renderOverview();
      else if (state.openInvestId) {
        const pot = state.investments.find((item) => item.id === state.openInvestId);
        if (pot) updateInvestSide(pot);
      }
    });
  }
  document.getElementById("add-transfer").addEventListener("click", () => {
    if (monthRequiresBank()) {
      Norte.toast("Selecciona un banco antes de anotar el mes.", "error");
      return;
    }
    const active = activeBankId();
    const other = state.banks.find((b) => b.id !== active);
    const entry = currentMonth();
    if (!Array.isArray(entry.transfers)) entry.transfers = [];
    entry.transfers.push({
      id: uid(),
      fromBankId: active || "",
      toBankId: other ? other.id : "",
      amount: 0,
      concept: "",
      investmentId: ""
    });
    renderTransfers();
    renderMonthTotals();
  });
  document.getElementById("add-income").addEventListener("click", () => {
    if (monthRequiresBank()) {
      Norte.toast("Selecciona un banco antes de anotar el mes.", "error");
      return;
    }
    currentMonth().incomes.push({ id: uid(), name: "", amount: 0, bankId: activeBankId() });
    renderIncomes();
  });
  document.getElementById("add-expense").addEventListener("click", () => {
    if (monthRequiresBank()) {
      Norte.toast("Selecciona un banco antes de anotar el mes.", "error");
      return;
    }
    currentMonth().expenses.push({ id: uid(), name: "", category: "otros", amount: 0, bankId: activeBankId() });
    renderExpenses();
  });
  document.getElementById("add-contrib").addEventListener("click", () => {
    if (monthRequiresBank()) {
      Norte.toast("Selecciona un banco antes de anotar el mes.", "error");
      return;
    }
    const pots = state.savings.filter((s) => (s.bankId || "") === activeBankId());
    if (!pots.length) {
      Norte.toast(`Crea un ahorro en ${bankName(activeBankId())} primero.`, "error");
      return;
    }
    currentMonth().contributions.push({
      id: uid(),
      savingId: pots[0].id,
      amount: 0,
      kind: "aporte",
      concept: "",
      bankId: activeBankId()
    });
    renderContribs();
  });
  document.getElementById("add-placement").addEventListener("click", () => {
    if (monthRequiresBank()) {
      Norte.toast("Selecciona un banco antes de anotar el mes.", "error");
      return;
    }
    const pots = state.investments.filter((s) => (s.bankId || "") === activeBankId());
    if (!pots.length) {
      Norte.toast(`Crea una inversión en ${bankName(activeBankId())} primero.`, "error");
      return;
    }
    currentMonth().investments.push({
      id: uid(),
      investmentId: pots[0].id,
      amount: 0,
      concept: "",
      bankId: activeBankId()
    });
    renderPlacements();
  });
  document.getElementById("btn-back").addEventListener("click", closeMonth);
  document.getElementById("btn-back-invest").addEventListener("click", closeInvest);
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
