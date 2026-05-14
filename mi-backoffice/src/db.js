// ═══════════════════════════════════════════════════════════════════════════
// SOL PRO - MÓDULO DE PERSISTENCIA IndexedDB
// ═══════════════════════════════════════════════════════════════════════════
// Versión: 1.0
// Base de datos local persistente para el backoffice
// Guarda PDFs completos, datos extraídos, catálogos, movimientos bancarios, etc.
// ═══════════════════════════════════════════════════════════════════════════

const DB_NAME = 'solpro_database';
const DB_VERSION = 1;

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
  configuracion: 'configuracion'      // Configuración general
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
