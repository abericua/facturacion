@echo off
title Sistema de Facturacion SOLPRO
echo Iniciando el sistema de facturacion...
cd /d "%~dp0"
"C:\Users\beric\AppData\Local\Python\bin\python.exe" -m streamlit run app.py
pause
