# Instrucciones del Proyecto

Este archivo contiene las convenciones y flujos de trabajo específicos para este repositorio.

## 🚀 Protocolo Automático de Inicio
Al iniciar cualquier sesión de chat, DEBES ejecutar de inmediato estos pasos en tu primer turno:
1. **Recuperar Contexto:** Leer `SOLPRO_MEMORIA.md`.
2. **Verificar LM Studio:** Comprobar silenciosamente si LM Studio está activo ejecutando `Invoke-RestMethod -Uri "http://localhost:1234/v1/models"`. Si falla, debes detenerte y pedirle al usuario que abra LM Studio.
3. **Verificar AI Bridge:** Comprobar si `app_bridge.py` está en el puerto 5005. Si no está corriendo, levántalo ejecutando `py app_bridge.py` en segundo plano dentro de `C:\Users\beric\OneDrive\Desktop\SGSP\mi-backoffice\`.

## 🧠 Equipo de Trabajo (Multi-Agente)
- **Gemini CLI (Antigravity):** Arquitecto de software y ejecutor principal.
- **Claude Code:** Especialista en refactorización, UI y lógica avanzada.
- **Gemma 4 (Local):** Auditor de seguridad y lógica (vía LM Studio/Bridge).
- **Usuario:** Dirección estratégica.

## 📈 Constantes Financieras SOLPRO (2026)
Para cualquier cálculo en el Dashboard (`main_portal.py`, `FinanzasPro.jsx`):
- **CMV:** 81.9%
- **Gastos Operativos:** 8.1%
- **Utilidad Neta:** 10.0%

## 🎨 Estándares Estéticos
- **Estilo:** Glassmorphism (translucidez y blur).
- **Fuentes:** Syne (títulos), DM Sans / Inter (cuerpo).

## Convenciones de Desarrollo
- Usar español para la comunicación y documentación.
- Seguir el flujo de Investigación -> Estrategia -> Ejecución.
- Consultar siempre `SOLPRO_MEMORIA.md` para el estado actual de las tareas.
