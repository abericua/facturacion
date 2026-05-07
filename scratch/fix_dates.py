import pandas as pd
import os

files = ['VENTAS TOTALES 2026.xlsx', 'VENTAS_TOTALES_2026 (1).xlsx']

for file in files:
    if os.path.exists(file):
        try:
            df = pd.read_excel(file)
            if 'FECHA' in df.columns:
                # Convert to datetime and then format as DD-MM-YYYY
                df['FECHA'] = pd.to_datetime(df['FECHA'], errors='coerce')
                df['FECHA'] = df['FECHA'].dt.strftime('%d-%m-%Y')
                
                # Fill NaNs with a default if needed or keep as is
                df['FECHA'] = df['FECHA'].fillna('')
                
                df.to_excel(file, index=False)
                print(f"Updated {file}")
            else:
                print(f"FECHA column not found in {file}")
        except PermissionError:
            print(f"File {file} is open by another program. Cannot save.")
    else:
        print(f"File {file} not found")
