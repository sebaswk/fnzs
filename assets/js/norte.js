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
    "pymes": "Pymes",
    "tx": "tx"
  };

  const FILE_NAMES = {
    "finanzas-personales": "personal",
    "inversiones": "interes-compuesto",
    "creditos": "creditos",
    "4x1000": "4x1000",
    "pymes": "pymes",
    "tx": "tx"
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
    if (document.body && document.body.hasAttribute("data-autosave")) return;
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

  /* ---------- Menú lateral ---------- */

  const SIDE_DOCK_MIN = 1360;
  const SIDE_COLLAPSE_KEY = "norte-side-collapsed";
  const SIDE_OPEN_KEY = "norte-side-open";

  const SIDE_SVG = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const SIDE_ICONS = {
    home: SIDE_SVG("<path d=\"M4 11 12 4l8 7\"/><path d=\"M6 10v9h12v-9\"/><path d=\"M10 19v-5h4v5\"/>"),
    flow: SIDE_SVG("<path d=\"M3 17l6-6 4 4 8-8\"/><path d=\"M14 7h7v7\"/>"),
    calc: SIDE_SVG("<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2.5\"/><path d=\"M8.5 7.5h7\"/><path d=\"M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01\" stroke-width=\"2.4\"/>"),
    pymes: SIDE_SVG("<path d=\"M4 20V9l8-5 8 5v11\"/><path d=\"M9 20v-6h6v6\"/>"),
    chevron: SIDE_SVG("<path d=\"m6 9 6 6 6-6\"/>"),
    hide: SIDE_SVG("<path d=\"m14 7-5 5 5 5\"/><path d=\"M19 5v14\"/>"),
    close: SIDE_SVG("<path d=\"M6 6l12 12M18 6 6 18\"/>"),
    pin: SIDE_SVG("<path d=\"m10 7 5 5-5 5\"/><path d=\"M5 5v14\"/>"),
    calendar: SIDE_SVG("<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"2.5\"/><path d=\"M3.5 10h17M8 3v4M16 3v4\"/>"),
    bank: SIDE_SVG("<path d=\"M3 10 12 4l9 6\"/><path d=\"M5.5 10.5v7M9.8 10.5v7M14.2 10.5v7M18.5 10.5v7\"/><path d=\"M3 20h18\"/>"),
    plus: SIDE_SVG("<path d=\"M12 5v14M5 12h14\"/>")
  };

  let sideKey = "";
  let sideApi = null;
  let sideContextConfig = null;

  function readStored(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* sin almacenamiento: el menú funciona igual, solo no recuerda */
    }
  }

  function sideContext() {
    const brand = document.querySelector(".topbar .brand");
    const href = brand ? brand.getAttribute("href") || "./index.html" : "./index.html";
    const root = href.replace(/index\.html.*$/, "") || "./";
    const match = /\/features\/([^/]+)\//.exec(window.location.pathname);
    const page = match ? match[1] : "home";
    return { root, page };
  }

  function sideItems(root) {
    const feature = (id) => `${root}features/${id}/index.html`;
    const flow = feature("finanzas-personales");
    return [
      { key: "home", label: "Inicio", icon: "home", href: `${root}index.html` },
      {
        key: "fp",
        label: "Flujo personal",
        icon: "flow",
        children: [
          { key: "fp-recopilado", label: "Resumen del año", href: `${flow}#resumen`, tab: "resumen" },
          { key: "fp-meses", label: "Movimientos", href: `${flow}#movimientos`, tab: "movimientos" },
          { key: "fp-patrimonio", label: "Patrimonio", href: `${flow}#patrimonio`, tab: "patrimonio" },
          { key: "fp-factura", label: "Factura", href: `${flow}#factura`, tab: "factura" },
          { key: "fp-tesoreria", label: "Tesorería", href: `${flow}#tesoreria`, tab: "tesoreria" }
        ]
      },
      {
        key: "calc",
        label: "Calculadoras",
        icon: "calc",
        children: [
          { key: "interes-compuesto", label: "Interés compuesto", href: feature("interes-compuesto") },
          { key: "creditos", label: "Créditos", href: feature("creditos") },
          { key: "4x1000", label: "Calculadora de 4x1000", href: feature("4x1000") }
        ]
      },
      { key: "pymes", label: "Pymes", icon: "pymes", href: feature("pymes"), feature: "pymes" }
    ];
  }

  function setSideActive(key) {
    sideKey = key || "";
    if (sideApi) sideApi.paintActive();
  }

  function closeSide() {
    if (sideApi) sideApi.close();
  }

  /* La página puede mostrar en el menú lo que se está viendo (año, banco…):
     { label, groups: [{ key, label, icon, value, compact, options: [{ id, label, active }], onSelect(id), add: { label, run } }] } */
  function setSideContext(config) {
    sideContextConfig = config || null;
    if (sideApi) sideApi.paintContext();
  }

  function setupNav() {
    const topbar = document.querySelector(".topbar");
    if (!topbar || !document.body) return;
    const toggle = topbar.querySelector(".nav-toggle");
    const brand = topbar.querySelector(".brand");
    const { root, page } = sideContext();
    if (!sideKey) sideKey = page === "finanzas-personales" ? "fp-recopilado" : page;

    // El botón del menú va a la izquierda, del mismo lado en que se abre el menú
    const inner = topbar.querySelector(".topbar-inner");
    if (toggle && inner) inner.insertBefore(toggle, inner.firstChild);

    const el = (tag, className, html) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (html != null) node.innerHTML = html;
      return node;
    };
    const esc = (text) => String(text == null ? "" : text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const side = el("aside", "side");
    side.id = "menu-lateral";
    side.setAttribute("aria-label", "Menú principal");
    const scrim = el("div", "side-scrim");
    scrim.hidden = true;

    const head = el("div", "side-head");
    if (brand) head.appendChild(brand.cloneNode(true));
    const hide = el("button", "side-btn side-hide");
    hide.type = "button";
    const pin = el("button", "side-btn side-pin", SIDE_ICONS.pin);
    pin.type = "button";
    pin.title = "Dejar el menú fijo a la izquierda";
    pin.setAttribute("aria-label", "Dejar el menú fijo a la izquierda");
    head.append(pin, hide);

    const nav = el("nav", "side-nav");
    nav.setAttribute("aria-label", "Secciones");
    const opened = new Set(readStored(SIDE_OPEN_KEY, ["fp"]));
    const groups = [];
    const saveOpen = () => writeStored(SIDE_OPEN_KEY, [...opened]);

    function paintGroup(entry, open) {
      entry.group.classList.toggle("is-open", open);
      entry.trigger.setAttribute("aria-expanded", String(open));
    }

    function buildGroup(item, key) {
      const group = el("div", "side-group");
      group.dataset.group = key;
      const badge = item.value != null ? `<span class="side-badge">${esc(item.value)}</span>` : "";
      const trigger = el("button", "side-link side-trigger", `<span class="side-ico">${SIDE_ICONS[item.icon]}</span><span class="side-text">${esc(item.label)}</span>${badge}<span class="side-chev">${SIDE_ICONS.chevron}</span>`);
      trigger.type = "button";
      const sub = el("div", `side-sub${item.compact ? " is-compact" : ""}`);
      sub.id = `side-sub-${key}`;
      trigger.setAttribute("aria-controls", sub.id);
      const entry = { group, trigger, key };
      paintGroup(entry, opened.has(key));
      trigger.addEventListener("click", () => {
        const open = !group.classList.contains("is-open");
        paintGroup(entry, open);
        if (open) opened.add(key);
        else opened.delete(key);
        saveOpen();
      });
      group.append(trigger, sub);
      return { entry, sub };
    }

    // Marca donde irá lo que la página quiera mostrar (año, banco…)
    const contextBox = el("div", "side-context");
    contextBox.hidden = true;

    sideItems(root).forEach((item) => {
      if (!item.children) {
        const link = el("a", "side-link", `<span class="side-ico">${SIDE_ICONS[item.icon]}</span><span class="side-text">${item.label}</span>`);
        link.setAttribute("href", item.href);
        link.dataset.sideKey = item.key;
        if (item.feature) link.dataset.feature = item.feature;
        nav.appendChild(link);
        return;
      }
      const { entry, sub } = buildGroup(item, item.key);
      item.children.forEach((child) => {
        const link = el("a", "side-sublink", `<span>${child.label}</span>`);
        link.setAttribute("href", child.href);
        link.dataset.sideKey = child.key;
        if (child.tab) link.dataset.sideTab = child.tab;
        sub.appendChild(link);
      });
      nav.appendChild(entry.group);
      groups.push(entry);
      if (item.key === "fp") nav.appendChild(contextBox);
    });

    side.append(head, nav);
    document.body.append(side, scrim);

    const wide = window.matchMedia(`(min-width: ${SIDE_DOCK_MIN}px)`);
    const isDocked = () => wide.matches && !document.body.classList.contains("side-collapsed");

    function paintActive() {
      side.querySelectorAll("[data-side-key]").forEach((link) => {
        const active = link.dataset.sideKey === sideKey;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      groups.forEach((entry) => {
        const holdsActive = Boolean(entry.group.querySelector(".side-sublink.is-active"));
        entry.group.classList.toggle("has-active", holdsActive);
        if (holdsActive && !entry.group.classList.contains("is-open")) paintGroup(entry, true);
      });
    }

    function paintContext() {
      contextBox.replaceChildren();
      const config = sideContextConfig;
      contextBox.hidden = !config || !config.groups || !config.groups.length;
      if (contextBox.hidden) return;
      contextBox.appendChild(el("p", "side-label", esc(config.label || "Estás viendo")));
      config.groups.forEach((item) => {
        const { entry, sub } = buildGroup(item, item.key);
        (item.options || []).forEach((option) => {
          const button = el("button", `side-sublink${option.active ? " is-active" : ""}`, `<span>${esc(option.label)}</span>`);
          button.type = "button";
          if (option.active) button.setAttribute("aria-current", "true");
          button.addEventListener("click", () => {
            if (item.onSelect) item.onSelect(option.id);
            if (!isDocked()) setOpen(false);
          });
          sub.appendChild(button);
        });
        if (item.add) {
          const add = el("button", "side-sublink side-add", `${SIDE_ICONS.plus}<span>${esc(item.add.label)}</span>`);
          add.type = "button";
          add.addEventListener("click", () => {
            item.add.run();
            if (!isDocked()) setOpen(false);
          });
          sub.appendChild(add);
        }
        contextBox.appendChild(entry.group);
      });
    }

    function paintMode() {
      const docked = isDocked();
      const label = docked ? "Ocultar el menú" : "Cerrar el menú";
      hide.innerHTML = docked ? SIDE_ICONS.hide : SIDE_ICONS.close;
      hide.title = label;
      hide.setAttribute("aria-label", label);
      if (toggle) toggle.setAttribute("aria-controls", side.id);
      if (docked) setOpen(false);
    }

    let isOpen = false;
    function setOpen(open) {
      isOpen = open;
      side.classList.toggle("is-open", open);
      scrim.hidden = !open;
      document.body.classList.toggle("side-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      }
    }

    function setCollapsed(collapsed) {
      document.body.classList.toggle("side-collapsed", collapsed);
      writeStored(SIDE_COLLAPSE_KEY, collapsed);
      paintMode();
    }

    if (readStored(SIDE_COLLAPSE_KEY, false) === true) document.body.classList.add("side-collapsed");

    if (toggle) {
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        setOpen(!isOpen);
        if (isOpen) {
          const target = side.querySelector(".is-active") || side.querySelector("a, button");
          if (target) target.focus({ preventScroll: true });
        }
      });
    }
    scrim.addEventListener("click", () => setOpen(false));
    hide.addEventListener("click", () => {
      if (isDocked()) setCollapsed(true);
      else setOpen(false);
    });
    pin.addEventListener("click", () => setCollapsed(false));
    side.addEventListener("click", (event) => {
      const link = event.target.closest && event.target.closest("a");
      if (link && !isDocked()) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen) {
        setOpen(false);
        if (toggle) toggle.focus();
      }
    });
    wide.addEventListener("change", paintMode);

    sideApi = { paintActive, paintContext, close: () => setOpen(false) };
    paintMode();
    paintContext();
    paintActive();
  }

  // Enlaces de la barra superior: "Calculadoras" se despliega al tocar o al pasar el mouse
  function setupTopNav() {
    const groups = [...document.querySelectorAll(".topbar .nav-group")];
    if (!groups.length) return;
    const close = (except) => groups.forEach((group) => {
      if (group === except) return;
      group.classList.remove("is-open");
      const trigger = group.querySelector(".nav-trigger");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
    groups.forEach((group) => {
      const trigger = group.querySelector(".nav-trigger");
      const items = [...group.querySelectorAll(".nav-item")];
      if (!trigger) return;
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = !group.classList.contains("is-open");
        close(group);
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
          items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
        }
      });
      group.addEventListener("focusout", (event) => {
        if (!group.contains(event.relatedTarget)) {
          group.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        }
      });
      group.addEventListener("mouseleave", () => {
        if (!group.contains(document.activeElement)) {
          group.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        }
      });
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest || !event.target.closest(".nav-group")) close();
    });
  }

  onReady(() => {
    setupNav();
    setupTopNav();
    applyFeatureFlags();
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
    setSideActive,
    setSideContext,
    closeSide,
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
