@echo off
title Sistema de Facturacion SOLPRO
echo Iniciando el sistema de facturacion...
cd /d "C:\Users\solpr\Desktop\Creador de Facturas"
streamlit run app.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo Ocurrio un error al iniciar el programa.
    echo Asegurate de tener Streamlit instalado.
    pause
)
