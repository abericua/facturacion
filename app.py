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
    
    .login-container {
        max-width: 450px;
        margin: 100px auto;
        background: #161b22;
        padding: 50px;
        border-radius: 4px;
        border-top: 5px solid var(--solpro-gold);
        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    
    /* Responsive Mobile Design */
    .responsive-flex {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    @media (max-width: 768px) {
        .header-container {
            flex-direction: column !important;
            text-align: center !important;
            gap: 15px !important;
            padding: 20px !important;
        }
        
        .login-container {
            margin: 30px 10px !important;
            padding: 30px 20px !important;
        }
        
        .responsive-flex {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
        }
        
        .responsive-flex > div:last-child {
            width: 100% !important;
            text-align: left !important;
            padding-top: 10px !important;
            border-top: 1px solid rgba(255,255,255,0.1) !important;
        }
        
        .total-display-container {
            padding: 20px !important;
            text-align: left !important;
        }
        .total-display-value {
            font-size: 28px !important;
        }
        
        h1 { font-size: 1.5rem !important; }
        h2 { font-size: 1.2rem !important; }
    }
    </style>
    """, unsafe_allow_html=True)

# Rutas de archivos dinámicas
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- CONFIGURACIÓN DE PERSISTENCIA (RAILWAY) ---
# En Railway, montaremos un volumen en /app/data para que los archivos no se borren al desplegar.
PERSISTENT_DIR = "/app/data"
if os.path.exists(PERSISTENT_DIR):
    DATA_DIR = PERSISTENT_DIR
else:
    DATA_DIR = BASE_DIR

PRODUCTS_FILE = os.path.join(BASE_DIR, "LISTA DE PRECIOS DE VENTA.xlsx")
SALES_FILE = os.path.join(DATA_DIR, "VENTAS TOTALES 2026.xlsx")
CLIENTS_FILE = os.path.join(DATA_DIR, "clientes.json")
USERS_FILE = os.path.join(BASE_DIR, "usuarios.json")
OUTPUT_DIR = os.path.join(DATA_DIR, "Facturas_Emitidas")

# Inicialización de carpeta de datos si es persistente
if DATA_DIR != BASE_DIR:
    import shutil
    # Solo copiamos si el archivo NO existe en el volumen para evitar sobrescribir datos nuevos con viejos
    for f in ["VENTAS TOTALES 2026.xlsx", "clientes.json"]:
        dest = os.path.join(DATA_DIR, f)
        src = os.path.join(BASE_DIR, f)
        if not os.path.exists(dest) and os.path.exists(src):
            shutil.copy2(src, dest)

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
            # Buscar el código en la primera columna, asegurando alineación de índices
            full_mask = df.iloc[:, 0].astype(str).str.strip() == str(codigo).strip()
            # Filtrar para ignorar la fila de cabecera si es necesario
            if start_row > 0:
                full_mask.iloc[0:start_row] = False
            
            if full_mask.any():
                idx = full_mask[full_mask].index[0]
                if len(df.columns) < 6:
                    for col_idx in range(len(df.columns), 6): 
                        df[f'Column{col_idx+1}'] = 0
                try:
                    current_stock = pd.to_numeric(df.iloc[idx, 5], errors='coerce')
                    if pd.isna(current_stock): current_stock = 0
                    df.iloc[idx, 5] = current_stock - sale.get('_CANT_NUM', 0)
                except: pass
        df.to_excel(PRODUCTS_FILE, index=False)
        st.cache_data.clear()

def validate_stock(sales_list):
    if not os.path.exists(PRODUCTS_FILE): return True, ""
    df = pd.read_excel(PRODUCTS_FILE)
    start_row = 1 if not df.empty and str(df.iloc[0, 0]).strip() == 'ID REF' else 0
    for sale in sales_list:
        codigo = sale['COD_PRODUCTO']
        cant_solicitada = sale.get('_CANT_NUM', 0)
        full_mask = df.iloc[:, 0].astype(str).str.strip() == str(codigo).strip()
        if start_row > 0: full_mask.iloc[0:start_row] = False
        if full_mask.any():
            idx = full_mask[full_mask].index[0]
            try:
                current_stock = pd.to_numeric(df.iloc[idx, 5], errors='coerce')
                if pd.isna(current_stock): current_stock = 0
                if cant_solicitada > current_stock:
                    return False, f"⚠️ Stock insuficiente para {codigo}. Disponible: {current_stock}, Solicitado: {cant_solicitada}"
            except: pass
    return True, ""

def add_inventory(codigo, cantidad_a_sumar):
    if os.path.exists(PRODUCTS_FILE):
        df = pd.read_excel(PRODUCTS_FILE)
        start_row = 1 if not df.empty and str(df.iloc[0, 0]).strip() == 'ID REF' else 0
        
        full_mask = df.iloc[:, 0].astype(str).str.strip() == str(codigo).strip()
        if start_row > 0:
            full_mask.iloc[0:start_row] = False
        
        if full_mask.any():
            idx = full_mask[full_mask].index[0]
            if len(df.columns) < 6:
                for col_idx in range(len(df.columns), 6): 
                    df[f'Column{col_idx+1}'] = 0
            try:
                current_stock = pd.to_numeric(df.iloc[idx, 5], errors='coerce')
                if pd.isna(current_stock): current_stock = 0
                df.iloc[idx, 5] = current_stock + cantidad_a_sumar
            except: pass
            df.to_excel(PRODUCTS_FILE, index=False)
            st.cache_data.clear()
            return True
    return False

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
            row_idx = mask[mask].index[0]
            if df.loc[row_idx, 'DESCRIPCION'] == "ANULADA":
                return False
                
            if 'RAW_ITEMS' in df.columns:
                raw_items_str = df.loc[row_idx, 'RAW_ITEMS']
                if pd.notna(raw_items_str) and str(raw_items_str).strip():
                    try:
                        import json
                        items_to_restore = json.loads(raw_items_str)
                        for item in items_to_restore:
                            add_inventory(item['COD_PRODUCTO'], item['_CANT_NUM'])
                    except Exception as e:
                        print(f"Error restoring inventory: {e}")
            
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
                # Asegurar que FECHA sea datetime (dayfirst=True para formato DD-MM-YYYY)
                df['FECHA'] = pd.to_datetime(df['FECHA'], dayfirst=True, errors='coerce')
                # Eliminar solo filas que realmente no tienen fecha (NaN en el Excel original)
                df = df.dropna(subset=['FECHA'])
                
                df['NRO_FACTURA_NUM'] = pd.to_numeric(df['NRO_FACTURA'], errors='coerce')
                # Ordenar por fecha (mas actual primero) y luego por número de factura
                df = df.sort_values(by=['FECHA', 'NRO_FACTURA_NUM'], ascending=[False, False])
                df = df.drop(columns=['NRO_FACTURA_NUM'])
                return df
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
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
    #MainMenu, header, footer {visibility: hidden;}
    .block-container {padding: 0 !important; margin: 0 !important; max-width: 100% !important;}
    .stApp {background: #08090c !important;}
    section[data-testid="stSidebar"] {display: none !important;}
    div[data-testid="stVerticalBlock"] > div:first-child {padding: 0 !important;}

    /* Panel izquierdo */
    .sp-left {
        min-height: 100vh; padding: 4rem 3rem;
        background: linear-gradient(135deg, rgba(245,188,0,.07) 0%, transparent 60%);
        border-right: 1px solid rgba(255,255,255,.07);
        display: flex; flex-direction: column; justify-content: center;
    }
    .sp-logo { display:flex; align-items:center; gap:14px; margin-bottom:2.5rem; }
    .sp-logo img { width:72px; border-radius:50%; filter:drop-shadow(0 0 16px rgba(245,188,0,.5)); }
    .sp-logo-name { font-family:'Space Grotesk',sans-serif; font-size:1.8rem; font-weight:700; color:#F2EDE0; letter-spacing:.04em; }
    .sp-logo-tag  { font-size:.6rem; letter-spacing:.28em; text-transform:uppercase; color:#F5BC00; display:block; margin-top:3px; font-family:'IBM Plex Sans',sans-serif; }
    .sp-hl { font-family:'Space Grotesk',sans-serif; font-size:2.4rem; font-weight:700; color:#F2EDE0; line-height:1.1; margin-bottom:1rem; }
    .sp-hl span { color:#F5BC00; }
    .sp-desc { font-family:'IBM Plex Sans',sans-serif; font-size:.93rem; color:rgba(242,237,224,.6); line-height:1.75; max-width:340px; margin-bottom:2rem; font-weight:300; }
    .sp-pill { display:inline-flex; align-items:center; gap:9px; background:rgba(245,188,0,.06); border:1px solid rgba(245,188,0,.18); border-radius:50px; padding:.4rem .9rem; margin-bottom:8px; }
    .sp-pill-dot { width:5px; height:5px; border-radius:50%; background:#F5BC00; flex-shrink:0; }
    .sp-pill-txt { font-family:'IBM Plex Sans',sans-serif; font-size:.77rem; color:rgba(242,237,224,.65); }
    .sp-stats { display:flex; gap:2rem; margin-top:2rem; }
    .sp-stat-v { font-family:'Space Grotesk',sans-serif; font-size:1.4rem; font-weight:700; color:#F2EDE0; }
    .sp-stat-l { font-family:'IBM Plex Sans',sans-serif; font-size:.63rem; letter-spacing:.14em; text-transform:uppercase; color:rgba(242,237,224,.32); }
    .sp-divv   { width:1px; height:28px; background:rgba(255,255,255,.09); align-self:center; }

    /* Panel derecho — la COLUMNA ENTERA es la card */
    [data-testid="column"]:nth-child(2) > div:first-child {
        min-height: 100vh;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 3rem 2.5rem !important;
    }
    [data-testid="column"]:nth-child(2) > div:first-child > div:first-child {
        background: rgba(14,12,8,.65);
        border: 1px solid rgba(245,188,0,.18);
        border-radius: 24px;
        padding: 2.5rem 2.3rem 2rem;
        width: 100%;
        max-width: 420px;
        box-shadow: 0 24px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(245,188,0,.08);
    }
    .sp-card-logo { display:flex; align-items:center; gap:12px; padding-bottom:1.4rem; border-bottom:1px solid rgba(255,255,255,.08); margin-bottom:1.6rem; }
    .sp-card-logo img { width:44px; border-radius:50%; filter:drop-shadow(0 0 8px rgba(245,188,0,.55)); }
    .sp-card-name { font-family:'Space Grotesk',sans-serif; font-size:1rem; font-weight:700; color:#F2EDE0; letter-spacing:.04em; }
    .sp-card-sub  { font-size:.58rem; letter-spacing:.22em; text-transform:uppercase; color:#F5BC00; display:block; margin-top:2px; font-family:'IBM Plex Sans',sans-serif; }
    .sp-form-title { font-family:'Space Grotesk',sans-serif; font-size:1.4rem; font-weight:700; color:#F2EDE0; margin-bottom:.25rem; }
    .sp-form-sub   { font-family:'IBM Plex Sans',sans-serif; font-size:.82rem; color:rgba(242,237,224,.35); margin-bottom:1.6rem; font-weight:300; }

    /* Inputs nativos de Streamlit — estilo SOLPRO */
    .stTextInput label p { font-family:'IBM Plex Sans',sans-serif !important; font-size:.72rem !important; font-weight:500 !important; color:rgba(242,237,224,.65) !important; letter-spacing:.06em !important; text-transform:uppercase !important; }
    .stTextInput input { background:rgba(245,188,0,.04) !important; border:1px solid rgba(255,255,255,.10) !important; border-radius:9px !important; color:#F2EDE0 !important; font-family:'IBM Plex Sans',sans-serif !important; }
    .stTextInput input:focus { border-color:#F5BC00 !important; box-shadow:0 0 0 3px rgba(245,188,0,.11) !important; }
    .stTextInput input::placeholder { color:rgba(242,237,224,.3) !important; }
    .stForm { background:transparent !important; border:none !important; padding:0 !important; }
    .stForm [data-testid="stFormSubmitButton"] button {
        width:100% !important; background:linear-gradient(135deg,#F5BC00,#BF9000) !important;
        color:#0C0800 !important; font-family:'Space Grotesk',sans-serif !important;
        font-size:.88rem !important; font-weight:700 !important; letter-spacing:.08em !important;
        text-transform:uppercase !important; border:none !important; border-radius:9px !important;
        padding:.82rem !important; box-shadow:0 0 26px rgba(245,188,0,.30) !important;
        margin-top:.5rem !important;
    }
    .stForm [data-testid="stFormSubmitButton"] button:hover {
        box-shadow:0 0 46px rgba(245,188,0,.55) !important;
        transform:translateY(-1px) !important; filter:brightness(1.05) !important;
    }
    .stCheckbox label p { font-family:'IBM Plex Sans',sans-serif !important; font-size:.77rem !important; color:rgba(242,237,224,.35) !important; font-weight:400 !important; }
    div[data-testid="stAlert"] { border-radius:9px !important; }
    </style>
    """, unsafe_allow_html=True)

    logo_b64 = ""
    try:
        import base64 as _b64
        with open(LOGO_FILE, "rb") as _f:
            logo_b64 = _b64.b64encode(_f.read()).decode()
    except: pass

    logo_tag_lg = f'<img src="data:image/png;base64,{logo_b64}">' if logo_b64 else ""
    logo_tag_sm = f'<img src="data:image/png;base64,{logo_b64}">' if logo_b64 else ""

    col_left, col_right = st.columns([1, 1], gap="small")

    with col_left:
        st.markdown(f"""
        <div class="sp-left">
            <div class="sp-logo">
                {logo_tag_lg}
                <div>
                    <div class="sp-logo-name">SOLPRO</div>
                    <span class="sp-logo-tag">Soluciones Profesionales</span>
                </div>
            </div>
            <div class="sp-hl">Facturación<br>profesional,<br><span>sin complicaciones</span></div>
            <div class="sp-desc">Genera, administra y envía facturas electrónicas en segundos. Control total de tus ingresos, clientes y reportes fiscales.</div>
            <div><div class="sp-pill"><div class="sp-pill-dot"></div><span class="sp-pill-txt">Facturas electrónicas en segundos</span></div></div>
            <div><div class="sp-pill"><div class="sp-pill-dot"></div><span class="sp-pill-txt">Gestión de clientes y productos</span></div></div>
            <div><div class="sp-pill"><div class="sp-pill-dot"></div><span class="sp-pill-txt">Reportes fiscales automáticos</span></div></div>
            <div class="sp-stats">
                <div class="sp-stat"><div class="sp-stat-v">+12K</div><div class="sp-stat-l">Facturas</div></div>
                <div class="sp-divv"></div>
                <div class="sp-stat"><div class="sp-stat-v">99.9%</div><div class="sp-stat-l">Disponibilidad</div></div>
                <div class="sp-divv"></div>
                <div class="sp-stat"><div class="sp-stat-v">24/7</div><div class="sp-stat-l">Soporte</div></div>
            </div>
        </div>
        """, unsafe_allow_html=True)

    with col_right:
        st.markdown(f"""
        <div class="sp-card-logo">
            {logo_tag_sm}
            <div>
                <div class="sp-card-name">SOLPRO</div>
                <span class="sp-card-sub">Facturación</span>
            </div>
        </div>
        <div class="sp-form-title">SOLPRO Facturación</div>
        <div class="sp-form-sub">Ingresa tus credenciales para continuar</div>
        """, unsafe_allow_html=True)

        with st.form("solpro_login_form"):
            user_input = st.text_input("Usuario", placeholder="admin")
            pass_input = st.text_input("Contraseña", type="password", placeholder="••••••••")
            st.checkbox("Mantener sesión iniciada")
            submitted = st.form_submit_button("Entrar al sistema")

        if submitted:
            users = load_users()
            hashed_input = hashlib.sha256(pass_input.encode()).hexdigest()
            user_found = next((u for u in users if u['usuario'] == user_input and u['password'] == hashed_input), None)
            if user_found:
                st.session_state.logged_in = True
                st.session_state.user_data = user_found
                st.rerun()
            else:
                st.error("Credenciales incorrectas. Verifica tu usuario y contraseña.")

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
    
    if st.button("💾 GUARDAR / ACTUALIZAR DATOS"):
        if nombre:
            save_client({"nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono})
            st.success(f"Cliente {nombre} guardado!")
            st.rerun()
        else:
            st.error("Ingresa al menos el nombre")

    st.divider()
    st.header("⚙️ Configuración")
    
    # Lista de vendedores desde usuarios.json
    all_users = load_users()
    vendedor_names = [u['nombre'] for u in all_users]
    current_user_name = st.session_state.user_data['nombre']
    
    # Selector de vendedor
    vendedor = st.selectbox(
        "Vendedor", 
        options=vendedor_names,
        index=vendedor_names.index(current_user_name) if current_user_name in vendedor_names else 0
    )
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
    else:
        ai_url = "http://localhost:1234/v1"

    st.divider()
    if st.button("🚪 CERRAR SESIÓN"):
        st.session_state.logged_in = False
        st.session_state.user_data = None
        st.rerun()

# --- TABS PRINCIPALES ---
# Todos los roles ven las 5 pestañas
tab1, tab2, tab3, tab4, tab5 = st.tabs(["🛒 FACTURACIÓN", "🚫 ANULAR", "📦 STOCK", "📊 HISTORIAL", "🤖 AI"])

with tab1:
    df_products = load_products()
    st.markdown("""
        <div class="responsive-hide" style="display: flex; background: #161b22; color: #f1c232; padding: 15px; border-radius: 2px; font-weight: 800; border: 1px solid #1e293b; margin-bottom: 20px; font-size: 12px; letter-spacing: 1px;">
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
            # Preparar opciones del catálogo completo
            all_options = ["--- BUSCAR PRODUCTO ---"] + [f"{row['CODIGO']} | {row['DESCRIPCION']}" for _, row in df_products.iterrows()]
            
            # Buscar el valor actual para mantener la selección si ya existe
            current_idx = 0
            if item.get('codigo'):
                match_str = next((opt for opt in all_options if opt.startswith(f"{item['codigo']} |")), None)
                if match_str:
                    current_idx = all_options.index(match_str)
            
            # Selector inteligente con búsqueda integrada
            selected_prod = st.selectbox(
                "Producto",
                options=all_options,
                index=current_idx,
                key=f"prod_sel_{i}",
                label_visibility="collapsed"
            )
            
            # Si el usuario cambia la selección
            if selected_prod != "--- BUSCAR PRODUCTO ---":
                cod_sel = selected_prod.split(" | ")[0]
                if cod_sel != item.get('codigo'):
                    row = df_products[df_products['CODIGO'] == cod_sel].iloc[0]
                    st.session_state.factura_items[i].update({
                        'codigo': row['CODIGO'],
                        'desc': row['DESCRIPCION'],
                        'precio': float(row['PRECIO'])
                    })
                    # Sincronizar estado interno de los widgets para que muestren el valor actualizado
                    st.session_state[f"desc_{i}"] = row['DESCRIPCION']
                    st.session_state[f"precio_{i}"] = float(row['PRECIO'])
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
            <div class="total-display-container" style="background: linear-gradient(135deg, #1e293b 0%, #0b0f19 100%); padding: 30px; border-radius: 8px; border: 1px solid #334155; margin-top: 30px; margin-bottom: 30px; text-align: right; box-shadow: 0 10px 20px rgba(0,0,0,0.5);">
                <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Total de Operación</div>
                <div class="total-display-value" style="font-size: 36px; font-weight: 800; color: #f1c232;">{total_str}</div>
            </div>
        """, unsafe_allow_html=True)
        
        if 'invoice_generated' in st.session_state:
            st.success(f"Factura {st.session_state.invoice_nro} emitida")
            try:
                with open(st.session_state.invoice_pdf_path, "rb") as f: 
                    st.download_button("📥 DESCARGAR PDF", f, os.path.basename(st.session_state.invoice_pdf_path), "application/pdf", key="dl_btn_after_gen")
            except Exception: pass

        if st.button("⚡ GENERAR FACTURA Y REGISTRAR"):
            if not nombre or not ruc or not nro_factura or not st.session_state.factura_items: st.error("Faltan datos")
            else:
                with st.spinner("Procesando..."):
                    inventory_log = []
                    descripciones = []
                    codigos = []
                    for it in st.session_state.factura_items:
                        descripciones.append(f"{it['cant']} {it['desc']}")
                        if it.get('codigo'):
                            codigos.append(str(it['codigo']))
                        inventory_log.append({
                            "COD_PRODUCTO": it.get('codigo', ''),
                            "_CANT_NUM": it['cant']
                        })
                    
                    # --- VALIDACION DE STOCK EN TIEMPO REAL ---
                    is_valid, error_msg = validate_stock(inventory_log)
                    if not is_valid:
                        st.error(error_msg)
                        st.stop()
                    # ------------------------------------------

                    save_client({"nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono})
                    pdf_path = os.path.join(OUTPUT_DIR, f"Factura_{nro_factura}_{datetime.now().strftime('%Y%m%d')}.pdf")
                    generate_invoice_pdf({
                        "nro_factura": nro_factura, "fecha": datetime.now().strftime("%d/%m/%Y"),
                        "nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono,
                        "condicion": condicion, "moneda": moneda,
                        "productos": [{"c": it['cant'], "d": it['desc'], "p": it['precio'], "t": it['total']} for it in st.session_state.factura_items]
                    }, pdf_path)
                    
                    import json
                    sales_log = [{
                        "FECHA": datetime.now().replace(hour=0, minute=0, second=0, microsecond=0),
                        "DESCRIPCION": ", ".join(descripciones),
                        "CLIENTE": nombre,
                        "PRECIO GS": total_factura if moneda == "PYG" else None,
                        "PRECIO USD": total_factura if moneda == "USD" else None,
                        "NRO_FACTURA": nro_factura,
                        "VENDEDOR": vendedor,
                        "FORMA PAGO": condicion,
                        "COD_PRODUCTO": ", ".join(codigos),
                        "LINEA": "CORP",
                        "RAW_ITEMS": json.dumps(inventory_log)
                    }]
                    
                    log_sales(sales_log)
                    update_inventory(inventory_log)
                    
                    st.session_state.invoice_generated = True
                    st.session_state.invoice_nro = nro_factura
                    st.session_state.invoice_pdf_path = pdf_path
                    st.session_state.factura_items = [{"cant": 1, "desc": "", "precio": 0.0, "codigo": ""}]
                    st.rerun()

if True:
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
        
        st.markdown("<h3 style='margin-top: 20px; color: #f8fafc;'>PRODUCTOS EN STOCK</h3>", unsafe_allow_html=True)
        
        # --- CARGA DE NUEVO INVENTARIO ---
        with st.expander("➕ CARGAR NUEVO INVENTARIO", expanded=False):
            st.markdown("Selecciona el producto y la cantidad a sumar al stock existente.")
            
            all_inventory_options = ["--- SELECCIONAR PRODUCTO ---"] + [f"{row['CODIGO']} | {row['DESCRIPCION']}" for _, row in df_i.iterrows()]
            prod_to_load = st.selectbox("Producto a cargar", options=all_inventory_options, key="load_inv_prod")
            cant_to_load = st.number_input("Cantidad a modificar (usa un número negativo para restar)", value=1, step=1, key="load_inv_cant")
            
            if st.button("💾 Actualizar Stock", key="btn_add_inv"):
                if prod_to_load != "--- SELECCIONAR PRODUCTO ---":
                    cod_load = prod_to_load.split(" | ")[0]
                    if add_inventory(cod_load, cant_to_load):
                        accion = "sumaron" if cant_to_load > 0 else "restaron"
                        st.success(f"✅ Se {accion} {abs(cant_to_load)} unidades al producto {cod_load}.")
                        st.rerun()
                    else:
                        st.error("Hubo un problema al actualizar el inventario.")
                else:
                    st.warning("Por favor, selecciona un producto.")
        
        filtro = st.text_input("🔍 Filtrar Inventario", placeholder="Buscar por código o nombre...")

        
        # Filtrar stock positivo
        df_stock = df_i[df_i['STOCK'] > 0]
        if filtro:
            df_stock = df_stock[df_stock['DESCRIPCION'].str.contains(filtro, case=False, na=False) | df_stock['CODIGO'].str.contains(filtro, case=False, na=False)]
        
        if not df_stock.empty:
            for _, row in df_stock.iterrows():
                st.markdown(f'''
                    <div class="responsive-flex" style="background: #161b22; padding: 15px 25px; border-radius: 4px; margin-bottom: 12px; border: 1px solid #1e293b; border-left: 4px solid #f1c232;">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <div style="color: #f1c232; font-size: 14px; font-weight: 700; background: rgba(241, 194, 50, 0.1); padding: 4px 10px; border-radius: 4px;">{row["CODIGO"]}</div>
                            <div style="color: #f8fafc; font-size: 16px; font-weight: 600; font-family: 'Raleway', sans-serif;">{row["DESCRIPCION"]}</div>
                        </div>
                        <div style="color: #f1c232; font-size: 26px; font-weight: 800; font-family: 'Raleway', sans-serif; text-align: right;">
                            {int(row["STOCK"])} <span style="color: #94a3b8; font-size: 14px; font-weight: 600; font-family: 'Source Sans Pro', sans-serif;">UNID.</span>
                        </div>
                    </div>
                ''', unsafe_allow_html=True)
        else:
            st.info("No hay productos con stock actualmente.")

    with tab4:
        st.header("📊 HISTORIAL DE VENTAS")
        
        # Botón de reporte movido al inicio para mayor visibilidad
        if os.path.exists(SALES_FILE):
            st.info("💡 Desde aquí puedes exportar el reporte completo de ventas acumulado en formato Excel.")
            with open(SALES_FILE, "rb") as f:
                st.download_button(
                    label="📥 EXPORTAR REPORTE DE VENTAS COMPLETO (EXCEL)",
                    data=f,
                    file_name="VENTAS_TOTALES_2026.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    use_container_width=True
                )
            st.divider()

        df_s = load_sales()
        if not df_s.empty:
            r1, r2 = st.columns(2)
            r1.metric("TOTAL GS", f"{df_s['PRECIO GS'].sum():,.0f}")
            r2.metric("TOTAL USD", f"{df_s['PRECIO USD'].sum():,.2f}")
            
            st.dataframe(
                df_s, 
                use_container_width=True, 
                hide_index=True,
                column_config={
                    "FECHA": st.column_config.DateColumn("FECHA", format="DD/MM/YYYY")
                }
            )
        else:
            st.info("No hay ventas registradas aún en 2026.")
            
        st.divider()
        st.markdown("<h3 style='margin-top: 20px; color: #f8fafc;'>🔄 REGENERAR PDF ANTIGUO</h3>", unsafe_allow_html=True)
        st.write("Si una venta del historial no tiene PDF, escribe su Nro de Factura para generarlo de nuevo:")
        col_reg1, col_reg2 = st.columns(2)
        with col_reg1:
            regen_nro = st.text_input("Nro de Factura a regenerar", placeholder="Ej: 0502", key="regen_input")
        with col_reg2:
            st.write("")
            st.write("")
            if st.button("📄 GENERAR PDF"):
                if regen_nro and not df_s.empty:
                    match = df_s[df_s['NRO_FACTURA'].astype(str) == str(regen_nro)]
                    if not match.empty:
                        row = match.iloc[0]
                        fecha = row['FECHA']
                        cliente = row['CLIENTE']
                        desc = str(row['DESCRIPCION'])
                        moneda = "USD" if pd.notna(row['PRECIO USD']) else "PYG"
                        total = float(row['PRECIO USD']) if moneda == "USD" else float(row['PRECIO GS'])
                        condicion = str(row['FORMA PAGO'])
                        
                        fecha_file = fecha.strftime("%Y%m%d") if hasattr(fecha, 'strftime') else str(fecha).replace('-', '').replace(':', '').replace(' ', '')
                        pdf_path = os.path.join(OUTPUT_DIR, f"Factura_{regen_nro}_{fecha_file}_Historica.pdf")
                        
                        try:
                            # Asegurar formato string para el PDF si fecha es datetime
                            fecha_str = fecha.strftime("%d/%m/%Y") if hasattr(fecha, 'strftime') else str(fecha).replace('-', '/')
                            from pdf_generator import generate_invoice_pdf
                            generate_invoice_pdf({
                                "nro_factura": str(regen_nro), "fecha": fecha_str,
                                "nombre": str(cliente), "ruc": "", "direccion": "", "telefono": "",
                                "condicion": condicion, "moneda": moneda,
                                "productos": [{"c": 1, "d": desc, "p": total, "t": total}]
                            }, pdf_path)
                            st.success(f"Factura {regen_nro} generada exitosamente. Revisa el repositorio de abajo.")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error al generar: {e}")
                    else:
                        st.error("No se encontró ese número de factura en el historial.")

        st.divider()
        st.markdown("<h3 style='margin-top: 20px; color: #f8fafc;'>🗄️ REPOSITORIO DE FACTURAS PDF</h3>", unsafe_allow_html=True)
        st.markdown("Todas las facturas emitidas se guardan automáticamente aquí.")
        
        pdf_files = []
        if os.path.exists(OUTPUT_DIR):
            pdf_files = [f for f in os.listdir(OUTPUT_DIR) if f.endswith('.pdf')]
            
        if pdf_files:
            filtro_pdf = st.text_input("🔍 Buscar factura en PDF (por número o fecha)", placeholder="Ej: 0501 o 20260507", key="pdf_search")
            
            # Ordenar archivos (los más recientes primero)
            pdf_files.sort(reverse=True)
            
            for pdf in pdf_files:
                if filtro_pdf.lower() in pdf.lower() or not filtro_pdf:
                    pdf_path = os.path.join(OUTPUT_DIR, pdf)
                    st.markdown(f'''
                        <div class="responsive-flex" style="background: #161b22; padding: 15px 25px; border-radius: 4px; margin-bottom: 12px; border: 1px solid #1e293b; border-left: 4px solid #f1c232;">
                            <div style="display: flex; align-items: center; gap: 20px;">
                                <div style="color: #f8fafc; font-size: 16px; font-weight: 600; font-family: 'Raleway', sans-serif;">📄 {pdf}</div>
                            </div>
                        </div>
                    ''', unsafe_allow_html=True)
                    
                    # El botón de descarga tiene que ir nativo de Streamlit
                    with open(pdf_path, "rb") as f:
                        st.download_button(
                            label="📥 DESCARGAR ESTA FACTURA", 
                            data=f, 
                            file_name=pdf, 
                            mime="application/pdf", 
                            key=f"dl_{pdf}"
                        )
        else:
            st.info("Aún no se han generado facturas en PDF.")

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
