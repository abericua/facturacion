import pandas as pd

excel_path = 'LISTA DE PRODUCTOS CON CODIGOS RECIENTES.xlsx'
df = pd.read_excel(excel_path)

print("Columns:")
print(df.columns.tolist())

print("\nSample of INSUMOS (if any word contains INSUMO):")
for idx, row in df.iterrows():
    # Convert entire row to string to search for INSUMOS
    row_str = ' | '.join(str(val).upper() for val in row.values)
    if 'INSUMO' in row_str or 'TINTA' in row_str:
        print(row.to_dict())
