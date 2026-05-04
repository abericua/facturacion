import pandas as pd
import os

def analyze_excel(file_path):
    print(f"\n--- Analyzing: {os.path.basename(file_path)} ---")
    try:
        df = pd.read_excel(file_path)
        print(f"Columns: {df.columns.tolist()}")
        print(f"First 5 rows:\n{df.head().to_string()}")
        print(f"Shape: {df.shape}")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

base_path = r"C:\Users\solpr\Desktop\Creador de Facturas"
analyze_excel(os.path.join(base_path, "LISTA DE PRECIOS DE VENTA.xlsx"))
analyze_excel(os.path.join(base_path, "VENTAS TOTALES 2026.xlsx"))
