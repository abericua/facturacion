
### v7.9.10 - SGSP SYNC API v1.0 ?? - 23/05/2026

**Sincronización Cloud Realizada por Antigravity:**
- **Nuevos Modelos y Endpoints**: Implementación de models_sgsp.py y outes_sgsp.py en el backend Railway para recibir Pedidos, Pagos, Clientes, Productos y Tipo de Cambio.
- **Integración en main.py**: Se añadieron las rutas de sgsp_router y la creación de tablas con checkfirst=True, preservando la lógica de IA y Auth intactas.
- **Sincronización en Facturador Local**: Creación de sync_service.py con envío asíncrono vía httpx. Los envíos son silenciosos para no bloquear el flujo local.
- **Reglas CORS**: Añadidos los dominios locales y en producción (acturacion.solpropy.com) a ALLOWED_ORIGINS.
