import csv

fixes = {
    'SC-107': {'Linea': 'INSUMOS', 'LINEA': 'INSUMOS'},
    'SC-127': {'Linea': 'INSUMOS', 'LINEA': 'INSUMOS'},
}

for filepath in ['productos_maestros.csv', 'COSTOS_INTERNOS_SOLPRO.csv']:
    with open(filepath, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
    id_col    = 'ID_Ref' if 'ID_Ref' in fieldnames else 'ID'
    linea_col = 'Linea'  if 'Linea'  in fieldnames else 'LINEA'
    for row in rows:
        pid = row[id_col].strip()
        if pid in fixes and linea_col in fixes[pid]:
            old = row[linea_col]
            row[linea_col] = fixes[pid][linea_col]
            print(f"  [{filepath}] {pid} linea: {old} -> {row[linea_col]}")
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

print("Done.")
