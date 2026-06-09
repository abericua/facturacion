# 🧠 MEMORIA DE TRABAJO SOLPRO - Actualizado 1 de Junio 2026

## 🎯 Estado del Proyecto (Sincronizado con SGSP Root)
El sistema ha evolucionado significativamente con un enfoque en **Seguridad (Protocolo 007)**, **Persistencia en la Nube (Railway)** y **Estabilidad Operativa**.

### ✅ Hitos Críticos de Mayo 2026
1.  **Seguridad & Autenticación (Protocolo 007):**
    *   Implementación de `SYSTEM_PEPPER` y SHA-256 para contraseñas.
    *   Doble factor de autenticación (2FA) obligatorio con reset de emergencia vía código maestro `007007`.
    *   Eliminación de login inseguro por parámetros de URL.
2.  **Infraestructura & Nube:**
    *   Configuración de **Railway Volume** (`/app/data`) para persistencia real de bases de datos y facturas emitidas.
    *   Lógica de "Bootstrap Inteligente" para evitar pérdida de datos al reiniciar el contenedor.
3.  **Lógica de Negocio & Stock:**
    *   **Validación de Stock en Tiempo Real:** Prevención de *Race Conditions* en ventas simultáneas.
    *   **Anulaciones Inteligentes:** Restauración automática de stock mediante `RAW_ITEMS` (JSON) en el Excel de ventas.
    *   **Regeneración de PDFs:** Capacidad de reconstruir facturas antiguas con coordenadas exactas (`x=550, y=490`).
4.  **UI/UX:**
    *   Diseño Responsivo (Mobile-Friendly) implementado en formularios y carritos.
    *   Integración nativa de la **Calculadora Solpro Elite v35.2** dentro del portal.

### 📋 Pendientes Críticos
- Monitorear la sincronización entre el volumen de Railway y el repositorio local.
- Validar la integridad del `SYSTEM_PEPPER` en nuevas migraciones de usuarios.

## 🤖 Notas entre Agentes (Handoff)
- **Gemini CLI:** He movido el protocolo a la raíz `SGSP/`. He escaneado las bitácoras y `main_portal.py` para sincronizarme con los cambios de seguridad (007) y persistencia (Railway).
- **Claude:** Fix aplicado en `app.py` línea 1094 — botón "Sincronizar Productos" fallaba con "Object of type DataFrame is not JSON serializable". Solución: `json.loads(df.to_json(orient='records'))` para convertir tipos numpy a Python nativos. Commit `4687ea4` pusheado por Gemini. `app_bridge.py` no existe en el proyecto — Gemini lo confirmó. El bridge real es `routes_bridge.py`.
- **Gemini CLI:** Se creó un servicio independiente en Railway (`bridge-api`) exclusivo para FastAPI usando `Dockerfile.api`. La URL base se actualizó a `https://facturacion-production-3916.up.railway.app` en `sync_service.py` y `mi-backoffice/.env`.
- **Claude (2026-06-03):** El ImportadorCompras / CargadorDocumentos / ConciliacionBancaria fallaban al "leer PDF". Causa real: NO era lectura de PDF (el texto se extrae en el navegador con pdf.js). El error `invalid x-api-key` venía de `api.anthropic.com` reenviado por el proxy `/api/bridge/anthropic/messages` → la `ANTHROPIC_API_KEY` en Railway estaba inválida (una key nueva tampoco funcionó, probable falta de billing/créditos en la cuenta Anthropic). **Decisión del usuario: migrar a Gemini.** Refactoricé `routes_bridge.py` → el endpoint `/anthropic/messages` ahora es un proxy LLM multi-proveedor (`proxy_llm`): si existe `GEMINI_API_KEY` (o `LLM_PROVIDER=gemini`) traduce el payload Anthropic→Gemini (`generateContent`) y devuelve la respuesta en shape Anthropic (`content:[{text}]`), así el frontend YA compilado no necesita cambios ni rebuild. Anthropic queda como fallback. **PENDIENTE en Railway:** setear `GEMINI_API_KEY` (y opcional `GEMINI_MODEL`, default `gemini-2.0-flash`) en el servicio `bridge-api` y redeploy.
- **Antigravity (2026-06-03):** Cambios de Claude en `routes_bridge.py` verificados, commiteados y pusheados (commit `41278421`). El `.git/index.lock` trabado fue eliminado. Railway detectó el cambio y está corriendo un deploy nuevo en el servicio `bridge-api`. El proxy LLM con soporte nativo para Gemini ya está en producción.
- **Claude (2026-06-09):** Fix en `ImportadorCompras.jsx` línea ~253 — error `Expected ',' or '}' after property value in JSON at position 290` al procesar PDFs kuDE (ej: `CC14019-00100100049295-50.pdf`). Causa: Gemini vía proxy devuelve JSON con sintaxis inválida (trailing commas, texto extra, números con separador paraguayo `7.650.000`). Solución: parsing en 3 intentos — (1) `JSON.parse` directo, (2) extracción del bloque `{...}` más externo con regex, (3) sanitización de problemas comunes del LLM (trailing commas, `True/False/None`, números con puntos como miles). **Requiere rebuild del frontend** (`npm run build` en `mi-backoffice/`).

