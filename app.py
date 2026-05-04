import streamlit as st
import pandas as pd
import os
import json
import hashlib
import requests
from datetime import datetime
from pdf_generator import generate_invoice_pdf

# Configuración de página
st.set_page_config(page_title="SOLPRO - Facturación Corporativa", layout="wide", page_icon="📄")

# Estilos Corporativos Premium
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
    
    * {
        font-family: 'Outfit', sans-serif;
    }
    
    .main {
        background-color: #f8fafc;
    }
    
    /* Header Corporativo */
    .header-container {
        background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%);
        padding: 20px;
        border-radius: 10px;
        color: white;
        margin-bottom: 30px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: #ffffff;
        border-right: 1px solid #e2e8f0;
    }
    
    /* Botones Premium */
    .stButton>button {
        border-radius: 8px;
        height: 3.5em;
        background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
        color: white;
        font-weight: 600;
        border: none;
        transition: all 0.3s ease;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
    }
    
    /* Mejorar Visibilidad de Inputs */
    .stTextInput input, .stNumberInput input, .stTextArea textarea, .stSelectbox div[data-baseweb="select"] {
        background-color: #ffffff !important;
        border: 2px solid #e2e8f0 !important;
        border-radius: 10px !important;
        font-size: 16px !important;
        padding: 12px !important;
        color: #1e293b !important;
        transition: all 0.2s ease;
    }
    
    .stTextInput input:focus, .stNumberInput input:focus, .stTextArea textarea:focus {
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15) !important;
        background-color: #fff !important;
    }

    /* Etiquetas más legibles */
    label p {
        font-size: 15px !important;
        font-weight: 600 !important;
        color: #334155 !important;
        margin-bottom: 8px !important;
    }

    /* Fix para Selectbox - Sin truncado y Menú Adaptable */
    div[data-testid="stSelectbox"] [data-baseweb="select"] div {
        white-space: normal !important;
        text-overflow: initial !important;
        line-height: 1.2 !important;
        padding: 2px !important;
    }
    
    div[data-baseweb="popover"] {
        min-width: 400px !important;
        max-width: 850px !important;
        width: auto !important;
    }
    
    div[data-baseweb="popover"] li {
        font-size: 14px !important;
        white-space: normal !important;
        padding: 10px 15px !important;
        border-bottom: 1px solid #f1f5f9;
        line-height: 1.3 !important;
    }
    
    div[data-baseweb="popover"] li:hover {
        background-color: #eff6ff !important;
    }

    /* Filas de la Tabla de Productos */
    .product-row {
        background-color: #ffffff;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        margin-bottom: 10px;
        transition: background-color 0.2s ease;
    }
    
    .product-row:hover {
        background-color: #f8fafc;
        border-color: #3b82f6;
    }

    /* Estilo de Tarjetas */
    .card {
        background-color: white;
        padding: 25px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        margin-bottom: 20px;
    }
    </style>
    """, unsafe_allow_html=True)

# Rutas de archivos dinámicas (compatibles con Local y Servidor)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_FILE = os.path.join(BASE_DIR, "LISTA DE PRECIOS DE VENTA.xlsx")
SALES_FILE = os.path.join(BASE_DIR, "VENTAS TOTALES 2026.xlsx")
CLIENTS_FILE = os.path.join(BASE_DIR, "clientes.json")
USERS_FILE = os.path.join(BASE_DIR, "usuarios.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "Facturas_Emitidas")
LOGO_FILE = os.path.join(BASE_DIR, "factura solpro 2026.png")

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# --- SEGURIDAD Y SESIÓN ---
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
if 'user_data' not in st.session_state:
    st.session_state.user_data = None

# Funciones de carga
@st.cache_data(ttl=60) # Cache de 1 minuto para detectar cambios manuales en Excel
def load_products():
    if os.path.exists(PRODUCTS_FILE):
        df = pd.read_excel(PRODUCTS_FILE)
        # Limpiar nombres de columnas
        df.columns = [str(c).strip().upper() for c in df.columns]
        
        # Mapeo inteligente
        if 'STOCK' in df.columns:
            df = df.rename(columns={'STOCK': 'STOCK_V'})
        
        df_final = pd.DataFrame()
        df_final['CODIGO'] = df.iloc[:, 0].astype(str)
        df_final['LINEA'] = df.iloc[:, 1].astype(str)
        df_final['DESCRIPCION'] = df.iloc[:, 2].astype(str)
        df_final['PRECIO'] = df.iloc[:, 3].astype(str) # No forzar a numérico porque tiene letras (Gs., U$D)
        
        if len(df.columns) >= 6:
            df_final['STOCK'] = pd.to_numeric(df.iloc[:, 5], errors='coerce').fillna(0)
        else:
            df_final['STOCK'] = 0
            
        # Eliminar fila de encabezado si existe
        mask_ref = df_final['CODIGO'].str.contains('ID REF|CODIGO', case=False, na=False)
        df_final = df_final[~mask_ref].reset_index(drop=True)
        
        return df_final
    return pd.DataFrame(columns=['CODIGO', 'LINEA', 'DESCRIPCION', 'PRECIO', 'STOCK'])

@st.cache_data
def load_clients():
    all_clients = {}
    
    # 1. Cargar desde JSON (base local enriquecida)
    if os.path.exists(CLIENTS_FILE):
        try:
            with open(CLIENTS_FILE, 'r', encoding='utf-8') as f:
                json_clients = json.load(f)
                for c in json_clients:
                    all_clients[c['nombre'].upper()] = c
        except: pass
        
    # 2. Extraer desde Excel de Ventas (histórico)
    if os.path.exists(SALES_FILE):
        try:
            df_sales = pd.read_excel(SALES_FILE)
            if 'CLIENTE' in df_sales.columns:
                unique_names = df_sales['CLIENTE'].dropna().unique()
                for name in unique_names:
                    name_up = str(name).strip().upper()
                    if name_up not in all_clients and name_up != "ANULADO":
                        all_clients[name_up] = {
                            "nombre": name_up,
                            "ruc": "",
                            "direccion": "",
                            "telefono": ""
                        }
        except: pass
        
    return sorted(list(all_clients.values()), key=lambda x: x['nombre'])

def save_client(client_data):
    clients = []
    if os.path.exists(CLIENTS_FILE):
        try:
            with open(CLIENTS_FILE, 'r', encoding='utf-8') as f:
                clients = json.load(f)
        except: pass
    
    found = False
    for i, c in enumerate(clients):
        if c['nombre'].upper() == client_data['nombre'].upper():
            clients[i] = client_data
            found = True
            break
    if not found:
        clients.append(client_data)
        
    with open(CLIENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(clients, f, ensure_ascii=False, indent=4)
    st.cache_data.clear() # Forzar recarga de clientes

def update_inventory(sales_list):
    """Actualiza el stock en el archivo de precios basándose en las ventas."""
    if os.path.exists(PRODUCTS_FILE):
        # Leer el archivo original (manteniendo formato de columnas original)
        df = pd.read_excel(PRODUCTS_FILE)
        
        # Identificar la fila de encabezado "ID REF" si existe
        start_row = 0
        if not df.empty and str(df.iloc[0, 0]).strip() == 'ID REF':
            start_row = 1

        for sale in sales_list:
            codigo = sale['COD_PRODUCTO']
            # Buscar en la primera columna (donde están los IDs)
            mask = df.iloc[start_row:, 0].astype(str).str.strip() == str(codigo).strip()
            if mask.any():
                idx = df[mask].index[0]
                # Column6 es el stock (índice 5)
                # Si no existe la columna 6, crearla
                if len(df.columns) < 6:
                    # Asegurar que existan columnas hasta el índice 5
                    for col_idx in range(len(df.columns), 6):
                        df[f'Column{col_idx+1}'] = 0
                
                try:
                    current_stock = pd.to_numeric(df.iloc[idx, 5], errors='coerce')
                    if pd.isna(current_stock): current_stock = 0
                    
                    cant_vendida = sale.get('_CANT_NUM', 0)
                    df.iloc[idx, 5] = current_stock - cant_vendida
                except Exception as e:
                    print(f"Error actualizando stock para {codigo}: {e}")
        
        df.to_excel(PRODUCTS_FILE, index=False)
        st.cache_data.clear()

def log_sales(sales_list):
    if os.path.exists(SALES_FILE):
        df = pd.read_excel(SALES_FILE)
        new_rows = pd.DataFrame(sales_list)
        df = pd.concat([df, new_rows], ignore_index=True)
        df.to_excel(SALES_FILE, index=False)

def get_next_invoice_number():
    if os.path.exists(SALES_FILE):
        df = pd.read_excel(SALES_FILE)
        if not df.empty and 'NRO_FACTURA' in df.columns:
            try:
                last_num = pd.to_numeric(df['NRO_FACTURA'], errors='coerce').max()
                if pd.isna(last_num): return "0501"
                return str(int(last_num) + 1).zfill(4)
            except: return "0501"
    return "0501"

def void_invoice(invoice_num):
    if os.path.exists(SALES_FILE):
        df = pd.read_excel(SALES_FILE)
        mask = df['NRO_FACTURA'].astype(str) == str(invoice_num)
        if mask.any():
            df.loc[mask, 'DESCRIPCION'] = "ANULADA"
            df.loc[mask, 'PRECIO GS'] = 0
            df.loc[mask, 'PRECIO USD'] = 0
            df.to_excel(SALES_FILE, index=False)
            return True
    return False

@st.cache_data(ttl=60)
def load_sales():
    if os.path.exists(SALES_FILE):
        try:
            df = pd.read_excel(SALES_FILE)
            if not df.empty:
                # Asegurar que FECHA sea datetime
                df['FECHA'] = pd.to_datetime(df['FECHA'], errors='coerce')
                return df.sort_values(by='FECHA', ascending=False)
        except: pass
    return pd.DataFrame()

def call_ai(prompt, system_prompt, api_url):
    try:
        payload = {
            "model": "local-model", 
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        }
        # Limpiar la URL por si acaso
        api_url = api_url.strip().rstrip('/')
        response = requests.post(f"{api_url}/chat/completions", json=payload, timeout=30)
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content']
        else:
            return f"Error de IA ({response.status_code}): {response.text}"
    except Exception as e:
        return f"Error de conexión: {str(e)}. Verifica que el túnel de la PC Madre esté activo."

# --- INTERFAZ DE LOGIN ---
if not st.session_state.logged_in:
    st.markdown("""
        <div style='display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column;'>
            <div style='background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; width: 400px;'>
                <h1 style='text-align: center; color: #1e3a8a; margin-bottom: 30px;'>SOLPRO ACCESS</h1>
    """, unsafe_allow_html=True)
    
    with st.form("login_form"):
        user_input = st.text_input("Usuario")
        pass_input = st.text_input("Contraseña", type="password")
        submit = st.form_submit_button("INICIAR SESIÓN", use_container_width=True)
        
        if submit:
            users = load_users()
            hashed_input = hash_password(pass_input)
            user_found = next((u for u in users if u['usuario'] == user_input and u['password'] == hashed_input), None)
            
            if user_found:
                st.session_state.logged_in = True
                st.session_state.user_data = user_found
                st.success(f"Bienvenido, {user_found['nombre']}")
                st.rerun()
            else:
                st.error("Credenciales incorrectas")
    st.markdown("</div></div>", unsafe_allow_html=True)
    st.stop() # Detener ejecucion si no esta logueado

# --- CONTENIDO PROTEGIDO ---

# HEADER CORPORATIVO
with st.container():
    col_l, col_r = st.columns([1, 4])
    with col_l:
        if os.path.exists(LOGO_FILE):
            st.image(LOGO_FILE, width=150)
        else:
            st.title("SOLPRO")
    with col_r:
        st.markdown(f"""
            <div class="header-container">
                <div style="font-size: 28px; font-weight: 700;">SISTEMA DE GESTIÓN DE VENTAS 2026</div>
                <div style="text-align: right;">
                    <span style="opacity: 0.8;">Fecha: {datetime.now().strftime('%d/%m/%Y')}</span><br>
                    <span style="font-weight: 600;">SOL PRO Professional</span>
                </div>
            </div>
        """, unsafe_allow_html=True)

# SIDEBAR PARA CONFIGURACIÓN Y CLIENTES
with st.sidebar:
    st.header("👤 Selección de Cliente")
    clients = load_clients()
    client_names = ["-- NUEVO CLIENTE --"] + [c['nombre'] for c in clients]
    selected_client_name = st.selectbox("Buscar Cliente", client_names)
    
    selected_client_data = None
    if selected_client_name != "-- NUEVO CLIENTE --":
        selected_client_data = next(c for c in clients if c['nombre'] == selected_client_name)

    nombre = st.text_input("Razón Social", value=selected_client_data['nombre'] if selected_client_data else "")
    ruc = st.text_input("RUC / C.I.", value=selected_client_data['ruc'] if selected_client_data else "")
    direccion = st.text_input("Dirección", value=selected_client_data['direccion'] if selected_client_data else "")
    telefono = st.text_input("Teléfono", value=selected_client_data['telefono'] if selected_client_data else "")
    
    st.divider()
    st.header("⚙️ Configuración")
    vendedor = st.text_input("Vendedor", value=st.session_state.user_data['nombre'])
    nro_factura = st.text_input("Nro. Factura (Siguiente)", value=get_next_invoice_number())
    condicion = st.radio("Condición", ["CONTADO", "CRÉDITO"], horizontal=True)
    moneda = st.radio("Moneda", ["PYG", "USD"], horizontal=True)

    st.divider()
    if st.button("🔄 SINCRONIZAR EXCEL (STOCK)"):
        st.cache_data.clear()
        st.success("Datos sincronizados!")

    if st.session_state.user_data['rol'] == 'admin':
        st.divider()
        st.header("🤖 SOLPRO AI Config")
        ai_url = st.text_input("URL de LM Studio (Túnel)", value="http://localhost:1234/v1", help="Pega aquí la URL de Ngrok o Cloudflare")
        if st.button("Guardar Configuración AI"):
            st.success("¡Datos sincronizados!")
            st.rerun()

    st.divider()
    if st.button("🚪 CERRAR SESIÓN"):
        st.session_state.logged_in = False
        st.session_state.user_data = None
        st.rerun()

# TABS PRINCIPALES
# Restringir pestañas según el rol
if st.session_state.user_data['rol'] == 'admin':
    tab1, tab2, tab3, tab4, tab5 = st.tabs(["🛒 Facturación", "🚫 Anulaciones", "📦 Inventario", "📊 Historial", "🤖 Asistente AI"])
else:
    tab1, = st.tabs(["🛒 Facturación"])
    st.info(f"Sesión activa: {st.session_state.user_data['nombre']} (Vendedor)")

with tab1:
    df_products = load_products()
    # Encabezado de "Tabla"
    st.markdown("""
        <div style="display: flex; background: #1e3a8a; color: white; padding: 10px; border-radius: 8px 8px 0 0; font-weight: bold; margin-bottom: 10px;">
            <div style="flex: 0.5;">CANT.</div>
            <div style="flex: 3;">PRODUCTO / DESCRIPCIÓN</div>
            <div style="flex: 0.8;">STOCK</div>
            <div style="flex: 1.5;">PRECIO UNIT.</div>
            <div style="flex: 1;">TOTAL</div>
            <div style="flex: 0.3;"></div>
        </div>
    """, unsafe_allow_html=True)

    total_factura = 0
    items_to_remove = []

    if 'factura_items' not in st.session_state:
        st.session_state.factura_items = [{"cant": 1, "desc": "", "precio": 0.0, "codigo": ""}]

    for i, item in enumerate(st.session_state.factura_items):
        st.markdown(f'<div class="product-row">', unsafe_allow_html=True)
        c1, c2, c_stock_col, c3, c4, c5 = st.columns([0.5, 3, 0.8, 1.5, 1, 0.3])
        
        with c1:
            cant = st.number_input("n", min_value=1, value=item['cant'], key=f"cant_{i}", label_visibility="collapsed")
        
        with c2:
            search_term = st.text_input("s", key=f"search_{i}", placeholder="Código o Nombre...", label_visibility="collapsed")
            
            filtered = df_products[
                df_products['DESCRIPCION'].str.contains(search_term, case=False, na=False) |
                df_products['CODIGO'].str.contains(search_term, case=False, na=False)
            ] if search_term else pd.DataFrame()
            
            if not filtered.empty:
                selected_idx = st.selectbox("p", filtered.index, 
                                           format_func=lambda x: f"{df_products.loc[x, 'CODIGO']} | {df_products.loc[x, 'DESCRIPCION']} [Stock: {int(df_products.loc[x, 'STOCK'])}]",
                                           key=f"suggest_{i}", label_visibility="collapsed")
                
                stock_actual = int(df_products.loc[selected_idx, 'STOCK'])
                st.markdown(
                    f"<div style='background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:4px 10px;margin:2px 0;font-size:13px;color:#166534;'>📦 Stock disponible: <b>{stock_actual}</b></div>",
                    unsafe_allow_html=True
                )
                if cant > stock_actual and stock_actual > 0:
                    st.error(f"⚠️ Cantidad supera stock (Disp: {stock_actual})")

                if st.button(f"✓ Seleccionar", key=f"btn_sel_{i}"):
                    # Guardar en session_state directamente (no solo en item local)
                    st.session_state.factura_items[i]['desc'] = df_products.loc[selected_idx, 'DESCRIPCION']
                    st.session_state.factura_items[i]['codigo'] = df_products.loc[selected_idx, 'CODIGO']
                    st.rerun()
            
            desc = st.text_area("d", value=st.session_state.factura_items[i]['desc'], key=f"desc_{i}", height=60, label_visibility="collapsed", placeholder="Descripción del producto...")

        
        with c_stock_col:
            codigo_actual = st.session_state.factura_items[i].get('codigo', '')
            if codigo_actual:
                mask = df_products['CODIGO'].astype(str) == str(codigo_actual)
                if mask.any():
                    s_val = int(df_products.loc[mask, 'STOCK'].values[0])
                    c_col = "#166534" if s_val > 0 else "#991b1b"
                    b_col = "#dcfce7" if s_val > 0 else "#fee2e2"
                    st.markdown(
                        f"<div style='background:{b_col};border-radius:8px;padding:8px 6px;text-align:center;color:{c_col};font-weight:bold;font-size:15px;margin-top:6px;'>{s_val}<br><span style='font-size:10px;font-weight:normal;'>und.</span></div>",
                        unsafe_allow_html=True
                    )
            else:
                st.markdown("<div style='padding:8px 6px;text-align:center;color:#94a3b8;font-size:13px;margin-top:6px;'>—</div>", unsafe_allow_html=True)

        with c3:
            precio = st.number_input("p", value=item['precio'], key=f"precio_{i}", format="%.2f", label_visibility="collapsed")
        
        with c4:
            subtotal = cant * precio
            st.markdown(f"<div style='padding-top: 10px; font-weight: bold;'>{subtotal:,.0f}</div>", unsafe_allow_html=True)
        
        with c5:
            if st.button("❌", key=f"del_{i}"):
                items_to_remove.append(i)
        
        item['cant'] = cant
        item['desc'] = desc
        item['precio'] = precio
        item['total'] = subtotal
        total_factura += subtotal
        st.markdown("</div>", unsafe_allow_html=True)
        st.markdown("<hr style='margin: 10px 0; opacity: 0.1;'>", unsafe_allow_html=True)

    if items_to_remove:
        for idx in sorted(items_to_remove, reverse=True):
            st.session_state.factura_items.pop(idx)
        st.rerun()

    c_foot1, c_foot2 = st.columns([2, 1])
    with c_foot1:
        if st.button("➕ AGREGAR OTRO PRODUCTO"):
            st.session_state.factura_items.append({"cant": 1, "desc": "", "precio": 0.0, "codigo": ""})
            st.rerun()

    st.divider()
    col_sum1, col_sum2 = st.columns([2, 1])
    with col_sum2:
        total_str = f"{moneda} {total_factura:,.2f}" if moneda=="USD" else f"₲ {total_factura:,.0f}"
        st.markdown(f"""
            <div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #1e3a8a; text-align: center;">
                <span style="font-size: 14px; color: #64748b;">TOTAL A FACTURAR</span><br>
                <span style="font-size: 32px; font-weight: 700; color: #1e3a8a;">
                    {total_str}
                </span>
            </div>
        """, unsafe_allow_html=True)
        
        if st.button("🖨️ EMITIR FACTURA Y REGISTRAR EN VENTAS TOTALES"):
            if not nombre or not ruc or not nro_factura or not st.session_state.factura_items:
                st.error("⚠️ Error: Complete los datos del cliente y agregue productos.")
            else:
                with st.spinner("Generando PDF y actualizando planilla..."):
                    client_obj = {"nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono}
                    save_client(client_obj)
                    
                    pdf_data = {
                        "nro_factura": nro_factura,
                        "fecha": datetime.now().strftime("%d/%m/%Y"),
                        "nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono,
                        "condicion": condicion, "moneda": moneda,
                        "productos": [{"c": it['cant'], "d": it['desc'], "p": it['precio'], "t": it['total']} for it in st.session_state.factura_items]
                    }
                    
                    pdf_filename = f"Factura_{nro_factura}_{datetime.now().strftime('%Y%m%d')}.pdf"
                    pdf_path = os.path.join(OUTPUT_DIR, pdf_filename)
                    generate_invoice_pdf(pdf_data, pdf_path)
                    
                    sales_to_log = []
                    for it in st.session_state.factura_items:
                        sales_to_log.append({
                            "FECHA": datetime.now(),
                            "DESCRIPCION": f"{it['cant']} {it['desc']}",
                            "CLIENTE": nombre,
                            "PRECIO GS": it['total'] if moneda == "PYG" else None,
                            "PRECIO USD": it['total'] if moneda == "USD" else None,
                            "NRO_FACTURA": nro_factura,
                            "VENDEDOR": vendedor,
                            "FORMA PAGO": condicion,
                            "COD_PRODUCTO": it.get('codigo', ''),
                            "LINEA": "FACTURACIÓN",
                            "_CANT_NUM": it['cant'] # Auxiliar para inventario
                        })
                    log_sales(sales_to_log)
                    update_inventory(sales_to_log)
                    
                    st.success(f"✅ Factura {nro_factura} emitida y registrada.")
                    
                    # Botón para descarga inmediata
                    with open(pdf_path, "rb") as f:
                        st.download_button(
                            label="📥 DESCARGAR FACTURA PDF",
                            data=f,
                            file_name=pdf_filename,
                            mime="application/pdf"
                        )
                    
                    st.info("Haga clic arriba para guardar el archivo. Luego puede limpiar los campos para una nueva factura.")
                    st.session_state.factura_items = []

if st.session_state.user_data['rol'] == 'admin':
    with tab2:
        st.header("🚫 Módulo de Anulación")
        st.info("Utilice este módulo para marcar una factura como ANULADA en el registro central.")
        with st.container():
            st.markdown('<div class="card">', unsafe_allow_html=True)
            inv_void = st.text_input("Número de Factura a Anular", placeholder="Ej: 0501")
            if st.button("CONFIRMAR ANULACIÓN DEFINITIVA"):
                if inv_void:
                    if void_invoice(inv_void):
                        st.success(f"✅ La factura {inv_void} ha sido anulada con éxito.")
                    else:
                        st.error("❌ No se encontró la factura en el registro.")
                else:
                    st.warning("Ingrese un número válido.")
            st.markdown('</div>', unsafe_allow_html=True)

    with tab3:
        df_inv = load_products()

        st.markdown("""
            <div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;'>
                <h3 style='margin:0; color:#1e3a8a;'>📦 Stock Disponible</h3>
            </div>
        """, unsafe_allow_html=True)

        col_search, col_line = st.columns([2, 1])
        with col_search:
            filtro = st.text_input("🔍 Buscar producto...", placeholder="Nombre o código...", label_visibility="visible")
        with col_line:
            lineas = ["TODAS"] + sorted(df_inv['LINEA'].dropna().unique().tolist())
            filtro_linea = st.selectbox("Línea", lineas)

        # Aplicar filtros
        df_show = df_inv.copy()
        if filtro:
            df_show = df_show[
                df_show['DESCRIPCION'].str.contains(filtro, case=False, na=False) |
                df_show['CODIGO'].str.contains(filtro, case=False, na=False)
            ]
        if filtro_linea != "TODAS":
            df_show = df_show[df_show['LINEA'] == filtro_linea]

        # Métricas resumen
        total_prods = len(df_show)
        con_stock = (df_show['STOCK'] > 0).sum()
        sin_stock = (df_show['STOCK'] == 0).sum()

        m1, m2, m3 = st.columns(3)
        m1.metric("Total Productos", total_prods)
        m2.metric("✅ Con Stock", con_stock)
        m3.metric("⚠️ Sin Stock", sin_stock)

        st.divider()

        # Tabla de inventario con colores
        st.markdown("""
            <div style="display:flex; background:#1e3a8a; color:white; padding:10px 8px;
                        border-radius:8px 8px 0 0; font-weight:bold; font-size:13px;">
                <div style="flex:1;">CÓDIGO</div>
                <div style="flex:1;">LÍNEA</div>
                <div style="flex:4;">DESCRIPCIÓN</div>
                <div style="flex:1; text-align:center;">STOCK</div>
            </div>
        """, unsafe_allow_html=True)

        for _, row in df_show.iterrows():
            stock_val = int(row['STOCK'])
            if stock_val == 0:
                bg = "#fff1f2"
                badge_bg = "#ef4444"
                badge_text = "SIN STOCK"
            elif stock_val <= 3:
                bg = "#fffbeb"
                badge_bg = "#f59e0b"
                badge_text = f"{stock_val} und."
            else:
                bg = "#f0fdf4"
                badge_bg = "#22c55e"
                badge_text = f"{stock_val} und."

            st.markdown(f"""
                <div style="display:flex; align-items:center; background:{bg};
                            padding:8px 8px; border-bottom:1px solid #e2e8f0;
                            font-size:13px;">
                    <div style="flex:1; color:#64748b; font-family:monospace;">{row['CODIGO']}</div>
                    <div style="flex:1; color:#475569;">{row['LINEA']}</div>
                    <div style="flex:4; font-weight:500; color:#1e293b;">{row['DESCRIPCION']}</div>
                    <div style="flex:1; text-align:center;">
                        <span style="background:{badge_bg}; color:white; padding:3px 10px;
                                    border-radius:20px; font-weight:bold; font-size:12px;">
                            {badge_text}
                        </span>
                    </div>
                </div>
            """, unsafe_allow_html=True)

if st.session_state.user_data['rol'] == 'admin':
    with tab4:
        st.markdown("<h2 style='color:#1e3a8a;'>📊 Historial de Ventas Corporativas</h2>", unsafe_allow_html=True)
        
        df_sales = load_sales()
        
        if df_sales.empty:
            st.warning("No hay registros de ventas todavía.")
        else:
            # Filtros de Historial
            c_h1, c_h2, c_h3 = st.columns([2, 1, 1])
            with c_h1:
                search_hist = st.text_input("🔍 Buscar por Cliente o Producto", placeholder="Nombre...")
            with c_h2:
                clients_list = ["TODOS"] + sorted(df_sales['CLIENTE'].dropna().unique().tolist())
                filter_client = st.selectbox("Filtrar por Cliente", clients_list)
            with c_h3:
                inv_list = ["TODAS"] + sorted(df_sales['NRO_FACTURA'].astype(str).unique().tolist())
                filter_inv = st.selectbox("Filtrar por Nro Factura", inv_list)
            
            # Aplicar filtros
            df_hist = df_sales.copy()
            if search_hist:
                df_hist = df_hist[
                    df_hist['CLIENTE'].str.contains(search_hist, case=False, na=False) |
                    df_hist['DESCRIPCION'].str.contains(search_hist, case=False, na=False)
                ]
            if filter_client != "TODOS":
                df_hist = df_hist[df_hist['CLIENTE'] == filter_client]
            if filter_inv != "TODAS":
                df_hist = df_hist[df_hist['NRO_FACTURA'].astype(str) == filter_inv]
            
            # Resumen del Historial Filtrado
            total_gs = df_hist['PRECIO GS'].sum()
            total_usd = df_hist['PRECIO USD'].sum()
            
            r1, r2, r3 = st.columns(3)
            r1.metric("Ventas Registradas", len(df_hist))
            r2.metric("Total Gs.", f"₲ {total_gs:,.0f}".replace(",", "."))
            r3.metric("Total USD", f"$ {total_usd:,.2f}")
            
            st.divider()
            
            # Mostrar tabla
            st.dataframe(
                df_hist[['FECHA', 'NRO_FACTURA', 'CLIENTE', 'DESCRIPCION', 'PRECIO GS', 'PRECIO USD', 'VENDEDOR', 'FORMA PAGO']],
                use_container_width=True,
                hide_index=True
            )
            
            # Botón para descargar el Excel completo
            st.download_button(
                label="📥 Exportar Historial Completo (Excel)",
                data=open(SALES_FILE, 'rb'),
                file_name=f"HISTORIAL_VENTAS_SOLPRO_{datetime.now().strftime('%Y%m%d')}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

        st.markdown("<div style='height:20px;'></div>", unsafe_allow_html=True)
        if st.button("🔄 Actualizar Inventario", key="refresh_inv"):
            st.cache_data.clear()
            st.rerun()

if st.session_state.user_data['rol'] == 'admin':
    with tab5:
        st.markdown("<h2 style='color:#1e3a8a;'>🤖 Asistente Inteligente SOLPRO</h2>", unsafe_allow_html=True)
        st.info("Este asistente está conectado a tu **PC Madre**. Puede analizar ventas, stock y ayudarte con decisiones de negocio.")
        
        # Historial de chat en session_state
        if "chat_history" not in st.session_state:
            st.session_state.chat_history = []
            
        for msg in st.session_state.chat_history:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
                
        if prompt := st.chat_input("¿En qué puedo ayudarte hoy?"):
            st.session_state.chat_history.append({"role": "user", "content": prompt})
            with st.chat_message("user"):
                st.markdown(prompt)
                
            with st.chat_message("assistant"):
                # Preparar Contexto
                df_p = load_products()
                df_s = load_sales()
                
                contexto = f"""
                Eres el asistente de gestión de SOLPRO. 
                DATOS ACTUALES:
                - Productos en catálogo: {len(df_p) if not df_p.empty else 0}
                - Ventas registradas: {len(df_s) if not df_s.empty else 0}
                - Productos con bajo stock (<5): {len(df_p[df_p['STOCK'] < 5]) if not df_p.empty else 0}
                - Última venta: {df_s.iloc[0]['CLIENTE'] if not df_s.empty else 'Ninguna'}
                """
                
                with st.spinner("Pensando..."):
                    respuesta = call_ai(prompt, contexto, ai_url)
                    st.markdown(respuesta)
                    st.session_state.chat_history.append({"role": "assistant", "content": respuesta})
