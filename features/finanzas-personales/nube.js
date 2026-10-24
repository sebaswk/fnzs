(() => {
  "use strict";

  // Inicio de sesión OPCIONAL para Flujo personal.
  // Sin sesión la página funciona igual que siempre (nada se guarda solo). Con sesión, los datos se
  // guardan en la cuenta de la persona y se recuperan en cualquier dispositivo.
  const api = window.FinanzasApi;
  const Cloud = window.NorteCloud;
  const btn = document.getElementById("btn-login");
  const pill = document.getElementById("sync-pill");
  const pillText = document.getElementById("sync-text");
  if (!api || !Cloud || !btn || !pill) return;

  const CACHE_KEY = "norte-fp-cache";
  const CHECK_EVERY = 1000;
  const cloud = Cloud.create({ table: "personal_data", sessionKey: "norte-fp-session", metaKey: "norte-fp-meta" });

  const STATUS_TEXT = {
    saved: "Guardado en tu cuenta",
    pending: "Cambios sin guardar…",
    saving: "Sincronizando…",
    offline: "Sin conexión · se guardará al volver",
    error: "No se pudo guardar",
    auth: "Sesión vencida"
  };

  // ---------- ¿Hay algo escrito? ----------

  const LISTS = ["banks", "accounts", "assets", "debts", "cards", "savings", "investments"];

  function monthHasContent(month) {
    if (!month || typeof month !== "object") return false;
    return Object.keys(month).some((key) => {
      const value = month[key];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "string") return value.trim() !== "";
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return false;
    });
  }

  function hasContent(raw) {
    const d = raw && typeof raw === "object" ? raw : null;
    if (!d) return false;
    if (d.profile && String(d.profile.name || "").trim()) return true;
    if (Number(d.usdRate) > 0) return true;
    if (LISTS.some((key) => Array.isArray(d[key]) && d[key].length > 0)) return true;
    const years = d.years && typeof d.years === "object" ? d.years : {};
    if (Object.keys(years).some((y) => {
      const months = (years[y] && years[y].months) || {};
      return Object.keys(months).some((m) => monthHasContent(months[m]));
    })) return true;
    const sheets = d.treasury && Array.isArray(d.treasury.sheets) ? d.treasury.sheets : [];
    return sheets.some((sheet) => sheet && sheet.cells && Object.keys(sheet.cells).length > 0);
  }

  // ---------- Copia en este navegador (solo con sesión iniciada) ----------

  function writeCache(snapshot) {
    const user = cloud.user();
    if (!user) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ uid: user.id, data: snapshot }));
    } catch (error) {
      // Sin almacenamiento: sigue funcionando con la nube.
    }
  }

  function removeCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      // nada
    }
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  // ---------- Detección de cambios ----------

  // La navegación (año y banco que se están viendo) no cuenta como un cambio de datos.
  function fingerprint(snapshot) {
    const copy = Object.assign({}, snapshot);
    delete copy.viewYear;
    delete copy.bankFilter;
    return JSON.stringify(copy);
  }

  let last = null;

  function remember() {
    const snapshot = api.snapshot();
    last = fingerprint(snapshot);
    writeCache(snapshot);
  }

  function check() {
    if (!cloud.hasSession()) return;
    const snapshot = api.snapshot();
    const now = fingerprint(snapshot);
    if (now === last) return;
    last = now;
    writeCache(snapshot);
    cloud.changed();
  }

  const adapter = {
    getData: () => api.snapshot(),
    hasContent,
    apply(raw) {
      api.applySnapshot(raw);
      remember();
    },
    clearLocal: removeCache,
    onAuthLost() {
      Norte.toast("La sesión venció. Inicia sesión de nuevo.", "error");
      paint();
    }
  };

  // ---------- Botón y estado ----------

  let lastError = "";

  function paint() {
    const on = cloud.hasSession();
    btn.querySelector(".login-out").hidden = on;
    btn.querySelector(".login-in").hidden = !on;
    btn.title = on ? "Cerrar sesión" : "Iniciar sesión para guardar tus datos en tu cuenta";
    btn.setAttribute("aria-label", on ? "Cerrar sesión" : "Iniciar sesión");
    btn.classList.toggle("is-signed", on);
    pill.hidden = !on;
    if (on) document.body.setAttribute("data-autosave", "");
  }

  cloud.onStatus((state, detail) => {
    pill.className = `sync-pill is-${state}`;
    const text = STATUS_TEXT[state] || "";
    pillText.textContent = text;
    pill.title = state === "error" && detail ? `${text}: ${detail}` : text;
    if (state === "error" && detail && detail !== lastError) {
      lastError = detail;
      Norte.toast(`No se pudo guardar en tu cuenta: ${detail}`, "error");
    }
    if (state === "saved") lastError = "";
  });

  async function startSync() {
    const result = await cloud.start(adapter);
    if (result === "auth") {
      Norte.toast("No se pudieron cargar tus datos. Inténtalo de nuevo.", "error");
      paint();
      return;
    }
    remember();
    paint();
  }

  // ---------- Ventana de inicio de sesión ----------

  function openLogin() {
    if (document.querySelector(".auth-overlay")) return;
    const overlay = document.createElement("div");
    overlay.className = "disclaimer auth-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "auth-title");

    const card = document.createElement("div");
    card.className = "disclaimer-card";

    const title = document.createElement("h2");
    title.id = "auth-title";
    title.textContent = "Iniciar sesión";
    const lede = document.createElement("p");
    lede.textContent = "Guarda tus datos en tu cuenta y recupéralos desde cualquier dispositivo. Si no tienes cuenta, puedes seguir usando Norte sin iniciar sesión.";

    const form = document.createElement("form");
    form.className = "auth-form";
    form.noValidate = true;

    const makeField = (id, label, type, autocomplete) => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      const lab = document.createElement("label");
      lab.setAttribute("for", id);
      lab.textContent = label;
      const input = document.createElement("input");
      input.className = "input";
      input.id = id;
      input.name = id;
      input.type = type;
      input.autocomplete = autocomplete;
      input.required = true;
      if (type === "email") {
        input.setAttribute("inputmode", "email");
        input.setAttribute("autocapitalize", "none");
        input.spellcheck = false;
      }
      wrap.append(lab, input);
      return { wrap, input };
    };
    const email = makeField("auth-email", "Correo", "email", "username");
    const password = makeField("auth-password", "Contraseña", "password", "current-password");

    const msg = document.createElement("p");
    msg.className = "auth-msg";
    msg.setAttribute("role", "status");

    const submit = document.createElement("button");
    submit.className = "btn btn-primary";
    submit.type = "submit";
    submit.textContent = "Entrar";
    const cancel = document.createElement("button");
    cancel.className = "btn btn-ghost";
    cancel.type = "button";
    cancel.textContent = "Cancelar";

    const note = document.createElement("p");
    note.className = "auth-note";
    note.textContent = "Mientras la sesión esté abierta, se guarda también una copia en este navegador. Se borra al salir.";

    form.append(email.wrap, password.wrap, msg, submit, cancel);
    card.append(title, lede, form, note);
    overlay.append(card);

    const close = () => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      btn.focus();
    };
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    cancel.addEventListener("click", close);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const mail = email.input.value.trim();
      const pass = password.input.value;
      if (!mail || !pass) {
        msg.textContent = "Escribe tu correo y tu contraseña.";
        return;
      }
      submit.disabled = true;
      msg.textContent = "Entrando…";
      const result = await cloud.signIn(mail, pass);
      if (!result.ok) {
        submit.disabled = false;
        password.input.value = "";
        msg.textContent = result.message;
        password.input.focus();
        return;
      }
      password.input.value = "";
      close();
      paint();
      Norte.toast("Sesión iniciada. Cargando tus datos…");
      await startSync();
    });

    document.body.append(overlay);
    email.input.focus();
  }

  async function logout() {
    if (cloud.isDirty()) {
      check();
      await cloud.flush();
      if (cloud.isDirty() && !window.confirm("Hay cambios que aún no se guardaron en tu cuenta y se perderán al salir. ¿Salir de todos modos?")) return;
    }
    await cloud.signOut();
    removeCache();
    // Se recarga para que no quede ningún dato en pantalla.
    window.location.reload();
  }

  btn.addEventListener("click", () => {
    if (cloud.hasSession()) logout();
    else openLogin();
  });

  // Cargar un archivo o el ejemplo reemplaza todo: con sesión, pide confirmación.
  api.setReplaceGuard(() => {
    if (!cloud.hasSession() || !hasContent(api.snapshot())) return true;
    return window.confirm("Tienes la sesión iniciada: esto reemplazará los datos guardados en tu cuenta. ¿Continuar?");
  });

  // ---------- Sincronización continua ----------

  setInterval(() => {
    if (!document.hidden) check();
  }, CHECK_EVERY);

  document.addEventListener("visibilitychange", () => {
    if (!cloud.hasSession()) return;
    if (document.hidden) {
      check();
      cloud.flush();
      return;
    }
    cloud.pullIfChanged().then((changed) => {
      if (changed) Norte.toast("Datos actualizados desde otro dispositivo.");
    });
  });

  window.addEventListener("pagehide", () => {
    if (!cloud.hasSession()) return;
    check();
    cloud.flush();
  });

  // ---------- Arranque ----------

  paint();
  if (cloud.hasSession()) {
    // Con sesión previa: se muestra primero la copia de este navegador y luego se sincroniza.
    const cache = readCache();
    const user = cloud.user();
    if (cache && user && cache.uid === user.id && cache.data) api.applySnapshot(cache.data);
    startSync();
  }
})();
