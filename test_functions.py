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
# We'll just extract the functions we need by executing the file in the env
try:
    exec(app_code, exec_env)
except Exception as e:
    pass # we might hit UI code errors, but functions might be defined

# TEST 1 & 2
try:
    clients = exec_env['load_clients']()
    print("TEST 1: Loaded", len(clients), "clients")
except Exception as e: print("TEST 1 ERROR:", e)

try:
    df_prods = exec_env['load_products']()
    print("TEST 2: Loaded", len(df_prods), "products")
except Exception as e: print("TEST 2 ERROR:", e)

# TEST 3: CONTADO
try:
    test_venta = {
        'es_sena': False,
        'cliente': 'Test Client',
        'fecha': '2026-05-22',
        'total': 100000,
        'nro_factura': '001-001-001',
        'items': [{'id_solpro': 'P001', 'id_producto_solpro': 'P001', 'cantidad': 1, 'precio': 100000, 'descripcion': 'Prod'}]
    }
    exec_env['registrar_pedido'](test_venta)
    exec_env['descontar_stock'](test_venta['items'])
    print("TEST 3: Venta Contado simulated successfully")
except Exception as e: print("TEST 3 ERROR:", e)

# TEST 4: SENA
try:
    test_sena = test_venta.copy()
    test_sena['es_sena'] = True
    test_sena['monto_sena'] = 30000
    exec_env['registrar_pedido'](test_sena)
    exec_env['reservar_stock'](test_sena['items'])
    print("TEST 4: Venta Seña simulated successfully")
except Exception as e: print("TEST 4 ERROR:", e)
