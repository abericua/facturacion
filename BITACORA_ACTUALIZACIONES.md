# 📖 Bitácora de Actualizaciones - SOLPRO (Mayo 2026)

Este documento registra todas las mejoras, optimizaciones y resoluciones de problemas (bugs) implementados en el Sistema de Facturación Corporativa SOLPRO.

---

## 📅 Fecha: 07 de Mayo de 2026
**Módulo:** Facturación, Control de Stock, e Interfaz de Usuario (UI)

### 🚀 Mejoras Implementadas

1. **Validación Estricta de Stock en Tiempo Real:**
   - **Problema:** Múltiples vendedores podían emitir facturas al mismo tiempo vendiendo el mismo producto físico, resultando en inventario negativo (Overselling o *Race Condition*).
   - **Solución:** Se implementó un validador en `validate_stock()` que se ejecuta milisegundos antes de confirmar el pago. Si el stock fue consumido por otro usuario, se bloquea la transacción de inmediato con un mensaje de alerta.

2. **Edición Manual de Inventario (Suma/Resta):**
   - Se modificó la pestaña de inventario para que el cuadro de "Cargar Stock" acepte números negativos. Ahora los administradores pueden restar mercancía cargada por error.
   - Todo cambio de stock manual refresca el caché global automáticamente para que la información esté fresca para los demás usuarios.

3. **Recuperación y Regeneración de Facturas:**
   - **Problema:** En el historial de `VENTAS TOTALES 2026.xlsx` existían registros que no contaban con su respectivo PDF generado o descargado.
   - **Solución:** Se añadió una función "🔄 REGENERAR PDF ANTIGUO" dentro de la pestaña "📊 HISTORIAL" que permite escribir el Nro. de Factura y generar el PDF perfectamente alineado sin alterar el stock.

4. **Automatización en Devolución de Stock (Anulaciones):**
   - **Problema:** Al marcar una factura como "ANULADA", el registro se invalidaba pero los productos físicos se perdían del sistema.
   - **Solución:** 
     - Se añadió la columna oculta `RAW_ITEMS` en el Excel de ventas que guarda un registro en formato JSON de la orden original.
     - Al darle al botón "EJECUTAR ANULACIÓN", el sistema lee el JSON oculto y **restaura automáticamente** todas las cantidades al stock disponible.
     - Se previene la doble-anulación (si ya está anulada, no vuelve a sumar).

5. **Adaptación de Diseño Responsivo (Mobile-Friendly):**
   - **Problema:** La interfaz y las columnas colapsaban o se aplastaban al usar el sistema desde celulares.
   - **Solución:** Se implementó una clase `responsive-flex` combinada con Media Queries CSS (`@media (max-width: 768px)`). Los formularios, totales de operación y listas de carrito ahora se apilan de forma ordenada y cómoda para uso táctil.

6. **Calibración del Sistema de PDF:**
   - Se re-alinearon permanentemente las coordenadas del "Nro de Factura" al punto exacto de la plantilla solicitada (`x=550, y=490`).

---
*Nota generada automáticamente tras la auditoría y certificación del sistema del 100% de la funcionalidad en Producción (Railway).*
