# 🔧 INTEGRACIÓN PASO A PASO - ConciliacionBancaria.jsx

## 📋 CAMBIOS A REALIZAR

Vas a hacer **5 cambios** en el archivo `ConciliacionBancaria.jsx`:

---

## ✅ CAMBIO 1: Agregar imports (LÍNEA ~3)

**Ubicación:** Al inicio del archivo, después de `import { useState } from 'react';`

**AGREGAR estas líneas:**

```javascript
// ── IMPORTS CORRECCIONES CRÍTICAS ───────────────────────────────────────────
import { importarExtractoPDFSeguro } from './pdfParserSeguro.js';
import { 
  useConfirmacion, 
  InputNumerico, 
  LoadingSpinner,
  formatearGuaranies 
} from './utilidadesValidacion.jsx';
```

---

## ✅ CAMBIO 2: Inicializar hook de confirmación (LÍNEA ~20-30)

**Ubicación:** Dentro del componente `ConciliacionBancaria`, al inicio donde están los `useState`

**AGREGAR esta línea:**

```javascript
export default function ConciliacionBancaria() {
  // ... estados existentes ...
  
  // AGREGAR ESTO:
  const { confirmar, ModalConfirmacion } = useConfirmacion();
  const [loading, setLoading] = useState(false);
  const [errorImportacion, setErrorImportacion] = useState(null);
  
  // ... resto del código ...
}
```

---

## ✅ CAMBIO 3: Reemplazar función de importación PDF (LÍNEA ~450-550 aprox)

**Buscar la función que procesa el PDF** (puede llamarse `procesarExtractoPDF`, `importarPDF`, o similar)

**REEMPLAZAR toda esa función con:**

```javascript
const procesarExtractoPDF = async (archivo, cuentaId) => {
  setLoading(true);
  setErrorImportacion(null);
  
  try {
    // Obtener perfil del banco
    const cuenta = bancosData.cuentas.find(c => c.id === cuentaId);
    if (!cuenta) {
      throw new Error('Cuenta no encontrada');
    }
    
    const perfil = bancosData.perfiles[cuenta.banco];
    if (!perfil) {
      throw new Error(`Perfil de banco "${cuenta.banco}" no encontrado`);
    }
    
    // Importar con el parser seguro
    const resultado = await importarExtractoPDFSeguro(archivo, cuentaId, perfil);
    
    if (!resultado.success) {
      // Mostrar errores
      setErrorImportacion(resultado.errores.join('\n'));
      alert(`⚠️ Errores al procesar el PDF:\n\n${resultado.errores.join('\n')}`);
      return;
    }
    
    // Mostrar advertencias si las hay
    if (resultado.advertencias.length > 0) {
      const continuar = confirm(
        `✅ PDF procesado correctamente\n\n` +
        `⚠️ Advertencias:\n${resultado.advertencias.join('\n')}\n\n` +
        `Movimientos detectados: ${resultado.movimientos.length}\n\n` +
        `¿Continuar con la importación?`
      );
      
      if (!continuar) {
        setLoading(false);
        return;
      }
    }
    
    // Guardar movimientos en preview
    setMovimientosPreview(resultado.movimientos);
    setTextoCrudoPDF(resultado.textoCrudo);
    
    console.log('✅ Importación exitosa:', {
      archivo: archivo.name,
      movimientos: resultado.movimientos.length
    });
    
  } catch (error) {
    console.error('❌ Error en importación:', error);
    setErrorImportacion(error.message);
    alert(`❌ Error inesperado:\n\n${error.message}`);
  } finally {
    setLoading(false);
  }
};
```

---

## ✅ CAMBIO 4: Agregar confirmación al eliminar cuentas (LÍNEA ~200-300 aprox)

**Buscar donde se eliminan cuentas** (puede ser una función `eliminarCuenta` o botón con onClick)

**REEMPLAZAR con:**

