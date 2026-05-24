import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_code = '''        st.divider()
        if st.button("🚪 CERRAR SESIÓN"):'''

new_code = '''        tc_path = os.path.join(BASE_DIR, '..', 'database', 'master_tipo_cambio.json')
        banda_piso = 0
        banda_techo = 0
        ultima_actualizacion = 'N/A'
        if os.path.exists(tc_path):
            with open(tc_path, 'r', encoding='utf-8') as f:
                try:
                    tc = json.load(f)
                    banda_piso = tc.get('banda_piso', 0)
                    banda_techo = tc.get('banda_techo', 0)
                    ultima_actualizacion = tc.get('ultima_actualizacion', 'N/A')
                except: pass
        
        st.sidebar.divider()
        st.sidebar.markdown("**💱 Tipo de Cambio Vigente**")
        st.sidebar.markdown(f"🟢 Piso: **Gs {banda_piso:,}**")
        st.sidebar.markdown(f"🔵 Techo: **Gs {banda_techo:,}**")
        st.sidebar.caption(f"Actualizado: {ultima_actualizacion}")

        st.divider()
        if st.button("🚪 CERRAR SESIÓN"):'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Sidebar updated")
else:
    print("Sidebar NOT updated, string not found")
