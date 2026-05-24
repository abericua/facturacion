@echo off
chcp 65001 >nul
set "BASE=C:\Users\beric\OneDrive\Desktop\SGSP"
cd /d "%BASE%"

echo.
echo ============================================================
echo   SGSP ELITE — Iniciando sistema local
echo ============================================================
echo.

:: Setear entorno LOCAL
set ENV_MODE=LOCAL
set DATA_DIR=%BASE%\database

echo [1/3] Iniciando FastAPI en puerto 8000...
start "SGSP API" cmd /k "cd /d %BASE% && uvicorn api:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/3] Iniciando Streamlit en puerto 8501...
start "SGSP Portal" cmd /k "cd /d %BASE% && streamlit run main_portal.py --server.port 8501"

timeout /t 4 /nobreak >nul

echo [3/3] Abriendo navegador...
start "" "http://localhost:8501"

echo.
echo   API     -> http://localhost:8000
echo   Docs    -> http://localhost:8000/docs
echo   Portal  -> http://localhost:8501
echo.
echo   Cerrar las ventanas de terminal para detener el sistema.
echo.
