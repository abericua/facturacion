import sys

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([' in line:
        lines[i] = line.replace(
            'tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([', 
            'tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs(['
        ).replace('])', ', "💱 TIPO DE CAMBIO"])')
        break

with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Updated successfully!")
