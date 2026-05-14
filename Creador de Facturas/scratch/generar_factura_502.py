import os
import sys

# Añadir el directorio actual al path para poder importar pdf_generator
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pdf_generator import generate_invoice_pdf

base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
output_dir = os.path.join(base_path, "Facturas_Emitidas")
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

output_path = os.path.join(output_dir, "Factura_0502_Regenerada_FINAL.pdf")

# Preparamos los datos con la info de la factura 502
data = {
    "nro_factura": "0502",
    "fecha": "05/05/2026",
    "nombre": "TECNOTEXTIL E.A.S",
    "ruc": "",  # No sale en el reporte, puedes dejarlo vacío
    "direccion": "",
    "telefono": "",
    "condicion": "CONTADO",
    "moneda": "PYG",
    "productos": [
        {"c": 12, "d": "SC-120", "p": 882965, "t": 10595580},
        {"c": 4, "d": "SC-121", "p": 882965, "t": 3531860},
        {"c": 4, "d": "SC-122", "p": 882965, "t": 3531860}
    ]
}

# Generar
print(f"Generando PDF en {output_path}...")
generate_invoice_pdf(data, output_path)
print("¡PDF generado con éxito!")
