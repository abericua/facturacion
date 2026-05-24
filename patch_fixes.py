import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. FIX buscar_cliente
new_buscar_cliente = '''    def buscar_cliente(query, clientes):
        q = query.upper().strip()
        if len(q) < 3:
            return list(clientes.values())
        matches = []
        seen = set()
        for key, c in clientes.items():
            score = 0
            if q == key:
                score = 100
            elif key.startswith(q):
                score = 80
            elif q in key:
                score = 60
            for alias in c.get('aliases', []):
                a = alias.upper()
                if q == a:
                    score = max(score, 95)
                elif a.startswith(q):
                    score = max(score, 75)
                elif q in a:
                    score = max(score, 55)
            if score > 0 and key not in seen:
                matches.append((score, c))
                seen.add(key)
        matches.sort(key=lambda x: x[0], reverse=True)
        return [m[1] for m in matches]
'''

content = re.sub(r'    def buscar_cliente\(query, clientes\):.*?        return matches', new_buscar_cliente.strip(), content, flags=re.DOTALL)

# 2. FIX product selection UI (which didn't apply earlier)
new_product_ui = '''            with c2:
                all_options = ["--- BUSCAR PRODUCTO ---"]
                for _, row in df_products.iterrows():
                    stock_str = f"Stock: {int(row['STOCK'])}" if pd.notna(row.get('STOCK')) else "Stock: 0"
                    pc = f"C: {row['PRECIO_CONTADO']:,.0f}" if pd.notna(row.get('PRECIO_CONTADO')) else "C: N/A"
                    pqr = f"QR: {row['PRECIO_QR']:,.0f}" if pd.notna(row.get('PRECIO_QR')) else "QR: N/A"
                    pcr = f"CR: {row['PRECIO_CREDITO']:,.0f}" if pd.notna(row.get('PRECIO_CREDITO')) and not row.get('CREDITO_BLOQUEADO') else "CR: BLOQ"
                    all_options.append(f"{row['CODIGO']} | {row['DESCRIPCION']} | {stock_str} | {pc} | {pqr} | {pcr}")

                current_idx = 0
                if item.get('codigo'):
                    match_str = next((opt for opt in all_options if opt.startswith(f"{item['codigo']} |")), None)
                    if match_str:
                        current_idx = all_options.index(match_str)

                selected_prod = st.selectbox(
                    "Producto",
                    options=all_options,
                    index=current_idx,
                    key=f"prod_sel_{i}",
                    label_visibility="collapsed"
                )

                if selected_prod != "--- BUSCAR PRODUCTO ---":
                    cod_sel = selected_prod.split(" | ")[0]
                    if cod_sel != item.get('codigo'):
                        row = df_products[df_products['CODIGO'] == cod_sel].iloc[0]
                        st.session_state.factura_items[i].update({
                            'id_solpro': row.get('id_solpro', ''),
                            'codigo': row['CODIGO'],
                            'desc': row['DESCRIPCION'],
                            'precio': float(row['PRECIO_CONTADO']) if pd.notna(row.get('PRECIO_CONTADO')) else 0.0,
                            'costo': row.get('COSTO', 0),
                            'margen_pct': row.get('MARGEN_PCT', 0),
                            'moneda': row.get('MONEDA', 'GS')
                        })
                        st.session_state[f"desc_{i}"] = row['DESCRIPCION']
                        st.session_state[f"precio_{i}"] = float(row['PRECIO_CONTADO']) if pd.notna(row.get('PRECIO_CONTADO')) else 0.0
                        st.rerun()

                desc = st.text_area("d", value=item['desc'], key=f"desc_{i}", height=60, label_visibility="collapsed")'''

pattern = re.compile(r'            with c2:.*?desc = st\.text_area\("d", value=item\[\'desc\'\], key=f"desc_\{i\}", height=60, label_visibility="collapsed"\)', re.DOTALL)
content = pattern.sub(new_product_ui, content)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixes applied")
