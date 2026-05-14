import os
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

def crear_cuadricula_calibracion(input_image_path, output_pdf_path):
    # Abrir la imagen para obtener dimensiones
    img = Image.open(input_image_path)
    width_px, height_px = img.size
    
    # Crear un canvas de ReportLab con el tamaño de la imagen convertido a puntos (1 px ~= 0.75 puntos en 96 dpi)
    # Sin embargo, para que sea exacto al imprimir, usaremos el tamaño A4 o el de la imagen escalado.
    # Asumiremos que la imagen tiene una resolución estándar.
    
    c = canvas.Canvas(output_pdf_path, pagesize=(width_px * 0.75, height_px * 0.75))
    
    # Dibujar la imagen de fondo
    c.drawImage(input_image_path, 0, 0, width=width_px * 0.75, height=height_px * 0.75)
    
    # Dibujar cuadrícula
    c.setStrokeColorRGB(1, 0, 0) # Rojo
    c.setFont("Helvetica", 8)
    
    paso = 50 # Puntos
    
    # Líneas verticales
    for x in range(0, int(width_px * 0.75), paso):
        c.line(x, 0, x, height_px * 0.75)
        c.drawString(x + 2, 10, str(x))
        
    # Líneas horizontales
    for y in range(0, int(height_px * 0.75), paso):
        c.line(0, y, width_px * 0.75, y)
        c.drawString(10, y + 2, str(y))
        
    c.save()
    print(f"PDF de calibración generado en: {output_pdf_path}")

if __name__ == "__main__":
    base_path = r"C:\Users\solpr\Desktop\Creador de Facturas"
    img_path = os.path.join(base_path, "factura solpro 2026.png")
    out_pdf = os.path.join(base_path, "CALIBRACION_FACTURA.pdf")
    
    if os.path.exists(img_path):
        crear_cuadricula_calibracion(img_path, out_pdf)
    else:
        print(f"No se encontró la imagen en {img_path}")
