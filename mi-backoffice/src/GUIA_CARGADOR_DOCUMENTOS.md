# 📁 INTEGRACIÓN CARGADOR DE DOCUMENTOS

## 🎯 OBJETIVO

Integrar tus carpetas locales con documentos DNIT y facturas de compras al backoffice de Sol Pro.

---

## 📂 CARPETAS A INTEGRAR

### 1. **DOCUMENTOS DNIT**
- **Ubicación:** `C:\Users\solpr\Desktop\mi-backoffice\DOCUMENTOS DNIT`
- **Contenido:** PDFs de declaraciones IVA (F120) y Renta (F500)
- **Uso:** Cargar automáticamente al módulo Finanzas

### 2. **FACTURAS DE COMPRAS SOLPRO**
- **Ubicación:** `C:\Users\solpr\Desktop\mi-backoffice\FACTURAS DE COMPRAS SOLPRO`
- **Contenido:** Archivos Excel con registros de compras por año
- **Uso:** Integrar al análisis de compras

---

## 🔧 INSTALACIÓN

### **PASO 1: Copiar archivo**
```
Copiar: CargadorDocumentos.jsx
A:      C:\Users\solpr\Desktop\mi-backoffice\src\
```

### **PASO 2: Agregar al menú del backoffice**

Abrí `backoffice.jsx` y hacé estos cambios:

**1. Import (línea ~8):**
```javascript
import CargadorDocumentos from './CargadorDocumentos.jsx';
```

**2. Agregar al array NAV (línea ~800):**
```javascript
{id:'cargador', label:'Cargar Documentos', Icon:FolderOpen, desc:'DNIT y Compras'},
```

**3. Import del ícono (línea ~12):**
```javascript
import {
  //... otros iconos
  FolderOpen,  // ← AGREGAR ESTE
} from "lucide-react";
```

**4. Renderizado (línea ~935):**
```javascript
{active==='cargador' && <CargadorDocumentos onDocumentosCargados={handleDocumentosCargados}/>}
```

**5. Agregar handler (dentro del componente BackOffice):**
```javascript
const handleDocumentosCargados = async (data) => {
  console.log('Documentos cargados:', data);
  
  if (data.tipo === 'dnit') {
    // Procesar PDFs F120/F500
    for (const doc of data.documentos) {
      console.log(`Procesando ${doc.formulario}: ${doc.nombre}`);
      // Aquí se puede integrar con FinanzasPro
    }
  } else if (data.tipo === 'compras') {
    // Procesar Excel de compras
    for (const doc of data.documentos) {
      console.log(`Procesando compras ${doc.anio}: ${doc.nombre}`);
      // Aquí se puede integrar con VentasAnalytics
    }
  }
};
```

---

## 🎯 CÓMO USAR

### **Opción A: Carga Manual (Recomendada)**

1. Navegá al módulo "Cargar Documentos" en el menú
2. **Sección DNIT:**
   - Click en "Seleccionar PDFs F120/F500"
   - Navegá a `DOCUMENTOS DNIT`
   - Seleccioná todos los PDFs (Ctrl+A)
   - Click "Abrir"

3. **Sección Compras:**
   - Click en "Seleccionar archivos Excel"
   - Navegá a `FACTURAS DE COMPRAS SOLPRO`
   - Seleccioná todos los Excel (Ctrl+A)
   - Click "Abrir"

4. Los archivos se procesarán automáticamente

---

## 📊 QUÉ HACE EL SISTEMA

### **Con PDFs F120 (IVA):**
- ✅ Detecta el mes y año del documento
- ✅ Extrae automáticamente las casillas fiscales
- ✅ Guarda en IndexedDB con el PDF completo
- ✅ Lo hace disponible en FinanzasPro → IVA Mensual

### **Con PDFs F500 (Renta):**
- ✅ Detecta el año de declaración
- ✅ Extrae Estado de Resultados completo
- ✅ Guarda en IndexedDB
- ✅ Lo hace disponible en FinanzasPro → IRE Anual

### **Con Excel de Compras:**
- ✅ Detecta el año del archivo
- ✅ Lee todas las filas (proveedores, montos, fechas)
- ✅ Integra con el análisis de compras
- ✅ Lo hace disponible en VentasAnalytics → Compras

---

## 🔄 INTEGRACIÓN AUTOMÁTICA (Futuro)

En una versión futura, el sistema podrá:
1. **Escanear automáticamente** las carpetas al iniciar
2. **Detectar nuevos archivos** cuando los agregues
3. **Sincronizar automáticamente** con IndexedDB
4. **Notificar** cuando haya nuevos documentos

---

## 💡 BENEFICIOS

**Antes:**
- ❌ Archivos dispersos en carpetas
- ❌ Hay que buscarlos manualmente
- ❌ No están integrados al sistema
- ❌ Se pierden al limpiar caché

**Después:**
- ✅ Todo centralizado en el backoffice
- ✅ Acceso inmediato desde el menú
- ✅ Integrado con análisis financiero
- ✅ Respaldo en IndexedDB

---

## ⚠️ NOTAS IMPORTANTES

1. **Nomenclatura de archivos:**
   - F120: Incluir "F120", "IVA" o mes en el nombre
   - F500: Incluir "F500", "RENTA" o año en el nombre
   - Compras: Incluir el año (2023, 2024, etc)

2. **Formatos soportados:**
   - PDFs: `.pdf`
   - Excel: `.xlsx`, `.xls`

3. **Tamaño máximo:** 10 MB por archivo

4. **Almacenamiento:** Los archivos se guardan en IndexedDB (hasta 1 GB total)

---

## 🧪 TESTING

1. Cargá 1 PDF F120 → Debería detectar "F120 (IVA)" y el período
2. Cargá 1 PDF F500 → Debería detectar "F500 (Renta)" y el año
3. Cargá 1 Excel de compras → Debería detectar el año
4. Verificá en la lista que aparezcan correctamente

---

## 📈 PRÓXIMOS PASOS

Una vez cargados los documentos, podés:

1. **Ver resumen en Dashboard** con datos reales
2. **Analizar tendencias** en VentasAnalytics → Compras
3. **Revisar declaraciones** en FinanzasPro → IVA/IRE
4. **Exportar reportes** con toda la información consolidada

---

*Guía generada para Sol Pro Backoffice v2.1*
