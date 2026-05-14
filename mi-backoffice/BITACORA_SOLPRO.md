# 📋 BITÁCORA — MASTER BACKOFFICE SOL PRO
**Empresa:** Sol Pro — Soluciones Profesionales (Asunción, Paraguay)  
**RUC:** 80102833-7  
**Proyecto:** mi-backoffice (React + Vite)  
**Ruta local:** `C:\Users\solpr\Desktop\mi-backoffice`  
**URL local:** http://localhost:5173  
**Última sesión:** 29 de abril de 2026

---

## 🚀 CÓMO ARRANCAR EL SISTEMA

```bash
cd Desktop\mi-backoffice
npm run dev
```
Luego abrí `http://localhost:5173` en el navegador.

**Arranque rápido:** Doble clic en `ARRANCAR_SOLPRO.bat` del escritorio.

**Primera vez:** `npm install pdfjs-dist` (requerido para módulo bancario)

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
mi-backoffice/
├── src/
│   ├── backoffice.jsx             ← Menú lateral, logo Sol Pro, 11 MÓDULOS
│   ├── main.jsx                   ← Entry point (importa BackOffice)
│   ├── FinanzasPro.jsx            ← Finanzas completo (5 tabs + Análisis)
│   ├── DashboardReal.jsx          ← Dashboard con datos reales y bandas v5.0
│   ├── DashboardReal2026.jsx      ← Dashboard Real 2026 (Ene-Mar) ← NUEVO
│   ├── VentasAnalytics.jsx        ← Analítica ventas (7 tabs) + Exportar CSV
│   ├── CalculadoraPrecios.jsx     ← Motor de precios v5.0 con UC/UV
│   ├── ConciliacionBancaria.jsx   ← Módulo bancario GS + USD ← NUEVO
│   ├── ImpositivoDNIT.jsx         ← Módulo impositivo DNIT ← NUEVO
│   ├── CargadorDocumentos.jsx     ← Módulo de carga de documentos local ← NUEVO
│   ├── App.css / index.css        ← No modificar
└── public/
    ├── BBDD_VENTAS_24_AL_26.csv                ← 2.388 registros de ventas reales
    ├── COMPRAS_SOL_CONTROL_2015_2026.csv       ← NUEVO
    ├── INSUMOS_TINTAS_SOLPRO_2026.csv          ← 85 tintas con lógica UC/UV
    ├── CATALOGO_SOLPRO_CON_COSTOS_2026.csv     ← 157 productos con costos
    └── LOGO SIN FONDO 2D REBRANDING...png      ← Logo Sol Pro
