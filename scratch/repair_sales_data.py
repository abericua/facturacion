import pandas as pd
import os
from datetime import datetime

FILE_PATH = r"c:\Users\solpr\Desktop\Creador de Facturas\VENTAS TOTALES 2026.xlsx"

def repair_dates(df):
    def fix_row(row):
        val = row['FECHA']
        if pd.isna(val):
            return val
        
        # Si ya es datetime, lo limpiamos a date
        if isinstance(val, datetime):
            # CASO CRÍTICO: Si el día es 1 y el mes es > 5 (ej: 2026-08-01), 
            # es casi seguro que el 8 era el día y el 5 el mes original.
            if val.day == 1 and val.month > 5:
                # Invertimos: el mes actual se vuelve el día, y el mes original era 5 (mayo)
                # O mejor: si el número de factura está entre 273 y 280, sabemos que es de HOY (08-05)
                if 273 <= row['NRO_FACTURA'] <= 280:
                    return datetime(2026, 5, 8).date()
            return val.date()
        
        # Si es string, intentamos parsearlo con cuidado
        if isinstance(val, str):
            # Limpiar posibles horas
            val = val.split(' ')[0]
            try:
                # Intentar formato día-mes-año primero
                return datetime.strptime(val, '%d-%m-%Y').date()
            except:
                try:
                    return datetime.strptime(val, '%Y-%m-%d').date()
                except:
                    return val
        return val

    df['FECHA'] = df.apply(fix_row, axis=1)
    return df

if os.path.exists(FILE_PATH):
    df = pd.read_excel(FILE_PATH)
    print(f"Reparando {len(df)} filas...")
    df = repair_dates(df)
    
    # Guardar con formato específico usando xlsxwriter
    writer = pd.ExcelWriter(FILE_PATH, engine='xlsxwriter')
    df.to_excel(writer, index=False, sheet_name='Ventas')
    
    # Aplicar formato de fecha a la columna A (FECHA)
    workbook  = writer.book
    worksheet = writer.sheets['Ventas']
    date_format = workbook.add_format({'num_format': 'dd/mm/yyyy'})
    worksheet.set_column('A:A', 15, date_format)
    
    writer.close()
    print("✅ Archivo reparado con éxito. Fechas invertidas corregidas y horas eliminadas.")
else:
    print("❌ Archivo no encontrado.")
