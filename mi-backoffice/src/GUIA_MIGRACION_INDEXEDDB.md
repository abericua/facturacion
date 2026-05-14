# 📘 GUÍA DE MIGRACIÓN A IndexedDB

## 🎯 OBJETIVO

Migrar los 3 módulos principales del backoffice de **localStorage** a **IndexedDB** para:
- ✅ Guardar PDFs completos
- ✅ Persistencia permanente de datos
- ✅ Mayor capacidad de almacenamiento (hasta 1 GB)
- ✅ Mejor organización de datos

---

## 📋 MÓDULOS A MIGRAR

### 1. **FinanzasPro.jsx**
- **localStorage actual:** `solpro_finanzas_v1`
- **Tablas IndexedDB:**
  - `finanzas_iva` → IVA mensual + PDFs F120
  - `finanzas_ire` → IRE anual + PDFs F500
  - `finanzas_pl` → P&L mensual
  - `finanzas_egresos` → Egresos con categorías
  - `finanzas_cxc` → Cuentas por cobrar

### 2. **ConciliacionBancaria.jsx**
- **localStorage actual:** `solpro_bancos_v2`
- **Tablas IndexedDB:**
  - `bancos_cuentas` → Cuentas bancarias
  - `bancos_movimientos` → Movimientos
  - `bancos_extractos` → PDFs de extractos
  - `bancos_tc` → Tipo de cambio BCP
  - `bancos_revaluaciones` → Revaluaciones USD
  - `bancos_perfiles` → Perfiles de bancos

### 3. **CalculadoraPrecios.jsx**
- **localStorage actual:** `solpro_catalogo_v1`
- **Tablas IndexedDB:**
  - `catalogos` → Productos y precios

---

## 🔧 CAMBIOS NECESARIOS

### **Patrón general de cambios:**

#### ANTES (localStorage):
```javascript
const STORAGE_KEY = 'solpro_finanzas_v1';

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return { ingresos:{}, egresos:{} };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
```

#### DESPUÉS (IndexedDB):
```javascript
import DB from './db.js';

// En componentes con useState:
const [data, setData] = useState({ ingresos:{}, egresos:{} });

// Cargar al montar componente
useEffect(() => {
  cargarDatos();
}, []);

async function cargarDatos() {
  // Cargar P&L del periodo actual
  const pl = await DB.obtenerPL('2026-04');
  if (pl) {
    setData(pl.datos);
  }
}

// Guardar cuando cambia
async function guardarDatos(nuevosDatos) {
  await DB.guardarPL('2026-04', nuevosDatos);
  setData(nuevosDatos);
}
```

---

## 📝 CAMBIOS ESPECÍFICOS POR MÓDULO

### **1. FinanzasPro.jsx**

#### **Imports a agregar:**
```javascript
import DB from './db.js';
```

#### **Funciones a modificar:**

**IVA Mensual - Cargar PDF F120:**
```javascript
// ANTES
const parsePDF120 = async (file) => {
  const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const text = textContent.items.map(item => item.str).join(' ');
  
  // ... parseo ...
  
  return { ventas, debito, credito, ... };
};

// DESPUÉS
const parsePDF120 = async (file) => {
  // 1. Convertir PDF a base64 para guardar
  const base64 = await file.arrayBuffer().then(buffer => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  });
  
  // 2. Extraer datos como antes
  const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const text = textContent.items.map(item => item.str).join(' ');
  
  // ... parseo ...
  const datos = { ventas, debito, credito, ... };
  
  // 3. Guardar en IndexedDB
  const periodo = '2026-04'; // según el mes seleccionado
  await DB.guardarIVA(periodo, datos, base64);
  
  return datos;
};
```

**P&L - Guardar automáticamente:**
```javascript
// Cuando el usuario modifica ingresos/egresos
const actualizarIngresos = async (valor) => {
  const periodo = monthKey(year, month);
  const nuevosDatos = { ...data, ingresos: valor };
  await DB.guardarPL(periodo, nuevosDatos);
  setData(nuevosDatos);
};
```

**Cargar al montar:**
```javascript
useEffect(() => {
  cargarDatosIniciales();
}, [year, month]);

async function cargarDatosIniciales() {
  const periodo = monthKey(year, month);
  
  // Cargar P&L
  const pl = await DB.obtenerPL(periodo);
  if (pl) setData(pl.datos);
  
  // Cargar IVA
  const iva = await DB.obtenerIVA(periodo);
  if (iva) setIvaData(iva.datos);
  
  // Cargar IRE si es el periodo anual
  if (month === 3) { // Abril = cierre fiscal
    const ire = await DB.obtenerIRE(year.toString());
    if (ire) setIreData(ire.datos);
  }
}
```

---

### **2. ConciliacionBancaria.jsx**