```

---

## ✅ MÓDULOS CONSTRUIDOS (10 en total)

### 1. Dashboard (datos simulados)
- KPIs: Ingresos YTD, Pedidos del mes, Valor inventario, Proveedores
- Gráfica Ingresos vs Gastos 2024
- Donut chart Ventas por Categoría
- Tabla Pedidos Recientes
- Alertas de Stock

### 2. Finanzas Pro — `FinanzasPro.jsx` (5 tabs)
**P&L:** Selector mes/año, ingresos manuales, KPIs, desglose egresos, gráfica anual, tabla 12 meses.

**Egresos y Gastos:** 7 categorías expandibles con ítems individuales (descripción + monto). Categorías: Gastos Fijos / Salarios / Compras Locales / Importaciones / Créditos / Marketing / Otros.

**IVA Mensual (4 sub-secciones):**
- **IVA Mensual:** carga manual + PDF F120 → extrae casillas 18, 44, 45, 58, 32+33+35+36
- **Resumen Anual:** semáforo PAGADO/PENDIENTE por mes
- **Historial de Pagos a la SET**
- **IRE Anual:** PDF F500 → extrae 15 casillas del Estado de Resultados completo

**Cuentas por Cobrar:** Registro de deudores con semáforo de vencimiento.

**Análisis Financiero:** Estado de Resultados comparativo 2023/2024/2025, gráficas interanuales, evolución mensual 2026 desde F120.

### 3. Inventario / 4. Pedidos
Stock con alertas CRÍTICO/BAJO/NORMAL. Pedidos con filtros y métricas.

### 5. Analítica Ventas — `VentasAnalytics.jsx` (7 tabs)
Tendencia, Estacionalidad, Comparativa, Categorías, Tintas & Stock, 📦 Compras, ⚖️ Stock & Rotación. Carga automática de BBDD_VENTAS + COMPRAS_SOL_CONTROL (2015-2026).

### 6. Dashboard Real
KPIs reales, Bandas USD, flujo mensual/trimestral/anual, Top 10 productos.

### 7. Calculadora de Precios v5.0
Motor Piso/Techo, márgenes por categoría, UC/UV, Vista Vendedor/Admin. Persiste en `localStorage` (solpro_catalogo_v1). Cargar: `CATALOGO_SOLPRO_CON_COSTOS_2026.csv`.

### 8. Bancos / Conciliación — `ConciliacionBancaria.jsx` v2 ← NUEVO (6 tabs)

**Migración:** `solpro_bancos_v1` → `solpro_bancos_v2` con 4 cuentas demo precargadas

**Bancos configurados:** Atlas, Ueno, FIC (GS + USD)

**🏦 Cuentas:** Registrar cuentas GS y USD, saldo calculado en tiempo real.

**💱 Tipo de Cambio BCP:** Registro diario TC BCP/Compra/Venta, KPIs (TC hoy, promedio mes, TC cierre), histórico tabular, base para revaluación USD. **NUEVO**

**📥 Importar Extracto:**
- Modo PDF con `pdfjs-dist` local, sin API externa
- Perfiles de banco configurables (Atlas, Ueno, FIC) con keywords personalizables
- Preview editable: corregir fechas/montos, eliminar filas
- Auto-categorización de comisiones
- Columna "SUGERIDO" con categorías auto-detectadas
- Muestra texto crudo del PDF para verificación

**⚖️ Conciliación:**
- Auto-Conciliar por monto (±1%)
- Conciliación manual con categorización
- Débitos/créditos sin match → registro contable automático
- USD: tipo de cambio → convierte a GS automáticamente

**🔄 Revaluación USD (cumplimiento DNIT):** Selector período mensual, cálculo saldo USD × TC cierre BCP, genera **asiento automático diferencia de cambio** (ganancia/pérdida), tabla detalle por cuenta. **NUEVO**

**📋 Movimientos:** Registro manual con moneda, TC y 11 categorías (incluye "Anticipos IRE" y "Diferencia de Cambio"). Badge REVAL distintivo.

**Estructura de perfiles de banco (keywords configurables):**
```javascript
{
  atlas: {
    nombre: 'Banco Atlas',
    color: '#0066cc',
    keywords_credito: ['ACRED', 'DEPOSITO', 'TRANSFERENCIA RECIBIDA'],
    keywords_debito: ['DEBITO', 'PAGO', 'COMISION', 'CARGO'],
    keywords_comision: ['COMISION', 'CARGO SERVICIO', 'MANTENIMIENTO']
  },
  ueno: { ... },
  fic: { ... }
}
```

**⚠️ PENDIENTE CRÍTICO:** Usuario debe subir 1 extracto PDF real de cada banco (Atlas, Ueno, FIC) para afinar parsers a formatos exactos.

### 9. Impositivo DNIT — `ImpositivoDNIT.jsx` ← NUEVO (6 tabs)

**Constantes fiscales implementadas:**
```javascript
CALENDARIO_PERPETUO: { 0:7, 1:9, 2:11, 3:13, 4:15, 5:17, 6:19, 7:21, 8:23, 9:25 }
TASAS: { IVA_GENERAL:10, IVA_REDUCIDO:5, IRE_GENERAL:10, IRE_SIMPLE:10, IRE_PRESUNTA:30, 
         IDU_RESIDENTES:8, IDU_NO_RESIDENTES:15 }
UMBRALES_IRE: { RESIMPLE_MAX:80M, SIMPLE_MAX:2.000M, GENERAL_MIN:2.000M }
ANTICIPOS: { UMBRAL_OBLIGATORIO:10M, CANTIDAD_CUOTAS:4, PORCENTAJE_CUOTA:25, 
             CODIGO_PAGO:'736', CODIGO_PAGO_GENERAL:'735' }
RETENCIONES_IVA: { MERCADO_INTERNO:30, AGRICOLAS:10, EXTERIOR:100, TARJETAS:0.9099, 
                   EXPORTADORES:30 }
