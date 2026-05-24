import os
import sys

BASE_DIR = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas'
sys.path.insert(0, BASE_DIR)
os.chdir(BASE_DIR)

# Mock Streamlit to prevent execution errors
import types
st_mock = types.ModuleType("streamlit")
st_mock.cache_data = lambda ttl=None: lambda f: f
sys.modules['streamlit'] = st_mock

with open('app.py', 'r', encoding='utf-8') as f:
    app_code = f.read()

exec_env = {'BASE_DIR': BASE_DIR, 'st': st_mock}
try:
    exec(app_code, exec_env)
except Exception as e:
    pass

clientes_mock = {
    'GRUPO VARGAS S.R.L': {
        'nombre': 'GRUPO VARGAS S.R.L',
        'aliases': ['JESSY LENS S.R.L', 'BRUPO VARGAS', 'JESSY LENS']
    },
    'JESSICA PORTILLO': {
        'nombre': 'JESSICA PORTILLO',
        'aliases': []
    }
}

buscar_cliente = exec_env.get('buscar_cliente')

print("Test 2 - Buscar 'JESSY':")
res1 = buscar_cliente('JESSY', clientes_mock)
for i, c in enumerate(res1):
    print(f" {i+1}. {c['nombre']}")

print("\nTest 3 - Buscar 'JESSICA':")
res2 = buscar_cliente('JESSICA', clientes_mock)
for i, c in enumerate(res2):
    print(f" {i+1}. {c['nombre']}")

