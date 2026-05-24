import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_func = '''def inicializar_tipo_cambio():
    import json
    from datetime import datetime
    tc_path = os.path.join(BASE_DIR, '..', 'database', 'master_tipo_cambio.json')
    if not os.path.exists(tc_path):
        return
    with open(tc_path, 'r', encoding='utf-8') as f:
        try:
            tc = json.load(f)
        except:
            tc = {}
    if tc.get('dolar_mercado', 0) == 0:
        tc['dolar_mercado'] = 6250
        tc['banda_piso'] = 6250 + 150
        tc['banda_techo'] = 6250 + 350
        tc['ultima_actualizacion'] = datetime.now().strftime('%Y-%m-%d')
        tc['actualizado_por'] = 'Sistema (default)'
        with open(tc_path, 'w', encoding='utf-8') as f:
            json.dump(tc, f, indent=2, ensure_ascii=False)

def run_facturador_app():
    inicializar_tipo_cambio()'''

content = content.replace('def run_facturador_app():', new_func)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Func added")
