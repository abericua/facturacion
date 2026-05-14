# 📊 DASHBOARD REAL 2026 - GUÍA DE INTEGRACIÓN

## 🎯 OBJETIVO

Crear un dashboard que muestre la **realidad financiera 2026** cruzando datos de múltiples fuentes:
- ✅ Ventas reales (CSV)
- ✅ Compras reales (CSV/Excel)
- 🔄 IVA declarado vs calculado (IndexedDB)
- 🔄 Flujo de caja bancario (IndexedDB)

---

## 📋 FASE 1: INSTALACIÓN BÁSICA (HOY - 10 MIN)

### **PASO 1: Copiar archivo**
```bash
Origen: DashboardReal2026.jsx
Destino: C:\Users\solpr\Desktop\mi-backoffice\src\
```

### **PASO 2: Agregar al menú**

Editar `backoffice.jsx`:

**Import (línea ~8):**
```javascript
import DashboardReal2026 from './DashboardReal2026.jsx';
```

**Agregar al array NAV (línea ~800):**
```javascript
{id:'real2026', label:'Dashboard Real 2026', Icon:Calendar, desc:'Datos reales cruzados'},
```

**Agregar ícono (línea ~12):**
```javascript
import { 
  // ... otros iconos
  Calendar  // ← AGREGAR
} from "lucide-react";
```

**Renderizado (línea ~945):**
```javascript
{active==='real2026' && <DashboardReal2026/>}
```

### **PASO 3: Copiar archivos CSV a public/**

```bash
Copiar:
- BBDD_VENTAS_24_AL_26.csv
- COMPRAS_SOL_CONTROL_2015_2026.csv

A:
C:\Users\solpr\Desktop\mi-backoffice\public\
```

### **PASO 4: Reiniciar y probar**
```bash
npm run dev
```

Navegá a **"Dashboard Real 2026"** en el menú.

---

## 📊 QUÉ MUESTRA AHORA (FASE 1)

### **KPIs Principales:**
```
✅ Ventas Reales 2026:    XXX unidades (desde CSV)
✅ Compras Reales 2026:   XXX unidades (desde CSV)
✅ Margen Real:           X.XX% (ventas - compras)
✅ Balance:               XXX unidades
```

### **Gráfica Principal:**
```
✅ Ventas vs Compras mes a mes 2026
   - Área verde: Ventas
   - Área cyan: Compras
```

### **Secciones Pendientes:**
```
⚠️ IVA Declarado vs Real: Muestra "—" (falta integración)
⚠️ Flujo de Caja: Muestra "—" (falta integración)
```

---

## 🔄 FASE 2: INTEGRAR IVA Y BANCOS (PRÓXIMA SEMANA)

### **Objetivo:** Completar el cruce de datos

### **CAMBIO 1: Integrar IVA desde IndexedDB**

**En DashboardReal2026.jsx (línea ~43):**

```javascript
// Reemplazar:
// const iva = await DB.obtenerTodoIVA();

// Por:
import DB from './db.js';

const cargarDatosReales = async () => {
  // ... código existente ...
  
  // 3. Cargar IVA desde IndexedDB
  const ivaData = [];
  for (let mes = 0; mes < 12; mes++) {
    const periodo = `2026-${String(mes + 1).padStart(2, '0')}`;
    const iva = await DB.obtenerIVA(periodo);
    if (iva) {
      ivaData.push({
        mes,
        periodo,
        declarado: parseFloat(iva.datos.debito_fiscal) || 0,
        credito: parseFloat(iva.datos.credito_fiscal) || 0
      });
    }
  }
  
  setDatos({ ventas, compras, iva: ivaData, bancos: [] });
};
```

### **CAMBIO 2: Integrar movimientos bancarios**

```javascript
// 4. Cargar movimientos bancarios desde IndexedDB
const bancosData = [];
const cuentas = await DB.obtenerTodasCuentas();

for (const cuenta of cuentas) {
  const movs = await DB.obtenerMovimientos(cuenta.id);
  const movs2026 = movs.filter(m => {
    const fecha = new Date(m.fecha);
    return fecha.getFullYear() === 2026;
  });
  
  bancosData.push(...movs2026.map(m => ({
    fecha: new Date(m.fecha),
    monto: parseFloat(m.monto),
    tipo: m.tipo, // 'ingreso' o 'egreso'
    cuenta: cuenta.nombre
  })));
}

setDatos({ ventas, compras, iva: ivaData, bancos: bancosData });
```

### **CAMBIO 3: Calcular IVA Real**

