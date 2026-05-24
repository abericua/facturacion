import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix indentation of def buscar_cliente
content = content.replace('def buscar_cliente(query, clientes):', '    def buscar_cliente(query, clientes):')

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Indentation fixed")
