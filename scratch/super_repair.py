import pandas as pd
import os
from datetime import date

FILE_PATH = r"c:\Users\solpr\Desktop\Creador de Facturas\VENTAS TOTALES 2026.xlsx"

def super_repair(df):
    # Forzamos la columna a tipo objeto para manipularla
    df['FECHA_NUEVA'] = df['FECHA']
    
    for idx, row in df.iterrows():
        nro = row['NRO_FACTURA']
        
        # REGLA DE ORO: Si es de hoy (facturas altas), forzamos 08/05/2026
        if nro >= 270:
            df.at[idx, 'FECHA_NUEVA'] = date(2026, 5, 8)
        else:
            # Para las antiguas, intentamos limpiar la hora y asegurar DD/MM/YYYY
            val = row['FECHA']
            try:
                if isinstance(val, str):
                    val = val.split(' ')[0]
                    # Intentamos parsear asumiendo que el dia es lo primero
                    dt = pd.to_datetime(val, dayfirst=True)
                    df.at[idx, 'FECHA_NUEVA'] = dt.date()
                elif hasattr(val, 'date'):
                    df.at[idx, 'FECHA_NUEVA'] = val.date()
            except:
                pass
    
    df['FECHA'] = df['FECHA_NUEVA']
    return df.drop(columns=['FECHA_NUEVA'])

if os.path.exists(FILE_PATH):
    df = pd.read_excel(FILE_PATH)
    df = super_repair(df)
    
    # Guardar con XlsxWriter para forzar el formato de celda de fecha
    writer = pd.ExcelWriter(FILE_PATH, engine='xlsxwriter')
    df.to_excel(writer, index=False, sheet_name='Ventas')
    
    workbook  = writer.book
    worksheet = writer.sheets['Ventas']
    
    # Formato de fecha sin hora
    date_format = workbook.add_format({'num_format': 'dd/mm/yyyy'})
    
    # Aplicar a la columna A
    worksheet.set_column('A:A', 15, date_format)
    
    writer.close()
    print("REPARACION COMPLETADA")
