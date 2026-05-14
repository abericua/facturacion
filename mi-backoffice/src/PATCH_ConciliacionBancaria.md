# 🔧 CAMBIOS EXACTOS PARA CONCILIACIONBANCARIA.JSX

## PASO 1: Agregar import de DB

**Al inicio del archivo, después de los imports de React:**
```javascript
import DB from './db.js';
```

## PASO 2: Eliminar código localStorage

**Buscar y COMENTAR (no borrar aún) las líneas:**
```javascript
const STORAGE_KEY_V2 = 'solpro_bancos_v2';
const loadBancosData = () => { ... };
const saveBancosData = (data) => { ... };
```

## PASO 3: Modificar carga inicial de datos

**Buscar:**
```javascript
const [bancosData, setBancosData] = useState(() => loadBancosData());
```

**Reemplazar por:**
```javascript
const [bancosData, setBancosData] = useState({
  cuentas: [],
  movimientos: [],
  tipoCambio: {},
  perfiles: {
    atlas: { nombre: 'Banco Atlas', color: '#0066cc', keywords_credito: [...], ... },
    ueno: { ... },
    fic: { ... }
  }
});
```

**Agregar useEffect para cargar:**
```javascript
useEffect(() => {
  cargarDatosIniciales();
}, []);

async function cargarDatosIniciales() {
  // Cargar cuentas
  const cuentas = await DB.obtenerTodasCuentas();
  
  // Cargar movimientos
  const movimientos = await DB.obtenerTodosMovimientos();
  
  // Cargar tipo de cambio
  const tc = await DB.obtenerTodoTC();
  const tipoCambio = {};
  tc.forEach(t => { tipoCambio[t.fecha] = t; });
  
  // Cargar perfiles
  const perfilesArr = await DB.obtenerTodosPerfiles();
  const perfiles = {};
  perfilesArr.forEach(p => { perfiles[p.banco] = p; });
  
  setBancosData({
    cuentas: cuentas || [],
    movimientos: movimientos || [],
    tipoCambio,
    perfiles: Object.keys(perfiles).length > 0 ? perfiles : bancosData.perfiles
  });
}
```

## PASO 4: Auto-guardar al agregar cuenta

**Buscar donde se agrega una cuenta nueva (función `agregarCuenta` o similar):**

**Agregar:**
```javascript
await DB.guardarCuenta(nuevaCuenta);
```

## PASO 5: Auto-guardar tipo de cambio

**Buscar donde se registra TC BCP:**

**Reemplazar:**
```javascript
const nuevoTC = { ...tipoCambio };
nuevoTC[fecha] = { bcp, compra, venta };
setBancosData({ ...bancosData, tipoCambio: nuevoTC });
```

**Por:**
```javascript
await DB.guardarTC(fecha, bcp, compra, venta);
const tc = await DB.obtenerTodoTC();
const tipoCambio = {};
tc.forEach(t => { tipoCambio[t.fecha] = t; });
setBancosData({ ...bancosData, tipoCambio });
```

## PASO 6: Guardar extracto PDF completo

**Buscar la función que procesa el PDF (probablemente `procesarPDFExtracto` o similar):**

**Agregar ANTES de parsear:**
```javascript
async function procesarExtractoPDF(file, cuentaId) {
  // 1. Convertir PDF a base64
  const buffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  
  // 2. Extraer texto (código existente)
  const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
  const texto = await extraerTextoPDF(pdf);
  
  // 3. Parsear movimientos (código existente)
  const movimientos = parsearPDFGenerico(texto, perfil);
  
  // 4. Guardar extracto en IndexedDB
  const periodo = '2026-04'; // detectar del nombre del archivo o del contenido
  await DB.guardarExtracto({
    id: `${cuentaId}-${periodo}`,
    cuenta_id: cuentaId,
    periodo,
    pdf_base64: base64,
    fecha_carga: new Date().toISOString(),
    texto_crudo: texto
  });
  
  // 5. Guardar movimientos
  for (const mov of movimientos) {
    await DB.guardarMovimiento(mov);
  }
  
  // 6. Recargar
  await cargarDatosIniciales();
}
```

## PASO 7: Auto-guardar movimientos manuales

**Buscar donde se agregan movimientos manualmente:**

**Agregar:**
```javascript
await DB.guardarMovimiento(nuevoMovimiento);
```

## PASO 8: Auto-guardar revaluación

**Buscar donde se crea la revaluación USD:**

**Agregar:**
```javascript
await DB.guardarRevaluacion({
  id: `reval-${periodo}-${Date.now()}`,
  periodo,
  cuenta_id,
  saldo_usd,
  tc_cierre,
  saldo_gs,
  diferencia_cambio,
  fecha_calculo: new Date().toISOString()
});
```

## PASO 9: Guardar perfiles de banco

**Si el usuario modifica un perfil de banco:**

```javascript
await DB.guardarPerfilBanco({
  banco: 'atlas',
  ...perfilModificado
});
```

---

## ⚡ RESUMEN DE CAMBIOS

Total de modificaciones: **9 cambios**

1. ✅ Import DB
2. ✅ Comentar código localStorage
3. ✅ Modificar useState inicial
4. ✅ Agregar useEffect para carga
5. ✅ Auto-guardar cuentas
6. ✅ Auto-guardar tipo de cambio
7. ✅ Guardar extracto PDF completo
8. ✅ Auto-guardar movimientos
9. ✅ Auto-guardar revaluaciones

---

## 🧪 CÓMO PROBAR

1. Reemplazar archivo
2. Reiniciar servidor
3. Ir a Bancos → tab Importar
4. Cargar un extracto PDF
5. Abrir DevTools → Application → IndexedDB → solpro_database → bancos_extractos
6. Deberías ver el extracto con el PDF completo en base64

---

*Patch generado para ConciliacionBancaria.jsx*
