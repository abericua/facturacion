"""
SGSP — Generador de PDFs de Factura
Módulo: pdf_generator.py

Función principal:
  generate_invoice_pdf(data, output_path)
  -> Recibe dict con datos ya armados desde app.py y genera el PDF.
  -> Compatible con el flujo actual de facturación (PostgreSQL + Streamlit).
"""

import os
from reportlab.pdfgen import canvas
from num2words import num2words

# ── Rutas fijas: calculadas desde la ubicación de ESTE archivo ────────────
DIRECTORIO_ACTUAL = os.path.dirname(os.path.abspath(__file__))
RUTA_PLANTILLA    = os.path.join(DIRECTORIO_ACTUAL, "factura solpro 2026.png")

# Tamaño de página: coincide con el PNG de plantilla (no A4 estándar)
PAGE_W = 2362 * 0.28
PAGE_H = 2180 * 0.28


# ── Helpers compartidos ────────────────────────────────────────────────────
def wrap_text(c, text, max_width, font_name="Helvetica", font_size=10):
    if not text:
        return [""]
    words = text.split()
    lines = []
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        if c.stringWidth(test_line, font_name, font_size) <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
            else:
                part = ""
                for char in word:
                    if c.stringWidth(part + char, font_name, font_size) <= max_width:
                        part += char
                    else:
                        lines.append(part)
                        part = char
                if part:
                    current_line = [part]
    if current_line:
        lines.append(" ".join(current_line))
    return lines

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
    Coordenadas calibradas desde generador_facturas.py (versión que generaba correctamente).
    data debe tener:
        nro_factura, fecha, condicion, nombre, ruc,
        telefono, direccion, productos, moneda
    Cada item de productos: {c, d, p, t}
    """
    # Plantilla de fondo
    if os.path.exists(RUTA_PLANTILLA):
        c.drawImage(RUTA_PLANTILLA, 0, 0, width=PAGE_W, height=PAGE_H)

    # CABECERA
    c.setFont("Courier-Bold", 14)
    c.drawString(505, 505, data['nro_factura'])   # después del "002-001-" preimpreso

    c.setFont("Helvetica", 11)
    c.drawString(135, 444, data['fecha'])
    x_cond = 556 if data['condicion'] == "CONTADO" else 624
    c.drawString(x_cond, 453, "X")               # subido para quedar dentro del checkbox

    c.drawString(145, 424, data['nombre'].upper())
    c.drawString(100, 404, data['ruc'])
    c.drawString(465, 404, data['telefono'])
    c.drawString(100, 384, data['direccion'].upper())

    # PRODUCTOS
    y          = 352
    total_suma = 0

    for p in data['productos']:
        c.setFont("Helvetica", 10)
        c.drawCentredString(55,  y, f"{float(p['c']):g}")
        
        desc_lines = wrap_text(c, p['d'], 290, "Helvetica", 10)
        # Solo dibujar precio/total de la línea si tienen valor (>0).
        # En facturas regeneradas desde el historial no hay precio por línea,
        # así que esas celdas quedan en blanco y el total real se toma de 'total_override'.
        if float(p['p']) > 0:
            c.drawRightString(415,   y, format_money(float(p['p']), moneda))
        if float(p['t']) > 0:
            c.drawRightString(621,   y, format_money(float(p['t']), moneda))
        
        y_desc = y
        for idx, line in enumerate(desc_lines):
            c.drawString(105, y_desc, line)
            if idx < len(desc_lines) - 1:
                y_desc -= 12
                
        total_suma += float(p['t'])
        y -= (18.5 + (len(desc_lines) - 1) * 12)

    # Permite forzar el total cuando no hay precio por línea (regeneración histórica)
    if data.get('total_override'):
        total_suma = float(data['total_override'])

    # TOTALES
    c.setFont("Helvetica", 10)
    c.drawRightString(621, 102, format_money(total_suma, moneda))   # Sub-Totales

    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(621, 80, format_money(total_suma, moneda))    # TOTAL A PAGAR

    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, 60, numero_a_letras(total_suma, moneda))       # En letras

    iva_10 = total_suma / 11
    c.setFont("Helvetica", 10)
    c.drawRightString(460, 38, format_money(iva_10, moneda))        # IVA 5%
    c.drawRightString(590, 38, format_money(iva_10, moneda))        # Total IVA 10%

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

