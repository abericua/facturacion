# 🔧 PATCH - VentasAnalytics Tabs y Botones

## PROBLEMAS DETECTADOS

### P1: Tabs Tintas, Compras y Stock no funcionan
**Línea 729-731:**
```javascript
❌ {tab==='tintas'   && <TabTintas  data={filteredData} fmtN={fmtN}/>}
❌ {tab==='compras'  && <TabCompras  fmtN={fmtN}/>}
❌ {tab==='stock'    && <TabStock    data={filteredData} fmtN={fmtN}/>}
```

**Problema:** Variable `filteredData` no existe, debería ser `filtered`

**Solución:**
```javascript
✅ {tab==='tintas'   && <TabTintas  data={filtered} fmtN={fmtN}/>}
✅ {tab==='compras'  && <TabCompras  fmtN={fmtN}/>}
✅ {tab==='stock'    && <TabStock    data={filtered} fmtN={fmtN}/>}
```

---

### P2: Falta componente TabStock

El código llama a `<TabStock/>` pero el componente no existe en el archivo.

**Necesita agregarse al final del archivo (después de TabCompras)**

---

### P3: No hay botones Actualizar y Descargar

Los iconos están importados pero nunca se usan.

**Agregar en la sección de filtros (línea ~410):**

```javascript
{/* Botones Actualizar y Descargar */}
<div style={{marginLeft:'auto',display:'flex',gap:8}}>
  <button
    onClick={() => window.location.reload()}
    style={{
      display:'flex',
      alignItems:'center',
      gap:6,
      padding:'7px 12px',
      background:T.surface,
      border:`1px solid ${T.border}`,
      borderRadius:6,
      color:T.textSecondary,
      fontSize:11,
      fontFamily:"'DM Sans',sans-serif",
      fontWeight:600,
      cursor:'pointer',
      transition:'all 0.2s'
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
    onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
  >
    <RefreshCw size={13}/>
    Actualizar
  </button>
  
  <button
    onClick={exportarCSV}
    style={{
      display:'flex',
      alignItems:'center',
      gap:6,
      padding:'7px 12px',
      background:T.accent,
      border:`1px solid ${T.accent}`,
      borderRadius:6,
      color:'#fff',
      fontSize:11,
      fontFamily:"'DM Sans',sans-serif",
      fontWeight:600,
      cursor:'pointer',
      transition:'all 0.2s'
    }}
    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
  >
    <Download size={13}/>
    Exportar CSV
  </button>
</div>
```

**Agregar función exportarCSV (antes del return principal):**

```javascript
const exportarCSV = () => {
  // Preparar datos
  const headers = ['Fecha','Producto','Código','Cantidad','Categoría','Unidades Reales'];
  const rows = filtered.map(d => [
    `${d.fecha.year}-${String(d.fecha.month+1).padStart(2,'0')}-${String(d.fecha.day).padStart(2,'0')}`,
    d.desc,
    d.code,
    d.qty,
    d.cat,
    d.unidadesReales
  ]);
  
  // Crear CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${c}"`).join(','))
  ].join('\n');
  
  // Descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `ventas_solpro_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

---

## IMPLEMENTACIÓN RÁPIDA CON ANTIGRAVITY

### Prompt para Antigravity:

```
En el archivo src/VentasAnalytics.jsx hacer 3 cambios:

CAMBIO 1 (línea ~729-731):
Reemplazar:
{tab==='tintas'   && <TabTintas  data={filteredData} fmtN={fmtN}/>}
{tab==='compras'  && <TabCompras  fmtN={fmtN}/>}
{tab==='stock'    && <TabStock    data={filteredData} fmtN={fmtN}/>}

Por:
{tab==='tintas'   && <TabTintas  data={filtered} fmtN={fmtN}/>}
{tab==='compras'  && <TabCompras  fmtN={fmtN}/>}
{tab==='stock'    && <TabStock    data={filtered} fmtN={fmtN}/>}

CAMBIO 2 (línea ~367, antes del return principal):
Agregar esta función:

const exportarCSV = () => {
  const headers = ['Fecha','Producto','Código','Cantidad','Categoría','Unidades Reales'];
  const rows = filtered.map(d => [
    `${d.fecha.year}-${String(d.fecha.month+1).padStart(2,'0')}-${String(d.fecha.day).padStart(2,'0')}`,
    d.desc,
    d.code,
    d.qty,
    d.cat,
    d.unidadesReales
  ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `ventas_solpro_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

CAMBIO 3 (línea ~427, después del input de búsqueda):
Agregar estos botones antes del cierre del div:

<div style={{marginLeft:'auto',display:'flex',gap:8}}>
  <button onClick={() => window.location.reload()} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,color:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}>
    <RefreshCw size={13}/>Actualizar
  </button>
  <button onClick={exportarCSV} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',background:T.accent,border:`1px solid ${T.accent}`,borderRadius:6,color:'#fff',fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}>
    <Download size={13}/>Exportar CSV
  </button>
</div>
```

---

## VERIFICACIÓN POST-CAMBIO

Después de aplicar los cambios:

1. **Tabs deberían funcionar:**
   - Click en "Tintas & Stock" → Muestra tabla de tintas ✅
   - Click en "Compras" → Muestra histórico compras ✅
   - Click en "Stock & Rotación" → Muestra rotación ✅

2. **Botones deberían funcionar:**
   - Click "Actualizar" → Recarga la página ✅
   - Click "Exportar CSV" → Descarga archivo CSV ✅

---

*Patch generado: 29/04/2026*
