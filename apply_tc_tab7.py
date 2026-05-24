import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_tabs = '''    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs(["🛒 FACTURACIÓN", "🗑️ ANULAR", "📦 STOCK", "📊 HISTORIAL", "🤖 AI", "📦 PEDIDOS PENDIENTES"])'''
new_tabs = '''    tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs(["🛒 FACTURACIÓN", "🗑️ ANULAR", "📦 STOCK", "📊 HISTORIAL", "🤖 AI", "📦 PEDIDOS PENDIENTES", "💱 TIPO DE CAMBIO"])'''

content = content.replace(old_tabs, new_tabs)

tab7_content = '''
    with tab7:
        st.header("💱 Tipo de Cambio")
        
        is_admin = st.session_state.user_data and st.session_state.user_data.get('rol') == 'admin'
        
        if not is_admin:
            st.warning("⚠️ Acceso restringido. Solo Administración puede modificar el tipo de cambio.")
        else:
            tc_path = os.path.join(BASE_DIR, '..', 'database', 'master_tipo_cambio.json')
            tc = {}
            if os.path.exists(tc_path):
                with open(tc_path, 'r', encoding='utf-8') as f:
                    try: tc = json.load(f)
                    except: pass
            
            dolar_actual = tc.get('dolar_mercado', 6250)
            piso_actual = tc.get('banda_piso', dolar_actual + 150)
            techo_actual = tc.get('banda_techo', dolar_actual + 350)
            ult_act = tc.get('ultima_actualizacion', 'N/A')
            act_por = tc.get('actualizado_por', 'N/A')
            historico = tc.get('historico', [])
            
            st.subheader("Estado Actual")
            st.info(f"""
            **Dólar mercado actual:** Gs {dolar_actual:,}
            🟢 **Banda Piso (Contado/QR):** Gs {piso_actual:,}
            🔵 **Banda Techo (Crédito Industrial):** Gs {techo_actual:,}
            
            *Última actualización:* {ult_act} por {act_por}
            """)
            
            st.subheader("Actualizar Tipo de Cambio")
            nuevo_dolar = st.number_input("Nuevo dólar mercado (Gs)", min_value=1000, max_value=50000, value=int(dolar_actual), step=50)
            
            st.info(f"""
            🟢 **Banda Piso:** Gs {nuevo_dolar + 150:,}
            🔵 **Banda Techo:** Gs {nuevo_dolar + 350:,}
            """)
            
            if st.button("💾 GUARDAR TIPO DE CAMBIO"):
                from datetime import datetime
                historico.insert(0, {
                    "fecha": ult_act,
                    "dolar_mercado": dolar_actual,
                    "banda_piso": piso_actual,
                    "banda_techo": techo_actual,
                    "actualizado_por": act_por
                })
                
                # Keep last 10
                historico = historico[:10]
                
                tc['dolar_mercado'] = nuevo_dolar
                tc['banda_piso'] = nuevo_dolar + 150
                tc['banda_techo'] = nuevo_dolar + 350
                tc['ultima_actualizacion'] = datetime.now().strftime('%Y-%m-%d')
                tc['actualizado_por'] = 'Administrador SOLPRO'
                tc['historico'] = historico
                
                with open(tc_path, 'w', encoding='utf-8') as f:
                    json.dump(tc, f, indent=2, ensure_ascii=False)
                
                load_products.clear()
                st.success(f"✅ Tipo de cambio actualizado a Gs {nuevo_dolar:,}. Bandas recalculadas. Los precios se actualizarán al recargar.")
                st.rerun()
                
            st.subheader("Historial de Cambios")
            if historico:
                hist_data = []
                for h in historico:
                    hist_data.append([
                        h.get('fecha', ''),
                        f"Gs {h.get('dolar_mercado', 0):,}",
                        f"Gs {h.get('banda_piso', 0):,}",
                        f"Gs {h.get('banda_techo', 0):,}",
                        h.get('actualizado_por', '')
                    ])
                import pandas as pd
                df_hist = pd.DataFrame(hist_data, columns=["Fecha", "Dólar", "Banda Piso", "Banda Techo", "Actualizado por"])
                st.dataframe(df_hist, use_container_width=True)
            else:
                st.write("No hay historial disponible.")
'''

# Find the end of run_facturador_app()
# The end is usually if __name__ == "__main__":
content = content.replace('if __name__ == "__main__":', tab7_content + '\n\nif __name__ == "__main__":')

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Tab 7 added")
