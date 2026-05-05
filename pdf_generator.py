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
        return f"TOTAL A PAGAR: {num2words(int(n), lang='es').upper()} GUARANÍES.-"
    else:
        entero = int(n)
        decimal = int(round((n - entero) * 100))
        return f"TOTAL A PAGAR: {num2words(entero, lang='es').upper()} CON {decimal:02d}/100 DÓLARES AMERICANOS.-"

def generate_invoice_pdf(data, output_path):
    """
    data: dict con campos:
        nro_factura, fecha, nombre, ruc, direccion, telefono, condicion, moneda, productos
    productos: lista de dicts con:
        c (cantidad), d (descripcion), p (precio unit), t (total)
    """
    # Usar ruta dinámica
    base_path = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(base_path, "factura solpro 2026.png")
    
    # Tamaño basado en el original (ajustado por factor 0.28)
    w, h = 2362 * 0.28, 2180 * 0.28
    
    c = canvas.Canvas(output_path, pagesize=(w, h))
    
    if os.path.exists(template_path):
        c.drawImage(template_path, 0, 0, width=w, height=h)
    
    # --- CABECERA ---
    c.setFont("Helvetica-Bold", 14)
    c.drawString(435, 478, data['nro_factura'])

    c.setFont("Helvetica", 11)
    c.drawString(135, 432, data['fecha'])
    
    # Condición X
    c.drawString(556 if data['condicion'] == "CONTADO" else 624, 432, "X")

    c.drawString(145, 412, data['nombre'].upper())
    c.drawString(100, 393, data['ruc'])
    c.drawString(465, 393, data['telefono'])
    c.drawString(100, 373, data['direccion'].upper())

    # --- PRODUCTOS ---
    y = 341
    total_suma = 0
    moneda = data['moneda']
    
    for p in data['productos']:
        c.setFont("Helvetica", 10)
        c.drawCentredString(55, y, f"{float(p['c']):g}")
        c.drawString(105, y, p['d'])
        c.drawRightString(415, y, format_money(float(p['p']), moneda))
        c.drawRightString(625, y, format_money(float(p['t']), moneda))
        total_suma += float(p['t'])
        y -= 18.5

    # --- TOTALES ---
    c.drawRightString(625, 96, format_money(total_suma, moneda))
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(625, 75, format_money(total_suma, moneda))
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, 55, numero_a_letras(total_suma, moneda))

    iva_10 = total_suma / 11
    c.setFont("Helvetica", 10)
    c.drawRightString(460, 34, format_money(iva_10, moneda))
    c.drawRightString(590, 34, format_money(iva_10, moneda))

    c.save()
    return output_path
