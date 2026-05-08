import pandas as pd
import os

SALES_FILE = r"c:\Users\solpr\Desktop\Creador de Facturas\VENTAS TOTALES 2026.xlsx"

if os.path.exists(SALES_FILE):
    try:
        df = pd.read_excel(SALES_FILE)
        print(f"Total de filas en el Excel: {len(df)}")
        print("\nÚltimas 5 filas:")
        print(df.tail())
        
        df['FECHA_DT'] = pd.to_datetime(df['FECHA'], dayfirst=True, errors='coerce')
        
        print("\nFacturas de hoy (08-05-2026):")
        today_str = "08-05-2026"
        # También probamos como objeto datetime
        today_dt = pd.to_datetime(today_str, dayfirst=True)
        
        match_today = df[(df['FECHA'] == today_str) | (df['FECHA_DT'] == today_dt)]
        print(f"Total encontradas hoy: {len(match_today)}")
        if not match_today.empty:
            print(match_today[['FECHA', 'NRO_FACTURA', 'CLIENTE', 'VENDEDOR']])
            
        print("\nFacturas de 'MAURO':")
        if 'VENDEDOR' in df.columns:
            mauro_sales = df[df['VENDEDOR'].str.contains("MAURO", case=False, na=False)]
            print(f"Total de Mauro: {len(mauro_sales)}")
            print(mauro_sales[['FECHA', 'NRO_FACTURA', 'CLIENTE', 'VENDEDOR']].tail(10))
        else:
            print("No existe la columna VENDEDOR")
            print(f"Columnas disponibles: {df.columns.tolist()}")
            
    except Exception as e:
        print(f"Error al leer el archivo: {e}")
else:
    print("El archivo no existe.")
