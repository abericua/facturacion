import os
import sys
import json
from datetime import datetime, date

BASE_DIR = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas'
sys.path.insert(0, BASE_DIR)
os.chdir(BASE_DIR)

import types
st_mock = types.ModuleType("streamlit")
st_mock.cache_data = lambda ttl=None: lambda f: f
st_mock.error = print
st_mock.stop = sys.exit
st_mock.session_state = type('obj', (object,), {
    'factura_items': [{"cant": 1, "desc": "Product A", "precio": 50000, "codigo": "COD1", "total": 50000}]
})()
sys.modules['streamlit'] = st_mock

exec_env = {'BASE_DIR': BASE_DIR, 'st': st_mock, 'OUTPUT_DIR': 'Facturas_Emitidas'}
with open('app.py', 'r', encoding='utf-8') as f:
    app_code = f.read()

try:
    exec(app_code, exec_env)
except:
    pass

try:
    inventory_log = [{"COD_PRODUCTO": "COD1", "_CANT_NUM": 1}]
    # Simulate es_sena = False logic
    is_valid, error_msg = exec_env['validate_stock'](inventory_log)
    print("validate_stock result:", is_valid, error_msg)
except Exception as e:
    import traceback
    traceback.print_exc()

