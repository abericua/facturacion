/**
 * SGSP — SyncBridge.js
 * Servicio de sincronización bidireccional entre el Backoffice React (IndexedDB)
 * y el volumen persistente de Railway via API Bridge.
 *
 * Variables de entorno requeridas (.env):
 *   VITE_BRIDGE_URL = https://solpro-master-tec-production.up.railway.app
 *   VITE_BRIDGE_KEY = sgsp-bridge-2026
 */

import DB from './db.js';

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL
  || 'https://solpro-master-tec-production.up.railway.app';

const BRIDGE_KEY = import.meta.env.VITE_BRIDGE_KEY
  || 'sgsp-bridge-2026';

const TIMEOUT_MS = 15000;

// ── Helpers ────────────────────────────────────────────────────────────────
function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': BRIDGE_KEY,
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error('Timeout — Railway no responde');
    throw err;
  }
}

// ── Estado del bridge (para UI) ────────────────────────────────────────────
let _lastSync = null;
let _syncStatus = 'idle'; // 'idle' | 'syncing' | 'ok' | 'error'
let _listeners = [];

function notifyListeners() {
  _listeners.forEach(fn => fn({ status: _syncStatus, lastSync: _lastSync }));
}

// ══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ══════════════════════════════════════════════════════════════════════════
export const SyncBridge = {

  // ── Suscribirse a cambios de estado ──────────────────────────────────────
  onStatusChange(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  },

  getStatus() {
    return { status: _syncStatus, lastSync: _lastSync };
  },

  // ── Health check ──────────────────────────────────────────────────────────
  async ping() {
    try {
      const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/status`, {
        headers: buildHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PULL — Railway → IndexedDB
  // ══════════════════════════════════════════════════════════════════════════

  async pullVentas() {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/ventas`, {
      headers: buildHeaders(),
    });
    if (!res.ok) throw new Error(`Ventas pull error: HTTP ${res.status}`);
    const { records } = await res.json();
    if (records && records.length > 0) {
      await DB.guardarCatalogo('ventas', records);
    }
    return records?.length || 0;
  },

  async pullCompras() {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/compras`, {
      headers: buildHeaders(),
    });
    if (!res.ok) throw new Error(`Compras pull error: HTTP ${res.status}`);
    const { records } = await res.json();
    if (records && records.length > 0) {
      await DB.limpiarCompras();
      await DB.guardarCompras(records);
    }
    return records?.length || 0;
  },

  async pullProductos() {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/productos`, {
      headers: buildHeaders(),
    });
    if (!res.ok) throw new Error(`Productos pull error: HTTP ${res.status}`);
    const { records } = await res.json();
    if (records && records.length > 0) {
      await DB.guardarCatalogo('productos', records);
    }
    return records?.length || 0;
  },

  async pullIVA(anio = '2026') {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/iva/${anio}`, {
      headers: buildHeaders(),
    });
    if (!res.ok) throw new Error(`IVA pull error: HTTP ${res.status}`);
    const { records } = await res.json();
    if (records && records.length > 0) {
      for (const r of records) {
        await DB.guardarIVA(r.periodo, r);
      }
    }
    return records?.length || 0;
  },

  async getDashboardResumen() {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/dashboard/resumen`, {
      headers: buildHeaders(),
    });
    if (!res.ok) throw new Error(`Dashboard error: HTTP ${res.status}`);
    return await res.json();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PUSH — IndexedDB → Railway
  // ══════════════════════════════════════════════════════════════════════════

  async pushCompras() {
    const records = await DB.obtenerTodasCompras();
    if (!records || records.length === 0) return 0;

    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/compras/sync`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error(`Compras push error: HTTP ${res.status}`);
    return records.length;
  },

  async pushIVA() {
    const records = await DB.getAll('finanzas_iva');
    if (!records || records.length === 0) return 0;

    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/iva/sync`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error(`IVA push error: HTTP ${res.status}`);
    return records.length;
  },

  /**
   * Envía el stock agregado desde ImportadorCompras al bridge Railway.
   * El backend actualiza la columna Stock en productos_maestros.csv.
   * @param {Array} stockItems — resultado de DB.agregarStockDesdeCompras()
   */
  async pushStock(stockItems) {
    if (!stockItems || stockItems.length === 0) return 0;

    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/stock/sync`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ records: stockItems }),
    });
    if (!res.ok) throw new Error(`Stock push error: HTTP ${res.status}`);
    const json = await res.json();
    return json.actualizados || stockItems.length;
  },

  async pushProductos() {
    const catalogo = await DB.obtenerCatalogo('productos');
    if (!catalogo?.productos?.length) return 0;

    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/productos/sync`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ records: catalogo.productos }),
    });
    if (!res.ok) throw new Error(`Productos push error: HTTP ${res.status}`);
    return catalogo.productos.length;
  },

  async uploadVentasMaster(records) {
    if (!records || records.length === 0) throw new Error('Sin registros de ventas');
    const res = await fetchWithTimeout(`${BRIDGE_URL}/api/bridge/ventas/upload`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error(`Ventas upload error: HTTP ${res.status}`);
    return await res.json();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SYNC COMPLETO
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Pull completo: Railway → IndexedDB
   * Llamar al abrir el backoffice para cargar los últimos datos del servidor.
   */
  async pullAll() {
    _syncStatus = 'syncing';
    notifyListeners();

    const results = {
      ventas:    0,
      compras:   0,
      productos: 0,
      iva:       0,
      errors:    [],
    };

    const tasks = [
      { key: 'ventas',    fn: () => this.pullVentas() },
      { key: 'compras',   fn: () => this.pullCompras() },
      { key: 'productos', fn: () => this.pullProductos() },
      { key: 'iva',       fn: () => this.pullIVA('2026') },
    ];

    for (const task of tasks) {
      try {
        results[task.key] = await task.fn();
      } catch (e) {
        results.errors.push(`${task.key}: ${e.message}`);
      }
    }

    _lastSync = new Date().toISOString();
    _syncStatus = results.errors.length === 0 ? 'ok' : 'error';
    notifyListeners();

    // Persistir timestamp del último sync
    try {
      await DB.guardarConfig('last_bridge_sync', _lastSync);
      await DB.guardarConfig('bridge_sync_results', JSON.stringify(results));
    } catch { /* no crítico */ }

    return results;
  },

  /**
   * Push completo: IndexedDB → Railway
   * Llamar después de procesar nuevos datos (ImportadorCompras, CargadorDocumentos).
   */
  async pushAll() {
    _syncStatus = 'syncing';
    notifyListeners();

    const results = {
      compras:   0,
      iva:       0,
      productos: 0,
      errors:    [],
    };

    const tasks = [
      { key: 'compras',   fn: () => this.pushCompras() },
      { key: 'iva',       fn: () => this.pushIVA() },
      { key: 'productos', fn: () => this.pushProductos() },
    ];

    for (const task of tasks) {
      try {
        results[task.key] = await task.fn();
      } catch (e) {
        results.errors.push(`${task.key}: ${e.message}`);
      }
    }

    _lastSync = new Date().toISOString();
    _syncStatus = results.errors.length === 0 ? 'ok' : 'error';
    notifyListeners();

    try {
      await DB.guardarConfig('last_bridge_push', _lastSync);
    } catch { /* no crítico */ }

    return results;
  },

  /**
   * Sync inteligente al iniciar el backoffice:
   * 1. Verifica conectividad
   * 2. Si hay datos locales más nuevos → push
   * 3. Siempre pull al final
   */
  async autoSync() {
    const online = await this.ping();
    if (!online) {
      _syncStatus = 'error';
      notifyListeners();
      return { online: false, pulled: null, pushed: null };
    }

    // Push primero (datos locales al servidor)
    let pushed = null;
    try { pushed = await this.pushAll(); } catch { /* continuar con pull */ }

    // Pull (servidor al local)
    const pulled = await this.pullAll();

    return { online: true, pulled, pushed };
  },
};

export default SyncBridge;
