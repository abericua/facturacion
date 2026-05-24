import os
import sys

BASE_DIR = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas'
sys.path.insert(0, BASE_DIR)
os.chdir(BASE_DIR)

from pdf_generator import generate_invoice_pdf

pdf_data = {
    "nro_factura": "TEST-123", "fecha": "22/05/2026",
    "nombre": "Test Client", "ruc": "123456", "direccion": "Test Address", "telefono": "123456",
    "condicion": "CONTADO", "moneda": "PYG",
    "productos": [{"c": 1, "d": "Test Product", "p": 100000, "t": 100000}]
}
pdf_path = "test_gen.pdf"

try:
    generate_invoice_pdf(pdf_data, pdf_path)
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()

