# 🔧 CAMBIOS EXACTOS PARA FINANZASPRO.JSX

## PASO 1: Agregar import de DB

**Línea 3 (después de pdfjsLib):**
```javascript
import DB from './db.js';
```

## PASO 2: Modificar función de carga inicial

**Reemplazar líneas 51-61 (funciones loadData y saveData):**

```javascript
// ── CARGA Y GUARDADO CON IndexedDB ────────────────────────────────────────
async function loadData(year, month) {
  const periodo = monthKey(year, month);
  const pl = await DB.obtenerPL(periodo);
  return pl ? pl.datos : { ingresos:{}, egresos:{} };
}

async function saveData(year, month, data) {
  const periodo = monthKey(year, month);
  await DB.guardarPL(periodo, data);
}

function monthKey(year, month) { 
  return `${year}-${String(month+1).padStart(2,'0')}`; 
}
```

## PASO 3: Modificar componente principal

**Buscar la línea que dice:**
```javascript
const [data, setData] = useState(() => loadData());
```

**Reemplazarla por:**
```javascript
const [data, setData] = useState({ ingresos:{}, egresos:{} });
```

**Agregar useEffect para cargar datos:**
```javascript
useEffect(() => {
  const cargar = async () => {
    const datos = await loadData(year, month);
    setData(datos);
  };
  cargar();
}, [year, month]);
```

## PASO 4: Modificar guardado automático

**Buscar todas las líneas que dicen:**
```javascript
saveData(newData);
```

**Reemplazarlas por:**
```javascript
saveData(year, month, newData);
```

## PASO 5: Modificar parseo PDF F120 (IVA)

**Buscar la función `parsePDF120` (aproximadamente línea 200-300)**

**Agregar al final de la función, ANTES del return:**
```javascript
// Guardar PDF en IndexedDB
const periodo = monthKey(year, month);
const reader = new FileReader();
reader.onload = async (e) => {
  const base64 = btoa(
    new Uint8Array(e.target.result)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  await DB.guardarIVA(periodo, datos, base64);
};
reader.readAsArrayBuffer(file);
```

## PASO 6: Modificar parseo PDF F500 (IRE)

**Buscar la función que procesa F500 (aproximadamente línea 400-500)**

**Agregar al final:**
```javascript
// Guardar PDF en IndexedDB
const reader = new FileReader();
reader.onload = async (e) => {
  const base64 = btoa(
    new Uint8Array(e.target.result)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  await DB.guardarIRE(year.toString(), datos, base64);
};
reader.readAsArrayBuffer(file);
```

## PASO 7: Auto-guardar egresos

**Buscar donde se agregan egresos (función con `setEgresos` o similar)**

**Después de actualizar el estado, agregar:**
```javascript
// Guardar en IndexedDB
await DB.guardarEgreso({
  ...egreso,
  periodo: monthKey(year, month)
});
```

## PASO 8: Auto-guardar CxC

**Buscar donde se agregan cuentas por cobrar**

**Agregar:**
```javascript
await DB.guardarCxC(cuenta);
```

---

## ⚡ RESUMEN DE CAMBIOS

Total de modificaciones: **8 cambios**

1. ✅ Import DB
2. ✅ Reemplazar loadData/saveData
3. ✅ Modificar useState inicial
4. ✅ Agregar useEffect para carga
5. ✅ Actualizar todas las llamadas a saveData
6. ✅ Guardar PDF F120
7. ✅ Guardar PDF F500
8. ✅ Auto-guardar egresos y CxC

---

## 🧪 CÓMO PROBAR

1. Reemplazar archivo
2. Reiniciar servidor
3. Ir a Finanzas → tab IVA Mensual
4. Cargar un PDF F120
5. Abrir DevTools → Application → IndexedDB → solpro_database → finanzas_iva
6. Deberías ver el registro con el PDF guardado

---

*Patch generado para FinanzasPro.jsx*
