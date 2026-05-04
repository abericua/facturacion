import os
import tkinter as tk
from tkinter import ttk, messagebox
from reportlab.pdfgen import canvas
from num2words import num2words

class FacturadorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("SOL PRO - Creador de Facturas (Coordenadas Corregidas)")
        self.root.geometry("900x800")

        self.nro_factura = tk.StringVar()
        self.fecha = tk.StringVar()
        self.nombre = tk.StringVar()
        self.ruc = tk.StringVar()
        self.direccion = tk.StringVar()
        self.telefono = tk.StringVar()
        self.condicion = tk.StringVar(value="CONTADO")
        self.moneda = tk.StringVar(value="PYG")

        self.productos = [] 
        self.setup_ui()

    def setup_ui(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill="both", expand=True)

        frame_header = ttk.LabelFrame(main_frame, text=" Datos del Cliente y Factura ", padding="10")
        frame_header.pack(fill="x", pady=5)

        ttk.Label(frame_header, text="Nro Factura (Serie):").grid(row=0, column=0, sticky="w")
        ttk.Entry(frame_header, textvariable=self.nro_factura, width=15).grid(row=0, column=1, padx=5, pady=2, sticky="w")
        
        ttk.Label(frame_header, text="Fecha:").grid(row=0, column=2, sticky="w", padx=10)
        ttk.Entry(frame_header, textvariable=self.fecha, width=20).grid(row=0, column=3, padx=5, pady=2, sticky="w")

        ttk.Label(frame_header, text="Moneda:").grid(row=0, column=4, sticky="w", padx=10)
        ttk.Combobox(frame_header, textvariable=self.moneda, values=["PYG", "USD"], width=5, state="readonly").grid(row=0, column=5, padx=5, pady=2, sticky="w")

        ttk.Label(frame_header, text="Nombre/RazÃ³n Social:").grid(row=1, column=0, sticky="w")
        ttk.Entry(frame_header, textvariable=self.nombre, width=50).grid(row=1, column=1, columnspan=3, padx=5, pady=2, sticky="w")

        ttk.Label(frame_header, text="RUC o C.I. NÂº:").grid(row=2, column=0, sticky="w")
        ttk.Entry(frame_header, textvariable=self.ruc, width=20).grid(row=2, column=1, padx=5, pady=2, sticky="w")
        
        ttk.Label(frame_header, text="TelÃ©fono:").grid(row=2, column=2, sticky="w", padx=10)
        ttk.Entry(frame_header, textvariable=self.telefono, width=20).grid(row=2, column=3, padx=5, pady=2, sticky="w")

        ttk.Label(frame_header, text="DirecciÃ³n:").grid(row=3, column=0, sticky="w")
        ttk.Entry(frame_header, textvariable=self.direccion, width=50).grid(row=3, column=1, columnspan=3, padx=5, pady=2, sticky="w")

        ttk.Label(frame_header, text="CondiciÃ³n:").grid(row=4, column=0, sticky="w")
        cond_frame = ttk.Frame(frame_header)
        cond_frame.grid(row=4, column=1, columnspan=2, sticky="w")
        ttk.Radiobutton(cond_frame, text="CONTADO", variable=self.condicion, value="CONTADO").pack(side="left", padx=5)
        ttk.Radiobutton(cond_frame, text="CRÃDITO", variable=self.condicion, value="CREDITO").pack(side="left", padx=5)

        frame_prod = ttk.LabelFrame(main_frame, text=" Detalle de Ventas ", padding="10")
        frame_prod.pack(fill="both", expand=True, pady=5)

        columns = ("cant", "desc", "precio", "total")
        self.tree = ttk.Treeview(frame_prod, columns=columns, show="headings", height=10)
        for col in columns: self.tree.heading(col, text=col.capitalize())
        self.tree.column("cant", width=60, anchor="center")
        self.tree.column("desc", width=400)
        self.tree.column("precio", width=120, anchor="e")
        self.tree.column("total", width=120, anchor="e")
        self.tree.pack(fill="both", expand=True)

        input_frame = ttk.Frame(frame_prod)
        input_frame.pack(fill="x", pady=10)

        self.in_cant = tk.StringVar(); self.in_desc = tk.StringVar(); self.in_precio = tk.StringVar()
        ttk.Label(input_frame, text="Cant:").pack(side="left")
        ttk.Entry(input_frame, textvariable=self.in_cant, width=7).pack(side="left", padx=5)
        ttk.Label(input_frame, text="DescripciÃ³n:").pack(side="left")
        ttk.Entry(input_frame, textvariable=self.in_desc, width=30).pack(side="left", padx=5)
        ttk.Label(input_frame, text="Precio:").pack(side="left")
        ttk.Entry(input_frame, textvariable=self.in_precio, width=12).pack(side="left", padx=5)
        ttk.Button(input_frame, text="AÃ±adir Item", command=self.add_item).pack(side="left", padx=10)
        ttk.Button(input_frame, text="Borrar Todo", command=self.clear_items).pack(side="left")

        ttk.Button(main_frame, text="GUARDAR FACTURA PDF", command=self.generate_pdf).pack(pady=10, ipady=5)

    def format_money(self, val):
        if self.moneda.get() == "PYG": return f"{val:,.0f}".replace(",", ".")
        else: return f"{val:,.2f}"

    def add_item(self):
        try:
            c = float(self.in_cant.get().replace(",", ".")); d = self.in_desc.get().upper()
            p = float(self.in_precio.get().replace(".", "").replace(",", ".")); t = c * p
            self.productos.append({'c': c, 'd': d, 'p': p, 't': t})
            self.tree.insert("", "end", values=(f"{c:g}", d, self.format_money(p), self.format_money(t)))
            self.in_cant.set(""); self.in_desc.set(""); self.in_precio.set("")
        except: messagebox.showerror("Error", "Datos numÃ©ricos invÃ¡lidos.")

    def clear_items(self):
        self.productos = []
        for i in self.tree.get_children(): self.tree.delete(i)

    def numero_a_letras(self, n):
        if self.moneda.get() == "PYG":
            return f"TOTAL A PAGAR: {num2words(int(n), lang='es').upper()} GUARANÃES.-"
        else:
            entero = int(n); decimal = int(round((n - entero) * 100))
            return f"TOTAL A PAGAR: {num2words(entero, lang='es').upper()} CON {decimal:02d}/100 DÃLARES AMERICANOS.-"

    def generate_pdf(self):
        if not self.nro_factura.get() or not self.nombre.get():
            messagebox.showwarning("Faltan datos", "Completa Nro Factura y Nombre.")
            return

        base_path = r"C:\Users\solpr\Desktop\Creador de Facturas"
        save_path = os.path.join(base_path, "Facturas_Emitidas")
        if not os.path.exists(save_path): os.makedirs(save_path)
        
        pdf_name = f"Factura_002-001-{self.nro_factura.get()}.pdf"
        pdf_path = os.path.join(save_path, pdf_name)

        w, h = 2362 * 0.28, 2180 * 0.28
        c = canvas.Canvas(pdf_path, pagesize=(w, h))
        c.drawImage(os.path.join(base_path, "factura solpro 2026.png"), 0, 0, width=w, height=h)

        # --- CABECERA (Ajustada segÃºn PDF de prueba) ---
        c.setFont("Courier-Bold", 14)
        c.drawString(450, 488, self.nro_factura.get()) # Bajado de 515 a 488

        c.setFont("Helvetica", 11)
        c.drawString(135, 444, self.fecha.get()) # Bajado de 473 a 444
        
        # CondiciÃ³n X
        c.drawString(556 if self.condicion.get() == "CONTADO" else 624, 444, "X")

        c.drawString(145, 424, self.nombre.get().upper()) # Bajado de 453 a 424
        c.drawString(100, 404, self.ruc.get()) # Bajado de 432 a 404
        c.drawString(465, 404, self.telefono.get())
        c.drawString(100, 384, self.direccion.get().upper()) # Bajado de 412 a 384

        # --- PRODUCTOS (Bajado punto de inicio) ---
        y = 352 # Bajado de 380 a 352
        total_suma = 0
        for p in self.productos:
            c.drawCentredString(55, y, f"{p['c']:g}")
            c.drawString(105, y, p['d'])
            c.drawRightString(415, y, self.format_money(p['p']))
            c.drawRightString(625, y, self.format_money(p['t']))
            total_suma += p['t']; y -= 18.5

        # --- TOTALES (Ajustados a las lÃ­neas inferiores) ---
        c.drawRightString(625, 102, self.format_money(total_suma)) # Bajado de 105 a 102
        c.setFont("Helvetica-Bold", 12)
        c.drawRightString(625, 80, self.format_money(total_suma)) # Bajado de 85 a 80
        
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, 60, self.numero_a_letras(total_suma)) # Bajado de 65 a 60

        iva_10 = total_suma / 11
        c.setFont("Helvetica", 10)
        c.drawRightString(460, 38, self.format_money(iva_10)) # Bajado de 42 a 38
        c.drawRightString(590, 38, self.format_money(iva_10))

        c.save()
        messagebox.showinfo("Guardado", f"Factura guardada en:\n{pdf_path}")
        os.startfile(save_path)

if __name__ == "__main__":
    root = tk.Tk(); app = FacturadorApp(root); root.mainloop()
