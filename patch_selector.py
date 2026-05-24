import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_c2_update = '''                        st.session_state.factura_items[i].update({
                            'id_solpro': row.get('id_solpro', ''),
                            'codigo': row['CODIGO'],
                            'desc': row['DESCRIPCION'],
                            'precio': float(row['PRECIO_CONTADO']) if pd.notna(row.get('PRECIO_CONTADO')) else 0.0,
                            'costo': row.get('COSTO', 0),
                            'margen_pct': row.get('MARGEN_PCT', 0),
                            'moneda': row.get('MONEDA', 'GS')
                        })'''

new_c2_update = '''                        st.session_state.factura_items[i].update({
                            'id_solpro': row.get('id_solpro', ''),
                            'codigo': row['CODIGO'],
                            'desc': row['DESCRIPCION'],
                            'precio': float(row['PRECIO_CONTADO']) if pd.notna(row.get('PRECIO_CONTADO')) else 0.0,
                            'tipo_precio': 'Contado',
                            'tipo_precio_idx': 0,
                            'costo': row.get('COSTO', 0),
                            'margen_pct': row.get('MARGEN_PCT', 0),
                            'moneda': row.get('MONEDA', 'GS')
                        })'''

old_c3 = '''            with c3: precio = st.number_input("p", value=item['precio'], key=f"precio_{i}", format="%.2f", label_visibility="collapsed")'''

new_c3 = '''            with c3:
                tipo = st.selectbox("Tipo", ["Contado", "QR", "Crédito"], index=item.get('tipo_precio_idx', 0), key=f"tipo_precio_{i}", label_visibility="collapsed")
                if tipo != item.get('tipo_precio', 'Contado'):
                    st.session_state.factura_items[i]['tipo_precio'] = tipo
                    st.session_state.factura_items[i]['tipo_precio_idx'] = ["Contado", "QR", "Crédito"].index(tipo)
                    cod_sel = item.get('codigo')
                    if cod_sel:
                        mask = df_products['CODIGO'].astype(str) == str(cod_sel)
                        if mask.any():
                            row = df_products.loc[mask].iloc[0]
                            if tipo == "Contado": new_p = float(row['PRECIO_CONTADO']) if pd.notna(row.get('PRECIO_CONTADO')) else 0.0
                            elif tipo == "QR": new_p = float(row['PRECIO_QR']) if pd.notna(row.get('PRECIO_QR')) else 0.0
                            elif tipo == "Crédito": new_p = float(row['PRECIO_CREDITO']) if pd.notna(row.get('PRECIO_CREDITO')) else 0.0
                            st.session_state.factura_items[i]['precio'] = new_p
                            st.session_state[f"precio_{i}"] = new_p
                            st.rerun()
                precio = st.number_input("p", value=item.get('precio', 0.0), key=f"precio_{i}", format="%.2f", label_visibility="collapsed")'''

if old_c2_update in content and old_c3 in content:
    content = content.replace(old_c2_update, new_c2_update)
    content = content.replace(old_c3, new_c3)
    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("UI price selector applied!")
else:
    print("Could not find the exact strings to replace. Debug required.")
