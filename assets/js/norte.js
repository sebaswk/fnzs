(() => {
  const APP = "norte";
  const VERSION = 1;

  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.setAttribute("role", "status");
  function mountToast() {
    if (document.body && !toastEl.isConnected) document.body.appendChild(toastEl);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountToast);
  } else {
    mountToast();
  }

  let toastTimer;

  function toast(message, type = "ok") {
    toastEl.textContent = message;
    toastEl.classList.toggle("is-error", type === "error");
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 3200);
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
    const day = new Date().toISOString().slice(0, 10);
    return `norte-${feature}-${day}.json`;
  }

  function downloadSnapshot(feature, data) {
    const payload = {
      app: APP,
      version: VERSION,
      feature,
      savedAt: new Date().toISOString(),
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
      throw new Error(`Este archivo es de «${obj.feature}», no de esta sección.`);
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

    ["dragenter", "dragover"].forEach((name) => {
      target.addEventListener(name, (event) => {
        stop(event);
        target.classList.add("drop-active");
      });
    });

    ["dragleave", "drop"].forEach((name) => {
      target.addEventListener(name, (event) => {
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

    const title = document.createElement("h2");
    title.id = "disclaimer-title";
    title.textContent = "Tus datos no se guardan solos";

    const copy = document.createElement("p");
    copy.textContent = "Esta web no tiene cuenta ni servidor. Para no perder lo que calcules o anotes, usa «Guardar datos»: se descarga un archivo liviano. Cuando vuelvas, pulsa «Cargar datos» y elige ese archivo.";

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

    card.append(title, copy, button);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    button.focus();
  }

  function mountDisclaimer() {
    showSaveDisclaimer();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountDisclaimer);
  } else {
    mountDisclaimer();
  }

  window.Norte = {
    APP,
    VERSION,
    toast,
    formatMoney,
    formatCompact,
    formatPct,
    downloadSnapshot,
    parseSnapshot,
    bindFileInput,
    enableDrop
  };
})();
