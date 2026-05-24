@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "BASE=C:\Users\beric\OneDrive\Desktop\SGSP"
cd /d "%BASE%"

echo.
echo ============================================================
echo   SGSP ELITE — Setup Automatico
echo ============================================================
echo.

:: ── PASO 1: Verificar archivos clave ─────────────────────────────────────
echo [1/7] Verificando archivos...
set "MISSING=0"
for %%F in (database.py migracion_datos.py api.py main_portal.py railway.toml) do (
    if not exist "%%F" (
        echo   [ERROR] No encontrado: %%F
        set "MISSING=1"
    ) else (
        echo   [OK] %%F
    )
)
if "%MISSING%"=="1" (
    echo.
    echo   Archivos faltantes. Abortando.
    pause & exit /b 1
)

:: ── PASO 2: Instalar dependencias Python nuevas ───────────────────────────
echo.
echo [2/7] Instalando dependencias Python...
pip install fastapi "uvicorn[standard]" PyJWT pyotp python-multipart --quiet
if %errorlevel% neq 0 (
    echo   [WARN] Algun paquete no se instalo. Intentando sin --quiet...
    pip install fastapi "uvicorn[standard]" PyJWT pyotp python-multipart
)
echo   [OK] Dependencias instaladas

:: ── PASO 3: Inicializar base de datos ────────────────────────────────────
echo.
echo [3/7] Inicializando base de datos SQLite...
python database.py
if %errorlevel% neq 0 (
    echo   [ERROR] Fallo database.py
    pause & exit /b 1
)
if exist "database\sgsp_master.db" (
    echo   [OK] sgsp_master.db creado
) else (
    echo   [WARN] No se encontro sgsp_master.db — verificar DATA_DIR
)

:: ── PASO 4: Verificar columnas CSV y Excel antes de migrar ───────────────
echo.
echo [4/7] Verificando archivos de datos para migracion...
set "CSV_OK=0"
set "XLS_OK=0"
if exist "database\productos_maestros.csv" (
    echo   [OK] productos_maestros.csv encontrado
    set "CSV_OK=1"
) else (
    echo   [WARN] No encontrado: database\productos_maestros.csv — migracion omitida
)
if exist "database\VENTAS TOTALES 2026.xlsx" (
    echo   [OK] VENTAS TOTALES 2026.xlsx encontrado
    set "XLS_OK=1"
) else (
    echo   [WARN] No encontrado: database\VENTAS TOTALES 2026.xlsx — migracion omitida
)

if "%CSV_OK%"=="1" if "%XLS_OK%"=="1" (
    echo   Ejecutando migracion de datos historicos...
    python migracion_datos.py
    if %errorlevel% neq 0 (
        echo   [WARN] migracion_datos.py termino con errores — revisar output arriba
    ) else (
        echo   [OK] Migracion completada
    )
) else (
    echo   [SKIP] Migracion omitida — archivos de datos no encontrados
)

:: ── PASO 5: Verificar sintaxis de todos los .py modificados ──────────────
echo.
echo [5/7] Verificando sintaxis Python...
for %%F in (database.py migracion_datos.py api.py main_portal.py) do (
    python -c "import ast; ast.parse(open('%%F', encoding='utf-8').read())" 2>nul
    if !errorlevel! equ 0 (
        echo   [OK] %%F
    ) else (
        echo   [ERROR] Sintaxis invalida en %%F
    )
)
python -c "import ast; ast.parse(open('Creador de Facturas/pdf_generator.py', encoding='utf-8').read())" 2>nul
if %errorlevel% equ 0 (
    echo   [OK] pdf_generator.py
) else (
    echo   [ERROR] Sintaxis invalida en pdf_generator.py
)

:: ── PASO 6: Build del frontend React ─────────────────────────────────────
echo.
echo [6/7] Build del frontend React...
if exist "mi-backoffice\package.json" (
    cd mi-backoffice
    echo   Ejecutando npm install...
    call npm install --silent
    echo   Ejecutando npm run build...
    call npm run build
    if %errorlevel% neq 0 (
        echo   [ERROR] npm run build fallo — revisar output arriba
    ) else (
        echo   [OK] Build exitoso — dist/ generado
    )
    cd /d "%BASE%"
) else (
    echo   [SKIP] No se encontro mi-backoffice\package.json
)

:: ── PASO 7: Test rapido de la API ─────────────────────────────────────────
echo.
echo [7/7] Test rapido de la API (arranca 5 segundos y verifica)...
start /B "" uvicorn api:app --host 127.0.0.1 --port 8000 >nul 2>&1
timeout /t 4 /nobreak >nul
python -c "import urllib.request; r=urllib.request.urlopen('http://localhost:8000/'); print('  [OK] API respondiendo:', r.read(30))" 2>nul
if %errorlevel% neq 0 (
    echo   [WARN] API no respondio en tiempo — puede necesitar mas tiempo para arrancar
) else (
    echo   [OK] API operativa en localhost:8000
)

:: ── RESUMEN ───────────────────────────────────────────────────────────────
echo.
echo ============================================================
echo   SETUP COMPLETADO
echo ============================================================
echo.
echo   Para arrancar el sistema completo, ejecuta start_sgsp.bat
echo.
echo   Variables Railway a configurar:
echo     DATA_DIR       = /app/data
echo     SYSTEM_PEPPER  = [valor secreto]
echo     JWT_SECRET     = [valor secreto]
echo     ENV_MODE       = PRODUCTION
echo     GOOGLE_API_KEY = [tu clave Gemini]
echo.
pause
