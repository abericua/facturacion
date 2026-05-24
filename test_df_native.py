import os
import sys
import pandas as pd
import json

BASE_DIR = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas'
sys.path.insert(0, os.path.join(BASE_DIR, '..', 'Calculadora de precios solpro'))
from calcular_precio_final import calcular

master_path = os.path.join(BASE_DIR, '..', 'database', 'master_productos.json')
tc_path = os.path.join(BASE_DIR, '..', 'database', 'master_tipo_cambio.json')
with open(tc_path, 'r') as f: tc = json.load(f)
dolar_mercado = tc.get('dolar_mercado', 0) or 7350

productos = []
with open(master_path, 'r', encoding='utf-8') as f: prods = json.load(f)
for p in prods:
    if not p.get('activo', True): continue
    precios = calcular(p['costo'], p['moneda_costo'], p['margen_pct'], p['linea'], dolar_mercado=dolar_mercado)
    productos.append({
        'id_solpro': p.get('id_solpro',''),
        'CODIGO': p.get('ids_externos', {}).get('id_maestro', p.get('id_solpro','')),
        'DESCRIPCION': p['nombre_canonico'],
        'LINEA': p['linea'],
        'PRECIO_CONTADO': precios['precio_contado'],
        'PRECIO_QR': precios['precio_qr'],
        'PRECIO_CREDITO': precios['precio_credito'],
        'CREDITO_BLOQUEADO': precios['credito_bloqueado'],
        'STOCK': p.get('stock_disponible',0),
        'MONEDA': p['moneda_costo'],
        'BANDA_PISO': precios['banda_piso'],
        'COSTO': p['costo'],
        'MARGEN_PCT': p['margen_pct']
    })

df = pd.DataFrame(productos)
pd.set_option('display.max_columns', None)
print(df.head(3))