RETENCIONES_IRE: { ESTADO:4, TARJETAS:1, PEQUEÑOS_PRODUCTORES:3, RECICLAJE:1.5, GANADO:0.4 }
IPS: { APORTE_OBRERO:9, APORTE_PATRONAL:16.5, TOTAL:25.5 }
LIMITES_DEDUCCION: { DONACIONES:1, PERDIDAS:20, INTERESES:30, IVA_AUTO:30 }
```

**📅 Calendario Perpetuo:** Calculadora automática vencimientos según último dígito RUC, tabla completa 0→día 7...9→día 25, ajuste automático fin de semana/feriado, vista mensual (IVA, IRE anual, anticipos). Ejemplo: RUC 80102833-7 → dígito 3 → día 13.

**💰 Anticipos IRE:** Calculadora automática promedio 3 años, detector OBLIGATORIO si >₲10M, 4 cuotas 25% cada una, deduce retenciones+saldo a favor, códigos pago 736 (SIMPLE)/735 (GENERAL), meses SIMPLE=abr/jun/ago/oct, GENERAL=may/jul/sep/nov. Ejemplo Sol Pro: promedio ₲11.719.745 → OBLIGATORIO.

**✓ Validador Gastos Deducibles:** Checklist interactivo 3 reglas oro (factura legal + necesario + real), resultado DEDUCIBLE/NO DEDUCIBLE, ejemplos por categoría (Laborales, Administrativos, Comercialización, Financieros), topes especiales (1% donaciones, 20% pérdidas, 30% intereses).

**📊 Régimen IRE:** Detector automático por facturación anual, RESIMPLE (≤₲80M cuota fija), SIMPLE (≤₲2.000M libros Excel), GENERAL (>₲2.000M balances completos), tabla comparativa. Ejemplo Sol Pro: ₲3.858M → IRE GENERAL.

**🔻 Retenciones:** Calculadora IVA (30% mercado, 10% agrícolas, 100% exterior, 0.9099% tarjetas) e IRE (4% Estado, 1% tarjetas, 3% pequeños productores), cálculo automático monto total → retención → a pagar al proveedor, tablas referencia rápida.

**📖 Constantes Fiscales:** Buscador de constantes, 4 grupos (Tasas impositivas, Umbrales IRE, IPS laboral, Anticipos IRE).

### 10. Cargador de Documentos — `CargadorDocumentos.jsx` ← NUEVO
- Módulo para la carga y gestión de archivos PDF y Excel locales.
- Integrado con el menú lateral mediante el ícono `FolderOpen`.

### 11. Dashboard Real 2026 — `DashboardReal2026.jsx` ← NUEVO
- Módulo enfocado en datos reales cruzados del periodo Enero-Marzo 2026.
- Integrado con el menú lateral mediante el ícono `Calendar`.

---

## 🏛 IMPUESTOS — CASILLAS PDF

**F120 (IVA):** casilla 18=ventas netas, 44/24=débito, 45/43=crédito, 58=saldo, 32+33+35+36=compras

**F500 (IRE):** casilla 77/78=ingresos, 80=costos, 82=renta bruta, 84=gastos deducibles, 103=renta neta, 106=base imponible, 120=impuesto, 113=anticipos, 123=saldo, 93=utilidad contable, 131=personal

**Datos SOLPRO 2025:** Ingresos ₲3.858M | Renta Bruta ₲302M (7.8%) | Renta Neta ₲153M (3.97%) | IRE ₲15.3M | Saldo ₲2.8M

---

## 🎨 LÓGICA UC/UV — TINTAS

| Modelo | Código | Uds/Caja | Color especial |
|---|---|---|---|
| F6470 | T53K | 2 (pack 2×1.6L) |  |
| F6470H Flúo | T53K720 | 2 | FLUO MAGENTA |
| F6470H Flúo | T53K820 | 2 | FLUO YELLOW |
| F6370 | T46C | 6 |  |
| F6200/F6070 | T741 | 6 |  |
| F170/F570 | T49M | 1 (140ml) |  |
| F10070 | T43M | 1 |  |

---

## 💰 POLÍTICA DE PRECIOS v5.0

```
Banda Piso  = USD + 150 pts  → Contado / QR
Banda Techo = USD + 350 pts  → Solo crédito industrial
Margen real = ganancia / precio (NO markup)
Comisión QR = 4%

