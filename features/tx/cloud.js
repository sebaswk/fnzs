(() => {
  "use strict";

  // Cliente mínimo de Supabase para tx: login con correo y contraseña + una fila por usuario.
  // La URL y la clave "publishable" son públicas por diseño. Lo que protege los datos es el login
  // y las reglas por usuario (RLS) de la tabla; aquí NUNCA va la clave secret / service_role.
  const API_URL = "https://jxhtypisigvwwkakdzlw.supabase.co";
  const API_KEY = "sb_publishable_2m5GQ55g88k0qgnf1v6kVg_K6PkxJXw";
  const TABLE = "tx_data";
  const SESSION_KEY = "norte-tx-session";
  const META_KEY = "norte-tx-meta";
  const PUSH_DELAY = 1500;
  const RETRY_EVERY = 30000;

  class NetError extends Error {}
  class AuthError extends Error {}
  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Sin almacenamiento: todo sigue funcionando en memoria.
    }
  }

  let session = readJSON(SESSION_KEY);
  let meta = readJSON(META_KEY) || { uid: null, updatedAt: null, dirty: false };
  let adapter = null;
  let statusCb = () => {};
  let refreshing = null;
  let pushing = false;
  let timer = null;
  let rev = 0;
  let retryTimer = null;

  const persistMeta = () => writeJSON(META_KEY, meta);
  const setStatus = (state, detail) => statusCb(state, detail || "");

  function clearSession() {
    session = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // nada
    }
  }

  function storeSession(body) {
    const expires = body.expires_at || Math.floor(Date.now() / 1000) + (Number(body.expires_in) || 3600);
    session = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: expires,
      user: { id: body.user && body.user.id, email: body.user && body.user.email }
    };
    writeJSON(SESSION_KEY, session);
  }

  // ---------- HTTP ----------

  async function raw(path, opts) {
    const o = opts || {};
    const headers = Object.assign({ apikey: API_KEY, "Content-Type": "application/json" }, o.headers || {});
    if (o.token) headers.Authorization = `Bearer ${o.token}`;
    let res;
    try {
      res = await fetch(API_URL + path, {
        method: o.method || "GET",
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        keepalive: !!o.keepalive
      });
    } catch (error) {
      throw new NetError("Sin conexión");
    }
    let body = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch (error) {
        body = null;
      }
    }
    if (!res.ok) {
      const message = (body && (body.msg || body.error_description || body.message || body.error)) || `Error ${res.status}`;
      throw new ApiError(message, res.status, body && (body.code || body.error_code));
    }
    return body;
  }

  async function refresh() {
    if (!session) throw new AuthError("Sin sesión");
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const body = await raw("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          body: { refresh_token: session.refresh_token }
        });
        storeSession(body);
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          clearSession();
          throw new AuthError("La sesión venció. Inicia sesión de nuevo.");
        }
        throw error;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function ensureFresh() {
    if (!session) throw new AuthError("Sin sesión");
    if (session.expires_at * 1000 - Date.now() < 60000) await refresh();
  }

  async function authed(path, opts) {
    await ensureFresh();
    try {
      return await raw(path, Object.assign({}, opts, { token: session.access_token }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await refresh();
        return raw(path, Object.assign({}, opts, { token: session.access_token }));
      }
      throw error;
    }
  }

  // ---------- Sesión ----------

  function friendly(error) {
    if (error instanceof NetError) return "No pude conectar. Revisa tu internet e inténtalo de nuevo.";
    if (error instanceof ApiError) {
      if (error.status === 400 || error.status === 401 || error.status === 422) return "Correo o contraseña incorrectos.";
      if (error.status === 429) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
      return "No se pudo iniciar sesión. Inténtalo de nuevo.";
    }
    return "No se pudo iniciar sesión.";
  }

  async function signIn(email, password) {
    try {
      const body = await raw("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email: String(email).trim(), password: String(password) }
      });
      storeSession(body);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: friendly(error) };
    }
  }

  async function signOut() {
    const token = session && session.access_token;
    clearTimeout(timer);
    clearInterval(retryTimer);
    retryTimer = null;
    clearSession();
    meta = { uid: null, updatedAt: null, dirty: false };
    persistMeta();
    try {
      localStorage.removeItem(META_KEY);
    } catch (error) {
      // nada
    }
    if (token) {
      try {
        await raw("/auth/v1/logout?scope=local", { method: "POST", token });
      } catch (error) {
        // El token local ya se descartó; el servidor lo vence solo.
      }
    }
  }

  // ---------- Datos ----------

  async function fetchRow() {
    const uid = session.user.id;
    const rows = await authed(`/rest/v1/${TABLE}?select=data,updated_at&user_id=eq.${encodeURIComponent(uid)}`);
    return rows && rows.length ? rows[0] : null;
  }

  const snapshotOf = () => JSON.parse(JSON.stringify(adapter.getData()));

  async function insertRow(payload) {
    const rows = await authed(`/rest/v1/${TABLE}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: { user_id: session.user.id, data: payload, updated_at: new Date().toISOString() }
    });
    return rows && rows[0];
  }

  async function patchRow(payload, expectedStamp) {
    const uid = encodeURIComponent(session.user.id);
    const rows = await authed(
      `/rest/v1/${TABLE}?user_id=eq.${uid}&updated_at=eq.${encodeURIComponent(expectedStamp)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: { data: payload, updated_at: new Date().toISOString() }
      }
    );
    return rows && rows[0];
  }

  function markSynced(row, dirty) {
    meta = { uid: session.user.id, updatedAt: row ? row.updated_at : meta.updatedAt, dirty: !!dirty };
    persistMeta();
  }

  function startRetry() {
    if (retryTimer) return;
    retryTimer = setInterval(() => {
      if (session && meta.dirty && !pushing) push();
    }, RETRY_EVERY);
  }

  function failStatus(error) {
    if (error instanceof AuthError) {
      setStatus("auth");
      if (adapter && adapter.onAuthLost) adapter.onAuthLost();
    } else if (error instanceof NetError) {
      setStatus("offline");
    } else {
      setStatus("error", error && error.message);
    }
  }

  async function resolveConflict() {
    const row = await fetchRow();
    if (!row) {
      meta.updatedAt = null;
      persistMeta();
      return push();
    }
    const useCloud = window.confirm(
      "Se guardaron cambios desde otro dispositivo y también hay cambios aquí.\n\n" +
      "Aceptar: cargar los de la nube (se descartan los de este dispositivo).\n" +
      "Cancelar: reemplazar la nube con los de este dispositivo."
    );
    if (useCloud) {
      adapter.apply(row.data);
      markSynced(row, false);
      setStatus("saved");
      return undefined;
    }
    meta.updatedAt = row.updated_at;
    persistMeta();
    return push();
  }

  async function push() {
    if (!session || !adapter) return;
    if (pushing) return;
    clearTimeout(timer);
    pushing = true;
    setStatus("saving");
    const revAtStart = rev;
    try {
      const payload = snapshotOf();
      let row;
      if (!meta.updatedAt) {
        try {
          row = await insertRow(payload);
        } catch (error) {
          if (error instanceof ApiError && (error.status === 409 || error.code === "23505")) {
            pushing = false;
            await resolveConflict();
            return;
          }
          throw error;
        }
      } else {
        row = await patchRow(payload, meta.updatedAt);
        if (!row) {
          pushing = false;
          await resolveConflict();
          return;
        }
      }
      const stillDirty = rev !== revAtStart;
      markSynced(row, stillDirty);
      if (stillDirty) schedule();
      else setStatus("saved");
    } catch (error) {
      failStatus(error);
      startRetry();
    } finally {
      pushing = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(push, PUSH_DELAY);
    setStatus("pending");
  }

  // Se llama cada vez que cambia algo en la app.
  function changed() {
    if (!session) return;
    rev += 1;
    meta.uid = session.user.id;
    meta.dirty = true;
    persistMeta();
    schedule();
    startRetry();
  }

  // Sincronización al abrir o al iniciar sesión.
  async function sync() {
    setStatus("saving");
    const uid = session.user.id;
    if (meta.uid && meta.uid !== uid) {
      // Datos locales de otra cuenta: se descartan.
      meta = { uid: null, updatedAt: null, dirty: false };
      adapter.clearLocal();
    }
    let row;
    try {
      row = await fetchRow();
    } catch (error) {
      if (error instanceof AuthError) {
        setStatus("auth");
        return "auth";
      }
      if (error instanceof NetError) {
        if (meta.uid === uid || meta.uid === null) {
          setStatus("offline");
          startRetry();
          return "ok";
        }
        return "auth";
      }
      setStatus("error", error.message);
      return "ok";
    }

    try {
      if (!row) {
        if (adapter.hasContent(adapter.getData())) {
          const created = await insertRow(snapshotOf());
          markSynced(created, false);
        } else {
          meta = { uid, updatedAt: null, dirty: false };
          persistMeta();
        }
        setStatus("saved");
        return "ok";
      }

      const sameAsLast = meta.uid === uid && meta.updatedAt === row.updated_at;
      if (sameAsLast) {
        if (meta.dirty) await push();
        else setStatus("saved");
        return "ok";
      }

      const localChanged = meta.uid === uid ? meta.dirty : adapter.hasContent(adapter.getData());
      if (!localChanged || !adapter.hasContent(adapter.getData())) {
        adapter.apply(row.data);
        markSynced(row, false);
        setStatus("saved");
        return "ok";
      }
      if (!adapter.hasContent(row.data)) {
        meta = { uid, updatedAt: row.updated_at, dirty: true };
        persistMeta();
        await push();
        return "ok";
      }
      const useCloud = window.confirm(
        "Hay datos en este dispositivo y otros distintos en la nube.\n\n" +
        "Aceptar: usar los de la nube (se descartan los de este dispositivo).\n" +
        "Cancelar: reemplazar la nube con los de este dispositivo."
      );
      if (useCloud) {
        adapter.apply(row.data);
        markSynced(row, false);
        setStatus("saved");
      } else {
        meta = { uid, updatedAt: row.updated_at, dirty: true };
        persistMeta();
        await push();
      }
      return "ok";
    } catch (error) {
      failStatus(error);
      startRetry();
      return error instanceof AuthError ? "auth" : "ok";
    }
  }

  // Trae cambios hechos desde otro dispositivo cuando no hay nada pendiente aquí.
  async function pullIfChanged() {
    if (!session || !adapter || pushing || meta.dirty) return false;
    try {
      const row = await fetchRow();
      if (row && row.updated_at !== meta.updatedAt && !meta.dirty) {
        adapter.apply(row.data);
        markSynced(row, false);
        setStatus("saved");
        return true;
      }
    } catch (error) {
      if (error instanceof AuthError) failStatus(error);
      else if (error instanceof NetError) setStatus("offline");
    }
    return false;
  }

  async function start(ad) {
    adapter = ad;
    if (!session) return "auth";
    try {
      await ensureFresh();
    } catch (error) {
      if (error instanceof AuthError) return "auth";
      // Sin conexión: se usa la copia de este dispositivo si es de esta cuenta.
      if (meta.uid === session.user.id || meta.uid === null) {
        setStatus("offline");
        startRetry();
        return "ok";
      }
      return "auth";
    }
    return sync();
  }

  async function flush() {
    if (!session || !adapter) return;
    if (meta.dirty) await push();
  }

  window.addEventListener("online", () => {
    if (session && meta.dirty) push();
  });

  window.TxCloud = {
    signIn,
    signOut,
    start,
    changed,
    flush,
    pullIfChanged,
    hasSession: () => !!session,
    user: () => (session ? session.user : null),
    isDirty: () => !!meta.dirty,
    onStatus: (fn) => { statusCb = fn; }
  };
})();
