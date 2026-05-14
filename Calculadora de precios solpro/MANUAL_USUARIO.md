# MANUAL DE USUARIO: CALCULADORA DE PRECIOS SOLPRO v30.0

![SOLPRO LOGO](ISOLOGO%20NUEVO%202026%20SOLPRO.png) 

## 1. INTRODUCCIÓN
La **Calculadora de Precios Solpro v30.0** es la herramienta oficial de gestión comercial de la empresa. Su objetivo es estandarizar el cálculo de costos, proteger el capital de reposición ante la volatilidad del dólar y garantizar que todos los vendedores manejen la misma lista de precios oficial.

---

## 2. FUNDAMENTOS: LA REGLA DE ORO
El sistema opera bajo el principio de **Blindaje Financiero**. "El dólar del mercado NO es nuestro dólar de costo".

### Bandas de Protección:
*   **BANDA PISO (Dólar Mercado + 150 pts):** Se utiliza para calcular el "Costo Real de Reposición". Es la base para los precios de **Contado** y **Digital (QR)**.
*   **BANDA TECHO (Dólar Mercado + 350 pts):** Se utiliza exclusivamente para la **Línea Industrial** en ventas a crédito, protegiendo la deuda contra devaluaciones futuras.

---

## 3. ARQUITECTURA DE PRECIOS AL PÚBLICO
El sistema calcula automáticamente tres niveles de precios:

1.  **PRECIO CONTADO (Base):** Aplicable a efectivo y transferencias inmediatas. No admite descuentos adicionales.
2.  **PRECIO DIGITAL (QR / Tarjeta):** Incluye un recargo de gestión del **4%**. Permite que a la caja de Solpro ingrese el valor neto del contado tras la comisión de la procesadora.
3.  **PRECIO FINANCIADO:** Exclusivo para maquinaria industrial. Bloqueado automáticamente para insumos y línea comercial.

---

## 4. PROTOCOLO DE REDONDEO (EFECTO 90)
Para mantener una estética comercial premium y proteger los márgenes, el sistema aplica automáticamente el **Redondeo Solpro**:

*   **En Guaraníes (Gs):** Se redondea al 100.000 más cercano y se restan 10.000. 
    *   *Ejemplo:* 2.570.000 → **2.590.000** | 2.540.000 → **2.490.000**.
*   **En Dólares (USD):**
    *   *Máquinas (>100):* Redondeo al 100 más cercano - 10. (Ej: 5.170 → **5.190**).
    *   *Insumos (<100):* Redondeo a la decena más cercana - 1. (Ej: 34 → **29**).

---

## 5. GUÍA DE USO (PASO A PASO)

### A. Inicio de Jornada
1. Abra el archivo `calculadora_precios.html`.
2. Ingrese el **Dólar Mercado** del día en el panel superior.
3. El sistema recalculará instantáneamente toda la base de datos.
4. Presione **"💾 Guardar Configuración"** para que los valores queden fijos para el resto del día.

### B. Gestión de Productos
*   **Auditoría:** Use la columna **"COSTO BASE"** para verificar que los costos y monedas sean correctos.
*   **Edición:** Presione el icono del lápiz (**✏️**) para corregir costos, cambiar nombres o ajustar la moneda (USD/GS) de un ítem.
*   **Nuevos Productos:** Use el panel izquierdo para cargar productos. El sistema sugerirá un **ID REF** automático según el proveedor.

### C. Armado de Combos
El sistema detecta automáticamente los componentes de un combo por su nombre (separados por el signo **+**). Aplica el **Protocolo de Normalización de Moneda**: convierte ítems USD a GS usando la Banda Piso antes de sumar los costos locales.

---

## 5. EXPORTACIÓN PARA VENDEDORES
Para distribuir la lista oficial:
1. Haga clic en **"📥 Exportar Lista Oficial"**.
2. Se generará un archivo CSV con el título **"LISTA DE PRECIOS DE VENTA"**.
3. El archivo incluye la fecha, la cotización usada y los precios finales con el formato correcto (`Gs. 9.000` / `U$D 9.0`).

---

## 6. MANTENIMIENTO Y SEGURIDAD
*   **Backup:** Los cambios se guardan localmente en su navegador. Se recomienda exportar la lista diariamente como respaldo.
*   **Bitácora:** Consulte el archivo `BITACORA.md` para conocer el historial técnico de cambios del sistema.

---
**Aprobado por Gerencia General**  
*Edición Mayo 2026 - Protocolo de Seguridad Financiera Solpro*
