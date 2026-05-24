import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# FIX 1: Replace validate_stock
old_validate_stock = '''    def validate_stock(sales_list):
        if not os.path.exists(PRODUCTS_FILE): return True, ""
        df = pd.read_csv(PRODUCTS_FILE)
        start_row = 0
        for sale in sales_list:
            codigo = sale['COD_PRODUCTO']
            cant_solicitada = sale.get('_CANT_NUM', 0)
            full_mask = df['ID_Ref'].astype(str).str.strip() == str(codigo).strip()
            
            if full_mask.any():
                idx = full_mask[full_mask].index[0]
                try:
                    current_stock = pd.to_numeric(df.at[idx, 'Stock'], errors='coerce')
                    if pd.isna(current_stock): current_stock = 0
                    if cant_solicitada > current_stock:
                        return False, f"❌ Stock insuficiente para {codigo}. Disponible: {current_stock}, Solicitado: {cant_solicitada}"
                except: pass
        return True, ""'''

new_validate_stock = '''    def validate_stock(inventory_log):
        import json
        master_path = os.path.join(
            BASE_DIR, '..', 'database',
            'master_productos.json')
        if not os.path.exists(master_path):
            return True, ""
        with open(master_path, 'r',
            encoding='utf-8') as f:
            productos = json.load(f)
        stock_map = {}
        for p in productos:
            stock_map[p['id_solpro']] = p.get(
                'stock_disponible', 0)
            for ext_id in p.get(
                'ids_externos', {}).values():
                if ext_id:
                    stock_map[ext_id] = p.get(
                        'stock_disponible', 0)
        for item in inventory_log:
            cod = str(item.get(
                'COD_PRODUCTO', '')).strip()
            stock = stock_map.get(cod, 0)
            if stock < 0:
                return False, \
                    f"{cod}: stock negativo"
        return True, ""'''

# Actually we can do a regex replacement for validate_stock just in case there are exact string match differences (like the emoji)
validate_stock_pattern = re.compile(r'    def validate_stock\(sales_list\):.*?return True, ""', re.DOTALL)
content = validate_stock_pattern.sub(new_validate_stock, content)

# FIX 2: Replace ttl for load_products
content = content.replace('@st.cache_data(ttl=60)\n    def load_products(dolar_mercado=None):', '@st.cache_data(ttl=30)\n    def load_products(dolar_mercado=None):')

# FIX 3: Replace ttl for load_clients
content = content.replace('@st.cache_data\n    def load_clients():', '@st.cache_data(ttl=30)\n    def load_clients():')

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixes applied.")
