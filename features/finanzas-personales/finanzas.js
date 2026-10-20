(() => {
  const FEATURE = "finanzas-personales";
  const CURRENCY = "COP";
  const DEFAULT_TAX_PCT = 4;
  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const CATEGORIES = [
    { id: "vivienda", label: "Vivienda", color: "#f07d6e" },
    { id: "alimentacion", label: "Alimentación", color: "#f3b65b" },
    { id: "servicios", label: "Servicios", color: "#4cc3e6" },
    { id: "transporte", label: "Transporte", color: "#e58f4f" },
    { id: "vehiculos", label: "Vehículos", color: "#2dd4bf" },
    { id: "salud", label: "Salud", color: "#ec8ec0" },
    { id: "educacion", label: "Educación", color: "#b4dc6a" },
    { id: "ocio", label: "Ocio", color: "#3fd49a" },
    { id: "deudas", label: "Deudas", color: "#d6a77a" },
    { id: "otros", label: "Otros", color: "#8a94a3" }
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
  const ASSET_KINDS = [
    { id: "vehiculo", label: "Vehículo" },
    { id: "inmueble", label: "Inmueble" },
    { id: "otro", label: "Otro" }
  ];
  const TAB_DESC = {
    recopilado: "Tu año de un vistazo: totales, deudas, ahorros e inversiones.",
    meses: "Elige un mes para anotar lo que entró y salió de cada banco.",
    patrimonio: "Lo que ya tenías en cada banco al empezar y otros bienes.",
    factura: "Un informe del año listo para revisar o imprimir.",
    tesoreria: "Una hoja de cálculo libre para planear y hacer cuentas."
  };
  const GMF_RATE = 0.004;
  const DEBT_COLOR = "#d6a77a";

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
      debts: [],
      contributions: [],
      investments: [],
      transfers: []
    };
  }

  // Antes se marcaba «Sin 4x1000»; ahora se marca lo que sí paga el impuesto.
  function syncGmf(row) {
    if (typeof row.gmf !== "boolean") row.gmf = row.gmfExempt === undefined ? false : !row.gmfExempt;
    delete row.gmfExempt;
  }

  function normalizeMonth(entry) {
    if (!entry) return emptyMonth();
    if (!Array.isArray(entry.investments)) entry.investments = [];
    if (!Array.isArray(entry.contributions)) entry.contributions = [];
    if (!Array.isArray(entry.incomes)) entry.incomes = [];
    if (!Array.isArray(entry.expenses)) entry.expenses = [];
    if (!Array.isArray(entry.transfers)) entry.transfers = [];
    if (!Array.isArray(entry.debts)) entry.debts = [];
    if (!entry.notesByBank || typeof entry.notesByBank !== "object") entry.notesByBank = {};
    entry.incomes.forEach((row) => {
      if (row.bankId == null) row.bankId = "";
    });
    entry.expenses.forEach((row) => {
      if (row.bankId == null) row.bankId = "";
      syncGmf(row);
    });
    entry.contributions.forEach((row) => {
      if (typeof row.concept !== "string") row.concept = "";
      syncGmf(row);
      if (row.kind !== "retiro") row.kind = "aporte";
      if (row.bankId == null) {
        const pot = state.savings.find((s) => s.id === row.savingId);
        row.bankId = pot ? (pot.bankId || "") : "";
      }
    });
    entry.investments.forEach((row) => {
      if (typeof row.concept !== "string") row.concept = "";
      syncGmf(row);
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
      syncGmf(row);
      row.amount = Number(row.amount) || 0;
    });
    entry.debts.forEach((row) => {
      if (!row.id) row.id = uid();
      if (row.kind !== "prestamo") row.kind = "pago";
      if (typeof row.concept !== "string") row.concept = "";
      row.amount = Number(row.amount) || 0;
      if (row.bankId == null) {
        const debt = state.debts.find((d) => d.id === row.debtId);
        row.bankId = debt ? (debt.bankId || "") : "";
      }
      syncGmf(row);
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

  function normalizeDebt(row) {
    return {
      id: row.id || uid(),
      name: row.name || "Deuda",
      bankId: row.bankId || "",
      initialAmount: Math.max(0, Number(row.initialAmount) || 0)
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
      compounding: row.compounding === "diario" ? "diario" : "mensual",
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

  function normalizeAsset(row) {
    return {
      id: row.id || uid(),
      name: row.name || "Patrimonio",
      kind: ASSET_KINDS.some((item) => item.id === row.kind) ? row.kind : "otro",
      value: Number(row.value) || 0,
      notes: row.notes || ""
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
    savingsLayout: "compact",
    investLayout: "compact",
    debtsLayout: "compact",
    expandedDebtId: null,
    flowChartsOpen: false,
    treasury: NorteSheet.normalize(null),
    banks: [],
    accounts: [],
    assets: [],
    debts: [],
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
    factura: document.getElementById("panel-factura"),
    tesoreria: document.getElementById("panel-tesoreria")
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

  function includeLooseAssets(allBanks) {
    return Boolean(allBanks) || state.bankFilter === "all" || state.bankFilter === "none";
  }

  function assetTotal() {
    return state.assets.reduce((sum, asset) => sum + (Number(asset.value) || 0), 0);
  }

  function daysInMonth(year, month) {
    return new Date(Number(year), Number(month), 0).getDate();
  }

  function compoundedInterest(balance, annualPct, year, month, compounding) {
    const annual = (Number(annualPct) || 0) / 100;
    if (compounding === "diario") {
      const days = daysInMonth(year, month);
      return balance * (Math.pow(1 + annual / 365, days) - 1);
    }
    return balance * (annual / 12);
  }

  function investmentWealthCop(pot) {
    if (pot.type === "bolsa") return bolsaValueCop(pot).available;
    if (pot.type === "manual") return bolsaTotals(pot).available;
    if (pot.type === "cdt") return (Number(pot.initialAmount) || 0) + cdtNetInterest(pot);
    const snap = investmentSnapshot(pot);
    return snap.available != null ? snap.available : potTotal("investment", pot.id);
  }

  function swapVisible(list, visible, item, delta) {
    const pos = visible.findIndex((row) => row.id === item.id);
    const neighbor = visible[pos + delta];
    if (!neighbor) return;
    const from = list.findIndex((row) => row.id === item.id);
    const to = list.findIndex((row) => row.id === neighbor.id);
    if (from < 0 || to < 0) return;
    const current = list[from];
    list[from] = list[to];
    list[to] = current;
  }

  function gmfCompute(items) {
    let counted = 0;
    (items || []).forEach((item) => {
      const amount = Math.abs(Number(item.amount) || 0);
      if (!amount || !item.charged) return;
      counted += amount;
    });
    return { counted, tax: counted * GMF_RATE };
  }

  function gmfBuckets(entry) {
    const buckets = new Map();
    const add = (bankId, amount, charged) => {
      const key = bankId || "";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ amount, charged: Boolean(charged) });
    };
    const source = entry || emptyMonth();
    (source.expenses || []).forEach((row) => add(row.bankId, row.amount, row.gmf));
    (source.debts || []).forEach((row) => add(row.bankId, row.amount, row.gmf));
    (source.contributions || []).forEach((row) => add(row.bankId, row.amount, row.gmf));
    (source.investments || []).forEach((row) => add(row.bankId, row.amount, row.gmf));
    (source.transfers || []).forEach((row) => add(row.fromBankId, row.amount, row.gmf));
    return buckets;
  }

  function gmfForRows(entry) {
    const buckets = gmfBuckets(entry);
    const active = activeBankId();
    const keys = active === null ? [...buckets.keys()] : [active];
    const banks = keys.map((bankId) => ({
      bankId,
      ...gmfCompute(buckets.get(bankId) || [])
    }));
    return {
      banks,
      counted: banks.reduce((sum, bank) => sum + bank.counted, 0),
      tax: banks.reduce((sum, bank) => sum + bank.tax, 0)
    };
  }

  function gmfNoteText() {
    return "Es el 0,4% de lo que marcaste «Con 4x1000».";
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

  // banco activo para anotar en Movimientos (null = "Todos", no se anota consolidado)
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
        debts: entry.debts || [],
        contributions: entry.contributions || [],
        investments: entry.investments || [],
        transfers: entry.transfers || []
      };
    }
    return {
      notes: (entry.notesByBank && entry.notesByBank[active]) || "",
      incomes: filterMonthRows(entry.incomes),
      expenses: filterMonthRows(entry.expenses),
      debts: filterMonthRows(entry.debts),
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

  function sumDebts(rows) {
    let pay = 0;
    let borrow = 0;
    (rows || []).forEach((row) => {
      const amount = Math.abs(Number(row.amount) || 0);
      if (row.kind === "prestamo") borrow += amount;
      else pay += amount;
    });
    return { pay, borrow };
  }

  function monthTotals(entry) {
    const income = sumList(entry && entry.incomes);
    const debt = sumDebts(entry && entry.debts);
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
      debtPay: debt.pay,
      debtNew: debt.borrow,
      egresos: expense,
      ahorros: contrib,
      inversiones: invest,
      balance: income - expense - debt.pay + debt.borrow - aportes - invest + retiros + xfer.net
    };
  }

  function yearTotals(year) {
    const y = state.years[String(year)];
    const acc = {
      income: 0, expense: 0, contrib: 0, invest: 0,
      egresos: 0, ahorros: 0, inversiones: 0, balance: 0, aportes: 0, retiros: 0,
      transferIn: 0, transferOut: 0, transferNet: 0, debtPay: 0, debtNew: 0
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
      acc.debtPay += t.debtPay;
      acc.debtNew += t.debtNew;
    });
    acc.balance = acc.income - acc.expense - acc.debtPay + acc.debtNew - acc.aportes - acc.invest + acc.retiros + acc.transferNet;
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

  function debtFlow(id, untilYear) {
    const flow = { paid: 0, borrowed: 0 };
    Object.entries(state.years).forEach(([yearKey, year]) => {
      if (untilYear != null && Number(yearKey) > untilYear) return;
      Object.values(year.months || {}).forEach((entry) => {
        (entry.debts || []).forEach((row) => {
          if (row.debtId !== id) return;
          const amount = Math.abs(Number(row.amount) || 0);
          if (row.kind === "prestamo") flow.borrowed += amount;
          else flow.paid += amount;
        });
      });
    });
    return flow;
  }

  function debtProgress(debt, untilYear) {
    const flow = debtFlow(debt.id, untilYear);
    const owed = (Number(debt.initialAmount) || 0) + flow.borrowed;
    const left = Math.max(0, owed - flow.paid);
    return { ...flow, owed, left, share: owed > 0 ? Math.min(100, (flow.paid / owed) * 100) : 0 };
  }

  function debtBalance(debt, untilYear) {
    return debtProgress(debt, untilYear).left;
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
      .reduce((sum, s) => sum + investmentWealthCop(s), 0);
    const assets = includeLooseAssets(allBanks) ? assetTotal() : 0;
    const debts = state.debts
      .filter((d) => bankOk(d.bankId))
      .reduce((sum, d) => sum + debtBalance(d, year), 0);
    return {
      accounts,
      savings,
      investments,
      assets,
      debts,
      total: accounts + savings + investments + assets - debts
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

  function expenseSlices(expenses, contrib, invest, debtPay) {
    const map = {};
    (expenses || []).forEach((row) => {
      const cat = categoryById(row.category).id;
      map[cat] = (map[cat] || 0) + (Number(row.amount) || 0);
    });
    const slices = CATEGORIES.map((category) => ({
      ...category,
      value: map[category.id] || 0
    }));
    if (debtPay > 0) {
      slices.push({ id: "pagos-deuda", label: "Pagos a deudas", color: DEBT_COLOR, value: debtPay });
    }
    if (contrib > 0) {
      slices.push({ id: "aportes-ahorro", label: "Aportes a ahorros", color: "#6c9eff", value: contrib });
    }
    if (invest > 0) {
      slices.push({ id: "aportes-inversion", label: "Aportes a inversiones", color: "#a68cf7", value: invest });
    }
    return slices.filter((item) => item.value > 0);
  }

  function yearOutflowSlices(year) {
    const y = state.years[String(year)];
    const expenses = [];
    let contrib = 0;
    let invest = 0;
    let debtPay = 0;
    if (y) {
      Object.values(y.months).forEach((entry) => {
        const sliced = monthViewEntry(normalizeMonth(entry));
        (sliced.expenses || []).forEach((row) => expenses.push(row));
        contrib += Math.max(sumContribs(sliced.contributions), 0);
        invest += monthTotals(sliced).invest;
        debtPay += sumDebts(sliced.debts).pay;
      });
    }
    return expenseSlices(expenses, contrib, invest, debtPay);
  }

  function metric(label, value, sub, extraClass, hero) {
    const article = document.createElement("article");
    article.className = hero ? "metric is-hero" : "metric";
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
    input.className = "input";
    input.value = value == null ? "" : value;
    Object.entries(attrs).forEach(([key, val]) => input.setAttribute(key, val));
    input.addEventListener("input", () => onChange(input));
    return input;
  }

  function makeSelect(value, options, onChange) {
    return Norte.menuSelect(value, options, onChange);
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

  function editButton(onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-btn";
    button.setAttribute("aria-label", "Editar");
    button.textContent = "✎";
    button.addEventListener("click", onClick);
    return button;
  }

  function monthHasData(entry) {
    if (!entry) return false;
    const t = monthTotals(entry);
    return t.income > 0 || t.expense > 0 || t.contrib !== 0 || t.invest > 0
      || t.transferIn > 0 || t.transferOut > 0 || t.debtPay > 0 || t.debtNew > 0;
  }

  function setView(mode) {
    overview.hidden = mode !== "overview";
    monthView.hidden = mode !== "month";
    investView.hidden = mode !== "invest";
  }

  function setTab(tab) {
    state.tab = tab;
    Object.entries(panels).forEach(([name, node]) => {
      if (!node) return;
      node.hidden = name !== tab;
    });
    document.querySelectorAll(".overview-tabbar [data-tab]").forEach((button) => {
      const active = button.dataset.tab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const desc = document.getElementById("tab-desc");
    if (desc) desc.textContent = TAB_DESC[tab] || "";
    if (tab === "factura") renderInvoice();
    if (tab === "meses") renderMonthGrid();
    if (tab === "patrimonio") renderPatrimonio();
    if (tab === "recopilado") {
      renderDebts();
      renderSavings();
      renderInvestments();
    }
    if (tab === "tesoreria") renderTreasury();
  }

  let treasurySheet = null;

  function renderTreasury() {
    const box = document.getElementById("treasury-sheet");
    if (!box) return;
    if (!treasurySheet) {
      treasurySheet = NorteSheet.create(box, {
        model: state.treasury,
        toast: (message, type) => Norte.toast(message, type)
      });
      return;
    }
    treasurySheet.refresh();
  }

  function loadTreasury(raw) {
    state.treasury = NorteSheet.normalize(raw);
    if (treasurySheet) treasurySheet.setModel(state.treasury);
  }

  function openMonth(year, key) {
    state.viewYear = Number(year);
    state.openMonth = { year: Number(year), month: key };
    state.openInvestId = null;
    getMonth(year, key, true);
    if (location.hash !== `#${year}-${key}`) location.hash = `${year}-${key}`;
    render();
    Norte.scrollTop();
  }

  function closeMonth() {
    state.openMonth = null;
    state.tab = "meses";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    render();
    Norte.scrollTop();
  }

  function openInvest(id) {
    state.openInvestId = id;
    state.openMonth = null;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    render();
    Norte.scrollTop();
  }

  function closeInvest() {
    state.openInvestId = null;
    state.tab = "recopilado";
    render();
    Norte.scrollTop();
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
      up.className = "btn btn-sm btn-icon";
      up.textContent = "↑";
      up.setAttribute("aria-label", "Subir banco");
      up.disabled = index === 0;
      up.addEventListener("click", () => moveBank(index, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.className = "btn btn-sm btn-icon";
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
        state.debts.forEach((d) => { if (d.bankId === id) d.bankId = ""; });
        if (state.bankFilter === id) state.bankFilter = "all";
        renderBanksModal();
        render();
      }));
      card.append(nameField, order);
      box.appendChild(card);
    });
  }

  function yearHasFlow(totals) {
    return totals.income > 0 || totals.expense > 0 || totals.aportes > 0 || totals.retiros > 0
      || totals.invest > 0 || totals.transferIn > 0 || totals.transferOut > 0
      || totals.debtPay > 0 || totals.debtNew > 0;
  }

  function syncFlowCharts(hasFlow) {
    const flowCharts = document.getElementById("overview-charts");
    const flowBtn = document.getElementById("toggle-flow-charts");
    if (flowBtn) {
      flowBtn.hidden = !hasFlow;
      flowBtn.setAttribute("aria-expanded", String(Boolean(hasFlow && state.flowChartsOpen)));
      const label = flowBtn.querySelector("span");
      if (label) label.textContent = state.flowChartsOpen ? "Ocultar gráficas" : "Ver gráficas";
    }
    if (flowCharts) flowCharts.hidden = !hasFlow || !state.flowChartsOpen;
  }

  function isFreshStart() {
    if (state.banks.length || state.accounts.length || state.assets.length || state.savings.length
      || state.investments.length || state.debts.length) return false;
    return !Object.values(state.years).some((year) => Object.values(year.months || {}).some((entry) =>
      ["incomes", "expenses", "debts", "contributions", "investments", "transfers"].some((field) => (entry[field] || []).length)
    ));
  }

  function renderOverview() {
    const onboarding = document.getElementById("onboarding");
    if (onboarding) onboarding.hidden = !isFreshStart();
    const totals = yearTotals(state.viewYear);
    const carry = carryInTotals(state.viewYear);
    const patrimonio = patrimonioBreakdown(state.viewYear);
    const spentShare = totals.income > 0 ? (totals.expense / totals.income) * 100 : 0;
    const filterNote = state.bankFilter === "all"
      ? "Todos los bancos"
      : state.bankFilter === "none"
        ? "Sin banco asignado"
        : bankName(state.bankFilter);

    document.getElementById("year-metrics").replaceChildren(
      metric(
        "Patrimonio total",
        money(patrimonio.total),
        patrimonio.debts > 0
          ? `Lo que tienes menos ${money(patrimonio.debts)} en deudas · ${filterNote}`
          : `Todo lo que tienes hoy · ${filterNote}`,
        "",
        true
      ),
      metric("Ingresos del año", money(totals.income), `Lo que entró en ${state.viewYear}`),
      metric("Gastos del año", money(totals.egresos), "Lo que gastaste en el día a día"),
      metric(
        "Ahorros e inversiones",
        money(patrimonio.savings + patrimonio.investments),
        carry.priorFlow > 0
          ? "Incluye lo que traes de años anteriores"
          : `Ahorros ${money(patrimonio.savings)} · Inversiones ${money(patrimonio.investments)}`
      ),
      metric(
        "Te quedó libre",
        money(totals.balance),
        totals.income > 0 ? `Gastaste el ${Norte.formatPct(spentShare)} de lo que entró` : "Aún no hay ingresos este año",
        totals.balance >= 0 ? "positive" : "negative"
      )
    );

    const hasFlow = yearHasFlow(totals);
    syncFlowCharts(hasFlow);
    if (hasFlow) {
      const months = MONTHS.map((name, index) => {
        const entry = getMonth(state.viewYear, monthKey(index), false);
        return monthTotals(monthViewEntry(entry || emptyMonth()));
      });
      NorteCharts.columns(document.getElementById("year-chart"), {
        labels: MONTHS,
        shortLabels: MONTHS.map((name) => name.slice(0, 3)),
        series: [
          { name: "Ingresos", color: "#3fd49a", stack: "entra", values: months.map((t) => t.income) },
          { name: "Gastos", color: "#f07d6e", stack: "sale", values: months.map((t) => t.expense) },
          { name: "A deudas", color: DEBT_COLOR, stack: "sale", values: months.map((t) => t.debtPay) },
          { name: "A ahorros", color: "#6c9eff", stack: "sale", values: months.map((t) => t.aportes) },
          { name: "A inversiones", color: "#a68cf7", stack: "sale", values: months.map((t) => t.invest) }
        ].filter((serie) => serie.name !== "A deudas" || serie.values.some((value) => value > 0)),
        lines: [{ name: "Te quedó", color: "#f3b65b", values: months.map((t) => t.balance) }],
        format: money,
        formatAxis: (value) => Norte.formatCompact(value, CURRENCY),
        tipTitle: (i) => `${MONTHS[i]} ${state.viewYear}`,
        tipRows: (i) => {
          const t = months[i];
          const rows = [
            { name: "Ingresos", color: "#3fd49a", value: money(t.income) },
            { name: "Gastos", color: "#f07d6e", value: money(t.expense) }
          ];
          if (t.debtPay > 0) rows.push({ name: "A deudas", color: DEBT_COLOR, value: money(t.debtPay) });
          rows.push(
            { name: "A ahorros", color: "#6c9eff", value: money(t.aportes) },
            { name: "A inversiones", color: "#a68cf7", value: money(t.invest) }
          );
          if (t.debtNew > 0) rows.push({ name: "Te prestaron", color: "#8a94a3", value: money(t.debtNew) });
          if (t.retiros > 0) rows.push({ name: "Sacaste de ahorros", color: "#8a94a3", value: money(t.retiros) });
          if (t.transferNet) rows.push({ name: "Transferencias", color: "#8a94a3", value: money(t.transferNet) });
          rows.push({ name: "Te quedó", color: "#f3b65b", value: money(t.balance), total: true });
          return rows;
        },
        title: "Ingresos y salidas de cada mes"
      });
      NorteCharts.breakdown(document.getElementById("year-donut"), yearOutflowSlices(state.viewYear), {
        format: money,
        totalLabel: "Salió en total",
        empty: "Aún no hay gastos ni aportes este año."
      });
    }

    renderDebts();
    renderSavings();
    renderInvestments();
    renderMonthGrid();
    renderPatrimonio();
    renderInvoice();
    setTab(state.tab);
  }

  function layoutToggleLabel(mode) {
    return mode === "compact" ? "Vista completa" : "Vista compacta";
  }

  function syncLayoutToggles() {
    const debtsBtn = document.getElementById("toggle-debts-layout");
    const savingsBtn = document.getElementById("toggle-savings-layout");
    const investBtn = document.getElementById("toggle-invest-layout");
    if (debtsBtn) debtsBtn.textContent = layoutToggleLabel(state.debtsLayout);
    if (savingsBtn) savingsBtn.textContent = layoutToggleLabel(state.savingsLayout);
    if (investBtn) investBtn.textContent = layoutToggleLabel(state.investLayout);
  }

  function reorderControls(list, visible, item, rerender) {
    const pos = visible.findIndex((row) => row.id === item.id);
    const box = document.createElement("div");
    box.className = "bank-order";
    const up = document.createElement("button");
    up.type = "button";
    up.className = "btn btn-sm btn-icon";
    up.textContent = "↑";
    up.setAttribute("aria-label", "Subir");
    up.disabled = pos <= 0;
    up.addEventListener("click", (event) => {
      event.stopPropagation();
      swapVisible(list, visible, item, -1);
      rerender();
    });
    const down = document.createElement("button");
    down.type = "button";
    down.className = "btn btn-sm btn-icon";
    down.textContent = "↓";
    down.setAttribute("aria-label", "Bajar");
    down.disabled = pos < 0 || pos >= visible.length - 1;
    down.addEventListener("click", (event) => {
      event.stopPropagation();
      swapVisible(list, visible, item, 1);
      rerender();
    });
    box.append(up, down);
    return box;
  }

  function paintDebtsTotal(list) {
    const box = document.getElementById("debts-total");
    if (!box) return;
    if (!list.length) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }
    const total = list.reduce((sum, debt) => sum + debtBalance(debt), 0);
    box.hidden = false;
    box.className = "list-total section-total";
    box.replaceChildren(
      Object.assign(document.createElement("span"), { className: "muted", textContent: "Total que debes" }),
      Object.assign(document.createElement("strong"), { textContent: money(total) })
    );
  }

  function removeDebt(debt) {
    const index = state.debts.findIndex((item) => item.id === debt.id);
    if (index >= 0) state.debts.splice(index, 1);
    Object.values(state.years).forEach((year) => {
      Object.values(year.months || {}).forEach((entry) => {
        entry.debts = (entry.debts || []).filter((row) => row.debtId !== debt.id);
      });
    });
    if (state.expandedDebtId === debt.id) state.expandedDebtId = null;
    render();
  }

  function debtStatus(progress) {
    if (progress.owed > 0 && progress.left === 0) return "Pagada";
    if (progress.paid > 0) return `Pagaste ${money(progress.paid)} · ${Norte.formatPct(progress.share)}`;
    return "Aún no anotas pagos";
  }

  function renderDebts() {
    const list = state.debts.filter((d) => matchesBank(d.bankId));
    const box = document.getElementById("debts-list");
    if (!box) return;
    box.replaceChildren();
    syncLayoutToggles();
    if (!list.length) {
      paintDebtsTotal([]);
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: state.debts.length
          ? "No hay deudas en este banco."
          : "Agrega una tarjeta o un crédito con lo que debes hoy. Cada pago que anotes en el mes baja el saldo."
      }));
      return;
    }
    list.forEach((debt) => {
      if (state.debtsLayout === "compact" && state.expandedDebtId !== debt.id) {
        const progress = debtProgress(debt);
        const row = document.createElement("article");
        row.className = "compact-row";
        const main = document.createElement("div");
        main.className = "compact-main";
        main.append(
          Object.assign(document.createElement("strong"), { textContent: debt.name || "Sin nombre" }),
          Object.assign(document.createElement("span"), {
            className: "faint",
            textContent: `${bankName(debt.bankId)} · ${debtStatus(progress)}`
          })
        );
        const amount = document.createElement("strong");
        amount.className = "compact-money";
        amount.textContent = money(progress.left);
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "btn btn-sm";
        edit.textContent = "Editar";
        edit.addEventListener("click", () => {
          state.expandedDebtId = debt.id;
          renderDebts();
        });
        row.append(
          main,
          amount,
          reorderControls(state.debts, list, debt, renderDebts),
          edit,
          removeButton(() => removeDebt(debt))
        );
        box.appendChild(row);
        return;
      }
      const card = document.createElement("article");
      card.className = "saving-card saving-card-rich debt-card";

      const left = document.createElement("strong");
      left.dataset.savingTotal = "1";
      const meta = document.createElement("div");
      meta.className = "saving-meta";
      const bar = document.createElement("div");
      bar.className = "progress";
      const fill = document.createElement("span");
      bar.appendChild(fill);
      const paint = () => {
        const progress = debtProgress(debt);
        left.textContent = money(progress.left);
        meta.textContent = debtStatus(progress);
        fill.style.width = `${progress.share}%`;
        paintDebtsTotal(list);
      };

      const orderLine = reorderControls(state.debts, list, debt, renderDebts);
      orderLine.className = "bank-order row-order";
      if (state.expandedDebtId === debt.id) {
        const close = document.createElement("button");
        close.type = "button";
        close.className = "btn btn-sm btn-ghost";
        close.textContent = "Cerrar";
        close.addEventListener("click", () => {
          state.expandedDebtId = null;
          renderDebts();
        });
        orderLine.appendChild(close);
      }
      orderLine.appendChild(removeButton(() => removeDebt(debt)));

      const done = document.createElement("div");
      done.className = "field";
      done.append(Object.assign(document.createElement("label"), { textContent: "Debes hoy" }), left, meta);

      card.append(
        orderLine,
        fieldWrap("Nombre", makeInput(debt.name, (input) => {
          debt.name = input.value;
        }, { type: "text", placeholder: "Tarjeta de crédito" })),
        fieldWrap("Banco", makeSelect(debt.bankId || "", bankOptions(true), (value) => {
          debt.bankId = value;
          render();
        })),
        Object.assign(fieldWrap("Debías al empezar", moneyField(debt.initialAmount, (val) => {
          debt.initialAmount = Math.max(0, val);
          paint();
        })), { className: "field field-money" }),
        done,
        bar
      );
      paint();
      box.appendChild(card);
    });
    paintDebtsTotal(list);
  }

  function paintSavingsTotal(list) {
    const box = document.getElementById("savings-total");
    if (!box) return;
    if (!list.length) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }
    const total = list.reduce((sum, pot) => sum + potTotal("saving", pot.id), 0);
    box.hidden = false;
    box.className = "list-total section-total";
    box.replaceChildren(
      Object.assign(document.createElement("span"), { className: "muted", textContent: "Total ahorrado" }),
      Object.assign(document.createElement("strong"), { textContent: money(total) })
    );
  }

  function renderSavings() {
    const list = state.savings.filter((s) => matchesBank(s.bankId));
    const box = document.getElementById("savings-list");
    box.replaceChildren();
    syncLayoutToggles();
    if (!list.length) {
      paintSavingsTotal([]);
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = state.savings.length
        ? "No hay ahorros en este banco."
        : "Crea un ahorro, por ejemplo un fondo de emergencia. Escribe lo que ya tienes y anota aportes o retiros en cada mes.";
      box.appendChild(p);
      return;
    }
    list.forEach((pot) => {
      const index = state.savings.findIndex((item) => item.id === pot.id);
      if (state.savingsLayout === "compact" && state.expandedSavingId !== pot.id) {
        const row = document.createElement("article");
        row.className = "compact-row";
        const main = document.createElement("div");
        main.className = "compact-main";
        main.append(
          Object.assign(document.createElement("strong"), { textContent: pot.name || "Sin nombre" }),
          Object.assign(document.createElement("span"), { className: "faint", textContent: bankName(pot.bankId) })
        );
        const amount = document.createElement("strong");
        amount.className = "compact-money";
        amount.textContent = money(potTotal("saving", pot.id));
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "btn btn-sm";
        edit.textContent = "Editar";
        edit.addEventListener("click", () => {
          state.expandedSavingId = pot.id;
          renderSavings();
        });
        row.append(
          main,
          amount,
          reorderControls(state.savings, list, pot, renderSavings),
          edit,
          removeButton(() => {
            state.savings.splice(index, 1);
            Object.values(state.years).forEach((year) => {
              Object.values(year.months || {}).forEach((entry) => {
                entry.contributions = (entry.contributions || []).filter((item) => item.savingId !== pot.id);
              });
            });
            render();
          })
        );
        box.appendChild(row);
        return;
      }
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
            ? `Traes ${money(carryFlow)} de años anteriores`
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
        Object.assign(document.createElement("label"), { textContent: "Llevas" }),
        strong,
        meta
      );

      const bar = document.createElement("div");
      bar.className = "progress";
      bar.appendChild(document.createElement("span"));

      const orderLine = reorderControls(state.savings, list, pot, renderSavings);
      orderLine.className = "bank-order row-order";
      if (state.expandedSavingId === pot.id) {
        const close = document.createElement("button");
        close.type = "button";
        close.className = "btn btn-sm btn-ghost";
        close.textContent = "Cerrar";
        close.addEventListener("click", () => {
          state.expandedSavingId = null;
          renderSavings();
        });
        orderLine.appendChild(close);
      }
      orderLine.appendChild(removeButton(() => {
        state.savings.splice(index, 1);
        Object.values(state.years).forEach((year) => {
          Object.values(year.months || {}).forEach((entry) => {
            entry.contributions = (entry.contributions || []).filter((row) => row.savingId !== pot.id);
          });
        });
        render();
      }));
      card.append(orderLine, nameField, bankField, initialField, targetField, done, bar);
      paintTotals();
      box.appendChild(card);
    });
    paintSavingsTotal(list);
  }

  function renderInvestments() {
    const list = state.investments.filter((s) => matchesBank(s.bankId));
    const box = document.getElementById("invest-list");
    box.replaceChildren();
    syncLayoutToggles();
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = state.investments.length
        ? "No hay inversiones en este banco."
        : "Agrega un CDT, una cuenta de alta rentabilidad, acciones o cualquier otra inversión con lo que ya tienes invertido.";
      box.appendChild(p);
      renderInvestPortfolio([]);
      return;
    }
    list.forEach((pot) => {
      const index = state.investments.findIndex((item) => item.id === pot.id);
      if (state.investLayout === "compact") {
        const row = document.createElement("article");
        row.className = "compact-row";
        const snapshot = investmentSnapshot(pot);
        const shown = pot.type === "bolsa"
          ? `${moneyInv(snapshot.available, pot)} · ${money(toCop(snapshot.available))}`
          : money(pot.type === "cdt" ? investmentWealthCop(pot) : snapshot.available);
        const main = document.createElement("div");
        main.className = "compact-main";
        main.append(
          Object.assign(document.createElement("strong"), { textContent: pot.name || "Sin nombre" }),
          Object.assign(document.createElement("span"), {
            className: "faint",
            textContent: `${investTypeLabel(pot.type)} · ${bankName(pot.bankId)}`
          })
        );
        const amount = document.createElement("strong");
        amount.className = "compact-money";
        amount.textContent = shown;
        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "btn btn-sm";
        openBtn.textContent = "Abrir";
        openBtn.addEventListener("click", () => openInvest(pot.id));
        row.append(
          main,
          amount,
          reorderControls(state.investments, list, pot, renderInvestments),
          openBtn,
          removeButton(() => {
            state.investments.splice(index, 1);
            Object.values(state.years).forEach((year) => {
              Object.values(year.months || {}).forEach((entry) => {
                entry.investments = (entry.investments || []).filter((item) => item.investmentId !== pot.id);
              });
            });
            if (state.openInvestId === pot.id) state.openInvestId = null;
            render();
          })
        );
        box.appendChild(row);
        return;
      }
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
          returnsHint: "Al terminar el plazo"
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
      sub.textContent = `${bankName(pot.bankId)} · ${isPositionType(pot.type) ? `vale hoy ${totalLabel}` : `invertido ${money(total)}`}`;
      title.append(h3, badge, sub);

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn btn-sm";
      openBtn.textContent = "Abrir";
      openBtn.addEventListener("click", () => openInvest(pot.id));

      top.append(title, reorderControls(state.investments, list, pot, renderInvestments), openBtn);

      const mini = document.createElement("div");
      mini.className = "invest-mini";
      [
        ["Invertido", fmt(outside.invested), ""],
        ["Vale hoy", fmt(outside.available), ""],
        ["Ganancia", fmt(outside.returns), outside.returnsHint]
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
    renderInvestPortfolio(list);
  }

  function holdingDisplayName(holding) {
    const kind = (BOLSA_KINDS.find((item) => item.id === holding.kind) || BOLSA_KINDS[0]).label;
    return (holding.name || "").trim() || kind;
  }

  const collapsedPortfolioBanks = new Set();

  function renderInvestPortfolio(list) {
    const box = document.getElementById("invest-portfolio");
    if (!box) return;
    box.replaceChildren();
    if (state.bankFilter !== "all" || !list.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.className = "portfolio-block";

    const palette = NorteCharts.palette;
    const tableRows = [];
    const groups = new Map();

    const addGroup = (key, label, bank, value) => {
      if (!groups.has(key)) groups.set(key, { label, value: 0, banks: [] });
      const group = groups.get(key);
      group.value += value;
      const found = group.banks.find((item) => item.label === bank);
      if (found) found.value += value;
      else group.banks.push({ label: bank, value });
    };

    list.forEach((pot) => {
      if (pot.type === "bolsa") {
        (pot.holdings || []).forEach((holding) => {
          const name = holdingDisplayName(holding);
          const cop = toCop(Number(holding.available) || 0);
          addGroup(`bolsa:${name.toLowerCase()}`, name, bankName(pot.bankId), cop);
          tableRows.push({
            product: pot.name || "Bolsa",
            detail: name,
            bank: bankName(pot.bankId),
            bankId: pot.bankId || "",
            invested: `${moneyInv(holdingInvested(holding), pot)} · ${money(toCop(holdingInvested(holding)))}`,
            available: `${moneyInv(Number(holding.available) || 0, pot)} · ${money(cop)}`,
            investedCop: toCop(holdingInvested(holding)),
            availableCop: cop
          });
        });
        return;
      }
      if (pot.type === "manual") {
        (pot.holdings || []).forEach((holding) => {
          const name = holdingDisplayName(holding);
          const value = Number(holding.available) || 0;
          addGroup(`manual:${pot.id}:${holding.id}`, `${name} · ${bankName(pot.bankId)}`, bankName(pot.bankId), value);
          tableRows.push({
            product: pot.name || "Inversión manual",
            detail: name,
            bank: bankName(pot.bankId),
            bankId: pot.bankId || "",
            invested: money(holdingInvested(holding)),
            available: money(value),
            investedCop: holdingInvested(holding),
            availableCop: value
          });
        });
        return;
      }
      const value = investmentWealthCop(pot);
      const investedCop = pot.type === "cdt" ? (Number(pot.initialAmount) || 0) : (investmentSnapshot(pot).invested || 0);
      addGroup(`pot:${pot.id}`, `${pot.name || "Producto"} · ${bankName(pot.bankId)}`, bankName(pot.bankId), value);
      tableRows.push({
        product: pot.name || "Producto",
        detail: investTypeLabel(pot.type),
        bank: bankName(pot.bankId),
        bankId: pot.bankId || "",
        invested: money(investedCop),
        available: money(value),
        investedCop,
        availableCop: value
      });
    });

    const head = document.createElement("div");
    head.className = "list-head portfolio-head";
    const titleWrap = document.createElement("div");
    titleWrap.append(
      Object.assign(document.createElement("h2"), { textContent: "Todo lo invertido" }),
      Object.assign(document.createElement("p"), {
        className: "faint",
        textContent: "Cómo se reparte todo lo que tienes invertido, en pesos."
      })
    );
    head.appendChild(titleWrap);
    box.appendChild(head);

    const layout = document.createElement("div");
    layout.className = "portfolio-layout";
    const chartBox = document.createElement("div");
    chartBox.className = "chart portfolio-chart";
    layout.appendChild(chartBox);
    box.appendChild(layout);

    const slices = [...groups.values()].map((group, index) => ({
      label: group.label,
      color: palette[index % palette.length],
      value: Math.max(0, group.value),
      note: group.banks.length > 1
        ? group.banks.map((bank) => `${bank.label} ${money(bank.value)}`).join(" · ")
        : ""
    }));
    NorteCharts.breakdown(chartBox, slices, {
      format: money,
      totalLabel: "Vale hoy",
      empty: "Cuando tus inversiones tengan valor, verás aquí cómo se reparten."
    });

    const tableWrap = document.createElement("div");
    tableWrap.className = "table-wrap portfolio-table";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    ["Detalle", "Banco", "Invertido", "Vale hoy"].forEach((text, idx) => {
      const th = document.createElement("th");
      th.textContent = text;
      if (idx < 2) th.style.textAlign = "left";
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    const tbody = document.createElement("tbody");
    const appendCells = (tr, values, leftCount) => {
      values.forEach((text, idx) => {
        const td = document.createElement("td");
        td.textContent = text;
        if (idx < leftCount) td.style.textAlign = "left";
        tr.appendChild(td);
      });
    };
    if (!tableRows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "Todavía no hay posiciones para listar.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      const byBank = new Map();
      tableRows.forEach((row) => {
        const key = row.bankId || "";
        if (!byBank.has(key)) byBank.set(key, []);
        byBank.get(key).push(row);
      });
      const keys = [...byBank.keys()];
      let totalInvested = 0;
      let totalAvailable = 0;
      keys.forEach((bankId) => {
        const rows = byBank.get(bankId);
        const invested = rows.reduce((sum, row) => sum + (Number(row.investedCop) || 0), 0);
        const available = rows.reduce((sum, row) => sum + (Number(row.availableCop) || 0), 0);
        totalInvested += invested;
        totalAvailable += available;
        const open = !collapsedPortfolioBanks.has(bankId);
        const fold = document.createElement("tr");
        fold.className = "bank-fold";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "bank-fold-btn";
        toggle.textContent = open ? "▾" : "▸";
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", `${open ? "Compactar" : "Expandir"} ${bankName(bankId)}`);
        toggle.addEventListener("click", () => {
          if (collapsedPortfolioBanks.has(bankId)) collapsedPortfolioBanks.delete(bankId);
          else collapsedPortfolioBanks.add(bankId);
          renderInvestPortfolio(list);
        });
        const detailCell = document.createElement("td");
        detailCell.style.textAlign = "left";
        detailCell.append(
          toggle,
          document.createTextNode(` ${rows.length} posición${rows.length === 1 ? "" : "es"}`)
        );
        const bankCell = document.createElement("td");
        bankCell.style.textAlign = "left";
        bankCell.textContent = bankName(bankId);
        fold.append(detailCell, bankCell);
        [money(invested), money(available)].forEach((text) => {
          const td = document.createElement("td");
          td.textContent = text;
          fold.appendChild(td);
        });
        tbody.appendChild(fold);
        rows.forEach((row) => {
          const tr = document.createElement("tr");
          tr.className = "portfolio-detail";
          if (!open) tr.hidden = true;
          appendCells(tr, [row.detail, row.bank, row.invested, row.available], 2);
          tbody.appendChild(tr);
        });
      });
      const total = document.createElement("tr");
      total.className = "portfolio-total";
      const totalLabel = document.createElement("td");
      totalLabel.colSpan = 2;
      totalLabel.style.textAlign = "left";
      totalLabel.textContent = "Total en pesos";
      total.appendChild(totalLabel);
      [money(totalInvested), money(totalAvailable)].forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        total.appendChild(td);
      });
      tbody.appendChild(total);
    }
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    layout.appendChild(tableWrap);
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
        const interest = compoundedInterest(
          balance,
          yieldPctForMonth(pot, year, key),
          year,
          month,
          pot.compounding
        );
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
          note: `Rendimiento mes ${moneyInv(interest, pot)}${add || transferAdd ? ` · aporte ${moneyInv(add + transferAdd, pot)}` : ""} · ${Norte.formatPct(yieldPctForMonth(pot, year, key), 2)} · ${pot.compounding === "diario" ? "diario" : "mensual"}`
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
    const colors = NorteCharts.palette;
    const kindLabel = (h) => (BOLSA_KINDS.find((k) => k.id === h.kind) || BOLSA_KINDS[0]).label;
    const dist = (pot.holdings || []).map((h, i) => ({
      label: h.name || kindLabel(h),
      color: colors[i % colors.length],
      value: Math.max(0, Number(h.available) || 0)
    }));
    NorteCharts.breakdown(document.getElementById("invest-donut"), dist, {
      format: (v) => moneyInv(v, pot),
      totalLabel: "Vale hoy",
      totalValue: moneyInv(last.available, pot),
      empty: "Cuando tus posiciones tengan valor, verás aquí cómo se reparten."
    });
    const bars = (pot.holdings || []).map((h) => ({
      label: h.name || kindLabel(h),
      value: holdingReturns(h, pot),
      color: "#3fd49a"
    }));
    NorteCharts.diverging(document.getElementById("invest-bars"), bars, {
      format: (v) => moneyInv(v, pot),
      empty: "Agrega posiciones para ver cuánto gana o pierde cada una."
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

    const signClass = (value) => (value > 0 ? "positive" : value < 0 ? "negative" : "");
    const yieldShare = (returns, invested) => (invested > 0 ? Norte.formatPct((returns / invested) * 100, 2) : "—");
    if (pot.type === "cdt") {
      const capital = Number(pot.initialAmount) || 0;
      const gross = cdtGrossInterest(pot);
      const tax = gross * ((Number(pot.taxPct) || 0) / 100);
      const net = gross - tax;
      const rate = Number(pot.interestRatePct) || 0;
      pot.interestGross = gross;
      document.getElementById("invest-metrics").replaceChildren(
        metric("Recibirás en total", moneyInv(capital + net, pot), pot.interestPayout === "mensual" ? "Los intereses te llegan cada mes" : "Al terminar el plazo", "", true),
        metric("Lo que invertiste", moneyInv(capital, pot), `${Number(pot.termDays) || 0} días · desde el día ${pot.openDay}`),
        metric("Intereses que ganas", moneyInv(net, pot), "Después de la retención", "positive"),
        metric("Intereses antes de impuestos", moneyInv(gross, pot), `Tasa ${Norte.formatPct(rate, 2)} efectiva anual`),
        metric("Retención", moneyInv(tax, pot), `${Norte.formatPct(pot.taxPct)} de los intereses`)
      );
    } else if (pot.type === "bolsa") {
      const rateNote = usdRate() ? `Con el dólar a ${moneyDec(usdRate())}` : "Escribe el valor del dólar arriba para verlo en pesos";
      document.getElementById("invest-metrics").replaceChildren(
        metric("Vale hoy en pesos", money(toCop(last.available)), rateNote, "", true),
        metric("Lo que invertiste", moneyInv(last.invested, pot), "En dólares"),
        metric("Vale hoy", moneyInv(last.available, pot), "En dólares"),
        metric("Comisiones", moneyInv(last.commission, pot), "En dólares"),
        metric(
          "Ganancia",
          moneyInv(last.returns, pot),
          usdRate() ? `${money(toCop(last.returns))} en pesos · ${yieldShare(last.returns, last.invested)}` : `Rentabilidad ${yieldShare(last.returns, last.invested)}`,
          signClass(last.returns)
        )
      );
      paintPositionCharts(pot, last);
    } else if (pot.type === "manual") {
      document.getElementById("invest-metrics").replaceChildren(
        metric("Vale hoy", moneyInv(last.available, pot), "Lo que valen todas tus posiciones", "", true),
        metric("Lo que invertiste", moneyInv(last.invested, pot), "Incluye tus aportes"),
        metric("Comisiones", moneyInv(last.commission, pot), "Lo que pagaste al comprar"),
        metric("Ganancia", moneyInv(last.returns, pot), "Incluye dividendos reinvertidos", signClass(last.returns)),
        metric("Rentabilidad", yieldShare(last.returns, last.invested), "Ganancia sobre lo invertido", signClass(last.returns))
      );
      paintPositionCharts(pot, last);
    } else {
      const capMonth = state.viewYear < now.getFullYear() ? `Hasta diciembre de ${state.viewYear}` : "Hasta este mes";
      document.getElementById("invest-metrics").replaceChildren(
        metric("Vale hoy", moneyInv(last.available, pot), capMonth, "", true),
        metric("Lo que has puesto", moneyInv(last.invested, pot), "Saldo inicial y aportes"),
        metric("Intereses ganados", moneyInv(last.returns, pot), "Desde que la abriste", "positive"),
        metric("Tasa actual", Norte.formatPct(pot.annualYieldPct, 2), "Efectiva anual"),
        metric("Pago de intereses", pot.compounding === "diario" ? "Diario" : "Mensual", pot.compounding === "diario" ? "Rinde todos los días" : "Rinde una vez al mes")
      );
    }

    const head = document.getElementById("invest-table-head");
    const body = document.getElementById("invest-table-body");
    head.replaceChildren();
    body.replaceChildren();
    const hr = document.createElement("tr");
    const cols = pot.type === "cdt"
      ? ["Mes", "Invertido", "Interés bruto", "Retención", "Interés neto", "Total neto"]
      : isPositionType(pot.type)
        ? ["Posición", "Invertido", "Comisión", "Vale hoy", "Ganancia"]
        : ["Mes", "Invertido", "Intereses del mes", "Saldo"];
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
        ? "Agrega un ETF, una acción o una cripto para ver el detalle."
        : "Aún no hay meses para mostrar.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    schedule.forEach((row) => {
      const tr = document.createElement("tr");
      const cells = pot.type === "cdt"
        ? [row.label, moneyInv(row.invested, pot), moneyInv(row.returnsGross || 0, pot), moneyInv(row.tax || 0, pot), moneyInv(row.returns || 0, pot), moneyInv(row.available || 0, pot)]
        : isPositionType(pot.type)
          ? [row.label, moneyInv(row.invested, pot), moneyInv(row.commission, pot), moneyInv(row.available, pot), moneyInv(row.returns, pot)]
          : [row.label, moneyInv(row.invested, pot), moneyInv(row.returns, pot), moneyInv(row.available, pot)];
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

  function gmfToggle(row, caption = "Con 4x1000") {
    const label = document.createElement("label");
    label.className = "check gmf-check";
    label.title = "Márcalo si a este movimiento le cobran el 4x1000.";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(row.gmf);
    input.addEventListener("change", () => {
      row.gmf = input.checked;
      renderMonthTotals();
    });
    label.append(input);
    if (caption) label.append(document.createTextNode(caption));
    return label;
  }

  function rowEnd(row, remove) {
    const end = document.createElement("div");
    end.className = "row-end";
    end.append(gmfToggle(row), remove);
    return end;
  }

  function moneyField(value, onChange) {
    return makeInput(value === 0 || value ? value : "", (input) => {
      const raw = input.value;
      const parsed = Number.parseFloat(raw);
      onChange(Number.isFinite(parsed) ? parsed : 0, input);
    }, { type: "number", min: "0", step: "0.01", placeholder: "0", inputmode: "decimal" });
  }

  function withPlaceholder(input, text) {
    input.placeholder = text;
    input.setAttribute("aria-label", text);
    return input;
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
          ? "Registra cada posición con lo que invertiste y lo que vale hoy. Cifras en dólares."
          : "Registra cada posición con lo que invertiste y lo que vale hoy. Cifras en pesos."
      })
    );
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-sm btn-outline";
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
      empty.textContent = "Agrega tu primera posición, por ejemplo un ETF o una acción.";
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
        Object.assign(document.createElement("label"), { textContent: `Lo que invertiste (${unit})` }),
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
        Object.assign(document.createElement("label"), { textContent: `Vale hoy (${unit})` }),
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
        Object.assign(document.createElement("label"), { textContent: `Comisión al comprar (${unit})` }),
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
      returnsHint.textContent = "Lo que has ganado o perdido";
      returnsField.append(
        Object.assign(document.createElement("label"), { textContent: "Ganancia" }),
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
        Object.assign(document.createElement("h3"), { textContent: "Aportes" }),
        (() => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn btn-sm btn-outline";
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
        hint.textContent = "Anota solo los meses en los que pusiste más dinero.";
        moves.appendChild(hint);
      } else {
        const legend = document.createElement("div");
        legend.className = "move-legend";
        ["Año", "Mes", "Aporte", "Comisión", ""].forEach((text) => {
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
            withPlaceholder(moneyField(mov.amount, (val) => {
              mov.amount = val;
              updateInvestSide(pot);
              const ret = card.querySelector("[data-holding-returns]");
              if (ret) ret.textContent = moneyInv(holdingReturns(holding, pot), pot);
            }), "Aporte"),
            withPlaceholder(moneyField(mov.commission, (val) => {
              mov.commission = val;
              updateInvestSide(pot);
              const ret = card.querySelector("[data-holding-returns]");
              if (ret) ret.textContent = moneyInv(holdingReturns(holding, pot), pot);
            }), "Comisión"),
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
        textContent: "Lo que te pagaron tus posiciones. Si lo reinvertiste, márcalo y se suma a su ganancia."
      })
    );
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-sm btn-outline";
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
        textContent: "Primero agrega una posición."
      }));
      container.appendChild(section);
      return;
    }

    if (!pot.dividends.length) {
      section.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Aún no has anotado dividendos."
      }));
      container.appendChild(section);
      return;
    }

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
      checkWrap.append(check, document.createTextNode("Reinvertido"));
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
        withPlaceholder(moneyField(div.amount, (val) => {
          div.amount = val;
          updateInvestSide(pot);
        }), `Valor (${positionUnit(pot)})`),
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

  function cdtPreviewText(pot) {
    const gross = cdtGrossInterest(pot);
    const tax = gross * ((Number(pot.taxPct) || 0) / 100);
    const mature = cdtMaturityDate(pot);
    const date = `${mature.getDate()} de ${MONTHS[mature.getMonth()].toLowerCase()} de ${mature.getFullYear()}`;
    return `Vence el ${date}. Ganarás ${moneyInv(gross - tax, pot)} de intereses después de la retención.`;
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
        ? "Un CDT con tasa fija. Mira cuánto recibirás al terminar y cómo crecen los intereses mes a mes."
        : pot.type === "alta_rentabilidad"
          ? "Una cuenta que paga intereses. Si el banco cambia la tasa, actualízala: lo que ya ganaste se mantiene."
          : pot.type === "manual"
            ? "Tus posiciones, aportes y dividendos, todo en pesos."
            : "Tus posiciones en bolsa, en dólares. Con el valor del dólar de arriba lo vemos también en pesos.";

    document.getElementById("invest-table-hint").textContent =
      pot.type === "cdt"
        ? "Cómo se acumulan los intereses durante el plazo."
        : isPositionType(pot.type)
          ? "Cada posición con lo que invertiste, lo que vale y lo que ganas."
          : "Lo que tenías, los intereses y el saldo de cada mes.";

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
    }, { type: "text", placeholder: "Ej. CDT Bancolombia" }));

    addField("Tipo", makeSelect(pot.type, INVEST_TYPES.map((t) => ({ value: t.id, label: t.label })), (value) => {
      pot.type = value;
      renderInvestDetail();
    }));

    addField("Banco o plataforma", makeSelect(pot.bankId || "", bankOptions(true), (value) => {
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
      addField("Lo que ya tienes invertido", moneyField(pot.initialAmount, (val) => {
        pot.initialAmount = val;
        if (pot.type === "cdt") pot.interestGross = cdtGrossInterest(pot);
        updateInvestSide(pot);
      }), "field-money");
    }

    if (pot.type === "cdt") {
      addField("Tasa de interés anual (%)", pctField(pot.interestRatePct, (val) => {
        pot.interestRatePct = val;
        pot.interestGross = cdtGrossInterest(pot);
        updateInvestSide(pot);
      }));
      addField("Retención (%)", pctField(pot.taxPct, (val) => {
        pot.taxPct = Number.isFinite(val) ? val : DEFAULT_TAX_PCT;
        updateInvestSide(pot);
      }));
      addField("Plazo (días)", makeInput(pot.termDays || "", (input) => {
        pot.termDays = Math.max(1, Number.parseInt(input.value, 10) || 180);
        pot.interestGross = cdtGrossInterest(pot);
        updateInvestSide(pot);
      }, { type: "number", min: "1", step: "1" }));
      addField("Pago de intereses", makeSelect(pot.interestPayout || "final", [
        { value: "final", label: "Al final del plazo" },
        { value: "mensual", label: "Cada mes" }
      ], (value) => {
        pot.interestPayout = value;
        updateInvestSide(pot);
      }));

      const preview = document.createElement("p");
      preview.className = "saving-meta";
      preview.id = "cdt-preview";
      preview.textContent = cdtPreviewText(pot);
      card.appendChild(preview);
    }

    if (pot.type === "alta_rentabilidad") {
      addField("Tasa anual (%)", pctField(pot.annualYieldPct, (val) => {
        setAnnualYieldPct(pot, val);
        updateInvestSide(pot);
      }));
      addField("Pago de intereses", makeSelect(pot.compounding || "mensual", [
        { value: "mensual", label: "Mensuales" },
        { value: "diario", label: "Diarios" }
      ], (value) => {
        pot.compounding = value;
        renderInvestDetail();
      }));
      const compoundHint = document.createElement("p");
      compoundHint.className = "saving-meta";
      compoundHint.textContent = pot.compounding === "diario"
        ? "Diarios: el banco paga intereses todos los días."
        : "Mensuales: el banco paga intereses una vez al mes.";
      card.appendChild(compoundHint);
      const hint = document.createElement("p");
      hint.className = "saving-meta";
      hint.textContent = "Si el banco cambia la tasa, actualízala aquí: lo ya ganado se mantiene. Los aportes se anotan en cada mes.";
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
          preview.textContent = cdtPreviewText(pot);
        };
        card.querySelectorAll("input, select, .pick").forEach((input) => {
          input.addEventListener("input", syncPreview);
          input.addEventListener("change", syncPreview);
        });
      }
    }
  }

  function renderOtherAssets(box) {
    if (!includeLooseAssets(false)) return;
    const section = document.createElement("section");
    section.className = "patrimonio-linked";
    section.append(
      Object.assign(document.createElement("h3"), { textContent: "Otro patrimonio" }),
      Object.assign(document.createElement("p"), {
        className: "faint",
        textContent: "Vehículos, inmuebles u otros bienes. Se ven con el filtro Todos o Sin banco."
      })
    );
    if (!state.assets.length) {
      section.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Aún no tienes otros bienes. Usa «Otro patrimonio» para agregar, por ejemplo, un vehículo."
      }));
    }
    state.assets.forEach((asset, index) => {
      const card = document.createElement("article");
      card.className = "asset-card";
      const nameField = document.createElement("div");
      nameField.className = "field";
      nameField.append(
        Object.assign(document.createElement("label"), { textContent: "Nombre" }),
        makeInput(asset.name, (input) => { asset.name = input.value; }, { type: "text", placeholder: "Vehículo" })
      );
      const kindField = document.createElement("div");
      kindField.className = "field";
      kindField.append(
        Object.assign(document.createElement("label"), { textContent: "Tipo" }),
        makeSelect(asset.kind, ASSET_KINDS.map((item) => ({ value: item.id, label: item.label })), (value) => {
          asset.kind = value;
        })
      );
      const valueField = document.createElement("div");
      valueField.className = "field field-money";
      valueField.append(
        Object.assign(document.createElement("label"), { textContent: "Valor" }),
        moneyField(asset.value, (val) => {
          asset.value = val;
          renderPatrimonioMetrics(document.getElementById("patrimonio-metrics"));
        })
      );
      const notesField = document.createElement("div");
      notesField.className = "field";
      notesField.append(
        Object.assign(document.createElement("label"), { textContent: "Nota" }),
        makeInput(asset.notes, (input) => { asset.notes = input.value; }, { type: "text", placeholder: "Modelo, año…" })
      );
      card.append(nameField, kindField, valueField, notesField, removeButton(() => {
        state.assets.splice(index, 1);
        render();
      }));
      section.appendChild(card);
    });
    box.appendChild(section);
  }

  function renderPatrimonioMetrics(metricsBox) {
    const p = patrimonioBreakdown(state.viewYear);
    const heroSub = [p.debts > 0 ? "Lo que tienes menos lo que debes" : "Todo lo que tienes hoy"];
    if (p.assets) heroSub.push(`incluye ${money(p.assets)} en otros bienes`);
    metricsBox.replaceChildren(
      metric("Patrimonio total", money(p.total), heroSub.join(" · "), "", true),
      metric("En cuentas", money(p.accounts), "Dinero disponible en cuentas"),
      metric("Ahorros", money(p.savings), "Lo que llevas ahorrado"),
      metric("Inversiones", money(p.investments), "Valor actual"),
      metric("Deudas", money(p.debts), "Lo que te falta pagar", p.debts > 0 ? "negative" : "")
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
    linkedTitle.textContent = "Ahorros, inversiones y deudas";
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
        const row = document.createElement("div");
        row.className = "linked-row";
        row.append(
          Object.assign(document.createElement("span"), {
            textContent: `${inv.name || "Producto"} · ${investTypeLabel(inv.type)}`
          }),
          Object.assign(document.createElement("strong"), {
            textContent: money(investmentWealthCop(inv))
          })
        );
        investPart.appendChild(row);
      });
    }

    const debtPart = document.createElement("div");
    debtPart.className = "linked-block";
    debtPart.appendChild(Object.assign(document.createElement("p"), { className: "faint", textContent: "Deudas" }));
    const debtList = state.debts.filter((d) => matchesBank(d.bankId));
    if (!debtList.length) {
      debtPart.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Sin deudas registradas."
      }));
    } else {
      debtList.forEach((debt) => {
        const row = document.createElement("div");
        row.className = "linked-row";
        row.append(
          Object.assign(document.createElement("span"), { textContent: debt.name || "Deuda" }),
          Object.assign(document.createElement("strong"), {
            className: "negative",
            textContent: money(-debtBalance(debt, state.viewYear))
          })
        );
        debtPart.appendChild(row);
      });
    }

    linkedGrid.append(savingsPart, investPart, debtPart);
    linked.appendChild(linkedGrid);
    const note = document.createElement("p");
    note.className = "saving-meta";
    note.textContent = "Ahorros e inversiones suman a tu patrimonio; las deudas lo restan. Si un ahorro ya está incluido en el saldo de una cuenta, no lo anotes dos veces.";
    linked.appendChild(note);
    box.appendChild(linked);

    const assetBtn = document.getElementById("add-asset");
    if (assetBtn) assetBtn.hidden = !(state.bankFilter === "none" || state.bankFilter === "all");
    renderOtherAssets(box);

    const accountsHead = document.createElement("div");
    accountsHead.className = "list-head accounts-subhead";
    accountsHead.append(
      Object.assign(document.createElement("h3"), { textContent: "Cuentas bancarias" }),
      Object.assign(document.createElement("p"), {
        className: "faint",
        textContent: "Lo que tenías en cada cuenta al empezar. No se suma como ingreso."
      })
    );
    box.appendChild(accountsHead);

    const allFiltered = state.accounts.filter((acc) => matchesBank(acc.bankId));
    if (!allFiltered.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = "Agrega tus cuentas con el saldo que tenían al empezar. Ese saldo no se suma como ingreso.";
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
        Object.assign(document.createElement("label"), { textContent: "Nombre de la cuenta" }),
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
        Object.assign(document.createElement("label"), { textContent: "Saldo al empezar" }),
        moneyField(acc.openingBalance, (val) => {
          acc.openingBalance = val;
          renderPatrimonioMetrics(metricsBox);
        })
      );

      const monthField = document.createElement("div");
      monthField.className = "field";
      monthField.append(
        Object.assign(document.createElement("label"), { textContent: "Desde el mes" }),
        makeSelect(acc.openingMonth, monthOptions(), (value) => {
          acc.openingMonth = value;
        })
      );

      const yearField = document.createElement("div");
      yearField.className = "field";
      yearField.append(
        Object.assign(document.createElement("label"), { textContent: "Del año" }),
        makeInput(acc.openingYear || "", (input) => {
          acc.openingYear = Number.parseInt(input.value, 10) || now.getFullYear();
        }, { type: "number", step: "1" })
      );

      const noteLine = document.createElement("p");
      noteLine.className = "saving-meta account-note";
      noteLine.textContent = `Saldo a ${(MONTHS[Number(acc.openingMonth) - 1] || "").toLowerCase()} de ${acc.openingYear}`;

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
      notice.className = "bank-required-note";
      const title = document.createElement("h3");
      title.textContent = "Elige un banco para anotar";
      const text = document.createElement("p");
      text.textContent = "Cada mes se anota por banco. El total de todos tus bancos lo ves en Resumen y en Factura.";
      const options = document.createElement("div");
      options.className = "chip-row";
      [...state.banks.map((bank) => ({ id: bank.id, label: bank.name })), { id: "none", label: "Sin banco" }].forEach((option) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = option.label;
        chip.addEventListener("click", () => {
          state.bankFilter = option.id;
          render();
        });
        options.appendChild(chip);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.className = "chip chip-add";
      add.textContent = "+ Agregar banco";
      add.addEventListener("click", () => document.getElementById("btn-manage-banks").click());
      options.appendChild(add);
      notice.append(title, text, options);
      grid.appendChild(notice);
      return;
    }

    const today = { year: now.getFullYear(), month: now.getMonth() };
    MONTHS.forEach((name, index) => {
      const key = monthKey(index);
      const entry = getMonth(state.viewYear, key, false);
      const sliced = monthViewEntry(entry || emptyMonth());
      const t = monthTotals(sliced);
      const filled = monthHasData(sliced);
      const isNow = state.viewYear === today.year && index === today.month;
      const card = document.createElement("article");
      card.className = `month-card${filled ? "" : " is-empty"}${isNow ? " is-now" : ""}`;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Abrir ${name} de ${state.viewYear}`);

      const head = document.createElement("div");
      head.className = "month-card-head";
      const title = document.createElement("h3");
      title.textContent = name;
      head.appendChild(title);
      if (isNow) head.appendChild(Object.assign(document.createElement("span"), { className: "month-now", textContent: "Este mes" }));

      const body = document.createElement("div");
      body.className = "month-card-body";
      if (filled) {
        const out = t.expense + t.debtPay + t.aportes + t.invest;
        const lines = [
          ["Ingresos", money(t.income), ""],
          ["Salidas", money(out), ""],
          ["Te quedó", money(t.balance), t.balance >= 0 ? "positive" : "negative"]
        ];
        lines.forEach(([label, value, cls]) => {
          const line = document.createElement("div");
          line.className = "month-line";
          const strong = document.createElement("strong");
          strong.textContent = value;
          if (cls) strong.className = cls;
          line.append(Object.assign(document.createElement("span"), { textContent: label }), strong);
          body.appendChild(line);
        });
        const top = Math.max(t.income, out, 1);
        const meter = document.createElement("div");
        meter.className = "month-meter";
        meter.setAttribute("aria-hidden", "true");
        [["is-in", t.income], ["is-out", out]].forEach(([cls, value]) => {
          const bar = document.createElement("span");
          bar.className = cls;
          bar.style.width = `${Math.max(value > 0 ? 3 : 0, (value / top) * 100)}%`;
          meter.appendChild(bar);
        });
        body.appendChild(meter);
      } else {
        body.appendChild(Object.assign(document.createElement("p"), {
          className: "month-empty",
          textContent: "Sin movimientos. Toca para anotar."
        }));
      }

      const foot = document.createElement("div");
      foot.className = "month-card-foot";
      foot.appendChild(Object.assign(document.createElement("span"), { className: "month-open", textContent: "Abrir mes →" }));
      if (filled) {
        const factura = document.createElement("button");
        factura.type = "button";
        factura.className = "btn btn-sm btn-ghost month-invoice-btn";
        factura.textContent = "Factura";
        factura.addEventListener("click", (event) => {
          event.stopPropagation();
          openMonthInvoice(state.viewYear, key);
        });
        factura.addEventListener("keydown", (event) => event.stopPropagation());
        foot.appendChild(factura);
      }

      card.append(head, body, foot);
      card.addEventListener("click", () => openMonth(state.viewYear, key));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openMonth(state.viewYear, key);
        }
      });
      grid.appendChild(card);
    });
  }

  function withBankLabel(name, bankId) {
    return `${name || "Sin nombre"} · ${bankName(bankId)}`;
  }

  function debtInvoiceRow(row, withBank) {
    const debt = state.debts.find((d) => d.id === row.debtId);
    const verb = row.kind === "prestamo" ? "Préstamo" : "Pago";
    const name = `${verb} ${(debt && debt.name) || "Deuda"}${row.concept ? ` · ${row.concept}` : ""}`;
    return {
      name: withBank ? withBankLabel(name, row.bankId || (debt && debt.bankId)) : `${name}${row.gmf ? " · con 4x1000" : ""}`,
      amount: row.amount
    };
  }

  function addInvoiceRows(box, title, rows) {
    if (!rows.length) return;
    const h = document.createElement("div");
    h.className = "invoice-row invoice-group";
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
    right.className = "invoice-stamp";
    const stamp = document.createElement("p");
    stamp.textContent = "Patrimonio total";
    const big = document.createElement("strong");
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
        ...state.investments.map((s) => s.bankId || ""),
        ...state.debts.map((d) => d.bankId || "")
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
        .reduce((s, pot) => s + investmentWealthCop(pot), 0);
      const debtSum = state.debts
        .filter((d) => (d.bankId || "") === bankId)
        .reduce((s, debt) => s + debtBalance(debt, state.viewYear), 0);
      const total = accountsSum + savingsSum + investSum - debtSum;
      if (!total && !debtSum) return;
      addInvoiceRows(byBankSection, bankName(bankId), [
        { name: "Cuentas", amount: accountsSum },
        { name: "Ahorros", amount: savingsSum },
        { name: "Inversiones", amount: investSum },
        { name: "Deudas", amount: -debtSum },
        { name: "Subtotal banco", amount: total }
      ].filter((row) => row.amount !== 0 || row.name === "Subtotal banco"));
    });
    if (includeLooseAssets(allBanks)) {
      const assetRows = state.assets
        .filter((asset) => Number(asset.value))
        .map((asset) => {
          const kind = (ASSET_KINDS.find((item) => item.id === asset.kind) || ASSET_KINDS[ASSET_KINDS.length - 1]).label;
          const name = (asset.name || "").trim();
          return {
            name: name ? `Otro patrimonio - ${kind} · ${name}` : `Otro patrimonio - ${kind}`,
            amount: Number(asset.value) || 0
          };
        });
      if (assetRows.length) addInvoiceRows(byBankSection, "Sin banco", assetRows);
    }
    box.appendChild(byBankSection);

    if (carry.opening > 0 || carry.priorFlow > 0) {
      const preamble = document.createElement("section");
      preamble.className = "invoice-month";
      preamble.appendChild(Object.assign(document.createElement("h3"), { textContent: "Con lo que empezaste" }));
      if (carry.opening > 0) {
        addInvoiceRows(preamble, "Lo que ya tenías", [
          { name: "En ahorros", amount: carry.savingsInitial },
          { name: "En inversiones", amount: carry.investmentsInitial }
        ].filter((row) => row.amount !== 0));
      }
      if (carry.priorFlow > 0) {
        addInvoiceRows(preamble, "Traes de años anteriores", [
          { name: "Aportes a ahorros", amount: carry.savings },
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
      addInvoiceRows(block, "Gastos", (sliced.expenses || []).map((row) => ({
        name: withBankLabel(`${row.name || "Gasto"} · ${categoryById(row.category).label}`, row.bankId),
        amount: row.amount
      })));
      addInvoiceRows(block, "Deudas", (sliced.debts || []).map((row) => debtInvoiceRow(row, true)));
      addInvoiceRows(block, "Ahorros", (sliced.contributions || []).map((row) => {
        const pot = state.savings.find((s) => s.id === row.savingId);
        const verb = row.kind === "retiro" ? "Retiro" : "Aporte";
        const concept = row.concept ? ` · ${row.concept}` : "";
        return {
          name: withBankLabel(`${verb} ${(pot && pot.name) || "Ahorro"}${concept}`, row.bankId || (pot && pot.bankId)),
          amount: contribSigned(row)
        };
      }));
      addInvoiceRows(block, "Transferencias", (sliced.transfers || []).map((row) => ({
        name: `${bankName(row.fromBankId)} → ${bankName(row.toBankId)}${row.concept ? ` · ${row.concept}` : ""}${row.investmentId ? " · a inversión" : ""}`,
        amount: row.amount
      })));
      addInvoiceRows(block, "Inversiones", (sliced.investments || []).map((row) => {
        const pot = state.investments.find((s) => s.id === row.investmentId);
        return {
          name: withBankLabel(`${(pot && pot.name) || "Inversión"}${row.concept ? ` · ${row.concept}` : ""}`, row.bankId || (pot && pot.bankId)),
          amount: row.amount
        };
      }));
      const sub = document.createElement("div");
      sub.className = "invoice-row total";
      sub.append(
        Object.assign(document.createElement("span"), { textContent: `Te quedó en ${name.toLowerCase()}` }),
        Object.assign(document.createElement("span"), { textContent: money(t.balance) })
      );
      block.appendChild(sub);
      box.appendChild(block);
    });

    if (!any && patrimonio.total <= 0) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "invoice-empty",
        textContent: "Aún no hay movimientos este año. Empieza por Patrimonio o por la pestaña Movimientos."
      }));
      return;
    }

    const savingsStock = savingsAll.reduce((sum, s) => sum + potTotal("saving", s.id), 0);
    const investStock = investAll.reduce((sum, s) => sum + investmentWealthCop(s), 0);
    const debtsAll = state.debts.filter((d) => matchesBank(d.bankId));
    const debtStock = debtsAll.reduce((sum, d) => sum + debtBalance(d, state.viewYear), 0);
    const foot = document.createElement("section");
    foot.className = "invoice-foot";
    [
      ["Ingresos del año", totals.income],
      ["Gastos del año", totals.egresos],
      ["Ahorraste en el año", totals.ahorros],
      ["Invertiste en el año", totals.inversiones],
      ...(debtsAll.length ? [["Pagaste a deudas en el año", totals.debtPay]] : []),
      ["Te quedó libre en el año", totals.balance],
      ["Total en ahorros", savingsStock],
      ["Total en inversiones", investStock],
      ...(debtsAll.length ? [["Total que debes", debtStock]] : []),
      ["Patrimonio total", patrimonio.total]
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
        textContent: "Elige un banco para anotar ingresos."
      }));
      return;
    }
    if (!rows.length) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Aún no hay ingresos este mes."
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
        textContent: "Elige un banco para anotar gastos."
      }));
      return;
    }
    if (!rows.length) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Aún no hay gastos este mes."
      }));
      return;
    }
    rows.forEach((row) => {
      const index = entry.expenses.indexOf(row);
      const wrap = document.createElement("div");
      wrap.className = "row expense";
      const categories = CATEGORIES.filter((category) => category.id !== "deudas" || row.category === "deudas");
      const select = makeSelect(categoryById(row.category).id, categories.map((category) => ({
        value: category.id,
        label: category.label
      })), (value) => {
        row.category = value;
        renderMonthTotals();
      });
      wrap.append(
        makeInput(row.name, (input) => { row.name = input.value; }, { type: "text", placeholder: "Concepto" }),
        select,
        moneyField(row.amount, (val) => {
          row.amount = val;
          renderMonthTotals();
        }),
        rowEnd(row, removeButton(() => {
          entry.expenses.splice(index, 1);
          renderExpenses();
          renderMonthTotals();
        }))
      );
      box.appendChild(wrap);
    });
  }

  function emptyCreate(box, text, buttonLabel, onClick) {
    const wrap = document.createElement("div");
    wrap.className = "empty-note empty-create";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-sm btn-outline";
    button.textContent = buttonLabel;
    button.addEventListener("click", onClick);
    wrap.append(Object.assign(document.createElement("p"), { textContent: text }), button);
    box.appendChild(wrap);
  }

  function renderDebtRows() {
    const box = document.getElementById("debt-rows");
    const hint = document.getElementById("debt-hint");
    if (!box) return;
    const entry = currentMonth();
    const active = activeBankId();
    const debts = state.debts.filter((d) => active === null || (d.bankId || "") === active);
    box.replaceChildren();
    if (monthRequiresBank()) {
      hint.textContent = "Elige un banco para anotar pagos de deudas.";
      return;
    }
    hint.textContent = "";
    if (!debts.length) {
      emptyCreate(box, `Aún no tienes deudas en ${bankName(active)}.`, "Crear deuda", () => startMonthRow("debt"));
      return;
    }
    const rows = filterMonthRows(entry.debts);
    if (!rows.length) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Aún no hay pagos de deudas este mes."
      }));
    }
    rows.forEach((row) => {
      const index = entry.debts.indexOf(row);
      const wrap = document.createElement("div");
      wrap.className = "row contrib-rich";
      if (!row.debtId || !debts.some((d) => d.id === row.debtId)) row.debtId = debts[0].id;
      if (!row.bankId) row.bankId = active;
      const select = makeSelect(row.debtId, [
        ...debts.map((debt) => ({ value: debt.id, label: debt.name || "Sin nombre" })),
        createOption("debt", active, (debt) => {
          row.debtId = debt.id;
          renderDebtRows();
        })
      ], (value) => {
        row.debtId = value;
      });
      const kind = makeSelect(row.kind || "pago", [
        { value: "pago", label: "Pago" },
        { value: "prestamo", label: "Préstamo" }
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
        }, { type: "text", placeholder: "Detalle (ej. cuota de marzo)" }),
        rowEnd(row, removeButton(() => {
          entry.debts.splice(index, 1);
          renderDebtRows();
          renderMonthTotals();
        }))
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
      hint.textContent = "Elige un banco para mover sus ahorros.";
      return;
    }
    if (!pots.length) {
      hint.textContent = "";
      emptyCreate(box, `Aún no tienes ahorros en ${bankName(active)}.`, "Crear ahorro", () => startMonthRow("saving"));
      return;
    }
    hint.textContent = "";
    if (!entry.contributions) entry.contributions = [];
    if (!filterMonthRows(entry.contributions).length) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Aún no hay aportes ni retiros de ahorro este mes."
      }));
    }
    filterMonthRows(entry.contributions).forEach((row) => {
      const index = entry.contributions.indexOf(row);
      const wrap = document.createElement("div");
      wrap.className = "row contrib-rich";
      if (!row.savingId || !pots.some((p) => p.id === row.savingId)) row.savingId = pots[0].id;
      if (!row.bankId) row.bankId = active;
      const select = makeSelect(row.savingId, [
        ...pots.map((pot) => ({ value: pot.id, label: pot.name || "Sin nombre" })),
        createOption("saving", active, (pot) => {
          row.savingId = pot.id;
          row.bankId = active;
          renderContribs();
        })
      ], (value) => {
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
        }, { type: "text", placeholder: "Para qué (ej. gasolina)" }),
        rowEnd(row, removeButton(() => {
          entry.contributions.splice(index, 1);
          renderContribs();
          renderMonthTotals();
        }))
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
      hint.textContent = "Elige un banco para aportar a sus inversiones.";
      return;
    }
    if (!pots.length) {
      hint.textContent = "";
      emptyCreate(box, `Aún no tienes inversiones en ${bankName(active)}.`, "Crear inversión", () => startMonthRow("investment"));
      return;
    }
    hint.textContent = "";
    if (!entry.investments) entry.investments = [];
    if (!filterMonthRows(entry.investments).length) {
      box.appendChild(Object.assign(document.createElement("p"), {
        className: "empty-note",
        textContent: "Aún no hay aportes a inversiones este mes."
      }));
    }
    filterMonthRows(entry.investments).forEach((row) => {
      const index = entry.investments.indexOf(row);
      const wrap = document.createElement("div");
      wrap.className = "row placement";
      if (!row.investmentId || !pots.some((p) => p.id === row.investmentId)) row.investmentId = pots[0].id;
      if (!row.bankId) row.bankId = active;
      const select = makeSelect(row.investmentId, [
        ...pots.map((pot) => ({ value: pot.id, label: `${pot.name || "Sin nombre"} · ${investTypeLabel(pot.type)}` })),
        createOption("investment", active, (pot) => {
          row.investmentId = pot.id;
          row.bankId = active;
          renderPlacements();
        })
      ], (value) => {
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
        rowEnd(row, removeButton(() => {
          entry.investments.splice(index, 1);
          renderPlacements();
          renderMonthTotals();
        }))
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
        textContent: "Elige un banco para anotar transferencias."
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
        textContent: "Aún no hay transferencias este mes."
      }));
    }
    rows.forEach((row) => {
      const index = entry.transfers.indexOf(row);
      const wrap = document.createElement("div");
      wrap.className = "transfer-card";
      const grid = document.createElement("div");
      grid.className = "transfer-grid";
      const destInvestOpts = [
        { value: "", label: "No" },
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
        fieldWrap("Va a una inversión", makeSelect(row.investmentId || "", destInvestOpts, (value) => {
          row.investmentId = value;
          renderMonthTotals();
        })),
        Object.assign(fieldWrap("4x1000", gmfToggle(row)), { className: "field gmf-field" })
      );
      const body = document.createElement("div");
      body.className = "transfer-body";
      body.append(grid);
      wrap.append(body, removeButton(() => {
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
    const debtTotal = document.getElementById("debt-total");
    if (debtTotal) debtTotal.textContent = money(t.debtPay);
    document.getElementById("contrib-total").textContent = money(t.contrib);
    document.getElementById("placement-total").textContent = money(t.invest);
    const transferTotal = document.getElementById("transfer-total");
    if (transferTotal) transferTotal.textContent = money(t.transferNet);
    const bankLabel = monthRequiresBank() ? "Todos los bancos" : bankName(activeBankId());
    const slices = expenseSlices(sliced.expenses, t.aportes, t.invest, t.debtPay);
    const gmf = gmfForRows(entry);
    const gmfMetric = metric("Calculadora de 4x1000", money(gmf.counted), gmfNoteText());
    gmfMetric.classList.add("metric-gmf");
    gmfMetric.insertBefore(
      Object.assign(document.createElement("p"), { className: "metric-tax", textContent: `Impuesto pagado: ${money(gmf.tax)}` }),
      gmfMetric.querySelector(".sub")
    );
    document.getElementById("month-metrics").replaceChildren(
      metric("Te quedó este mes", money(t.balance), bankLabel, t.balance >= 0 ? "positive" : "negative", true),
      metric("Ingresos", money(t.income), "Lo que entró"),
      metric("Gastos", money(t.expense), "Lo que gastaste"),
      metric("Deudas", money(t.debtPay), t.debtNew ? `Te prestaron ${money(t.debtNew)}` : "Lo que pagaste"),
      metric("Ahorraste", money(t.contrib), t.retiros ? `Sacaste ${money(t.retiros)}` : "Neto del mes"),
      metric("Transferencias", money(t.transferNet), t.transferOut || t.transferIn ? `Salió ${money(t.transferOut)} · Entró ${money(t.transferIn)}` : "Entre tus bancos"),
      metric("Invertiste", money(t.invest), "En tus inversiones"),
      gmfMetric
    );
    NorteCharts.breakdown(document.getElementById("month-donut"), slices, {
      format: money,
      totalLabel: "Salió este mes",
      empty: "Anota gastos o aportes para ver en qué se fue el dinero."
    });
  }

  function openMonthInvoice(year, month) {
    const dialog = document.getElementById("month-invoice-modal");
    const box = document.getElementById("month-invoice");
    if (!dialog || !box) return;
    const entry = normalizeMonth(getMonth(year, month, false) || emptyMonth());
    const sliced = monthViewEntry(entry);
    const t = monthTotals(sliced);
    const gmf = gmfForRows(entry);
    const title = `${MONTHS[Number(month) - 1]} ${year} · ${bankName(activeBankId())}`;
    box.replaceChildren();
    const head = document.createElement("div");
    head.className = "invoice-head";
    head.append(
      Object.assign(document.createElement("div"), { className: "brand-line", textContent: "Norte · Factura del mes" }),
      Object.assign(document.createElement("h2"), { textContent: title })
    );
    box.appendChild(head);
    const block = document.createElement("section");
    block.className = "invoice-month";
    addInvoiceRows(block, "Ingresos", (sliced.incomes || []).map((row) => ({
      name: row.name || "Ingreso",
      amount: row.amount
    })));
    addInvoiceRows(block, "Gastos", (sliced.expenses || []).map((row) => ({
      name: `${row.name || "Gasto"}${row.gmf ? " · con 4x1000" : ""}`,
      amount: row.amount
    })));
    addInvoiceRows(block, "Deudas", (sliced.debts || []).map((row) => debtInvoiceRow(row, false)));
    addInvoiceRows(block, "Ahorros", (sliced.contributions || []).map((row) => {
      const pot = state.savings.find((item) => item.id === row.savingId);
      const verb = row.kind === "retiro" ? "Retiro" : "Aporte";
      return {
        name: `${verb} ${(pot && pot.name) || "Ahorro"}${row.concept ? ` · ${row.concept}` : ""}${row.gmf ? " · con 4x1000" : ""}`,
        amount: contribSigned(row)
      };
    }));
    addInvoiceRows(block, "Transferencias", (sliced.transfers || []).map((row) => ({
      name: `${bankName(row.fromBankId)} → ${bankName(row.toBankId)}${row.concept ? ` · ${row.concept}` : ""}${row.gmf ? " · con 4x1000" : ""}`,
      amount: row.amount
    })));
    addInvoiceRows(block, "Inversiones", (sliced.investments || []).map((row) => {
      const pot = state.investments.find((item) => item.id === row.investmentId);
      return {
        name: `${(pot && pot.name) || "Inversión"}${row.concept ? ` · ${row.concept}` : ""}${row.gmf ? " · con 4x1000" : ""}`,
        amount: row.amount
      };
    }));
    const foot = document.createElement("section");
    foot.className = "invoice-foot";
    const summary = [{ label: "Te quedó este mes", text: money(t.balance), total: true }];
    if (gmf.banks.length > 1) {
      gmf.banks.forEach((bank) => {
        summary.push({
          label: `4x1000 · ${bankName(bank.bankId)}`,
          text: `${money(bank.counted)} · impuesto ${money(bank.tax)}`,
          total: false
        });
      });
    } else {
      summary.push({ label: "Movimientos con 4x1000", text: money(gmf.counted), total: false });
    }
    summary.push({ label: "Impuesto 4x1000 pagado", text: money(gmf.tax), total: true });
    summary.forEach((item) => {
      const row = document.createElement("div");
      row.className = item.total ? "invoice-row total" : "invoice-row";
      row.append(
        Object.assign(document.createElement("span"), { textContent: item.label }),
        Object.assign(document.createElement("span"), { textContent: item.text })
      );
      foot.appendChild(row);
    });
    const note = document.createElement("p");
    note.className = "saving-meta";
    note.textContent = gmfNoteText();
    foot.appendChild(note);
    box.append(block, foot);
    if (typeof dialog.showModal === "function") dialog.showModal();
  }

  function shiftMonth(delta) {
    if (!state.openMonth) return;
    const index = ymIndex(state.openMonth.year, state.openMonth.month) + delta;
    const year = Math.floor(index / 12);
    openMonth(year, monthKey(index % 12));
  }

  function renderMonthBankChips() {
    const box = document.getElementById("month-bank-chips");
    if (!box) return;
    box.replaceChildren();
    [
      { id: "all", label: "Todos" },
      ...state.banks.map((bank) => ({ id: bank.id, label: bank.name })),
      { id: "none", label: "Sin banco" }
    ].forEach((filter) => {
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

  function renderMonth() {
    const { year, month } = state.openMonth;
    document.getElementById("month-title").textContent = `${MONTHS[Number(month) - 1]} ${year}`;
    renderMonthBankChips();
    const entry = currentMonth();
    const active = activeBankId();
    if (active === null) {
      notesInput.value = entry.notes || "";
      notesInput.disabled = true;
      notesInput.placeholder = "Elige un banco para escribir notas.";
    } else {
      notesInput.disabled = false;
      notesInput.placeholder = "Metas, recordatorios, pendientes…";
      notesInput.value = (entry.notesByBank && entry.notesByBank[active]) || "";
    }
    const locked = monthRequiresBank();
    ["add-income", "add-expense", "add-debt-row", "add-contrib", "add-placement", "add-transfer"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = locked;
    });
    const banner = document.getElementById("month-bank-banner");
    if (banner) banner.hidden = !locked;
    renderIncomes();
    renderExpenses();
    renderDebtRows();
    renderContribs();
    renderTransfers();
    renderPlacements();
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
      treasury: JSON.parse(JSON.stringify(state.treasury)),
      banks: state.banks.map((row) => ({ ...row })),
      accounts: state.accounts.map((row) => ({ ...row })),
      assets: state.assets.map((row) => ({ ...row })),
      debts: state.debts.map((row) => ({ ...row })),
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
      loadTreasury(data.treasury);
      state.banks = Array.isArray(data.banks) ? data.banks.map(normalizeBank) : [];
      state.accounts = Array.isArray(data.accounts) ? data.accounts.map(normalizeAccount) : [];
      state.assets = Array.isArray(data.assets) ? data.assets.map(normalizeAsset) : [];
      state.debts = Array.isArray(data.debts) ? data.debts.map(normalizeDebt) : [];
      state.savings = Array.isArray(data.savings) ? data.savings.map(normalizeSaving) : [];
      state.investments = Array.isArray(data.investments) ? data.investments.map(normalizeInvestment) : [];
      state.years = data.years;
      state.openMonth = null;
      state.openInvestId = null;
      state.expandedDebtId = null;
    } else if (data.incomes || data.expenses) {
      const period = (data.profile && data.profile.period) || `${state.viewYear}-01`;
      const [year, month] = period.split("-");
      state.profile.name = (data.profile && data.profile.name) || "";
      state.viewYear = Number(year) || state.viewYear;
      state.usdRate = 0;
      loadTreasury(null);
      state.banks = [];
      state.accounts = [];
      state.assets = [];
      state.debts = [];
      state.savings = [];
      state.investments = [];
      state.years = {
        [year]: {
          months: {
            [month]: {
              notes: (data.profile && data.profile.notes) || "",
              incomes: data.incomes || [],
              expenses: data.expenses || [],
              debts: [],
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
    const card = uid();
    const loan = uid();
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
    state.debts = [
      { id: card, name: "Tarjeta de crédito", bankId: bank1, initialAmount: 2400000 },
      { id: loan, name: "Crédito de libre inversión", bankId: bank1, initialAmount: 9000000 }
    ];
    state.expandedDebtId = null;
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
              { id: uid(), name: "Arriendo", category: "vivienda", amount: 1600000, bankId: bank1, gmf: true },
              { id: uid(), name: "Mercado", category: "alimentacion", amount: 820000, bankId: bank1 }
            ],
            debts: [
              { id: uid(), debtId: card, kind: "pago", amount: 600000, concept: "Cuota de enero", bankId: bank1, gmf: true },
              { id: uid(), debtId: loan, kind: "pago", amount: 450000, concept: "", bankId: bank1 }
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
                investmentId: e,
                gmf: true
              }
            ]
          },
          "02": {
            notes: "",
            notesByBank: {},
            incomes: [{ id: uid(), name: "Salario", amount: 4800000, bankId: bank1 }],
            expenses: [
              { id: uid(), name: "Arriendo", category: "vivienda", amount: 1600000, bankId: bank1, gmf: true },
              { id: uid(), name: "Mercado", category: "alimentacion", amount: 790000, bankId: bank1 }
            ],
            debts: [
              { id: uid(), debtId: card, kind: "pago", amount: 600000, concept: "Cuota de febrero", bankId: bank1, gmf: true },
              { id: uid(), debtId: loan, kind: "pago", amount: 450000, concept: "", bankId: bank1 }
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
    loadTreasury(exampleTreasury());
    render();
    Norte.toast("Cargamos un ejemplo para que explores.");
  }

  function exampleTreasury() {
    const cells = {
      "0:0": { v: "Presupuesto mensual", b: 1 },
      "2:0": { v: "Concepto", b: 1, bg: "slate" },
      "2:1": { v: "Valor", b: 1, bg: "slate", a: "right" },
      "2:2": { v: "% del salario", b: 1, bg: "slate", a: "right" },
      "3:0": { v: "Salario" },
      "3:1": { v: "4800000", f: "money" }
    };
    [["Arriendo", 1600000], ["Mercado", 820000], ["Servicios", 350000], ["Transporte", 280000]].forEach(([concept, amount], index) => {
      const r = 4 + index;
      cells[`${r}:0`] = { v: concept };
      cells[`${r}:1`] = { v: String(amount), f: "money" };
      cells[`${r}:2`] = { v: `=B${r + 1}/$B$4`, f: "pct" };
    });
    cells["9:0"] = { v: "Total gastos", b: 1 };
    cells["9:1"] = { v: "=SUMA(B5:B8)", f: "money", b: 1 };
    cells["9:2"] = { v: "=B10/$B$4", f: "pct", b: 1 };
    cells["10:0"] = { v: "Te queda", b: 1, bg: "green" };
    cells["10:1"] = { v: "=B4-B10", f: "money", b: 1, bg: "green" };
    cells["10:2"] = { v: "=B11/$B$4", f: "pct", b: 1, bg: "green" };
    return { sheets: [{ name: "Presupuesto", cells, widths: { 0: 190, 1: 140, 2: 130 } }] };
  }

  document.querySelectorAll(".overview-tabbar [data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  document.querySelectorAll("#onboarding [data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      const go = button.dataset.go;
      if (go === "banks") document.getElementById("btn-manage-banks").click();
      else setTab(go);
    });
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
    state.banks.push({ id: uid(), name: "Nuevo banco" });
    renderBanksModal();
    renderBankChips();
    banksModal.showModal();
    focusLastBank();
  });
  document.getElementById("add-bank").addEventListener("click", () => {
    state.banks.push({ id: uid(), name: "Nuevo banco" });
    renderBanksModal();
    renderBankChips();
    focusLastBank();
  });
  banksModal.addEventListener("close", () => render());

  const POT_COPY = {
    saving: {
      title: "Nuevo ahorro",
      option: "+ Crear ahorro nuevo",
      placeholder: "Ej. Fondo de emergencia",
      amount: "Lo que ya tienes ahorrado",
      fallback: "Nuevo ahorro",
      note: "La meta y los demás detalles los puedes cambiar en Resumen."
    },
    investment: {
      title: "Nueva inversión",
      option: "+ Crear inversión nueva",
      placeholder: "Ej. CDT 90 días",
      amount: "Lo que ya tienes invertido",
      fallback: "Nueva inversión",
      note: "La tasa, el plazo y los demás detalles los completas al abrirla desde Resumen."
    },
    debt: {
      title: "Nueva deuda",
      option: "+ Crear deuda nueva",
      placeholder: "Ej. Tarjeta de crédito",
      amount: "Lo que debes hoy",
      fallback: "Nueva deuda",
      note: "Cada pago que anotes en el mes baja lo que debes."
    }
  };
  const potModal = document.getElementById("pot-modal");
  const potName = document.getElementById("pot-name");
  const potAmount = document.getElementById("pot-amount");
  const potTypeBox = document.getElementById("pot-type");
  const potAmountField = document.getElementById("pot-amount-field");
  const potPending = { kind: "saving", bankId: "", type: "alta_rentabilidad", done: null };

  function syncPotAmount() {
    potAmountField.hidden = potPending.kind === "investment" && isPositionType(potPending.type);
  }

  function createOption(kind, bankId, onCreate) {
    return { label: POT_COPY[kind].option, action: () => openPotModal(kind, bankId, onCreate) };
  }

  function openPotModal(kind, bankId, onCreate) {
    const copy = POT_COPY[kind];
    potPending.kind = kind;
    potPending.bankId = bankId || "";
    potPending.done = onCreate;
    document.getElementById("pot-modal-title").textContent = copy.title;
    document.getElementById("pot-modal-desc").textContent = `Se crea en ${bankName(bankId)} y también aparece en Resumen.`;
    document.getElementById("pot-amount-label").textContent = copy.amount;
    document.getElementById("pot-modal-note").textContent = copy.note;
    potName.value = "";
    potName.placeholder = copy.placeholder;
    potAmount.value = "";
    document.getElementById("pot-type-field").hidden = kind !== "investment";
    if (kind === "investment") {
      potTypeBox.replaceChildren(makeSelect(potPending.type, INVEST_TYPES.map((type) => ({ value: type.id, label: type.label })), (value) => {
        potPending.type = value;
        syncPotAmount();
      }));
    }
    syncPotAmount();
    if (typeof potModal.showModal === "function") potModal.showModal();
    potName.focus();
  }

  function createPot() {
    const { kind, bankId, type } = potPending;
    const done = potPending.done;
    potPending.done = null;
    const name = potName.value.trim() || POT_COPY[kind].fallback;
    const parsed = Number.parseFloat(potAmount.value);
    const amount = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    let item;
    if (kind === "saving") {
      item = normalizeSaving({ id: uid(), name, target: 0, bankId, initialAmount: amount });
      state.savings.push(item);
    } else if (kind === "investment") {
      const opened = state.openMonth || { year: state.viewYear, month: monthKey(now.getMonth()) };
      item = normalizeInvestment({
        id: uid(),
        name,
        type,
        bankId,
        initialAmount: isPositionType(type) ? 0 : amount,
        openYear: opened.year,
        openMonth: opened.month,
        taxPct: DEFAULT_TAX_PCT,
        holdings: []
      });
      state.investments.push(item);
    } else {
      item = normalizeDebt({ id: uid(), name, bankId, initialAmount: amount });
      state.debts.push(item);
    }
    if (potModal.open) potModal.close();
    if (done) done(item);
    Norte.toast(`Creamos «${name}» en ${bankName(bankId)}.`);
  }

  function addMonthRow(kind, potId) {
    const entry = currentMonth();
    const bankId = activeBankId();
    if (kind === "saving") {
      entry.contributions.push({ id: uid(), savingId: potId, amount: 0, kind: "aporte", concept: "", bankId, gmf: false });
      renderContribs();
    } else if (kind === "investment") {
      entry.investments.push({ id: uid(), investmentId: potId, amount: 0, concept: "", bankId, gmf: false });
      renderPlacements();
    } else {
      entry.debts.push({ id: uid(), debtId: potId, kind: "pago", amount: 0, concept: "", bankId, gmf: false });
      renderDebtRows();
    }
    renderMonthTotals();
  }

  function startMonthRow(kind) {
    if (monthRequiresBank()) {
      Norte.toast("Selecciona un banco antes de anotar el mes.", "error");
      return;
    }
    const source = kind === "saving" ? state.savings : kind === "investment" ? state.investments : state.debts;
    const bankId = activeBankId();
    const pots = source.filter((item) => (item.bankId || "") === bankId);
    if (!pots.length) {
      openPotModal(kind, bankId, (pot) => addMonthRow(kind, pot.id));
      return;
    }
    addMonthRow(kind, pots[0].id);
  }

  document.getElementById("pot-form").addEventListener("submit", (event) => {
    event.preventDefault();
    createPot();
  });
  document.getElementById("pot-cancel").addEventListener("click", () => {
    potPending.done = null;
    potModal.close();
  });
  potModal.addEventListener("close", () => {
    potPending.done = null;
  });

  function focusLastBank() {
    const inputs = document.querySelectorAll("#banks-list input");
    const last = inputs[inputs.length - 1];
    if (!last) return;
    last.focus();
    last.select();
    last.scrollIntoView({ block: "nearest" });
  }
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
      name: "Nueva inversión",
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
  document.getElementById("add-debt").addEventListener("click", () => {
    const debt = normalizeDebt({ name: "Nueva deuda", bankId: defaultBankId(), initialAmount: 0 });
    state.debts.push(debt);
    state.expandedDebtId = debt.id;
    render();
  });
  document.getElementById("toggle-debts-layout").addEventListener("click", () => {
    state.debtsLayout = state.debtsLayout === "compact" ? "full" : "compact";
    state.expandedDebtId = null;
    renderDebts();
  });
  document.getElementById("toggle-savings-layout").addEventListener("click", () => {
    state.savingsLayout = state.savingsLayout === "compact" ? "full" : "compact";
    state.expandedSavingId = null;
    renderSavings();
  });
  document.getElementById("toggle-flow-charts").addEventListener("click", () => {
    state.flowChartsOpen = !state.flowChartsOpen;
    syncFlowCharts(true);
  });
  document.getElementById("toggle-invest-layout").addEventListener("click", () => {
    state.investLayout = state.investLayout === "compact" ? "full" : "compact";
    renderInvestments();
  });
  document.getElementById("btn-month-invoice").addEventListener("click", () => {
    if (!state.openMonth) return;
    if (monthRequiresBank()) {
      Norte.toast("Selecciona un banco para ver la factura del mes.", "error");
      return;
    }
    openMonthInvoice(state.openMonth.year, state.openMonth.month);
  });
  document.getElementById("add-asset").addEventListener("click", () => {
    state.assets.push(normalizeAsset({ name: "Nuevo bien", kind: "vehiculo", value: 0 }));
    if (state.bankFilter !== "none" && state.bankFilter !== "all") state.bankFilter = "none";
    render();
    setTab("patrimonio");
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
  document.getElementById("add-debt-row").addEventListener("click", () => startMonthRow("debt"));
  document.getElementById("add-contrib").addEventListener("click", () => startMonthRow("saving"));
  document.getElementById("add-placement").addEventListener("click", () => startMonthRow("investment"));
  document.getElementById("btn-back").addEventListener("click", closeMonth);
  document.getElementById("month-prev").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("month-next").addEventListener("click", () => shiftMonth(1));
  const printBtn = document.getElementById("btn-print-invoice");
  if (printBtn) printBtn.addEventListener("click", () => window.print());
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
