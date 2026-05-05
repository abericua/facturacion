import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from num2words import num2words

def format_money(val, moneda):
    if moneda == "PYG":
        return f"{val:,.0f}".replace(",", ".")
    else:
        return f"{val:,.2f}"

def numero_a_letras(n, moneda):
    if moneda == "PYG":
        return f"TOTAL A PAGAR: {num2words(int(n), lang='es').upper()} GUARANIES.-"
    else:
        entero = int(n)
        decimal = int(round((n - entero) * 100))
        return f"TOTAL A PAGAR: {num2words(entero, lang='es').upper()} CON {decimal:02d}/100 DOLARES AMERICANOS.-"

def generate_invoice_pdf(data, output_path):
    base_path = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(base_path, "factura solpro 2026.png")

    w, h = 2362 * 0.28, 2180 * 0.28
    c = canvas.Canvas(output_path, pagesize=(w, h))

    if os.path.exists(template_path):
        c.drawImage(template_path, 0, 0, width=w, height=h)

    # CABECERA
    c.setFont("Helvetica-Bold", 14)
    c.drawString(435, 520, data['nro_factura'])

    c.setFont("Helvetica", 11)
    c.drawString(115, 456, data['fecha'])
    x_cond = 533 if data['condicion'] == "CONTADO" else 601
    c.drawString(x_cond, 456, "X")

    c.drawString(140, 436, data['nombre'].upper())
    c.drawString(110, 416, data['ruc'])
    c.drawString(465, 416, data['telefono'])
    c.drawString(110, 396, data['direccion'].upper())

    # PRODUCTOS
    y = 345
    total_suma = 0
    moneda = data['moneda']

    for p in data['productos']:
        c.setFont("Helvetica", 10)
        # Cantidad en la primera columna
        c.drawCentredString(35, y, f"{float(p['c']):g}")
        # Descripción
        c.drawString(73, y, p['d'])
        # Precio Unitario
        c.drawRightString(535, y, format_money(float(p['p']), moneda))
        # Valor de Venta (10%)
        c.drawRightString(658, y, format_money(float(p['t']), moneda))
        total_suma += float(p['t'])
        y -= 18.5

    # TOTALES
    c.setFont("Helvetica", 10)
    c.drawRightString(658, 95, format_money(total_suma, moneda))   # Sub-Totales
    c.drawRightString(658, 82, format_money(total_suma, moneda))   # TOTAL A PAGAR

    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(658, 63, format_money(total_suma, moneda))   # Total bold (opcional si hay cuadro)

    c.setFont("Helvetica", 8)
    total_letras = numero_a_letras(total_suma, moneda)
    palabras = total_letras.replace("TOTAL A PAGAR: ", "")
    c.drawString(200, 63, palabras)                                # Total en letras

    iva_10 = total_suma / 11
    c.setFont("Helvetica", 10)
    c.drawRightString(445, 50, format_money(iva_10, moneda))       # IVA 10%
    c.drawRightString(658, 50, format_money(iva_10, moneda))       # Total IVA

    c.save()
    return output_path
