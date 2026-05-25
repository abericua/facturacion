@echo off
title Sistema de Facturacion SOLPRO
echo Iniciando el sistema de facturacion...
cd /d "C:\Users\beric\OneDrive\Desktop\SGSP"
set SYSTEM_PEPPER=SOLPRO_ULTRA_SECRET_2026_#!
set SGSP_DATABASE=C:\Users\beric\OneDrive\Desktop\SGSP\database
"C:\Users\beric\AppData\Local\Python\bin\python.exe" -m streamlit run app.py
pause