```javascript
const eliminarCuenta = async (cuentaId) => {
  const cuenta = bancosData.cuentas.find(c => c.id === cuentaId);
  
  const confirmado = await confirmar({
    titulo: '⚠️ ¿Eliminar cuenta bancaria?',
    mensaje: `Se eliminará la cuenta "${cuenta?.nombre || 'sin nombre'}" y TODOS sus movimientos asociados.\n\nEsta acción NO se puede deshacer.\n\n¿Estás seguro?`,
    tipo: 'danger',
    textoConfirmar: 'Sí, eliminar',
    textoCancelar: 'No, cancelar'
  });
  
  if (!confirmado) return;
  
  // Eliminar cuenta
  const nuevasCuentas = bancosData.cuentas.filter(c => c.id !== cuentaId);
  const nuevosMovimientos = bancosData.movimientos.filter(m => m.cuenta_id !== cuentaId);
  
  setBancosData({
    ...bancosData,
    cuentas: nuevasCuentas,
    movimientos: nuevosMovimientos
  });
  
  saveBancosData({
    ...bancosData,
    cuentas: nuevasCuentas,
    movimientos: nuevosMovimientos
  });
};
```

---

## ✅ CAMBIO 5: Renderizar modal y loading al final del return (ÚLTIMA LÍNEA antes del cierre)

**Ubicación:** Justo antes del último `</div>` del return principal

**AGREGAR:**

```javascript
return (
  <div style={{ padding: 24, background: T.bg, minHeight: '100vh' }}>
    {/* ... TODO EL CONTENIDO EXISTENTE ... */}
    
    {/* AGREGAR ESTO AL FINAL, ANTES DEL CIERRE */}
    
    {/* Loading overlay */}
    {loading && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998
      }}>
        <LoadingSpinner mensaje="Procesando extracto PDF..." size={60} />
      </div>
    )}
    
    {/* Modal de confirmación */}
    <ModalConfirmacion />
  </div>
);
```

---

## 🎨 BONUS: Reemplazar inputs de monto (OPCIONAL)

Si querés mejorar también los inputs de monto, buscá líneas como:

```javascript
// ANTES:
<input 
  type="number" 
  value={monto} 
  onChange={e => setMonto(parseFloat(e.target.value))}
/>
```

**REEMPLAZAR con:**

```javascript
// DESPUÉS:
<InputNumerico
  value={monto}
  onChange={setMonto}
  min={0}
  decimales={0}
  prefijo="₲"
  placeholder="Ingrese monto"
/>
```

---

## ✅ VERIFICACIÓN

Después de hacer los cambios, guardá el archivo y:

1. **Reiniciá el servidor:**
   ```bash
   Ctrl + C
   npm run dev
   ```

2. **Probá la importación de PDF:**
   - Ir a módulo Bancos
   - Intentar importar un extracto
   - Debería mostrar loading spinner
   - Si hay errores, debería mostrarlos claramente

3. **Probá eliminar cuenta:**
   - Intentar eliminar una cuenta
   - Debería aparecer modal de confirmación
   - Cancelar → no debería eliminar
   - Confirmar → debería eliminar

---

## ⚠️ ERRORES COMUNES

**Error: "Cannot find module './pdfParserSeguro.js'"**
→ Verificá que el archivo esté en `src/` y que el nombre sea exacto

**Error: "pdfjsLib is not defined"**
→ Verificá que tengas `npm install pdfjs-dist` instalado

**Modal no aparece**
→ Verificá que agregaste `<ModalConfirmacion />` al final del return

---

## 📊 RESULTADO ESPERADO

**Antes de los cambios:**
- ❌ PDF falla → Pantalla blanca o error sin explicación
- ❌ Eliminar cuenta → Se borra sin preguntar

**Después de los cambios:**
- ✅ PDF falla → Mensaje claro: "Error: formato no reconocido"
- ✅ PDF escaneado → Advertencia: "PDF sin texto extraíble"
- ✅ PDF exitoso → Muestra estadísticas y advertencias
- ✅ Eliminar cuenta → Modal de confirmación

---

¿Necesitás ayuda con algún cambio específico? 🚀
