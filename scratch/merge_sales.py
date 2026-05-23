import pandas as pd
import os

MAIN_FILE = r"c:\Users\solpr\Desktop\Creador de Facturas\VENTAS TOTALES 2026.xlsx"
EXTRACTION_FILE = r"c:\Users\solpr\Desktop\Creador de Facturas\EXTRACCION_MAURO.xlsx"

if os.path.exists(MAIN_FILE) and os.path.exists(EXTRACTION_FILE):
    try:
        df_main = pd.read_excel(MAIN_FILE)
        df_extra = pd.read_excel(EXTRACTION_FILE)
        
        print(f"Filas en principal: {len(df_main)}")
        print(f"Filas en extracción: {len(df_extra)}")
        
        # Combinar
        df_combined = pd.concat([df_main, df_extra], ignore_index=True)
        
        # Eliminar duplicados exactos
        initial_len = len(df_combined)
        # Usamos NRO_FACTURA y CLIENTE como llave para evitar duplicados si se cargaron dos veces
        df_combined = df_combined.drop_duplicates(subset=['FECHA', 'NRO_FACTURA', 'CLIENTE', 'VENDEDOR', 'PRECIO GS', 'PRECIO USD'], keep='first')
        
        print(f"Filas tras eliminar duplicados: {len(df_combined)}")
        print(f"Nuevas filas añadidas: {len(df_combined) - len(df_main)}")
        
        # Guardar de nuevo en el principal
        df_combined.to_excel(MAIN_FILE, index=False)
        print("✅ Fusión completada exitosamente.")
        
    except Exception as e:
        print(f"❌ Error durante la fusión: {e}")
else:
    print("❌ No se encontró uno de los archivos necesarios.")
