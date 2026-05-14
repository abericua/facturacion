import pandas as pd
import csv
import os

excel_path = 'LISTA DE PRODUCTOS CON CODIGOS RECIENTES.xlsx'
master_csv = 'productos_maestros.csv'
costos_csv = 'COSTOS_INTERNOS_SOLPRO.csv'

# 1. Load Costs (for prices)
prices = {}
if os.path.exists(costos_csv):
    with open(costos_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            prices[row['ID'].strip()] = {
                'costo': float(row['COSTO_ORIGINAL']) if row['COSTO_ORIGINAL'] else 0.0,
                'moneda': row['MONEDA']
            }

# 2. Load Excel (as Truth)
df_excel = pd.read_excel(excel_path)
linea_col = df_excel.columns[1] # The problematic 'LÍNEA' column
producto_col = df_excel.columns[2]

new_master_data = []

def get_provider(pid):
    if pid.startswith('IM-'): return 'Importacion SOLPRO'
    if pid.startswith('SC-'): return 'Sol Control'
    if pid.startswith('TC-'): return 'Todo Costura'
    if pid.startswith('CMB-'): return 'SOLPRO COMBOS'
    return 'Desconocido'

# User explicit categories
for _, row in df_excel.iterrows():
    pid = str(row['ID REF']).strip()
    if not pid or pid == 'nan': continue
    
    nombre = str(row[producto_col]).strip()
    
    # EXACT LINE from user's Excel
    linea = str(row[linea_col]).strip()
    
    # If the user put a weird thing like "YE", fix it based on name
    if linea == 'nan' or len(linea) < 3 or linea.startswith('YE'):
        if 'TINTA' in nombre:
            linea = 'INSUMOS'
        elif 'COMBO' in nombre:
            linea = 'COMBO COMERCIAL'
        else:
            linea = 'ACCESORIOS'
            
    # Fix combos to match HTML categories
    if 'COMBO' in nombre.upper() and 'COMBO' not in linea.upper():
        if 'INDUSTRIAL' in nombre.upper() or 'WILPEX' in nombre.upper():
            linea = 'COMBO INDUSTRIAL'
        else:
            linea = 'COMBO COMERCIAL'
            
    # Standardize casing
    linea = linea.upper()
    
    prov = get_provider(pid)
    
    # Get price from costos_csv if exists
    costo = 0.0
    moneda = 'USD' if 'INDUSTRIAL' in linea else 'GS'
    
    if pid in prices:
        costo = prices[pid]['costo']
        # Don't overwrite Moneda if the user specifically categorized it as INDUSTRIAL in excel
        if 'INDUSTRIAL' not in linea:
            moneda = prices[pid]['moneda']
    else:
        if pid.startswith('TC-'): moneda = 'GS'
        if 'INDUSTRIAL' in linea: moneda = 'USD'
        
    new_master_data.append({
        'Nombre': nombre,
        'ID_Ref': pid,
        'Proveedor': prov,
        'Linea': linea,
        'Costo_Compra': costo,
        'Moneda_Costo': moneda,
        'Margen_Pct': 30.0
    })

# 3. Save
with open(master_csv, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['Nombre', 'ID_Ref', 'Proveedor', 'Linea', 'Costo_Compra', 'Moneda_Costo', 'Margen_Pct'])
    writer.writeheader()
    writer.writerows(new_master_data)

# Re-save costos to match
new_costos_list = []
for m in new_master_data:
    new_costos_list.append({
        'ID': m['ID_Ref'],
        'PRODUCTO': m['Nombre'],
        'LINEA': m['Linea'],
        'COSTO_ORIGINAL': m['Costo_Compra'],
        'MONEDA': m['Moneda_Costo']
    })

with open(costos_csv, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['ID', 'PRODUCTO', 'LINEA', 'COSTO_ORIGINAL', 'MONEDA'])
    writer.writeheader()
    writer.writerows(new_costos_list)

print(f"Fixed Sync completed. {len(new_master_data)} items loaded with correct categories.")