Agregar función en el componente:

```javascript
const calcularIVARealVentas = (ventasMes, tasaIVA = 0.10) => {
  // Asumiendo que ventas son con IVA incluido
  const totalVentas = ventasMes * precioPromedioVenta; // Definir precio promedio
  const ivaReal = totalVentas * (tasaIVA / (1 + tasaIVA));
  return ivaReal;
};
```

### **CAMBIO 4: Calcular Flujo de Caja**

```javascript
const flujoMensual = useMemo(() => {
  return Array(12).fill(0).map((_, mes) => {
    const ingresosBancos = datos.bancos
      .filter(m => m.fecha.getMonth() === mes && m.tipo === 'ingreso')
      .reduce((s, m) => s + m.monto, 0);
      
    const egresosBancos = datos.bancos
      .filter(m => m.fecha.getMonth() === mes && m.tipo === 'egreso')
      .reduce((s, m) => s + m.monto, 0);
    
    return {
      mes: MESES[mes],
      ingresos: ingresosBancos,
      egresos: egresosBancos,
      neto: ingresosBancos - egresosBancos
    };
  });
}, [datos.bancos]);
```

---

## 📈 FASE 3: ANÁLISIS AVANZADO (2 SEMANAS)

### **Features adicionales:**

1. **Gráfica Facturado vs Cobrado**
   - Línea verde: Ventas facturadas
   - Línea cyan: Ingresos bancarios
   - Área roja: CxC pendiente

2. **Alerta de Diferencias**
   - Si IVA declarado < IVA real → Advertencia
   - Si CxC > 30% ventas → Alerta de cobranza

3. **Proyección 2026**
   - Basado en tendencia ene-abr
   - Estimar cierre de año
   - Comparar con meta

4. **Export a Excel**
   - Botón "Descargar Reporte"
   - Excel con todas las tablas
   - Gráficas incluidas

---

## 🎨 MEJORAS DE UI (FUTURO)

### **Filtros:**
- Selector de período (Trim 1, Trim 2, etc)
- Filtro por tipo de producto
- Vista comparativa 2025 vs 2026

### **Alertas Inteligentes:**
```
⚠️ Tu margen real (X%) está por debajo del objetivo (Y%)
⚠️ CxC acumulado: ₲XXX (Z días promedio)
⚠️ Diferencia IVA: ₲XXX a favor/contra
```

### **Gráficas Adicionales:**
- Rotación de inventario
- Días de cobranza
- Días de pago a proveedores
- Cash conversion cycle

---

## 💡 RECOMENDACIONES

### **Datos a Completar:**

1. **Precio promedio de venta**
   - Necesario para calcular monto en ₲ desde unidades
   - Obtener de Calculadora Precios o VentasAnalytics

2. **Costo promedio de compra**
   - Necesario para calcular monto en ₲
   - Obtener de facturas de compras

3. **IVA mensual 2026**
   - Cargar F120 de ene-abr 2026
   - Usar CargadorDocumentos

4. **Extractos bancarios 2026**
   - Cargar PDFs de ene-abr 2026
   - Usar ConciliacionBancaria

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### **Hoy:**
- [ ] Copiar DashboardReal2026.jsx a src/
- [ ] Agregar al menú de backoffice.jsx
- [ ] Copiar CSVs a public/
- [ ] Reiniciar servidor
- [ ] Verificar que carga ventas/compras

### **Esta semana:**
- [ ] Cargar F120 enero-abril 2026
- [ ] Cargar extractos bancarios 2026
- [ ] Integrar IVA en dashboard
- [ ] Integrar movimientos bancarios

### **Próxima semana:**
- [ ] Calcular precios promedio
- [ ] Implementar gráfica Facturado vs Cobrado
- [ ] Agregar alertas automáticas
- [ ] Testing completo

---

## 🚀 RESULTADO ESPERADO

Una vez completado, tendrás un dashboard que te muestra:

```
✅ REALIDAD vs DECLARADO en tiempo real
✅ Margen REAL calculado desde tus datos
✅ Flujo de caja efectivo (no contable)
✅ Alertas de diferencias y pendientes
✅ Proyección de cierre 2026
```

**Esto te permitirá:**
- 📊 Tomar decisiones basadas en datos reales
- 💰 Ver dónde está realmente tu dinero
- ⚠️ Detectar problemas antes de que sean críticos
- 📈 Proyectar el año con datos confiables

---

*Guía generada para Sol Pro Backoffice v2.2 - Dashboard Real 2026*