#### **Extractos PDF - Guardar completo:**
```javascript
// Al importar extracto PDF
const procesarExtracto = async (file, cuentaId) => {
  // 1. Convertir a base64
  const base64 = await file.arrayBuffer().then(buffer => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  });
  
  // 2. Extraer texto para preview
  const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
  const texto = await extraerTextoPDF(pdf);
  
  // 3. Parsear movimientos
  const movimientos = parsearPDFGenerico(texto, perfil);
  
  // 4. Guardar extracto completo en IndexedDB
  await DB.guardarExtracto({
    id: `${cuentaId}-${periodo}`,
    cuenta_id: cuentaId,
    periodo: '2026-04',
    pdf_base64: base64,
    fecha_carga: new Date().toISOString(),
    texto_crudo: texto
  });
  
  // 5. Guardar movimientos
  for (const mov of movimientos) {
    await DB.guardarMovimiento(mov);
  }
};
```

#### **Tipo de Cambio - Auto-guardar:**
```javascript
const agregarTC = async (fecha, tcBcp, tcCompra, tcVenta) => {
  await DB.guardarTC(fecha, tcBcp, tcCompra, tcVenta);
  // Recargar lista
  const todos = await DB.obtenerTodoTC();
  setTipoCambio(todos);
};
```

---

### **3. CalculadoraPrecios.jsx**

#### **Catálogo - Persistencia:**
```javascript
// Al cargar CSV
const cargarCatalogo = async (productos) => {
  await DB.guardarCatalogo('productos', productos);
  setProductos(productos);
};

// Al montar componente
useEffect(() => {
  cargarCatalogoInicial();
}, []);

async function cargarCatalogoInicial() {
  const catalogo = await DB.obtenerCatalogo('productos');
  if (catalogo) {
    setProductos(catalogo.productos);
  }
}
```

---

## 🎯 ESTRATEGIA DE MIGRACIÓN

### **Opción 1: Migración Manual (Recomendada para desarrollo)**

1. **Instalar archivos nuevos:**
   - `db.js` en `src/`
   - `ConfiguracionDB.jsx` en `src/`

2. **Agregar al menú "Base de Datos"**

3. **Probar migración:**
   - Abrir módulo "Base de Datos"
   - Click "Migrar desde localStorage"
   - Verificar que los datos se copiaron

4. **Actualizar módulos uno por uno:**
   - Primero FinanzasPro
   - Luego ConciliacionBancaria
   - Finalmente CalculadoraPrecios

5. **Backup antes de actualizar:**
   - Exportar backup desde "Base de Datos"
   - Guardar en CONOCIMIENTO/

### **Opción 2: Migración Automática**

Agregar en cada módulo al inicio:

```javascript
useEffect(() => {
  migrarSiEsNecesario();
}, []);

async function migrarSiEsNecesario() {
  const migrado = await DB.obtenerConfig('migracion_completada');
  if (!migrado?.valor) {
    await DB.migrarDesdeLocalStorage();
  }
  // Luego cargar desde IndexedDB
  cargarDatosIniciales();
}
```

---

## ⚠️ ADVERTENCIAS

1. **NO borres localStorage** hasta confirmar que IndexedDB funciona
2. **Siempre haz backup** antes de actualizar módulos
3. **Prueba primero en un módulo** antes de migrar todos
4. **Los PDFs en base64 ocupan ~33% más** que el archivo original

---

## ✅ CHECKLIST DE MIGRACIÓN

### Preparación:
- [ ] Copiar `db.js` a `src/`
- [ ] Copiar `ConfiguracionDB.jsx` a `src/`
- [ ] Agregar módulo "Base de Datos" al menú
- [ ] Exportar backup de localStorage (opcional)

### FinanzasPro:
- [ ] Agregar `import DB from './db.js'`
- [ ] Modificar carga de IVA para guardar PDF
- [ ] Modificar carga de IRE para guardar PDF
- [ ] Auto-guardar P&L al modificar
- [ ] Auto-guardar egresos al agregar/modificar
- [ ] Auto-guardar CxC al agregar/modificar
- [ ] Cargar datos al montar componente
- [ ] Probar guardado y carga

### ConciliacionBancaria:
- [ ] Guardar extractos PDF completos
- [ ] Guardar movimientos en IndexedDB
- [ ] Guardar tipo de cambio automáticamente
- [ ] Guardar revaluaciones
- [ ] Cargar todo al montar
- [ ] Probar conciliación

### CalculadoraPrecios:
- [ ] Guardar catálogo al cargar CSV
- [ ] Cargar catálogo al montar
- [ ] Probar persistencia

---

## 🚀 SIGUIENTE PASO

Una vez completada la migración, podrás:
1. Cerrar el navegador y volver → **datos siguen ahí**
2. Borrar caché → **datos siguen ahí** (en IndexedDB)
3. Exportar backup mensual → **archivo .json con todo**
4. Transferir a otra PC → **importar backup**

---

*Guía generada para Sol Pro Backoffice v2.0*
