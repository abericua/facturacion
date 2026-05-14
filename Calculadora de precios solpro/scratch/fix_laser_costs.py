import csv

# Fix costs: 10W = 3,000,000 GS | 20W = 4,800,000 GS
fixes = {
    'TC-003': 4800000.0,  # GRABADORA LASER 20W
    'TC-005': 3000000.0,  # GRABADORA LASER 10W
}

for filepath in ['productos_maestros.csv', 'COSTOS_INTERNOS_SOLPRO.csv']:
    with open(filepath, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())

    # Detect ID column name
    id_col = 'ID_Ref' if 'ID_Ref' in fieldnames else 'ID'
    cost_col = 'Costo_Compra' if 'Costo_Compra' in fieldnames else 'COSTO_ORIGINAL'

    changed = 0
    for row in rows:
        pid = row[id_col].strip()
        if pid in fixes:
            old = row[cost_col]
            row[cost_col] = fixes[pid]
            print(f"  [{filepath}] {pid}: {old} -> {fixes[pid]}")
            changed += 1

    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  {filepath}: {changed} items updated.")

print("\nDone.")
