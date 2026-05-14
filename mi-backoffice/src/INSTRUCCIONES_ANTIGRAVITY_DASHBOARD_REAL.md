# INSTRUCCIONES ANTIGRAVITY - INTEGRAR DASHBOARD REAL 2026

## ARCHIVO A MODIFICAR
`backoffice.jsx` (ubicado en `/mnt/user-data/outputs/`)

---

## CAMBIO 1: Importar DashboardReal2026
**Ubicación:** Línea ~8 (después de imports existentes)
**Acción:** AGREGAR esta línea
```javascript
import DashboardReal2026 from './DashboardReal2026.jsx';
```

---

## CAMBIO 2: Agregar ícono Calendar
**Ubicación:** Línea ~12 (en el import de lucide-react)
**Buscar:** `import { [lista de íconos] } from 'lucide-react';`
**Acción:** AGREGAR `Calendar` a la lista de íconos importados

**Ejemplo:**
```javascript
// ANTES:
import { TrendingUp, DollarSign, ... } from 'lucide-react';

// DESPUÉS:
import { TrendingUp, DollarSign, Calendar, ... } from 'lucide-react';
```

---

## CAMBIO 3: Agregar tab en menú lateral
**Ubicación:** Línea ~809 (en el array `tabs`)
**Buscar:** La sección donde están definidos los tabs del menú
**Acción:** AGREGAR este objeto al array de tabs (después de 'CargadorDocs' o al final)

```javascript
{
  id: 'real2026',
  label: 'Dashboard Real 2026',
  Icon: Calendar,
  desc: 'Datos reales cruzados Ene-Mar 2026'
},
```

---

## CAMBIO 4: Renderizar componente
**Ubicación:** Línea ~946 (en la sección de renderizado condicional)
**Buscar:** La zona donde se renderizan los componentes según `active`
**Acción:** AGREGAR esta línea (puede ser al final de los if/else de renderizado)

```javascript
{active === 'real2026' && <DashboardReal2026 />}
```

---

## VERIFICACIÓN
Después de hacer los cambios, verificar que:
1. ✅ El import está correcto (línea ~8)
2. ✅ Calendar está en los íconos de lucide-react (línea ~12)
3. ✅ El tab aparece en el menú lateral (línea ~809)
4. ✅ El componente se renderiza cuando se selecciona (línea ~946)

---

## ESTRUCTURA ESPERADA

```javascript
// Línea ~8
import DashboardReal2026 from './DashboardReal2026.jsx';

// Línea ~12
import { ..., Calendar, ... } from 'lucide-react';

// Línea ~809
const tabs = [
  { id: 'dashboard', label: 'Dashboard', ... },
  { id: 'finanzas', label: 'FinanzasPro', ... },
  // ... otros tabs ...
  { id: 'real2026', label: 'Dashboard Real 2026', Icon: Calendar, desc: 'Datos reales cruzados Ene-Mar 2026' },
];

// Línea ~946
{active === 'dashboard' && <Dashboard />}
{active === 'finanzas' && <FinanzasPro />}
// ... otros renderizados ...
{active === 'real2026' && <DashboardReal2026 />}
```

---

## ARCHIVOS RELACIONADOS
Los siguientes archivos deben estar en `/mnt/user-data/outputs/`:
- ✅ `DashboardReal2026.jsx` (componente creado)
- ✅ `backoffice.jsx` (archivo a modificar)

---

## NOTA
Si `DashboardReal2026.jsx` NO está en la misma carpeta que `backoffice.jsx`, ajustar la ruta del import en el CAMBIO 1.
