(() => {
  const APP = "norte";
  const VERSION = 1;

  // Cambia a true para volver a mostrar una feature en el menú y en el inicio.
  const FEATURES = {
    pymes: false
  };

  const FEATURE_LABELS = {
    "finanzas-personales": "Flujo personal",
    "inversiones": "Interés compuesto",
    "creditos": "Créditos",
    "4x1000": "Calculadora de 4x1000",
    "pymes": "Pymes"
  };

  const FILE_NAMES = {
    "finanzas-personales": "personal",
    "inversiones": "interes-compuesto",
    "creditos": "creditos",
    "4x1000": "4x1000",
    "pymes": "pymes"
  };

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.setAttribute("role", "status");
  onReady(() => {
    if (document.body && !toastEl.isConnected) document.body.appendChild(toastEl);
  });

  let toastTimer;

  function toast(message, type = "ok") {
    toastEl.textContent = message;
    toastEl.classList.toggle("is-error", type === "error");
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 3400);
  }

  function formatMoney(value, currency) {
    const locale = currency === "COP" ? "es-CO" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "COP" ? 0 : 2
    }).format(Number.isFinite(value) ? value : 0);
  }

  function formatCompact(value, currency) {
    const locale = currency === "COP" ? "es-CO" : "en-US";
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1
    }).format(Number.isFinite(value) ? value : 0);
  }

  function formatPct(value, digits = 1) {
    return `${Number(value || 0).toLocaleString("es-CO", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    })}%`;
  }

  function stampName(feature) {
    return `${FILE_NAMES[feature] || feature}.json`;
  }

  function downloadSnapshot(feature, data) {
    const now = new Date();
    const payload = {
      app: APP,
      version: VERSION,
      feature,
      savedAt: now.toISOString(),
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = stampName(feature);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Datos guardados. Conserva ese archivo para recuperarlos después.");
  }

  function parseSnapshot(text, expectedFeature) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      throw new Error("No pude leer ese archivo. Usa el que descargaste con Guardar datos.");
    }
    if (obj.app !== APP) {
      throw new Error("Este archivo no pertenece a Norte.");
    }
    if (!obj.feature || typeof obj.data === "undefined") {
      throw new Error("El archivo está incompleto.");
    }
    if (expectedFeature && obj.feature !== expectedFeature) {
      const label = FEATURE_LABELS[obj.feature] || obj.feature;
      throw new Error(`Este archivo es de «${label}», no de esta sección.`);
    }
    return obj;
  }

  function readFile(file) {
    return file.text();
  }

  function bindFileInput(input, expectedFeature, onData) {
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      try {
        const snapshot = parseSnapshot(await readFile(file), expectedFeature);
        onData(snapshot.data, snapshot);
        toast("Datos cargados. Ya puedes seguir editando.");
      } catch (err) {
        toast(err.message, "error");
      }
    });
  }

  function enableDrop(target, expectedFeature, onData) {
    const stop = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const hasFiles = (event) => Array.from((event.dataTransfer && event.dataTransfer.types) || []).includes("Files");

    ["dragenter", "dragover"].forEach((name) => {
      target.addEventListener(name, (event) => {
        if (!hasFiles(event)) return;
        stop(event);
        target.classList.add("drop-active");
      });
    });

    ["dragleave", "drop"].forEach((name) => {
      target.addEventListener(name, (event) => {
        if (!hasFiles(event)) return;
        stop(event);
        if (name === "dragleave" && target.contains(event.relatedTarget)) return;
        target.classList.remove("drop-active");
      });
    });

    target.addEventListener("drop", async (event) => {
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      try {
        const snapshot = parseSnapshot(await readFile(file), expectedFeature);
        onData(snapshot.data, snapshot);
        toast("Datos cargados. Ya puedes seguir editando.");
      } catch (err) {
        toast(err.message, "error");
      }
    });
  }

  function showSaveDisclaimer() {
    if (!document.getElementById("btn-guardar")) return;
    try {
      if (sessionStorage.getItem("norte-disclaimer") === "1") return;
    } catch {
      /* modo privado */
    }
    if (document.querySelector(".disclaimer")) return;

    const overlay = document.createElement("div");
    overlay.className = "disclaimer";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "disclaimer-title");

    const card = document.createElement("div");
    card.className = "disclaimer-card";

    const icon = document.createElement("div");
    icon.className = "disclaimer-icon";
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';

    const title = document.createElement("h2");
    title.id = "disclaimer-title";
    title.textContent = "Tus datos no se guardan solos";

    const copy = document.createElement("p");
    copy.textContent = "Para no perder lo que anotes, usa «Guardar datos»: se descarga un archivo liviano. Cuando vuelvas, pulsa «Cargar datos» y elige ese archivo.";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary";
    button.textContent = "Entendido";
    button.addEventListener("click", () => {
      try {
        sessionStorage.setItem("norte-disclaimer", "1");
      } catch {
        /* ignore */
      }
      overlay.remove();
    });

    card.append(icon, title, copy, button);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    button.focus();
  }

  function applyFeatureFlags() {
    document.querySelectorAll("[data-feature]").forEach((node) => {
      node.hidden = !FEATURES[node.dataset.feature];
    });
  }

  function setupNav() {
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    const toggle = topbar.querySelector(".nav-toggle");
    const groups = [...topbar.querySelectorAll(".nav-group")];
    const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

    function closeGroups(except) {
      groups.forEach((group) => {
        if (group === except) return;
        group.classList.remove("is-open");
        const trigger = group.querySelector(".nav-trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }

    function setMenu(open) {
      topbar.classList.toggle("is-menu-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      }
      if (open) {
        groups.forEach((group) => {
          group.classList.add("is-open");
          const trigger = group.querySelector(".nav-trigger");
          if (trigger) trigger.setAttribute("aria-expanded", "true");
        });
      }
    }

    groups.forEach((group) => {
      const trigger = group.querySelector(".nav-trigger");
      const items = [...group.querySelectorAll(".nav-item")];
      if (!trigger) return;
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = !group.classList.contains("is-open");
        closeGroups(group);
        group.classList.toggle("is-open", open);
        trigger.setAttribute("aria-expanded", String(open));
      });
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" && items.length) {
          event.preventDefault();
          group.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
          items[0].focus();
        }
      });
      group.addEventListener("keydown", (event) => {
        const index = items.indexOf(document.activeElement);
        if (event.key === "Escape") {
          group.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
          trigger.focus();
        } else if (index >= 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();
          const next = items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
          next.focus();
        }
      });
      group.addEventListener("focusout", (event) => {
        if (isMobile()) return;
        if (!group.contains(event.relatedTarget)) {
          group.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        }
      });
      group.addEventListener("mouseleave", () => {
        if (isMobile()) return;
        if (!group.contains(document.activeElement)) {
          group.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        }
      });
    });

    if (toggle) {
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        setMenu(!topbar.classList.contains("is-menu-open"));
      });
    }

    document.addEventListener("click", (event) => {
      if (!topbar.contains(event.target)) {
        if (!isMobile()) closeGroups();
        setMenu(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && topbar.classList.contains("is-menu-open")) {
        setMenu(false);
        if (toggle) toggle.focus();
      }
    });

    window.matchMedia("(max-width: 900px)").addEventListener("change", (query) => {
      setMenu(false);
      if (!query.matches) closeGroups();
    });
  }

  onReady(() => {
    applyFeatureFlags();
    setupNav();
    showSaveDisclaimer();
  });

  function closePicks() {
    document.querySelectorAll(".pick.is-open").forEach((node) => {
      node.classList.remove("is-open");
      const menu = node.querySelector(".pick-menu");
      if (menu) menu.hidden = true;
    });
  }

  document.addEventListener("click", closePicks);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePicks();
  });

  function menuSelect(value, options, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "pick";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pick-btn";
    button.setAttribute("aria-haspopup", "listbox");
    const menu = document.createElement("div");
    menu.className = "pick-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    let current = value;
    let items = Array.isArray(options) ? options.slice() : [];

    function labelOf(val) {
      const found = items.find((opt) => !opt.action && String(opt.value) === String(val));
      return found ? found.label : "Elegir";
    }

    function paint() {
      wrap.value = current == null ? "" : String(current);
      button.textContent = labelOf(current);
      button.title = labelOf(current);
      menu.replaceChildren();
      items.forEach((opt) => {
        const item = document.createElement("button");
        item.type = "button";
        if (opt.action) {
          if (menu.children.length) menu.appendChild(Object.assign(document.createElement("div"), { className: "pick-sep" }));
          item.className = "pick-item is-action";
          item.textContent = opt.label;
          item.addEventListener("click", (event) => {
            event.stopPropagation();
            closePicks();
            opt.action();
          });
          menu.appendChild(item);
          return;
        }
        item.setAttribute("role", "option");
        item.className = `pick-item${String(opt.value) === String(current) ? " is-active" : ""}`;
        item.textContent = opt.label;
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          current = opt.value;
          closePicks();
          paint();
          button.focus();
          if (onChange) onChange(current);
          wrap.dispatchEvent(new Event("change", { bubbles: true }));
        });
        menu.appendChild(item);
      });
    }

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closePicks();
      if (willOpen) {
        menu.hidden = false;
        wrap.classList.add("is-open");
        const active = menu.querySelector(".is-active");
        if (active) active.scrollIntoView({ block: "nearest" });
      }
    });

    wrap.setOptions = (next, selected) => {
      items = next;
      if (selected != null) current = selected;
      paint();
    };

    wrap.append(button, menu);
    paint();
    return wrap;
  }

  function scrollTop() {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  }

  window.Norte = {
    scrollTop,
    APP,
    VERSION,
    FEATURES,
    toast,
    formatMoney,
    formatCompact,
    formatPct,
    downloadSnapshot,
    parseSnapshot,
    bindFileInput,
    enableDrop,
    menuSelect
  };
})();
