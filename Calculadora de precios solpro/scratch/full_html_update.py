import csv

master_csv = 'productos_maestros.csv'
html_path = 'calculadora_precios.html'

master_list = []
with open(master_csv, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    master_list = list(reader)

html_master_lines = []
for row in master_list:
    line = f"{row['ID_Ref']},{row['Nombre']},{row['Proveedor']},{row['Linea']},{row['Costo_Compra']},{row['Moneda_Costo']}"
    if float(row.get('Margen_Pct', 30)) != 30.0:
        line += f",{row['Margen_Pct']}"
    html_master_lines.append(line)

new_master_data = 'const MASTER_DATA = `' + '\n'.join(html_master_lines) + '`;'

with open(html_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_line = -1
end_line = -1
for i, line in enumerate(lines):
    if 'const MASTER_DATA = `' in line:
        start_line = i
    if start_line != -1 and '`;' in line:
        end_line = i
        break

if start_line != -1 and end_line != -1:
    new_lines = lines[:start_line] + [new_master_data + '\n'] + lines[end_line+1:]
    with open(html_path, 'w', encoding='utf-8', newline='') as f:
        f.writelines(new_lines)
    print("HTML updated successfully.")
else:
    print("ERROR: Could not find MASTER_DATA block.")
