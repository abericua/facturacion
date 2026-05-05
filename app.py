import streamlit as st
import pandas as pd
import os
import json
import hashlib
import base64
import requests
from datetime import datetime
from pdf_generator import generate_invoice_pdf

# Configuración de página
st.set_page_config(
    page_title="SOLPRO - Facturación Corporativa", 
    layout="wide", 
    page_icon="📄",
    initial_sidebar_state="expanded"
)

# --- SISTEMA DE DISEÑO CORPORATIVO SOLPRO (MODO OSCURO) ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800&family=Source+Sans+Pro:wght@300;400;600&display=swap');
    
    :root {
        --solpro-gold: #f1c232;
        --solpro-black: #0b0f19;
        --solpro-gray: #1e293b;
        --solpro-text: #f8fafc;
        --solpro-text-muted: #94a3b8;
    }

    /* Fondo Global */
    .stApp {
        background-color: var(--solpro-black);
        color: var(--solpro-text);
    }
    
    * {
        font-family: 'Source Sans Pro', sans-serif;
    }
    
    h1, h2, h3, .header-title {
        font-family: 'Raleway', sans-serif !important;
        font-weight: 800 !important;
        letter-spacing: -0.5px;
    }

    /* Header Corporativo Premium */
    .header-container {
        background: linear-gradient(135deg, #000000 0%, #1e293b 100%);
        padding: 30px;
        border-radius: 4px;
        border-bottom: 3px solid var(--solpro-gold);
        margin-bottom: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    
    /* Sidebar Industrial */
    [data-testid="stSidebar"] {
        background-color: #05070a;
        border-right: 1px solid var(--solpro-gray);
    }
    
    [data-testid="stSidebar"] .stMarkdown h1, [data-testid="stSidebar"] .stMarkdown h2 {
        color: var(--solpro-gold) !important;
        font-size: 1.2rem !important;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    /* Botones Solpro (Estilo Industrial) */
    .stButton>button {
        border-radius: 2px !important;
        height: 3.8em;
        background: var(--solpro-gold) !important;
        color: #000000 !important;
        font-weight: 800 !important;
        border: none !important;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        width: 100%;
        margin-top: 10px;
    }
    
    .stButton>button:hover {
        background: #ffffff !important;
        transform: translateY(-1px);
        box-shadow: 0 5px 15px rgba(241, 194, 50, 0.3);
    }
    
    .stButton>button:active {
        transform: translateY(1px);
    }

    /* Inputs Oscuros con Acento Dorado */
    .stTextInput input, .stNumberInput input, .stTextArea textarea, .stSelectbox div[data-baseweb="select"] {
        background-color: #161b22 !important;
        border: 1px solid var(--solpro-gray) !important;
        border-radius: 2px !important;
        color: white !important;
        padding: 12px !important;
        transition: border-color 0.3s ease;
    }
    
    .stTextInput input:focus, .stNumberInput input:focus, .stTextArea textarea:focus {
        border-color: var(--solpro-gold) !important;
        box-shadow: 0 0 0 1px var(--solpro-gold) !important;
    }

    /* Labels */
    label p {
        color: var(--solpro-gold) !important;
        font-weight: 600 !important;
        text-transform: uppercase;
        font-size: 0.85rem !important;
        letter-spacing: 0.5px;
    }

    /* Tabs Personalizados */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: transparent;
    }

    .stTabs [data-baseweb="tab"] {
        background-color: #161b22;
        border: 1px solid var(--solpro-gray);
        color: var(--solpro-text-muted);
        padding: 10px 25px;
        border-radius: 2px 2px 0 0;
        font-weight: 600;
    }

    .stTabs [aria-selected="true"] {
        background-color: var(--solpro-gold) !important;
        color: #000000 !important;
        border-color: var(--solpro-gold) !important;
    }

    /* Estilo de Tarjetas y Filas de Producto */
    .card, .product-row {
        background-color: #161b22;
        padding: 20px;
        border-radius: 2px;
        border: 1px solid var(--solpro-gray);
        margin-bottom: 15px;
    }
    
    .product-row:hover {
        border-color: var(--solpro-gold);
        background-color: #1c2128;
    }

    /* Métricas */
    [data-testid="stMetricValue"] {
        color: var(--solpro-gold) !important;
        font-weight: 800 !important;
    }
    
    /* Login Form Fix */
    .login-container {
        max-width: 450px;
        margin: 100px auto;
        background: #161b22;
        padding: 50px;
        border-radius: 4px;
        border-top: 5px solid var(--solpro-gold);
        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    </style>
    """, unsafe_allow_html=True)

# Rutas de archivos dinámicas
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_FILE = os.path.join(BASE_DIR, "LISTA DE PRECIOS DE VENTA.xlsx")
SALES_FILE = os.path.join(BASE_DIR, "VENTAS TOTALES 2026.xlsx")
CLIENTS_FILE = os.path.join(BASE_DIR, "clientes.json")
USERS_FILE = os.path.join(BASE_DIR, "usuarios.json")
REDESIGN_FILE = os.path.join(BASE_DIR, "solpro-login-redesign.html")
OUTPUT_DIR = os.path.join(BASE_DIR, "Facturas_Emitidas")
# CAMBIO DE LOGO A VERSIÓN CORPORATIVA
LOGO_FILE = os.path.join(BASE_DIR, "LOGO  2D FONDO NEGRO 2026.png")

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

# --- MANEJO DE LOGIN POR URL ---
if not st.session_state.logged_in:
    # Usamos get() para manejar parámetros de forma segura
    u_param = st.query_params.get("u")
    p_param = st.query_params.get("p")
    
    if u_param and p_param:
        try:
            # En algunas versiones de Streamlit los parámetros pueden venir como listas
            user_url = u_param[0] if isinstance(u_param, list) else u_param
            pass_raw = p_param[0] if isinstance(p_param, list) else p_param
            
            # Asegurar padding correcto para base64
            missing_padding = len(pass_raw) % 4
            if missing_padding:
                pass_raw += '=' * (4 - missing_padding)
            
            pass_url = base64.b64decode(pass_raw).decode('utf-8')
            users = load_users()
            hashed_input = hash_password(pass_url)
            user_found = next((u for u in users if u['usuario'] == user_url and u['password'] == hashed_input), None)
            
            if user_found:
                st.session_state.logged_in = True
                st.session_state.user_data = user_found
                # Limpiar parámetros de la URL para que no se vean
                st.query_params.clear()
                st.rerun()
            else:
                # Si falló el login, mostramos un error temporal (opcional)
                st.error("Credenciales de URL inválidas")
        except Exception as e:
            # st.error(f"Error procesando login: {e}")
            pass

# Funciones de carga
def clean_price(price_str):
    if pd.isna(price_str): return 0.0
    price_str = str(price_str).upper()
    # Remover símbolos comunes y espacios
    for s in ["GS.", "U$D", "GS", "USD", ".", " ", "$"]:
        price_str = price_str.replace(s, "")
    # Reemplazar coma por punto para decimales si los hay
    price_str = price_str.replace(",", ".")
    try:
        return float(price_str)
    except:
        return 0.0

@st.cache_data(ttl=60)
def load_products():
    if os.path.exists(PRODUCTS_FILE):
        df = pd.read_excel(PRODUCTS_FILE)
        # Buscar la fila real de cabecera para evitar problemas si hay filas vacías al inicio
        start_row = 0
        for i in range(min(len(df), 10)):
            if "ID REF" in str(df.iloc[i, 0]).upper():
                start_row = i + 1
                break
        
        df_final = pd.DataFrame()
        df_final['CODIGO'] = df.iloc[start_row:, 0].astype(str).str.strip()
        df_final['LINEA'] = df.iloc[start_row:, 1].astype(str).str.strip()
        df_final['DESCRIPCION'] = df.iloc[start_row:, 2].astype(str).str.strip()
        
        # Limpieza de precio
        df_final['PRECIO'] = df.iloc[start_row:, 3].apply(clean_price)
        
        # Manejo de Stock (Columna 5)
        if len(df.columns) >= 6:
            df_final['STOCK'] = pd.to_numeric(df.iloc[start_row:, 5], errors='coerce').fillna(0)
        else:
            df_final['STOCK'] = 0
            
        # Limpieza de nans y cabeceras residuales
        df_final = df_final[df_final['CODIGO'] != 'nan'].reset_index(drop=True)
        return df_final
    return pd.DataFrame(columns=['CODIGO', 'LINEA', 'DESCRIPCION', 'PRECIO', 'STOCK'])

@st.cache_data
def load_clients():
    all_clients = {}
    if os.path.exists(CLIENTS_FILE):
        try:
            with open(CLIENTS_FILE, 'r', encoding='utf-8') as f:
                json_clients = json.load(f)
                for c in json_clients:
                    all_clients[c['nombre'].upper()] = c
        except: pass
        
    if os.path.exists(SALES_FILE):
        try:
            df_sales = pd.read_excel(SALES_FILE)
            if 'CLIENTE' in df_sales.columns:
                unique_names = df_sales['CLIENTE'].dropna().unique()
                for name in unique_names:
                    name_up = str(name).strip().upper()
                    if name_up not in all_clients and name_up != "ANULADO":
                        all_clients[name_up] = {"nombre": name_up, "ruc": "", "direccion": "", "telefono": ""}
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
    if not found: clients.append(client_data)
    with open(CLIENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(clients, f, ensure_ascii=False, indent=4)
    st.cache_data.clear()

def update_inventory(sales_list):
    if os.path.exists(PRODUCTS_FILE):
        df = pd.read_excel(PRODUCTS_FILE)
        start_row = 1 if not df.empty and str(df.iloc[0, 0]).strip() == 'ID REF' else 0
        for sale in sales_list:
            codigo = sale['COD_PRODUCTO']
            mask = df.iloc[start_row:, 0].astype(str).str.strip() == str(codigo).strip()
            if mask.any():
                idx = df[mask].index[0]
                if len(df.columns) < 6:
                    for col_idx in range(len(df.columns), 6): df[f'Column{col_idx+1}'] = 0
                try:
                    current_stock = pd.to_numeric(df.iloc[idx, 5], errors='coerce')
                    if pd.isna(current_stock): current_stock = 0
                    df.iloc[idx, 5] = current_stock - sale.get('_CANT_NUM', 0)
                except: pass
        df.to_excel(PRODUCTS_FILE, index=False)
        st.cache_data.clear()

def log_sales(sales_list):
    if os.path.exists(SALES_FILE):
        try:
            df = pd.read_excel(SALES_FILE)
            df = pd.concat([df, pd.DataFrame(sales_list)], ignore_index=True)
            df.to_excel(SALES_FILE, index=False)
        except Exception as e:
            st.error(f"Error al actualizar la planilla: {e}")
    else:
        df = pd.DataFrame(sales_list)
        df.to_excel(SALES_FILE, index=False)

def get_next_invoice_number():
    if os.path.exists(SALES_FILE):
        df = pd.read_excel(SALES_FILE)
        if not df.empty and 'NRO_FACTURA' in df.columns:
            try:
                last_num = pd.to_numeric(df['NRO_FACTURA'], errors='coerce').max()
                return str(int(last_num) + 1).zfill(4) if not pd.isna(last_num) else "0501"
            except: pass
    return "0501"

def void_invoice(invoice_num):
    if os.path.exists(SALES_FILE):
        df = pd.read_excel(SALES_FILE)
        mask = df['NRO_FACTURA'].astype(str) == str(invoice_num)
        if mask.any():
            df.loc[mask, ['DESCRIPCION', 'PRECIO GS', 'PRECIO USD']] = ["ANULADA", 0, 0]
            df.to_excel(SALES_FILE, index=False)
            return True
    return False

@st.cache_data(ttl=60)
def load_sales():
    if os.path.exists(SALES_FILE):
        try:
            df = pd.read_excel(SALES_FILE)
            if not df.empty:
                df['FECHA'] = pd.to_datetime(df['FECHA'], errors='coerce')
                return df.sort_values(by='FECHA', ascending=False)
        except: pass
    return pd.DataFrame()

def call_ai(prompt, system_prompt, api_url):
    try:
        payload = {
            "model": "local-model", 
            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}],
            "temperature": 0.7
        }
        response = requests.post(f"{api_url.strip().rstrip('/')}/chat/completions", json=payload, timeout=30)
        return response.json()['choices'][0]['message']['content'] if response.status_code == 200 else f"Error: {response.text}"
    except Exception as e: return f"Error de conexión: {str(e)}"

# --- INTERFAZ DE LOGIN ---
if not st.session_state.get('logged_in', False):
    import streamlit.components.v1 as components
    
    # Cargar HTML de rediseño
    try:
        with open(REDESIGN_FILE, "r", encoding="utf-8") as f:
            html_content = f.read()
        
        login_bridge = """
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('loginForm');
            if (form) {
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    const user = document.getElementById('email').value;
                    const pass = document.getElementById('password').value;
                    const encodedPass = btoa(pass);
                    
                    // Intentar obtener la URL base de la página principal de forma segura
                    const params = "?u=" + encodeURIComponent(user) + "&p=" + encodeURIComponent(encodedPass);
                    
                    // Intentar redirección absoluta usando el referrer
                    let targetUrl = "";
                    try {
                        // Intentar obtener la URL limpia (sin parámetros anteriores) del referrer
                        const ref = document.referrer;
                        if (ref) {
                            targetUrl = ref.split('?')[0].split('#')[0];
                        }
                    } catch(e) {}

                    if (!targetUrl || targetUrl === "null") {
                        // Fallback a la raíz del sitio si estamos en el mismo dominio
                        targetUrl = "/";
                    }

                    // Forzar la redirección en la ventana superior (la de Streamlit)
                    window.top.location.href = targetUrl + params;
                });
            }
        });
        </script>
        """
        html_content = html_content.replace("</body>", login_bridge + "</body>")
        
        # Estilo para que el login sea pantalla completa y oculte Streamlit
        st.markdown("""
            <style>
            #MainMenu {visibility: hidden;}
            header {visibility: hidden;}
            footer {visibility: hidden;}
            .block-container {padding: 0 !important; margin: 0 !important; max-width: 100% !important;}
            iframe {position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; border: none; z-index: 9999;}
            </style>
        """, unsafe_allow_html=True)
        
        components.html(html_content, height=1200, scrolling=False)
    except Exception as e:
        st.error(f"Error al cargar el rediseño del login: {e}")
        # Fallback al login básico si falla la carga del archivo
        st.markdown('<div class="login-container">', unsafe_allow_html=True)
        st.markdown("<h1 style='text-align: center; color: #f1c232; margin-bottom: 30px;'>SOLPRO ACCESS</h1>", unsafe_allow_html=True)
        with st.form("login_form"):
            user_input = st.text_input("Usuario")
            pass_input = st.text_input("Contraseña", type="password")
            if st.form_submit_button("INICIAR SESIÓN"):
                users = load_users()
                hashed_input = hashlib.sha256(pass_input.encode()).hexdigest()
                user_found = next((u for u in users if u['usuario'] == user_input and u['password'] == hashed_input), None)
                if user_found:
                    st.session_state.logged_in = True
                    st.session_state.user_data = user_found
                    st.rerun()
                else: st.error("Credenciales incorrectas")
        st.markdown("</div>", unsafe_allow_html=True)
    
    st.stop()

# --- HEADER CORPORATIVO ---
with st.container():
    col_l, col_r = st.columns([1, 4])
    with col_l:
        if os.path.exists(LOGO_FILE): st.image(LOGO_FILE, width=180)
        else: st.title("SOLPRO")
    with col_r:
        st.markdown(f"""
            <div class="header-container">
                <div style="font-size: 32px; font-weight: 800; color: #f1c232; font-family: 'Raleway';">PORTAL DE FACTURACIÓN</div>
                <div style="text-align: right; color: #94a3b8;">
                    <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Estado del Sistema:</span><br>
                    <span style="color: #4ade80; font-weight: bold; font-size: 14px;">● OPERATIVO 2026</span>
                </div>
            </div>
        """, unsafe_allow_html=True)

# --- SIDEBAR ---
with st.sidebar:
    st.header("👤 Cliente")
    clients = load_clients()
    client_names = ["-- NUEVO CLIENTE --"] + [c['nombre'] for c in clients]
    selected_client_name = st.selectbox("Buscar Cliente", client_names)
    
    sel_data = next((c for c in clients if c['nombre'] == selected_client_name), None)
    nombre = st.text_input("Razón Social", value=sel_data['nombre'] if sel_data else "")
    ruc = st.text_input("RUC / C.I.", value=sel_data['ruc'] if sel_data else "")
    direccion = st.text_input("Dirección", value=sel_data['direccion'] if sel_data else "")
    telefono = st.text_input("Teléfono", value=sel_data['telefono'] if sel_data else "")
    
    st.divider()
    st.header("⚙️ Configuración")
    vendedor = st.text_input("Vendedor", value=st.session_state.user_data['nombre'])
    nro_factura = st.text_input("Nro. Factura", value=get_next_invoice_number())
    condicion = st.radio("Condición", ["CONTADO", "CRÉDITO"], horizontal=True)
    moneda = st.radio("Moneda", ["PYG", "USD"], horizontal=True)

    if st.button("🔄 SINCRONIZAR DATOS"):
        st.cache_data.clear()
        st.success("Sincronizado")

    if st.session_state.user_data['rol'] == 'admin':
        st.divider()
        st.header("🤖 AI TUNNEL")
        ai_url = st.text_input("Endpoint URL", value="http://localhost:1234/v1")

    st.divider()
    if st.button("🚪 CERRAR SESIÓN"):
        st.session_state.logged_in = False
        st.session_state.user_data = None
        st.rerun()

# --- TABS PRINCIPALES ---
if st.session_state.user_data['rol'] == 'admin':
    tab1, tab2, tab3, tab4, tab5 = st.tabs(["🛒 FACTURACIÓN", "🚫 ANULAR", "📦 STOCK", "📊 HISTORIAL", "🤖 AI"])
else:
    tab1, = st.tabs(["🛒 FACTURACIÓN"])

with tab1:
    df_products = load_products()
    st.markdown("""
        <div style="display: flex; background: #161b22; color: #f1c232; padding: 15px; border-radius: 2px; font-weight: 800; border: 1px solid #1e293b; margin-bottom: 20px; font-size: 12px; letter-spacing: 1px;">
            <div style="flex: 0.5;">CANT.</div>
            <div style="flex: 3;">PRODUCTO / DESCRIPCIÓN</div>
            <div style="flex: 0.8;">DISP.</div>
            <div style="flex: 1.5;">P. UNITARIO</div>
            <div style="flex: 1;">TOTAL</div>
            <div style="flex: 0.3;"></div>
        </div>
    """, unsafe_allow_html=True)

    if 'factura_items' not in st.session_state: st.session_state.factura_items = [{"cant": 1, "desc": "", "precio": 0.0, "codigo": ""}]
    total_factura = 0
    items_to_remove = []

    for i, item in enumerate(st.session_state.factura_items):
        st.markdown(f'<div class="product-row">', unsafe_allow_html=True)
        c1, c2, c_stock, c3, c4, c5 = st.columns([0.5, 3, 0.8, 1.5, 1, 0.3])
        with c1: cant = st.number_input("n", min_value=1, value=item['cant'], key=f"cant_{i}", label_visibility="collapsed")
        with c2:
            search = st.text_input("s", key=f"search_{i}", placeholder="Buscar...", label_visibility="collapsed")
            filtered = df_products[df_products['DESCRIPCION'].str.contains(search, case=False, na=False) | df_products['CODIGO'].str.contains(search, case=False, na=False)] if search else pd.DataFrame()
            if not filtered.empty:
                sel_idx = st.selectbox("p", filtered.index, format_func=lambda x: f"{df_products.loc[x, 'CODIGO']} - {df_products.loc[x, 'DESCRIPCION']}", key=f"suggest_{i}", label_visibility="collapsed")
                if st.button("✓ SELECCIONAR", key=f"btn_sel_{i}"):
                    st.session_state.factura_items[i].update({
                        'desc': df_products.loc[sel_idx, 'DESCRIPCION'], 
                        'codigo': df_products.loc[sel_idx, 'CODIGO'],
                        'precio': float(df_products.loc[sel_idx, 'PRECIO'])
                    })
                    st.rerun()
            desc = st.text_area("d", value=item['desc'], key=f"desc_{i}", height=60, label_visibility="collapsed")
        
        with c_stock:
            codigo = item.get('codigo', '')
            if codigo:
                mask = df_products['CODIGO'].astype(str) == str(codigo)
                if mask.any():
                    s_val = int(df_products.loc[mask, 'STOCK'].values[0])
                    st.markdown(f"<div style='color:{'#4ade80' if s_val>0 else '#ef4444'}; font-weight:bold; text-align:center; padding-top:10px;'>{s_val}</div>", unsafe_allow_html=True)
        
        with c3: precio = st.number_input("p", value=item['precio'], key=f"precio_{i}", format="%.2f", label_visibility="collapsed")
        with c4:
            subt = cant * precio
            st.markdown(f"<div style='padding-top: 10px; font-weight: 800; color: #f1c232;'>{subt:,.0f}</div>", unsafe_allow_html=True)
        with c5:
            if st.button("✕", key=f"del_{i}"): items_to_remove.append(i)
        
        item.update({'cant': cant, 'desc': desc, 'precio': precio, 'total': subt})
        total_factura += subt
        st.markdown("</div>", unsafe_allow_html=True)

    if items_to_remove:
        for idx in sorted(items_to_remove, reverse=True): st.session_state.factura_items.pop(idx)
        st.rerun()

    if st.button("✚ AGREGAR LÍNEA DE PRODUCTO"):
        st.session_state.factura_items.append({"cant": 1, "desc": "", "precio": 0.0, "codigo": ""})
        st.rerun()

    st.divider()
    col_sum1, col_sum2 = st.columns([2, 1])
    with col_sum2:
        total_str = f"{moneda} {total_factura:,.2f}" if moneda=="USD" else f"₲ {total_factura:,.0f}"
        st.markdown(f"""
            <div style="background: #161b22; padding: 25px; border: 2px solid #f1c232; text-align: center;">
                <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Total de Operación</div>
                <div style="font-size: 36px; font-weight: 800; color: #f1c232;">{total_str}</div>
            </div>
        """, unsafe_allow_html=True)
        
        if st.button("⚡ GENERAR FACTURA Y REGISTRAR"):
            if not nombre or not ruc or not nro_factura or not st.session_state.factura_items: st.error("Faltan datos")
            else:
                with st.spinner("Procesando..."):
                    save_client({"nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono})
                    pdf_path = os.path.join(OUTPUT_DIR, f"Factura_{nro_factura}_{datetime.now().strftime('%Y%m%d')}.pdf")
                    generate_invoice_pdf({
                        "nro_factura": nro_factura, "fecha": datetime.now().strftime("%d/%m/%Y"),
                        "nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono,
                        "condicion": condicion, "moneda": moneda,
                        "productos": [{"c": it['cant'], "d": it['desc'], "p": it['precio'], "t": it['total']} for it in st.session_state.factura_items]
                    }, pdf_path)
                    
                    sales_log = []
                    for it in st.session_state.factura_items:
                        sales_log.append({
                            "FECHA": datetime.now(), "DESCRIPCION": f"{it['cant']} {it['desc']}", "CLIENTE": nombre,
                            "PRECIO GS": it['total'] if moneda == "PYG" else None, "PRECIO USD": it['total'] if moneda == "USD" else None,
                            "NRO_FACTURA": nro_factura, "VENDEDOR": vendedor, "FORMA PAGO": condicion,
                            "COD_PRODUCTO": it.get('codigo', ''), "LINEA": "CORP", "_CANT_NUM": it['cant']
                        })
                    log_sales(sales_log)
                    update_inventory(sales_log)
                    st.success(f"Factura {nro_factura} emitida")
                    with open(pdf_path, "rb") as f: st.download_button("📥 DESCARGAR PDF", f, pdf_path, "application/pdf")
                    st.session_state.factura_items = []

if st.session_state.user_data['rol'] == 'admin':
    with tab2:
        st.header("🚫 ANULACIONES")
        inv_v = st.text_input("Nro Factura", placeholder="0000")
        if st.button("EJECUTAR ANULACIÓN"):
            if inv_v and void_invoice(inv_v): st.success("Anulada")
            else: st.error("No encontrada")

    with tab3:
        df_i = load_products()
        m1, m2, m3 = st.columns(3)
        m1.metric("SKUs", len(df_i))
        m2.metric("STOCK POSITIVO", (df_i['STOCK'] > 0).sum())
        m3.metric("AGOTADOS", (df_i['STOCK'] == 0).sum())
        
        filtro = st.text_input("🔍 Filtrar Inventario", placeholder="Código o Nombre...")
        df_f = df_i[df_i['DESCRIPCION'].str.contains(filtro, case=False, na=False) | df_i['CODIGO'].str.contains(filtro, case=False, na=False)] if filtro else df_i
        st.dataframe(df_f, use_container_width=True, hide_index=True)

    with tab4:
        st.header("📊 HISTORIAL DE VENTAS")
        df_s = load_sales()
        if not df_s.empty:
            r1, r2 = st.columns(2)
            r1.metric("TOTAL GS", f"{df_s['PRECIO GS'].sum():,.0f}")
            r2.metric("TOTAL USD", f"{df_s['PRECIO USD'].sum():,.2f}")
            
            # Botón para descargar la planilla de ventas completa
            if os.path.exists(SALES_FILE):
                with open(SALES_FILE, "rb") as f:
                    st.download_button(
                        label="📥 DESCARGAR PLANILLA DE VENTAS COMPLETA (EXCEL)",
                        data=f,
                        file_name="VENTAS_TOTALES_2026.xlsx",
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
            
            st.dataframe(df_s, use_container_width=True, hide_index=True)
        else:
            st.info("No hay ventas registradas aún en 2026.")

    with tab5:
        st.header("🤖 ASISTENTE AI")
        if "chat_history" not in st.session_state: st.session_state.chat_history = []
        for msg in st.session_state.chat_history:
            with st.chat_message(msg["role"]): st.markdown(msg["content"])
        if prompt := st.chat_input("Consulta corporativa..."):
            st.session_state.chat_history.append({"role": "user", "content": prompt})
            with st.chat_message("user"): st.markdown(prompt)
            with st.chat_message("assistant"):
                ctx = f"Catálogo: {len(load_products())} items. Ventas: {len(load_sales())}."
                res = call_ai(prompt, f"Asistente SOLPRO. Contexto: {ctx}", ai_url)
                st.markdown(res)
                st.session_state.chat_history.append({"role": "assistant", "content": res})
