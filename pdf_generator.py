"""
SGSP — Generador de PDFs de Factura
Módulo: pdf_generator.py

Contiene DOS funciones:
  1. generate_invoice_pdf(data, output_path)
     → Original: recibe dict con datos ya armados. Compatible con app.py actual.

  2. generate_invoice_pdf_from_db(factura_id, output_path)
     → Nueva (determinista): lee directamente de SQLite por FacturaID.
        Usa cuando el sistema esté migrado a la BD relacional.
"""

import os
import sqlite3
from reportlab.pdfgen import canvas
from num2words import num2words

# ── Rutas fijas: calculadas desde la ubicación de ESTE archivo ────────────
DIRECTORIO_ACTUAL = os.path.dirname(os.path.abspath(__file__))
RUTA_PLANTILLA    = os.path.join(DIRECTORIO_ACTUAL, "factura solpro 2026.png")

# BD para la función nueva
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(DIRECTORIO_ACTUAL), "database"))
DB_PATH  = os.path.join(DATA_DIR, "sgsp_master.db")

# Tamaño de página: coincide con el PNG de plantilla (no A4 estándar)
PAGE_W = 2362 * 0.28
PAGE_H = 2180 * 0.28


# ── Helpers compartidos ────────────────────────────────────────────────────
def format_money(val, moneda):
    if moneda == "PYG":
        return f"{val:,.0f}".replace(",", ".")
    else:
        return f"{val:,.2f}"


def numero_a_letras(n, moneda):
    if moneda == "PYG":
        return f"TOTAL A PAGAR: {num2words(int(n), lang='es').upper()} GUARANIES.-"
    else:
        entero  = int(n)
        decimal = int(round((n - entero) * 100))
        return f"TOTAL A PAGAR: {num2words(entero, lang='es').upper()} CON {decimal:02d}/100 DOLARES AMERICANOS.-"


def _dibujar_canvas(c, data, moneda):
    """
    Dibuja todos los campos sobre el canvas.
    data debe tener:
        nro_factura, fecha, condicion, nombre, ruc,
        telefono, direccion, productos, moneda
    Cada item de productos: {c, d, p, t}
    """
    # Plantilla de fondo
    if os.path.exists(RUTA_PLANTILLA):
        c.drawImage(RUTA_PLANTILLA, 0, 0, width=PAGE_W, height=PAGE_H)

    # CABECERA
    c.setFont("Helvetica-Bold", 14)
    c.drawString(550, 490, data['nro_factura'])

    c.setFont("Helvetica", 11)
    c.drawString(190, 456, data['fecha'])
    x_cond = 533 if data['condicion'] == "CONTADO" else 601
    c.drawString(x_cond, 456, "X")

    c.drawString(220, 436, data['nombre'].upper())
    c.drawString(120, 416, data['ruc'])
    c.drawString(470, 416, data['telefono'])
    c.drawString(120, 396, data['direccion'].upper())

    # PRODUCTOS
    y         = 345
    total_suma = 0

    for p in data['productos']:
        c.setFont("Helvetica", 10)
        c.drawCentredString(35,  y, f"{float(p['c']):g}")
        c.drawString(73,         y, p['d'])
        c.drawRightString(405,   y, format_money(float(p['p']), moneda))
        c.drawRightString(615,   y, format_money(float(p['t']), moneda))
        total_suma += float(p['t'])
        y -= 18.5

    # TOTALES
    c.setFont("Helvetica", 10)
    c.drawRightString(615, 100, format_money(total_suma, moneda))
    c.drawRightString(615, 82,  format_money(total_suma, moneda))

    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(615, 63, format_money(total_suma, moneda))

    c.setFont("Helvetica", 8)
    palabras = numero_a_letras(total_suma, moneda).replace("TOTAL A PAGAR: ", "")
    c.drawString(40, 63, palabras)

    iva_10 = total_suma / 11
    c.setFont("Helvetica", 10)
    c.drawRightString(445, 50, format_money(iva_10, moneda))
    c.drawRightString(615, 50, format_money(iva_10, moneda))

    c.save()


# ── FUNCION 1 — ORIGINAL (compatible con app.py actual) ──────────────────
def generate_invoice_pdf(data, output_path):
    """
    Genera PDF de factura a partir de un diccionario de datos.
    Mantiene compatibilidad total con app.py.
    """
    moneda = data.get('moneda', 'PYG')
    c = canvas.Canvas(output_path, pagesize=(PAGE_W, PAGE_H))
    _dibujar_canvas(c, data, moneda)
    return output_path


# ── FUNCION 2 — NUEVA DETERMINISTA (lee de SQLite por FacturaID) ─────────
def _obtener_datos_factura_db(factura_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    encabezado = conn.execute("""
        SELECT f.*, c.RazonSocial, c.RUC, c.Direccion, c.Telefono
        FROM Facturas f
        LEFT JOIN Clientes c ON f.ClienteID = c.ClienteID
        WHERE f.FacturaID = ?
    """, (factura_id,)).fetchone()

    if not encabezado:
        conn.close()
        raise ValueError(f"Factura {factura_id} no encontrada en la base de datos.")

    detalles = conn.execute("""
        SELECT df.Cantidad, df.PrecioUnitario,
               (df.Cantidad * df.PrecioUnitario) AS Total,
               p.Nombre
        FROM Detalle_Facturas df
        JOIN Productos p ON df.ProductoID = p.ProductoID
        WHERE df.FacturaID = ?
    """, (factura_id,)).fetchall()

    conn.close()
    return dict(encabezado), [dict(d) for d in detalles]


def generate_invoice_pdf_from_db(factura_id, output_path):
    """
    Genera PDF de factura directamente desde SQLite.
    Funcion determinista: PDF = g(FacturaID).
    """
    encabezado, detalles = _obtener_datos_factura_db(factura_id)

    data = {
        'nro_factura': str(encabezado.get('NumeroSecuencial', '')),
        'fecha':       str(encabezado.get('FechaEmision', ''))[:10],
        'condicion':   'CONTADO',
        'nombre':      encabezado.get('RazonSocial', 'CONSUMIDOR FINAL'),
        'ruc':         encabezado.get('RUC', ''),
        'telefono':    encabezado.get('Telefono', ''),
        'direccion':   encabezado.get('Direccion', ''),
        'moneda':      encabezado.get('Moneda', 'GS'),
        'productos': [
            {
                'c': d['Cantidad'],
                'd': d['Nombre'],
                'p': d['PrecioUnitario'],
                't': d['Total']
            }
            for d in detalles
        ]
    }

    moneda = data['moneda']
    c = canvas.Canvas(output_path, pagesize=(PAGE_W, PAGE_H))
    _dibujar_canvas(c, data, moneda)
    return output_path
