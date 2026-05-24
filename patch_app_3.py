import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_sidebar_client = '''    with st.sidebar:
        st.header("👤 Cliente")
        clients_dict = load_clients()
        query_cliente = st.text_input("🔍 Buscar Cliente por Alias (opcional)")
        
        if query_cliente:
            matches = buscar_cliente(query_cliente, clients_dict)
        else:
            matches = sorted(list(clients_dict.values()), key=lambda x: x['nombre'])

        client_names = ["-- NUEVO CLIENTE --"] + [c['nombre'] for c in matches]
        selected_client_name = st.selectbox("Buscar Cliente", client_names)
        
        sel_data = next((c for c in matches if c['nombre'] == selected_client_name), None)
'''

content = re.sub(r'    with st\.sidebar:\n        st\.header\("👤 Cliente"\)\n        clients = load_clients\(\).*?        sel_data = next\(\(c for c in clients if c\[\'nombre\'\] == selected_client_name\), None\)', new_sidebar_client, content, flags=re.DOTALL)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Part 3 applied")
