// ═══════════════════════════════════════════════════════════════════════════
// SOL PRO - MÓDULO DE PERSISTENCIA IndexedDB
// ═══════════════════════════════════════════════════════════════════════════
// Versión: 1.0
// Base de datos local persistente para el backoffice
// Guarda PDFs completos, datos extraídos, catálogos, movimientos bancarios, etc.
// ═══════════════════════════════════════════════════════════════════════════

const DB_NAME = 'solpro_database';
const DB_VERSION = 3; // Actualizado para incluir tabla de Clientes y Compras Proveedores

// ── CONFIGURACIÓN DE STORES (TABLAS) ────────────────────────────────────────
const STORES = {
  finanzas_iva: 'finanzas_iva',       // IVA mensual + PDFs F120
  finanzas_ire: 'finanzas_ire',       // IRE anual + PDFs F500
  finanzas_pl: 'finanzas_pl',         // P&L mensual
  finanzas_egresos: 'finanzas_egresos', // Egresos y gastos
  finanzas_cxc: 'finanzas_cxc',       // Cuentas por cobrar
  
  bancos_cuentas: 'bancos_cuentas',   // Cuentas bancarias
  bancos_movimientos: 'bancos_movimientos', // Movimientos bancarios
  bancos_extractos: 'bancos_extractos',     // PDFs de extractos
  bancos_tc: 'bancos_tc',             // Tipo de cambio BCP
  bancos_revaluaciones: 'bancos_revaluaciones', // Revaluaciones USD
  bancos_perfiles: 'bancos_perfiles', // Perfiles de bancos
  
  catalogos: 'catalogos',             // Catálogo de productos/precios
  configuracion: 'configuracion',     // Configuración general
  clientes: 'clientes',               // Cartera de clientes y distribución geográfica
  compras_proveedores: 'compras_proveedores'
};

// ── CLASE PRINCIPAL DE BASE DE DATOS ────────────────────────────────────────
class SolProDB {
  constructor() {
    this.db = null;
    this.isReady = false;
  }

