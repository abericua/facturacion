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

## 📅 Fecha: 14 de Mayo de 2026
**Módulo:** Seguridad (Hardening), Autenticación y Control Administrativo

### 🚀 Mejoras de Seguridad y Control (Auditoría 007)

1.  **Eliminación de Vulnerabilidad de Login por URL:**
    *   Se eliminó la capacidad de iniciar sesión mediante parámetros `?u=` y `?p=` en la URL, previniendo el robo de credenciales vía historial de navegación o logs.

2.  **Fortalecimiento de Contraseñas (Salting & Peppering):**
    *   Implementación de `SYSTEM_PEPPER`. Las contraseñas ahora se almacenan con un hash reforzado, protegiéndolas contra ataques de tablas arcoíris.
    *   Se incluyó una lógica de migración automática para usuarios existentes.

3.  **Autenticación de Dos Factores (2FA):**
    *   Integración obligatoria con **Google Authenticator**. Cada inicio de sesión requiere ahora un código TOTP de 6 dígitos.
    *   Generación automática de códigos QR para la configuración inicial de nuevos usuarios.

4.  **Control de Acceso Basado en Roles (RBAC) para Anulaciones:**
    *   **Restricción:** Los vendedores ahora solo tienen permiso para anular facturas que ellos mismos emitieron.
    *   **Permiso Maestro:** El administrador mantiene la capacidad de anular cualquier registro del sistema.

5.  **Panel de Edición Maestra (Admin Only):**
    *   Se habilitó una herramienta de corrección en la pestaña "HISTORIAL" exclusiva para administradores.
    *   Permite corregir: Fecha de emisión, cliente, reasignación de vendedor y montos totales (GS/USD) de facturas ya emitidas.

6.  **Actualización de Infraestructura:**
    *   Sincronización de dependencias en `requirements.txt` (`pyotp`, `qrcode`) para soportar las nuevas capas de seguridad.

---
*Nota: Sistema certificado bajo el protocolo de seguridad 007. Listo para despliegue en producción.*
