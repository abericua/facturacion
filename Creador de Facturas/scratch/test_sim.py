import sys
from datetime import datetime

# Simulamos las variables
moneda = "PYG"
total_factura = 3500000
nombre = "TEST CLIENTE"
nro_factura = "0502"
vendedor = "ALBERTO"
condicion = "CONTADO"

# Simulamos st.session_state.factura_items
factura_items = [
    {"cant": 12, "desc": "SC-120 TEXTIL", "precio": 100000, "codigo": "SC-120", "total": 1200000},
    {"cant": 4, "desc": "SC-121 TEXTIL", "precio": 100000, "codigo": "SC-121", "total": 400000},
]

inventory_log = []
descripciones = []
codigos = []

for it in factura_items:
    descripciones.append(f"{it['cant']} {it['desc']}")
    if it.get('codigo'):
        codigos.append(str(it['codigo']))
        
    inventory_log.append({
        "COD_PRODUCTO": it.get('codigo', ''),
        "_CANT_NUM": it['cant']
    })

sales_log = [{
    "FECHA": datetime.now(),
    "DESCRIPCION": ", ".join(descripciones),
    "CLIENTE": nombre,
    "PRECIO GS": total_factura if moneda == "PYG" else None,
    "PRECIO USD": total_factura if moneda == "USD" else None,
    "NRO_FACTURA": nro_factura,
    "VENDEDOR": vendedor,
    "FORMA PAGO": condicion,
    "COD_PRODUCTO": ", ".join(codigos),
    "LINEA": "CORP"
}]

print("--- SALES LOG GENERADO ---")
import json
def default_converter(o):
    if isinstance(o, datetime):
        return o.isoformat()
print(json.dumps(sales_log, indent=2, default=default_converter))

print("\n--- INVENTORY LOG GENERADO ---")
print(json.dumps(inventory_log, indent=2))
