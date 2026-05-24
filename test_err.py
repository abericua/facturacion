import os
import sys

BASE_DIR = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas'
sys.path.insert(0, BASE_DIR)
os.chdir(BASE_DIR)

import types
st_mock = types.ModuleType("streamlit")
st_mock.cache_data = lambda ttl=None: lambda f: f
sys.modules['streamlit'] = st_mock

exec_env = {'BASE_DIR': BASE_DIR, 'st': st_mock}
with open('app.py', 'r', encoding='utf-8') as f:
    app_code = f.read()

try:
    exec(app_code, exec_env)
except Exception as e:
    import traceback
    traceback.print_exc()

