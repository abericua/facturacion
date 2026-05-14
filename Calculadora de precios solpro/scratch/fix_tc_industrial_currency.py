import csv

# All Todo Costura INDUSTRIAL products must have Moneda = GS
# (costs are already in GS, but were incorrectly tagged as USD)

for filepath in ['productos_maestros.csv', 'COSTOS_INTERNOS_SOLPRO.csv']:
    with open(filepath, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())

    id_col    = 'ID_Ref'  if 'ID_Ref'         in fieldnames else 'ID'
    prov_col  = 'Proveedor' if 'Proveedor'     in fieldnames else 'LINEA'
    linea_col = 'Linea'   if 'Linea'           in fieldnames else 'LINEA'
    mon_col   = 'Moneda_Costo' if 'Moneda_Costo' in fieldnames else 'MONEDA'

    changed = 0
    for row in rows:
        pid = row[id_col].strip()
        if not pid.startswith('TC-'):
            continue
        # In costos CSV there's no Proveedor column, so rely on ID prefix + LINEA
        linea = row.get(linea_col, '').strip().upper()
        if linea == 'INDUSTRIAL' and row[mon_col].strip() == 'USD':
            row[mon_col] = 'GS'
            print(f"  [{filepath}] {pid} moneda USD -> GS")
            changed += 1

    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  {filepath}: {changed} items corrected.\n")

print("Done.")
