# 🔧 CAMBIOS EXACTOS PARA CALCULADORAPRECIOS.JSX

## PASO 1: Agregar import de DB

**Al inicio del archivo:**
```javascript
import DB from './db.js';
```

## PASO 2: Eliminar código localStorage

**Buscar y COMENTAR:**
```javascript
const STORAGE_KEY = 'solpro_catalogo_v1';
const loadCatalogo = () => { ... };
const saveCatalogo = (productos) => { ... };
```

## PASO 3: Modificar carga inicial

**Buscar:**
```javascript
const [productos, setProductos] = useState(() => loadCatalogo());
```

**Reemplazar por:**
```javascript
const [productos, setProductos] = useState([]);
```

**Agregar useEffect:**
```javascript
useEffect(() => {
  cargarCatalogoInicial();
}, []);

async function cargarCatalogoInicial() {
  const catalogo = await DB.obtenerCatalogo('productos');
  if (catalogo && catalogo.productos) {
    setProductos(catalogo.productos);
  }
}
```

## PASO 4: Auto-guardar al cargar CSV

**Buscar la función que procesa el CSV (probablemente `procesarCSV` o `cargarCSV`):**

**Después de parsear el CSV y antes de setProductos:**
```javascript
async function procesarCSV(file) {
  // ... código existente de parseo ...
  
  const productosParseados = [...]; // array de productos
  
  // Guardar en IndexedDB
  await DB.guardarCatalogo('productos', productosParseados);
  
  // Actualizar estado
  setProductos(productosParseados);
}
```

## PASO 5: Auto-guardar al modificar producto

**Si hay una función para editar productos manualmente:**

```javascript
async function actualizarProducto(index, productoModificado) {
  const nuevosProductos = [...productos];
  nuevosProductos[index] = productoModificado;
  
  // Guardar en IndexedDB
  await DB.guardarCatalogo('productos', nuevosProductos);
  
  setProductos(nuevosProductos);
}
```

## PASO 6: Auto-guardar configuración de TC

**Si guardas el tipo de cambio USD:**

```javascript
async function guardarTipoCambio(tc) {
  await DB.guardarConfig('tipo_cambio_usd', tc);
  setTipoCambio(tc);
}

// Al cargar
useEffect(() => {
  const cargarTC = async () => {
    const config = await DB.obtenerConfig('tipo_cambio_usd');
    if (config) setTipoCambio(config.valor);
  };
  cargarTC();
}, []);
```

---

## ⚡ RESUMEN DE CAMBIOS

Total de modificaciones: **6 cambios**

1. ✅ Import DB
2. ✅ Comentar código localStorage
3. ✅ Modificar useState inicial
4. ✅ Agregar useEffect para carga
5. ✅ Auto-guardar al cargar CSV
6. ✅ Auto-guardar al modificar productos

---

## 🧪 CÓMO PROBAR

1. Reemplazar archivo
2. Reiniciar servidor
3. Ir a Calculadora de Precios
4. Cargar catálogo CSV
5. Abrir DevTools → Application → IndexedDB → solpro_database → catalogos
6. Deberías ver el catálogo guardado con tipo='productos'

---

*Patch generado para CalculadoraPrecios.jsx*