  // ── INICIALIZAR BASE DE DATOS ──────────────────────────────────────────────
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error al abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        console.log('✅ IndexedDB inicializada correctamente');
        resolve(this.db);
      };

      // Crear stores (tablas) si es la primera vez
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Finanzas
        if (!db.objectStoreNames.contains(STORES.finanzas_iva)) {
          const store = db.createObjectStore(STORES.finanzas_iva, { keyPath: 'periodo' });
          store.createIndex('anio', 'anio', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.finanzas_ire)) {
          db.createObjectStore(STORES.finanzas_ire, { keyPath: 'anio' });
        }
        if (!db.objectStoreNames.contains(STORES.finanzas_pl)) {
          const store = db.createObjectStore(STORES.finanzas_pl, { keyPath: 'periodo' });
          store.createIndex('anio', 'anio', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.finanzas_egresos)) {
          const store = db.createObjectStore(STORES.finanzas_egresos, { keyPath: 'id', autoIncrement: true });
          store.createIndex('periodo', 'periodo', { unique: false });
          store.createIndex('categoria', 'categoria', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.finanzas_cxc)) {
          const store = db.createObjectStore(STORES.finanzas_cxc, { keyPath: 'id', autoIncrement: true });
          store.createIndex('cliente', 'cliente', { unique: false });
          store.createIndex('estado', 'estado', { unique: false });
        }

        // Bancos
        if (!db.objectStoreNames.contains(STORES.bancos_cuentas)) {
          const store = db.createObjectStore(STORES.bancos_cuentas, { keyPath: 'id' });
          store.createIndex('banco', 'banco', { unique: false });
          store.createIndex('moneda', 'moneda', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.bancos_movimientos)) {
          const store = db.createObjectStore(STORES.bancos_movimientos, { keyPath: 'id' });
          store.createIndex('cuenta_id', 'cuenta_id', { unique: false });
          store.createIndex('fecha', 'fecha', { unique: false });
          store.createIndex('conciliado', 'conciliado', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.bancos_extractos)) {
          const store = db.createObjectStore(STORES.bancos_extractos, { keyPath: 'id' });
          store.createIndex('cuenta_id', 'cuenta_id', { unique: false });
          store.createIndex('periodo', 'periodo', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.bancos_tc)) {
          db.createObjectStore(STORES.bancos_tc, { keyPath: 'fecha' });
        }
        if (!db.objectStoreNames.contains(STORES.bancos_revaluaciones)) {
          const store = db.createObjectStore(STORES.bancos_revaluaciones, { keyPath: 'id' });
          store.createIndex('periodo', 'periodo', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.bancos_perfiles)) {
          db.createObjectStore(STORES.bancos_perfiles, { keyPath: 'banco' });
        }

        // Catálogos y configuración
        if (!db.objectStoreNames.contains(STORES.catalogos)) {
          db.createObjectStore(STORES.catalogos, { keyPath: 'tipo' });
        }
        if (!db.objectStoreNames.contains(STORES.configuracion)) {
          db.createObjectStore(STORES.configuracion, { keyPath: 'clave' });
        }
        
        // Clientes
        if (!db.objectStoreNames.contains(STORES.clientes)) {
          const store = db.createObjectStore(STORES.clientes, { keyPath: 'id' });
          store.createIndex('nombre', 'nombre', { unique: false });
          store.createIndex('departamento', 'departamento', { unique: false });
        }

        if (!db.objectStoreNames.contains('compras_proveedores')) {
          const store = db.createObjectStore('compras_proveedores', { keyPath: 'id', autoIncrement: true });
          store.createIndex('periodo', 'periodo', { unique: false });
          store.createIndex('anio', 'anio', { unique: false });
          store.createIndex('ruc_proveedor', 'ruc_proveedor', { unique: false });
          store.createIndex('tipo', 'tipo', { unique: false });
        }

        console.log('✅ Stores (tablas) creadas correctamente');
      };
    });
  }

  // ── MÉTODOS GENÉRICOS ──────────────────────────────────────────────────────
  async get(storeName, key) {
    if (!this.isReady) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    if (!this.isReady) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    if (!this.isReady) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    if (!this.isReady) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    if (!this.isReady) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ── MÉTODOS ESPECÍFICOS: FINANZAS ──────────────────────────────────────────
  
  // IVA Mensual
  async guardarIVA(periodo, datos, pdfBase64 = null) {
    const registro = {
      periodo, // "2026-04"
      anio: periodo.split('-')[0],
      datos,
      pdf: pdfBase64,
      fecha_actualizacion: new Date().toISOString()
    };
    return this.put(STORES.finanzas_iva, registro);
  }

  async obtenerIVA(periodo) {
    return this.get(STORES.finanzas_iva, periodo);
  }

  async obtenerIVAPorAnio(anio) {
    return this.getByIndex(STORES.finanzas_iva, 'anio', anio);
  }

  // IRE Anual
  async guardarIRE(anio, datos, pdfBase64 = null) {
    const registro = {
      anio,
      datos,
      pdf: pdfBase64,
      fecha_actualizacion: new Date().toISOString()
    };
    return this.put(STORES.finanzas_ire, registro);
  }

  async obtenerIRE(anio) {
    return this.get(STORES.finanzas_ire, anio);
  }

  // P&L Mensual
  async guardarPL(periodo, datos) {
    const registro = {
      periodo,
      anio: periodo.split('-')[0],
      datos,
      fecha_actualizacion: new Date().toISOString()
    };
    return this.put(STORES.finanzas_pl, registro);
  }

  async obtenerPL(periodo) {
    return this.get(STORES.finanzas_pl, periodo);
  }

  async obtenerPLPorAnio(anio) {
    return this.getByIndex(STORES.finanzas_pl, 'anio', anio);
  }

  // Egresos
  async guardarEgreso(egreso) {
    return this.put(STORES.finanzas_egresos, egreso);
  }

  async obtenerEgresosPorPeriodo(periodo) {
    return this.getByIndex(STORES.finanzas_egresos, 'periodo', periodo);
  }

  async eliminarEgreso(id) {
    return this.delete(STORES.finanzas_egresos, id);
  }

  // Cuentas por Cobrar
  async guardarCxC(cuenta) {
    return this.put(STORES.finanzas_cxc, cuenta);
  }

  async obtenerTodasCxC() {
    return this.getAll(STORES.finanzas_cxc);
  }

  async eliminarCxC(id) {
    return this.delete(STORES.finanzas_cxc, id);
  }

  // ── MÉTODOS ESPECÍFICOS: BANCOS ────────────────────────────────────────────

  // Cuentas
  async guardarCuenta(cuenta) {
    return this.put(STORES.bancos_cuentas, cuenta);
  }

  async obtenerCuenta(id) {
    return this.get(STORES.bancos_cuentas, id);
  }

  async obtenerTodasCuentas() {
    return this.getAll(STORES.bancos_cuentas);
  }

  async eliminarCuenta(id) {
    return this.delete(STORES.bancos_cuentas, id);
  }

  // Movimientos
  async guardarMovimiento(movimiento) {
    return this.put(STORES.bancos_movimientos, movimiento);
  }

  async obtenerMovimientosPorCuenta(cuenta_id) {
    return this.getByIndex(STORES.bancos_movimientos, 'cuenta_id', cuenta_id);
  }

  async obtenerTodosMovimientos() {
    return this.getAll(STORES.bancos_movimientos);
  }

  async eliminarMovimiento(id) {
    return this.delete(STORES.bancos_movimientos, id);
  }

  // Extractos PDF
  async guardarExtracto(extracto) {
    // extracto = { id, cuenta_id, periodo, pdf_base64, fecha_carga, texto_crudo }
    return this.put(STORES.bancos_extractos, extracto);
  }

  async obtenerExtractoPorPeriodo(cuenta_id, periodo) {
    const extractos = await this.getByIndex(STORES.bancos_extractos, 'cuenta_id', cuenta_id);
    return extractos.find(e => e.periodo === periodo);
  }

  // Tipo de Cambio
  async guardarTC(fecha, tc_bcp, tc_compra, tc_venta) {
    const registro = {
      fecha, // "2026-04-26"
      tc_bcp,
      tc_compra,
      tc_venta,
      fecha_actualizacion: new Date().toISOString()
    };
    return this.put(STORES.bancos_tc, registro);
  }

  async obtenerTC(fecha) {
    return this.get(STORES.bancos_tc, fecha);
  }

  async obtenerTodoTC() {
    return this.getAll(STORES.bancos_tc);
  }

  // Revaluaciones
  async guardarRevaluacion(revaluacion) {
    return this.put(STORES.bancos_revaluaciones, revaluacion);
  }

  async obtenerRevaluacionesPorPeriodo(periodo) {
    return this.getByIndex(STORES.bancos_revaluaciones, 'periodo', periodo);
  }

  // Perfiles de bancos
  async guardarPerfilBanco(perfil) {
    return this.put(STORES.bancos_perfiles, perfil);
  }

  async obtenerPerfilBanco(banco) {
    return this.get(STORES.bancos_perfiles, banco);
  }

  async obtenerTodosPerfiles() {
    return this.getAll(STORES.bancos_perfiles);
  }

  async guardarCompras(registros) {
    for (const r of registros) {
      const fecha = r.fecha || '';
      const parts = fecha.split('/');
      const periodo = parts.length === 3
        ? (parseInt(parts[2]) < 100 ? '20'+parts[2] : parts[2]) + '-' + parts[1].padStart(2,'0')
        : new Date().getFullYear() + '-01';
      await this.put('compras_proveedores', {
        ...r,
        periodo,
        anio: periodo.split('-')[0],
        fecha_carga: new Date().toISOString()
      });
    }
  }

  async obtenerTodasCompras() {
    return this.getAll('compras_proveedores');
  }

  async obtenerComprasPorAnio(anio) {
    return this.getByIndex('compras_proveedores', 'anio', anio);
  }

  /**
   * Agrega los items[] de compras AÚN NO SINCRONIZADAS (stock_sincronizado !== true).
   * FAC suma cantidades, NC resta.
   * Retorna { items: Array<{codigo,descripcion,cantidad,precio_unit_usd}>, ids: number[] }
   * donde ids son los IDs de las compras procesadas (para marcarlas después).
   */
  async agregarStockDesdeCompras() {
    const compras = await this.getAll('compras_proveedores');
    const pendientes = compras.filter(c => !c.stock_sincronizado);

    const mapa = {};
    const ids  = [];

    for (const compra of pendientes) {
      ids.push(compra.id);
      const items = compra.items || [];
      const signo = compra.tipo === 'NC' ? -1 : 1;

      for (const item of items) {
        const cod = (item.codigo || '').trim().toUpperCase();
        if (!cod) continue;

        if (!mapa[cod]) {
          mapa[cod] = {
            codigo:          cod,
            descripcion:     item.descripcion || '',
            cantidad:        0,
            precio_unit_usd: item.precio_unit_usd || 0,
          };
        }
        mapa[cod].cantidad += (item.cantidad || 0) * signo;
        if (item.precio_unit_usd) {
          mapa[cod].precio_unit_usd = item.precio_unit_usd;
        }
      }
    }

    const items = Object.values(mapa).filter(i => i.codigo && i.cantidad > 0);
    return { items, ids, pendientes: pendientes.length };
  }

  /**
   * Marca las compras con los IDs dados como stock_sincronizado = true.
   * Se llama después de un pushStock exitoso.
   */
  async marcarComprasSincronizadas(ids) {
    if (!ids || !ids.length) return;
    if (!this.isReady) await this.init();

    for (const id of ids) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(['compras_proveedores'], 'readwrite');
        const store = tx.objectStore('compras_proveedores');
        const req = store.get(id);
        req.onsuccess = () => {
          const record = req.result;
          if (record) {
            record.stock_sincronizado = true;
            record.fecha_sync_stock = new Date().toISOString();
            store.put(record);
          }
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    }
  }

  /**
   * Lee el tipo de cambio más reciente guardado en bancos_tc.
   * Si no hay ninguno, retorna el fallback.
   */
  async getUltimoTC(fallback = 7650) {
    try {
      const todos = await this.getAll(STORES.bancos_tc);
      if (!todos.length) return fallback;
      todos.sort((a, b) => b.fecha.localeCompare(a.fecha));
      return todos[0].tc_bcp || todos[0].tc_compra || fallback;
    } catch { return fallback; }
  }

  /**
   * Lee todas las compras de proveedores y actualiza la categoría
   * 'compras_local' de FinanzasPro (finanzas_pl) por período, neteando
   * FAC - NC. También guarda el IVA crédito neto por período.
   * @param {number} tcUSD — tipo de cambio USD→GS a usar
   * @returns {number} cantidad de períodos actualizados
   */
  async actualizarEgresosDesdeCompras(tcUSD) {
    const tc = tcUSD || await this.getUltimoTC();
    const compras = await this.getAll('compras_proveedores');

    // Agrupar por período
    const porPeriodo = {};
    for (const c of compras) {
      const p = c.periodo;
      if (!p) continue;
      if (!porPeriodo[p]) {
        porPeriodo[p] = { neto_usd: 0, neto_pyg: 0, iva_credito: 0, facturas: 0, ncs: 0 };
      }
      const signo = c.tipo === 'NC' ? -1 : 1;
      porPeriodo[p].neto_usd    += (c.subtotal_usd || 0) * signo;
      porPeriodo[p].neto_pyg    += (c.subtotal_pyg || 0) * signo;
      porPeriodo[p].iva_credito += (c.iva_total    || 0) * signo;
      if (c.tipo === 'FAC') porPeriodo[p].facturas++;
      else                  porPeriodo[p].ncs++;
    }

    let actualizados = 0;
    for (const [periodo, t] of Object.entries(porPeriodo)) {
      const montoGs = Math.round(t.neto_usd * tc + t.neto_pyg);
      const ivaGs   = Math.round(Math.abs(t.iva_credito));

      // Leer PL existente y hacer merge
      const existing = await this.get('finanzas_pl', periodo);
      const datos    = existing?.datos || {};
      const egresos  = typeof datos.egresos === 'object' && datos.egresos !== null
                       ? { ...datos.egresos }
                       : {};

      egresos.compras_local = montoGs;

      await this.guardarPL(periodo, {
        ...datos,
        egresos,
        iva_credito_compras: ivaGs,
        compras_resumen: {
          facturas:  t.facturas,
          ncs:       t.ncs,
          neto_usd:  parseFloat(t.neto_usd.toFixed(2)),
          neto_pyg:  Math.round(t.neto_pyg),
          iva_credito: ivaGs,
          tc_usado:  tc,
          actualizado: new Date().toISOString(),
        },
      });
      actualizados++;
    }
    return actualizados;
  }

  /**
   * Compara los precios de compra reales (de compras_proveedores.items)
   * contra el costo base registrado en el catálogo de productos.
   * Retorna variaciones ordenadas: primero las desfavorables (precio > costo base).
   */
  async analizarVariacionCostos() {
    const compras  = await this.getAll('compras_proveedores');
    const catalogo = await this.obtenerCatalogo('productos');
    const prods    = catalogo?.productos || [];

    // Construir mapa catálogo por ID_Ref / código
    const catMap = {};
    for (const p of prods) {
      const id = (p.ID_Ref || p.Codigo_Proveedor || '').trim().toUpperCase();
      if (id) catMap[id] = p;
    }

    const variaciones = [];
    const vistos = new Set(); // evitar duplicados por código

    for (const compra of compras) {
      for (const item of (compra.items || [])) {
        const cod = (item.codigo || '').trim().toUpperCase();
        if (!cod || vistos.has(cod)) continue;
        const precioCompra = parseFloat(item.precio_unit_usd) || 0;
        if (!precioCompra) continue;

        // Buscar en catálogo
        let catProd = catMap[cod];
        if (!catProd) {
          catProd = prods.find(p =>
            (p.Nombre || '').toUpperCase().includes(cod) ||
            cod.includes((p.ID_Ref || '').toUpperCase())
          );
        }

        if (catProd && catProd.Moneda_Costo === 'USD') {
          const costoBase = parseFloat(catProd.Costo_Compra) || 0;
          if (!costoBase) continue;
          const dif = precioCompra - costoBase;
          const pct = (dif / costoBase) * 100;
          variaciones.push({
            codigo:            cod,
            descripcion:       item.descripcion || catProd.Nombre || cod,
            precio_compra_usd: precioCompra,
            costo_base_usd:    costoBase,
            diferencia_usd:    parseFloat(dif.toFixed(2)),
            variacion_pct:     parseFloat(pct.toFixed(1)),
            favorable:         dif < 0,   // pagamos menos = favorable
            proveedor:         compra.proveedor || '',
            periodo:           compra.periodo   || '',
          });
          vistos.add(cod);
        }
      }
    }

    // Desfavorables primero (precio compra > costo base)
    return variaciones.sort((a, b) => b.diferencia_usd - a.diferencia_usd);
  }

  /**
   * Resetea el flag stock_sincronizado en TODAS las compras.
   * Usar solo para re-sincronización forzada completa.
   */
  async resetearFlagsStock() {
    const compras = await this.getAll('compras_proveedores');
    for (const c of compras) {
      c.stock_sincronizado = false;
      delete c.fecha_sync_stock;
      await this.put('compras_proveedores', c);
    }
    return compras.length;
  }

  async limpiarCompras() {
    if (!this.isReady) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['compras_proveedores'], 'readwrite');
      tx.objectStore('compras_proveedores').clear().onsuccess = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── MÉTODOS ESPECÍFICOS: CATÁLOGOS ─────────────────────────────────────────

  async guardarCatalogo(tipo, productos) {
    // tipo = "productos", "precios", etc.
    const registro = {
      tipo,
      productos,
      fecha_actualizacion: new Date().toISOString()
    };
    return this.put(STORES.catalogos, registro);
  }

  async obtenerCatalogo(tipo) {
    return this.get(STORES.catalogos, tipo);
  }

  // ── MÉTODOS ESPECÍFICOS: CONFIGURACIÓN ─────────────────────────────────────

  async guardarConfig(clave, valor) {
    const registro = { clave, valor };
    return this.put(STORES.configuracion, registro);
  }

  async obtenerConfig(clave) {
    return this.get(STORES.configuracion, clave);
  }

  // ── MIGRACIÓN DESDE LOCALSTORAGE ───────────────────────────────────────────
  
  async migrarDesdeLocalStorage() {
    console.log('🔄 Iniciando migración desde localStorage...');
    
    try {
      // Migrar Finanzas v1
      const finanzasV1 = localStorage.getItem('solpro_finanzas_v1');
      if (finanzasV1) {
        const data = JSON.parse(finanzasV1);
        
        // Migrar IVA mensual
        if (data.iva_mensual) {
          for (const [periodo, iva] of Object.entries(data.iva_mensual)) {
            await this.guardarIVA(periodo, iva);
          }
        }
        
        // Migrar IRE
        if (data.ire_anual) {
          for (const [anio, ire] of Object.entries(data.ire_anual)) {
            await this.guardarIRE(anio, ire);
          }
        }
        
        // Migrar P&L
        if (data.pl_mensual) {
          for (const [periodo, pl] of Object.entries(data.pl_mensual)) {
            await this.guardarPL(periodo, pl);
          }
        }
        
        console.log('✅ Finanzas migradas');
      }

      // Migrar Bancos v2
      const bancosV2 = localStorage.getItem('solpro_bancos_v2');
      if (bancosV2) {
        const data = JSON.parse(bancosV2);
        
        // Migrar cuentas
        if (data.cuentas) {
          for (const cuenta of data.cuentas) {
            await this.guardarCuenta(cuenta);
          }
        }
        
        // Migrar movimientos
        if (data.movimientos) {
          for (const mov of data.movimientos) {
            await this.guardarMovimiento(mov);
          }
        }
        
        // Migrar tipo de cambio
        if (data.tipoCambio) {
          for (const [fecha, tc] of Object.entries(data.tipoCambio)) {
            await this.guardarTC(fecha, tc.bcp, tc.compra, tc.venta);
          }
        }
        
        // Migrar perfiles
        if (data.perfiles) {
          for (const [banco, perfil] of Object.entries(data.perfiles)) {
            await this.guardarPerfilBanco({ banco, ...perfil });
          }
        }
        
        console.log('✅ Bancos migrados');
      }

      // Migrar Catálogo v1
      const catalogoV1 = localStorage.getItem('solpro_catalogo_v1');
      if (catalogoV1) {
        const data = JSON.parse(catalogoV1);
        await this.guardarCatalogo('productos', data);
        console.log('✅ Catálogo migrado');
      }

      const comprasV1 = localStorage.getItem('solpro_compras');
      if (comprasV1) {
        const data = JSON.parse(comprasV1);
        if (Array.isArray(data) && data.length) {
          await this.guardarCompras(data);
          console.log('✅ Compras migradas');
        }
      }

      console.log('✅ Migración completada exitosamente');
      
      // Opcional: guardar bandera de que ya se migró
      await this.guardarConfig('migracion_completada', true);
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
    }
  }

  // ── BACKUP Y RESTORE ───────────────────────────────────────────────────────

  async exportarBackup() {
    const backup = {
      version: DB_VERSION,
      fecha: new Date().toISOString(),
      datos: {}
    };

    for (const storeName of Object.values(STORES)) {
      backup.datos[storeName] = await this.getAll(storeName);
    }

    return backup;
  }

  async importarBackup(backup) {
    if (backup.version !== DB_VERSION) {
      console.warn('⚠️ Versión de backup diferente, puede haber incompatibilidades');
    }

    for (const [storeName, registros] of Object.entries(backup.datos)) {
      for (const registro of registros) {
        await this.put(storeName, registro);
      }
    }

    console.log('✅ Backup importado correctamente');
  }

  async limpiarBaseDatos() {
    for (const storeName of Object.values(STORES)) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await store.clear();
    }
    console.log('✅ Base de datos limpiada');
  }
}

// ── INSTANCIA SINGLETON ─────────────────────────────────────────────────────
const DB = new SolProDB();

// Inicializar automáticamente
DB.init().catch(err => console.error('Error al inicializar DB:', err));

export default DB;
