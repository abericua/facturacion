import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Part 4: st.tabs
content = content.replace(
    'tab1, tab2, tab3, tab4, tab5 = st.tabs(["🛒 FACTURACIÓN", "🚫 ANULAR", "📦 STOCK", "📊 HISTORIAL", "🤖 AI"])',
    'tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs(["🛒 FACTURACIÓN", "🚫 ANULAR", "📦 STOCK", "📊 HISTORIAL", "🤖 AI", "📦 PEDIDOS PENDIENTES"])'
)

# Part 5: Product Selection
new_product_ui = '''            with c2:
                all_options = ["--- BUSCAR PRODUCTO ---"]
                for _, row in df_products.iterrows():
                    stock_str = f"Stock: {int(row['STOCK'])}"
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
                            'precio': float(row['PRECIO_CONTADO']),
                            'costo': row.get('COSTO', 0),
                            'margen_pct': row.get('MARGEN_PCT', 0),
                            'moneda': row.get('MONEDA', 'GS')
                        })
                        st.session_state[f"desc_{i}"] = row['DESCRIPCION']
                        st.session_state[f"precio_{i}"] = float(row['PRECIO_CONTADO'])
                        st.rerun()

                desc = st.text_area("d", value=item['desc'], key=f"desc_{i}", height=60, label_visibility="collapsed")'''

content = re.sub(r'            with c2:\n                opciones_producto = \["--- BUSCAR PRODUCTO ---"\] \+ df_products\[\'CODIGO\'\]\.astype\(str\)\.tolist\(\).*?                desc = st\.text_area\("d", value=item\[\'desc\'\], key=f"desc_\{i\}", height=60, label_visibility="collapsed"\)', new_product_ui, content, flags=re.DOTALL)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Parts 4 and 5 applied")
