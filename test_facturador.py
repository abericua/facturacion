import os
import sys

BASE_DIR = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas'
sys.path.insert(0, BASE_DIR)

import app

# Test 1: load_clients
clients = app.load_clients()
print(f"Loaded {len(clients)} clients.")
matches = app.buscar_cliente('JESSY LENS', clients)
print("Matches for 'JESSY LENS':", [m['nombre'] for m in matches])

# Test 2: load_products
df = app.load_products()
print(f"Loaded {len(df)} products.")
print("Sample product:", df.iloc[0].to_dict() if len(df) > 0 else "None")

# Test 3: registrar_pedido (Contado)
import datetime
test_venta = {
    'es_sena': False,
    'cliente': 'Test Client',
    'id_cliente_solpro': 'CLI-TEST',
    'fecha': datetime.datetime.now().isoformat(),
    'vendedor': 'Admin',
    'total': 100000,
    'forma_pago': 'CONTADO',
    'nro_factura': '001-001-0000001',
    'items': [{
        'id_solpro': df.iloc[0]['id_solpro'] if len(df) > 0 else 'PROD-TEST',
        'descripcion': 'Test Product',
        'cantidad': 1,
        'precio': 100000,
        'costo': 50000
    }]
}
id_pedido = app.registrar_pedido(test_venta)
app.descontar_stock(test_venta['items'])
print(f"Registered contado pedido: {id_pedido}")

# Test 4: registrar_pedido (Sena)
test_sena = test_venta.copy()
test_sena['es_sena'] = True
test_sena['monto_sena'] = 30000
test_sena['tipo_doc'] = 'Recibo interno'
id_sena = app.registrar_pedido(test_sena)
app.reservar_stock(test_sena['items'])
print(f"Registered sena pedido: {id_sena}")