COMERCIAL=30% / INDUSTRIAL=24% / INSUMOS=15% / ACCESORIOS=30%

≤₲389k: ceil(p/10k)*10k-1k | >₲389k: round(p/100k)*100k-10k
```

---

## 📊 ARCHIVOS CSV

| Archivo | Descripción | Dónde |
|---|---|---|
| `BBDD_VENTAS_24_AL_26.csv` | 2.388 ventas 2024-2026 | `public/` |
| `COMPRAS_SOL_CONTROL_2015_2026.csv` | 512 compras 2015-2026 categorizadas | `public/` |
| `CATALOGO_SOLPRO_CON_COSTOS_2026.csv` | 157 productos con costos | Cargar en Calculadora |
| `INSUMOS_TINTAS_SOLPRO_2026.csv` | 85 tintas con UC/UV | `public/` |

**Costos reales extraídos de:** `productos_maestros.csv`
- 93 productos en USD (Sol Control)
- 47 productos en GS (Todo Costura)

---

## 🏆 DATOS CLAVE DEL NEGOCIO

- **2024:** 929 unidades vendidas
- **2025:** 2.352 unidades vendidas (+153%)
- **2026 (parcial):** 301 unidades
- **Pico de ventas:** Julio–Septiembre 2025
- **Producto estrella #1:** Tinta EP F6470 T53K220 CYAN (432 uds = 12.1% del total)
- **Producto estrella #2:** Tinta EP F6470 T53K320 MAGENTA (250 uds)
- **Producto estrella #3:** IMP EPSON SURECOLOR F170 A4 (226 uds)
- **Proveedor principal:** Sol Control (productos en USD)
- **Proveedor secundario:** Todo Costura (productos en GS)
- **Facturación 2025:** ₲3.858.536.561 (IRE GENERAL)
- **Régimen IRE:** IRE GENERAL (>₲2.000M)
- **Anticipos IRE:** OBLIGATORIOS (promedio 3 años ₲11.719.745 >₲10M)

---

## ⚠️ PENDIENTES Y PRÓXIMOS PASOS

### Pendiente inmediata módulo bancario:
- [ ] **Subir extractos PDF reales** de Atlas, Ueno y FIC para afinar parsers
- [ ] **Validar TC BCP** para revaluación mensual USD
- [ ] **Primera conciliación real** con extractos de abril 2026

### Pendientes módulos tributarios:
- [ ] **Form 241 RG90** (Libro Ventas/Compras exportador)
- [ ] **IPS Calculadora completa** (salario bruto → líquido, desglose distribución)
- [ ] **Validador KuDE** (CDC 44 dígitos + QR + XML match)
- [ ] **Pre-validación DNIT API** (RUC + timbrado proveedores)

### Roadmap ERP completo:
1. **Facturación SIFEN + CxC Aging**
2. **Flujo de Caja proyectado 30/60/90**
3. **Compras y CxP**
4. **Control Inventario valorizado**
5. **Generador cotizaciones PDF**
6. **Login usuario/contraseña**
7. **Publicar en servidor**

### Mejoras técnicas pendientes:
- [ ] Hacer que la Calculadora guarde el tipo de cambio del día automáticamente
- [ ] Agregar gráfico de barras de colores en el tab Tintas & Stock
- [ ] Integrar el catálogo de costos directamente en el DashboardReal para calcular margen real por período

---

## 🔧 NOTAS TÉCNICAS

**Stack:** React 18 + Vite + Recharts + Lucide-react + pdfjs-dist  
**Fuentes:** Syne (títulos) + DM Sans (texto) + JetBrains Mono (numeros)  
**Colores principales:**
```
accent:  #f59e0b  (dorado Sol Pro)
green:   #34d399  (precios contado)
cyan:    #22d3ee  (UC/UV y datos)
purple:  #a78bfa  (precios QR)
red:     #f87171  (alertas)
bg:      #07080f  (fondo oscuro)
```

**localStorage keys utilizadas:**
- `solpro_finanzas_v1` (FinanzasPro)
- `solpro_catalogo_v1` (CalculadoraPrecios)
- `solpro_bancos_v2` (ConciliacionBancaria v2)

**Errores comunes y soluciones:**
- Error `Unterminated string` en CalculadoraPrecios.jsx → reemplazar el archivo completo desde la bitácora
- Error `Expected }` en NAV → verificar que el array tenga 10 items y cierre con `];`
- Error `Unexpected token >` en JSX → reemplazar `>` con `&gt;` en textos JSX
- Tab Tintas en blanco → usar componente separado `TabTintas`, no IIFE dentro de JSX
- PDF parser no funciona → instalar `npm install pdfjs-dist`

---

## 📝 HISTORIAL DE SESIONES

### Sesión 1 — 19 de abril de 2026
- Instalación de React + Vite en Windows
- Creación del backoffice base con 4 módulos
- Integración del logo Sol Pro
- Desarrollo de DashboardReal con datos reales del CSV de ventas
- Desarrollo de VentasAnalytics con 5 tabs incluyendo Tintas & Stock
- Desarrollo de CalculadoraPrecios v5.0 con motor de margen real
- Integración del catálogo de costos desde productos_maestros.csv (163 productos)
- Implementación de lógica UC/UV para tintas
- Generación de INSUMOS_TINTAS_SOLPRO_2026.csv con 85 tintas
- Múltiples correcciones de bugs (fontFamily, NAV duplicado, archivo truncado)
- Sistema funcionando al 100% con 7 módulos

### Sesión 2 — 21 de abril de 2026
- Desarrollo de FinanzasPro completo (5 tabs)
- Implementación P&L mensual con selector de mes/año
- Sistema de egresos con 7 categorías expandibles
- Parser PDF F120 (IVA) y F500 (IRE) con extracción automática de casillas
- Análisis Financiero con Estado de Resultados comparativo 2023-2025
- Backoffice actualizado a 8 módulos

### Sesión 3 — 22 de abril de 2026
- Desarrollo de VentasAnalytics v2 con 7 tabs
- Tab Compras (COMPRAS_SOL_CONTROL_2015_2026.csv)
- Tab Stock & Rotación con análisis de inventario
- Corrección bugs en parseo CSV de compras

### Sesión 4 — 24 de abril de 2026
- Desarrollo de ConciliacionBancaria v1
- Importación extractos PDF (Itaú, Continental, BCP, Sudameris)
- Auto-conciliación por monto
- Conciliación manual con categorización
- Sistema localStorage `solpro_bancos_v1`

### Sesión 5 — 26 de abril de 2026
**MÓDULOS BANCARIO E IMPOSITIVO v2**
- ConciliacionBancaria v2 (migración, perfiles, revaluación USD, BCP)
- ImpositivoDNIT (calendario, anticipos IRE, validador gastos, retenciones)
- Integración backoffice.jsx y correcciones JSX

### Sesión 6 — 29 de abril de 2026
**MÓDULO CARGADOR DE DOCUMENTOS**
- Creación/Integración de `CargadorDocumentos.jsx`
- Actualización de `backoffice.jsx`:
  - Importación de componente `CargadorDocumentos`
  - Importación de ícono `FolderOpen` de `lucide-react`
  - Nuevo ítem en `NAV`: "Cargar Documentos" (ID: `cargador`)
  - Renderizado condicional del nuevo módulo
- Verificación de integridad del menú (comas, llaves y corchetes)
- El sistema ahora cuenta con **10 módulos activos**

---

### Sesión 7 — 29 de abril de 2026 (Actual)
**DASHBOARD REAL 2026 Y MEJORAS ANALÍTICAS**
- Integración de `DashboardReal2026.jsx` en `backoffice.jsx`.
- Actualización de `VentasAnalytics.jsx`:
  - Implementación de función `exportarCSV` para descarga de datos.
  - Adición de botones "Actualizar" y "Exportar CSV" en la UI.
  - Corrección de variables de filtrado en Tabs Tintas/Stock.
- Gestión de datos:
  - Sincronización de `BBDD_VENTAS_24_AL_26.csv` desde `Documents` a `public/`.
  - Verificación de existencia de `COMPRAS_SOL_CONTROL_2015_2026.csv` en `public/`.
- El sistema ahora cuenta con **11 módulos activos**.

---

*Bitácora actualizada automáticamente — Sol Pro Backoffice v2.2*  
*Última actualización: 29 de abril de 2026 — Sesión 7*