## 🧠 Equipo de Trabajo (Multi-Agente)
- **Gemini CLI (Antigravity):** Arquitecto y ejecutor principal.
- **Claude Code:** Especialista en refactorización y UI avanzada.
- **Gemma 4 (Local):** Auditor de seguridad vía Bridge (:5005).
- **Usuario:** Dirección estratégica.

## 🗺️ Mapa de URLs y Rutas (FUENTE DE VERDAD)

> ⚠️ Antes de tocar cualquier endpoint, consultá esta sección.

### Servidor Railway (Backend)
- **Host Original:** `https://solpro-master-tec-production.up.railway.app`
- **Host Nuevo (bridge-api):** `https://facturacion-production-3916.up.railway.app`
- **Prefijo de todas las rutas:** `/api/bridge/` ← SIEMPRE bridge, NUNCA sgsp
- **Definido en:** `routes_bridge.py` línea 36

### Endpoints disponibles
| Método | Ruta | Desde | Descripción |
|--------|------|-------|-------------|
| GET | `/api/bridge/status` | JS + PY | Health check |
| GET | `/api/bridge/ventas` | JS | Ventas |
| GET | `/api/bridge/compras` | JS | Compras |
| GET | `/api/bridge/productos` | JS + PY | Leer productos CSV |
| GET | `/api/bridge/iva/{anio}` | JS | IVA por año |
| GET | `/api/bridge/dashboard/resumen` | JS | Resumen financiero |
| POST | `/api/bridge/compras/sync` | JS | Push compras |
| POST | `/api/bridge/iva/sync` | JS | Push IVA |
| POST | `/api/bridge/productos/sync` | JS + PY | Push productos CSV |
| POST | `/api/bridge/ventas/upload` | JS | Upload ventas |
| POST | `/api/bridge/anthropic/messages` | JS | Proxy seguro a Anthropic (CORS Fix) |
### Constantes de URL por archivo
| Archivo | Variable | Valor correcto |
|---------|----------|----------------|
| `sync_service.py` | `API_BASE_URL` | `...railway.app/api/bridge` |
| `mi-backoffice/src/SyncBridge.js` | `BRIDGE_URL` | `...railway.app` (sin prefijo, se agrega por ruta) |

### Frontend
- **Producción:** `https://facturacion.solpropy.com` (UI, no API)
- **Local React:** `http://localhost:5173` o `5174`
- **Local Streamlit:** `http://localhost:8501`

---

## 📈 Constantes Financieras SOLPRO (2026)
- **CMV:** 81.9%
- **Gastos Operativos:** 8.1%
- **Utilidad Neta:** 10.0%

