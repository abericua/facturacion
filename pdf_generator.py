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
    c.drawString(435, 520, data['nro_factura'])

    c.setFont("Helvetica", 11)
    # Fecha y Condición (Fila 1)
    c.drawString(115, 456, data['fecha'])
    c.drawString(560 if data['condicion'] == "CONTADO" else 630, 456, "X")

    # Nombre (Fila 2)
    c.drawString(140, 436, data['nombre'].upper())
    
    # RUC y Teléfono (Fila 3)
    c.drawString(110, 416, data['ruc'])
    c.drawString(465, 416, data['telefono'])
    
    # Dirección (Fila 4)
    c.drawString(110, 396, data['direccion'].upper())

    # --- PRODUCTOS ---
    y = 345
    total_suma = 0
    moneda = data['moneda']
    
    for p in data['productos']:
        c.setFont("Helvetica", 10)
        c.drawCentredString(55, y, f"{float(p['c']):g}")
        c.drawString(120, y, p['d'])
        c.drawRightString(500, y, format_money(float(p['p']), moneda))
        c.drawRightString(645, y, format_money(float(p['t']), moneda))
        total_suma += float(p['t'])
        y -= 18.5

    # --- TOTALES ---
    c.drawRightString(645, 96, format_money(total_suma, moneda))
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(645, 75, format_money(total_suma, moneda))
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(80, 60, numero_a_letras(total_suma, moneda))

    iva_10 = total_suma / 11
    c.setFont("Helvetica", 10)
    c.drawRightString(460, 38, format_money(iva_10, moneda))
    c.drawRightString(590, 38, format_money(iva_10, moneda))

    c.save()
    return output_path
