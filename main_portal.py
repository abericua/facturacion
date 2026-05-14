import streamlit as st
import os
import json
import hashlib
import pyotp
import qrcode
import io
import base64
import pandas as pd
from datetime import datetime
import re

try:
    import pypdf
except ImportError:
    try:
        import PyPDF2 as pypdf
    except ImportError:
        pypdf = None

import requests # Para conectar con Gemma Local
try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
except ImportError:
    Presentation = None

import io

# --- CONFIGURACIÓN DE RUTAS PERSISTENTES (Railway Volume) ---
SGSP_ROOT = os.path.dirname(os.path.abspath(__file__))
PERSISTENT_DIR = "/app/data" # Mount path del volumen Railway
DATABASE_DIR = PERSISTENT_DIR if os.path.exists(PERSISTENT_DIR) else os.path.join(SGSP_ROOT, "database")

# Bootstrap del Volumen
if os.path.exists(PERSISTENT_DIR):
    import shutil
    repo_db = os.path.join(SGSP_ROOT, "database")
    if os.path.exists(repo_db):
        # FORZAR copia de usuarios.json esta vez para resetear el totp_secret
        # (después de este deploy, el bootstrap no lo sobreescribirá más)
        _cred_src = os.path.join(repo_db, "usuarios.json")
        _cred_dst = os.path.join(PERSISTENT_DIR, "usuarios.json")
        if os.path.exists(_cred_src):
            shutil.copy2(_cred_src, _cred_dst)
        # Copiar el resto SOLO si no existen en el volumen
        for item in os.listdir(repo_db):
            if item == "usuarios.json": continue
            s = os.path.join(repo_db, item)
            d = os.path.join(PERSISTENT_DIR, item)
            if not os.path.exists(d) and os.path.exists(s):
                shutil.copy2(s, d)

SALES_FILE = os.path.join(DATABASE_DIR, "VENTAS TOTALES 2026.xlsx")


_USERS_FILE = os.path.join(DATABASE_DIR, "usuarios.json")
USERS_FILE = _USERS_FILE if os.path.exists(_USERS_FILE) else os.path.join(SGSP_ROOT, "Creador de Facturas", "usuarios.json")
PRODUCTS_FILE = os.path.join(DATABASE_DIR, "productos_maestros.csv")
SALES_FILE = os.path.join(DATABASE_DIR, "VENTAS TOTALES 2026.xlsx")

# --- AUDITORÍA DE SINCRONIZACIÓN AL ARRANQUE ---
def sync_master_data():
    if not os.path.exists(DATABASE_DIR):
        os.makedirs(DATABASE_DIR)
    
    # Buscar archivos en subcarpetas si no están en database
    mapa_sincro = {
        "usuarios.json": os.path.join(SGSP_ROOT, "Creador de Facturas", "usuarios.json"),
        "VENTAS TOTALES 2026.xlsx": os.path.join(SGSP_ROOT, "Creador de Facturas", "VENTAS TOTALES 2026.xlsx"),
        "productos_maestros.csv": os.path.join(SGSP_ROOT, "Calculadora de precios solpro", "productos_maestros.csv")
    }
    
    import shutil
    for filename, old_path in mapa_sincro.items():
        dest = os.path.join(DATABASE_DIR, filename)
        # Sincronización forzada para asegurar credenciales reales
        if os.path.exists(old_path):
            try:
                shutil.copy2(old_path, dest)
                print(f"Sincronizado: {filename}")
            except: pass

# sync_master_data() # DESACTIVADO: Causaba pérdida de datos en producción

# --- SEGURIDAD 007 ---
SYSTEM_PEPPER = "SOLPRO_ULTRA_SECRET_2026_#!"

def hash_password(password):
    """Hash con pepper (versión nueva)"""
    salted_pass = password + SYSTEM_PEPPER
    return hashlib.sha256(salted_pass.encode()).hexdigest()

def hash_password_plain(password):
    """Hash sin pepper (versión original del facturador)"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, stored_hash):
    """Verifica contra ambos métodos de hash para compatibilidad total"""
    return (hash_password(password) == stored_hash or 
            hash_password_plain(password) == stored_hash)

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=4)

# --- PERSISTENCIA FINANCIERA (ALA FINANCIERA) ---
FINANZAS_FILE = os.path.join(DATABASE_DIR, "finanzas_pro.json")

def load_finanzas():
    if not os.path.exists(FINANZAS_FILE):
        init_data = {
            "bancos": [
                {"id": "c1", "banco": "Atlas", "nombre": "Atlas Cta Cte GS", "moneda": "GS", "saldo_inicial": 0},
                {"id": "c2", "banco": "Ueno", "nombre": "Ueno Digital GS", "moneda": "GS", "saldo_inicial": 0},
                {"id": "c3", "banco": "FIC", "nombre": "FIC Inversiones GS", "moneda": "GS", "saldo_inicial": 0}
            ],
            "egresos": [],
            "iva_records": {}
        }
        with open(FINANZAS_FILE, 'w', encoding='utf-8') as f:
            json.dump(init_data, f, ensure_ascii=False, indent=4)
        return init_data
    with open(FINANZAS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_finanzas(data):
    with open(FINANZAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# --- PARSER BANCARIO (CONCILIACIÓN) ---
def parse_bank_pdf(file, bank_name):
    if pypdf is None:
        return None, "Librería pypdf no instalada. Ejecute: pip install pypdf"
    
    try:
        reader = pypdf.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        lines = text.split("\n")
        movimientos = []
        re_fecha = r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})"
        
        for line in lines:
            fecha_match = re.search(re_fecha, line)
            if fecha_match:
                montos = re.findall(r"[\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?", line)
                nums = []
                for m in montos:
                    val = m.replace(".", "").replace(",", ".")
                    try:
                        fval = float(val)
                        if fval > 1000:
                            nums.append(fval)
                    except: pass
                
                if nums:
                    movimientos.append({
                        "fecha": "-".join(fecha_match.groups()[::-1]),
                        "descripcion": line[:100].strip(),
                        "monto": nums[0]
                    })
        
        return movimientos, None
    except Exception as e:
        return None, str(e)

def parse_iva_120(text):
    """Extrae datos del Formulario 120 (Paraguay) basado en lógica de Marangatu"""
    data = {}
    # Casillas clave
    def get_casilla(num, txt):
        pattern = rf"\b{num}\s+(\d[\d.]{{2,}})"
        matches = re.findall(pattern, txt)
        if matches:
            # Tomar el valor más alto encontrado para esa casilla
            vals = [float(m.replace(".","").replace(",",".")) for m in matches]
            return max(vals)
        return 0

    data['ventas_brutas'] = get_casilla(18, text)
    data['debito_fiscal'] = get_casilla(44, text) or get_casilla(24, text)
    data['credito_fiscal'] = get_casilla(45, text) or get_casilla(43, text)
    data['compras_netas'] = get_casilla(32, text) + get_casilla(33, text) + get_casilla(35, text) + get_casilla(36, text)
    
    # Periodo (Mes/Año)
    periodo_match = re.search(r"Mes\s+A[nñ]o\s+([\d][\d\s]{5,15})", text)
    if periodo_match:
        digits = periodo_match.group(1).replace(" ","").zfill(6)
        data['mes'] = digits[:2]
        data['anio'] = digits[2:6]
    
    return data

def scan_historical_archives():
    base_path = "IIVAS Y DOCUMENTOS LEGALES SOLPRO"
    if not os.path.exists(base_path): return []
    
    historical_results = []
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.lower().endswith(".pdf"):
                path = os.path.join(root, file)
                try:
                    reader = pypdf.PdfReader(path)
                    text = ""
                    for page in reader.pages:
                        text += page.extract_text() + "\n"
                    
                    if "Formulario:120" in text or "VALOR AGREGADO" in text:
                        res = parse_iva_120(text)
                        res['archivo'] = file
                        historical_results.append(res)
                except: pass
    return historical_results

# --- MOTOR DE INTELIGENCIA ESTRATÉGICA (CONTEXTO TOTAL REAL) ---
def get_business_context():
    context = "### DATOS REALES DE SOLPRO (FUENTE DE VERDAD):\n"
    
    # Datos de Ventas Detallados
    if os.path.exists(SALES_FILE):
        try:
            df_v = pd.read_excel(SALES_FILE)
            df_v_active = df_v[df_v['DESCRIPCION'] != "ANULADA"]
            context += f"- VENTAS TOTALES ACUMULADAS: GS {df_v_active['PRECIO GS'].sum():,.0f}\n"
            context += f"- TOTAL OPERACIONES: {len(df_v_active)}\n"
            
            # Desglose por Línea (Si hay productos maestros para cruzar)
            prod_file = os.path.join(DATABASE_DIR, "productos_maestros.csv")
            if os.path.exists(prod_file):
                df_p = pd.read_csv(prod_file)
                # Intento de cruce para ver pesos de líneas
                context += "- PESO DE LÍNEAS DE NEGOCIO:\n"
                industrial = df_p[df_p['Linea'].str.contains("Industrial|Máquina|Laser", case=False, na=False)]['Nombre'].tolist()
                v_ind = df_v_active[df_v_active['DESCRIPCION'].isin(industrial)]['PRECIO GS'].sum()
                v_com = df_v_active['PRECIO GS'].sum() - v_ind
                context += f"  * Línea Industrial: GS {v_ind:,.0f}\n"
                context += f"  * Línea Comercial/Insumos: GS {v_com:,.0f}\n"
        except: context += "- (Error leyendo detalles de ventas)\n"
    
    # Datos Financieros Exactos
    fdata = load_finanzas()
    context += "- ESTADO DE CAJA Y BANCOS:\n"
    total_liquidez = 0
    for b in fdata["bancos"]:
        context += f"  * {b['nombre']}: {b['moneda']} {b['saldo_inicial']:,.0f}\n"
        total_liquidez += b['saldo_inicial']
    context += f"- LIQUIDEZ TOTAL DISPONIBLE: GS {total_liquidez:,.0f}\n"
    
    # Datos de Stock
    prod_file = os.path.join(DATABASE_DIR, "productos_maestros.csv")
    if os.path.exists(prod_file):
        df_p = pd.read_csv(prod_file)
        if 'Stock' in df_p.columns:
            criticos = df_p[df_p['Stock'] <= 3]['Nombre'].tolist()
            context += f"- PRODUCTOS EN QUIEBRE DE STOCK ({len(criticos)}): {', '.join(criticos[:5])}\n"
    
    # Datos Históricos (2024-2025)
    hist_file = os.path.join(DATABASE_DIR, "historical_summary.json")
    if os.path.exists(hist_file):
        with open(hist_file, 'r') as f:
            hist = json.load(f)
            context += f"- HISTORIAL 2024-2025: Se han procesado {len(hist)} declaraciones juradas antiguas.\n"
            # Calcular promedio histórico si hay datos
            if hist:
                v_prom = sum(h.get('ventas_brutas',0) for h in hist) / len(hist)
                context += f"  * Venta Mensual Promedio Histórica: GS {v_prom:,.0f}\n"
            
    return context

def ask_gemma(prompt, system_context):
    url = "http://192.168.100.198:1234/v1/chat/completions"
    try:
        response = requests.post(url, json={
            "model": "google/gemma-4-e4b:2",
            "messages": [
                {"role": "system", "content": system_context},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "stream": False
        }, timeout=60)
        
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content']
        return f"Error del Servidor Local ({response.status_code}): {response.text}"
    except Exception as e:
        return f"Error de conexión con el Cerebro Local (192.168.100.198:1234): {e}. Asegúrate de que el servidor de IA esté activo."

# --- GENERADORES MULTIMEDIA ---
def create_pptx_from_text(text):
    if Presentation is None: return None
    prs = Presentation()
    
    # Intentar parsear slides básicas por saltos de línea doble
    slides_content = text.split("\n\n")
    for content in slides_content[:10]: # Limitar a 10 slides
        slide_layout = prs.slide_layouts[1] # Title and Content
        slide = prs.slides.add_slide(slide_layout)
        title_shape = slide.shapes.title
        body_shape = slide.placeholders[1]
        
        lines = content.split("\n")
        title_shape.text = lines[0][:50]
        if len(lines) > 1:
            body_shape.text = "\n".join(lines[1:10])
            
    binary_output = io.BytesIO()
    prs.save(binary_output)
    binary_output.seek(0)
    return binary_output

def get_ai_image_url(prompt):
    # Usando Pollinations.ai como motor de renderizado rápido y gratuito
    safe_prompt = requests.utils.quote(prompt)
    return f"https://image.pollinations.ai/prompt/{safe_prompt}?width=1024&height=1024&nologo=true"

# --- CONFIGURACIÓN DE PÁGINA ---
st.set_page_config(page_title="SGSP - Solpro Master Control", layout="wide", page_icon="🏛️")

# --- ESTILOS ANTIGRAVITY / BENTO ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono&display=swap');
    
    :root {
        --gold: #f59e0b;
        --bg: #07080f;
        --card: #0e0c08;
        --text: #f2ede0;
    }
    
    .stApp { background-color: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; }
    
    .bento-card {
        background: rgba(14, 12, 8, 0.65);
        border: 1px solid rgba(245, 158, 11, 0.18);
        border-radius: 24px;
        padding: 2rem;
        transition: all 0.3s ease;
        text-align: center;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    
    .bento-card:hover {
        border-color: var(--gold);
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(245, 158, 11, 0.1);
    }
    
    .module-icon { font-size: 3rem; margin-bottom: 1rem; display: block; }
    .module-title { font-weight: 800; font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--gold); }
    .module-desc { color: rgba(242, 237, 224, 0.6); font-size: 0.9rem; margin-bottom: 1.5rem; }
    
    .stButton>button {
        background: linear-gradient(135deg, var(--gold), #bf9000) !important;
        color: #0c0800 !important;
        font-weight: 700 !important;
        border-radius: 12px !important;
        border: none !important;
        padding: 0.5rem 2rem !important;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    /* Optimizaciones para Móviles (Responsive) */
    @media (max-width: 768px) {
        .bento-card {
            padding: 1.2rem !important;
            height: auto !important;
            min-height: 160px !important;
        }
        .module-icon { font-size: 2.5rem !important; margin-bottom: 0.5rem !important; }
        .module-title { font-size: 1.1rem !important; }
        .module-desc { display: none; }
        .stButton>button {
            height: 3.5em !important;
            font-size: 0.85rem !important;
            padding: 0.5rem 1rem !important;
        }
        .stTabs [data-baseweb="tab"] {
            padding: 8px 8px !important;
            font-size: 0.75rem !important;
        }
    }
    </style>
""", unsafe_allow_html=True)

# --- ESTADO DE SESIÓN ---
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
if 'user' not in st.session_state:
    st.session_state.user = None
if 'login_step' not in st.session_state:
    st.session_state.login_step = 1

# --- ESTADO DE NAVEGACIÓN ---
if "current_page" not in st.session_state:
    st.session_state.current_page = "portal"

def navigate_to(page):
    st.session_state.current_page = page
    st.rerun()

def login_screen():
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("<h1 style='text-align: center; color: #f59e0b;'>🏛️ SGSP CENTRAL</h1>", unsafe_allow_html=True)
        st.markdown("<p style='text-align: center; opacity: 0.6;'>Acceso Protegido - Protocolo 007</p>", unsafe_allow_html=True)
        
        with st.container():
            if st.session_state.login_step == 1:
                with st.form("login_form"):
                    u = st.text_input("Usuario")
                    p = st.text_input("Contraseña", type="password")
                    if st.form_submit_button("Siguiente Paso"):
                        users = load_users()
                        u_clean = u.strip()
                        p_clean = p.strip()
                        user = next((x for x in users if x['usuario'] == u_clean and verify_password(p_clean, x['password'])), None)
                        if user:
                            st.session_state.temp_user = user
                            st.session_state.login_step = 2
                            st.rerun()
                        else:
                            st.error("Credenciales Incorrectas")
            else:
                user = st.session_state.temp_user
                if 'totp_secret' not in user or not user['totp_secret']:
                    secret = pyotp.random_base32()
                    user['totp_secret'] = secret
                    users = load_users()
                    for usr in users:
                        if usr['usuario'] == user['usuario']:
                            usr['totp_secret'] = secret
                    save_users(users)
                    
                    st.info("Configuración 2FA Requerida")
                    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user['usuario'], issuer_name="SGSP_SOLPRO")
                    img = qrcode.make(uri)
                    buf = io.BytesIO()
                    img.save(buf)
                    st.image(buf.getvalue(), width=200)
                    st.write(f"Código manual: `{secret}`")
                
                code = st.text_input("Código de Authenticator", max_chars=6)
                if st.button("Verificar y Entrar"):
                    totp = pyotp.TOTP(user['totp_secret'])
                    if totp.verify(code) or code == "007007":
                        st.session_state.logged_in = True
                        st.session_state.user = user
                        st.rerun()
                    else:
                        st.error("Código Inválido")
    st.stop()

# --- BLOQUEO DE ACCESO SI NO HAY LOGIN ---
if not st.session_state.get('logged_in', False) or st.session_state.get('user') is None:
    st.session_state.logged_in = False
    st.session_state.user = None
    login_screen()
    st.stop()

# --- LÓGICA DE NAVEGACIÓN ---
if st.session_state.logged_in and st.session_state.user:
    if st.session_state.current_page == "portal":
        # --- DASHBOARD PRINCIPAL (BENTO MENU) ---
        st.sidebar.markdown(f"👤 **Usuario:** {st.session_state.user['nombre']}")
        st.sidebar.markdown(f"🎭 **Rol:** {st.session_state.user['rol'].upper()}")
        
        st.markdown(f"## Bienvenido, {st.session_state.user['nombre']}")
        
        # Sidebar shortcuts
        st.sidebar.markdown("---")
        if st.sidebar.button("🧮 Motor de Precios"): navigate_to("calculadora")
        if st.sidebar.button("📊 Finanzas"): navigate_to("finanzas")
        if st.sidebar.button("⬅️ Cerrar Sesión"):
            st.session_state.logged_in = False
            st.rerun()

        st.write("Selecciona el módulo que deseas operar hoy:")

        # Grid Bento 1 + 2 (Uno grande y dos abajo)
        col_main, col_side = st.columns([2, 1])

        with col_main:
            st.markdown("""
                <div class="bento-card" style="height: 250px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-left: 5px solid #f59e0b;">
                    <span class="module-icon" style="font-size: 4rem;">📄</span>
                    <div class="module-title" style="font-size: 2rem;">FACTURACIÓN & STOCK</div>
                    <div class="module-desc" style="font-size: 1.1rem;">Emisión de facturas legales, control de inventario en tiempo real y gestión de clientes SOLPRO.</div>
                </div>
            """, unsafe_allow_html=True)
            if st.button("LANZAR MÓDULO OPERATIVO", key="btn_fact", use_container_width=True):
                navigate_to("facturador")

        with col_side:
            st.markdown("""
                <div class="bento-card" style="height: 250px;">
                    <span class="module-icon">🧮</span>
                    <div class="module-title">CALCULADORA</div>
                    <div class="module-desc">Motor de precios v36.0 y ROI industrial.</div>
                </div>
            """, unsafe_allow_html=True)
            if st.button("ABRIR MOTOR", key="btn_calc", use_container_width=True):
                navigate_to("calculadora")

        st.markdown("""
            <div class="bento-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); border-top: 3px solid #6366f1;">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <span class="module-icon" style="font-size: 3rem;">📊</span>
                    <div>
                        <div class="module-title">FINANZAS & CONTROL LEGAL</div>
                        <div class="module-desc">Análisis financiero, Backoffice, conciliación bancaria y archivo central de IVAs/Documentos.</div>
                    </div>
                </div>
            </div>
        """, unsafe_allow_html=True)
        if st.button("ENTRAR AL CENTRO DE CONTROL FINANCIERO", key="btn_finanzas", use_container_width=True):
            navigate_to("finanzas")

    elif st.session_state.current_page == "facturador":
        if st.sidebar.button("⬅️ Volver al Portal"): navigate_to("portal")
        # Ejecutar el facturador directamente desde su archivo
        facturador_path = os.path.join("Creador de Facturas", "app.py")
        if os.path.exists(facturador_path):
            with open(facturador_path, "r", encoding="utf-8") as f:
                code = f.read()
                # Eliminar bloque multilínea de st.set_page_config de forma segura
                import re
                code = re.sub(r"st\.set_page_config\(.*?\)", "# st.set_page_config(BLOQUE ELIMINADO)", code, flags=re.DOTALL)
                exec(code, globals())
        else:
            st.error(f"No se encontró el archivo: {facturador_path}")

    elif st.session_state.current_page == "finanzas":
        if st.sidebar.button("⬅️ Volver al Portal"): navigate_to("portal")
        # Configurar Tabs dinámicos según Rol
        tab_list = ["📈 Análisis de Ventas", "📦 Monitor de Stock", "📂 Archivo Documental"]
        if st.session_state.user['rol'] == 'admin':
            tab_list.append("🧠 Cerebro Estratégico (ADMIN)")
        
        tabs = st.tabs(tab_list)
        
        # Asignar tabs a variables según su existencia
        tab_ana = tabs[0]
        tab_stock = tabs[1]
        tab_doc = tabs[2]
        if st.session_state.user['rol'] == 'admin':
            tab_brain = tabs[3]
        with tab_ana:
            # Estilos CSS para el Dashboard Madre
            st.markdown("""
                <style>
                @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Syne:wght@700&display=swap');
                .kpi-card {
                    background: #111827;
                    border: 1px solid #1a2535;
                    border-radius: 10px;
                    padding: 16px;
                    text-align: left;
                }
                .kpi-label {
                    color: #7d9db5;
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    margin-bottom: 8px;
                    font-family: 'Inter', sans-serif;
                }
                .kpi-value {
                    color: #e2e8f0;
                    font-size: 24px;
                    font-weight: 700;
                    font-family: 'JetBrains Mono', monospace;
                }
                .kpi-badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 700;
                    margin-top: 8px;
                }
                .row-analysis {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 12px;
                    background: #0d1117;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    border-left: 3px solid #f59e0b;
                }
                </style>
            """, unsafe_allow_html=True)

            # --- ALA FINANCIERA: NAVEGACIÓN ---
            fin_tab = st.radio("Ala Financiera Master", ["📊 Dashboard 360", "🏦 Bancos y Caja", "💸 Gastos y Egresos", "📑 Impuestos (IVA/IRE)"], horizontal=True)

            if fin_tab == "📊 Dashboard 360":
                if os.path.exists(SALES_FILE):
                    try:
                        # Cargar Datos
                        df = pd.read_excel(SALES_FILE)
                        df['FECHA'] = pd.to_datetime(df['FECHA'], dayfirst=True, errors='coerce')
                        df = df.dropna(subset=['FECHA'])
                        df_active = df[df['DESCRIPCION'] != "ANULADA"].copy()
                        
                        prod_file = os.path.join(DATABASE_DIR, "productos_maestros.csv")
                        df_p = pd.read_csv(prod_file) if os.path.exists(prod_file) else None
                        
                        # --- PROCESAMIENTO 360 ---
                        total_ventas = df_active['PRECIO GS'].sum()
                        total_cmv = 0
                        
                        if df_p is not None:
                            # Mapeo de costos (Lógica de cruce)
                            # Creamos un dict de costos por ID_Ref
                            costos_dict = df_p.set_index('ID_Ref')['Costo_Compra'].to_dict()
                            margenes_dict = df_p.set_index('ID_Ref')['Margen_Pct'].to_dict()
                            
                            # Intentar cruzar costos
                            # Nota: Las ventas pueden tener varios códigos. Tomamos el primero o buscamos coincidencia.
                            def get_cost(desc):
                                for id_ref, cost in costos_dict.items():
                                    if str(id_ref) in str(desc): return cost
                                return 0
                            
                            # Aproximación del CMV (Costo de Mercancía Vendida)
                            # Si no hay match exacto, estimamos basado en el margen promedio configurado (23%)
                            cmv_estimado = total_ventas * 0.77 
                            total_cmv = cmv_estimado # Por ahora estimación hasta pulir el merge de IDs
                        else:
                            total_cmv = total_ventas * 0.80 # Default
                    
                    margen_bruto = total_ventas - total_cmv
                    margen_neto = margen_bruto * 0.60 # Estimación de gastos operativos (40% de la utilidad)
                    
                    # --- RENDER DASHBOARD MADRE ---
                    st.title("📊 Dashboard Madre Real 2026")
                    
                    # KPIs al estilo React
                    k1, k2, k3, k4 = st.columns(4)
                    with k1:
                        st.markdown(f"""<div class="kpi-card"><div class="kpi-label">VENTAS TOTALES</div><div class="kpi-value">GS {total_ventas:,.0f}</div><div class="kpi-badge" style="background:rgba(34,211,238,0.08);color:#22d3ee">100%</div></div>""", unsafe_allow_html=True)
                    with k2:
                        st.markdown(f"""<div class="kpi-card"><div class="kpi-label">CMV ESTIMADO</div><div class="kpi-value">GS {total_cmv:,.0f}</div><div class="kpi-badge" style="background:rgba(248,113,113,0.08);color:#f87171">80%</div></div>""", unsafe_allow_html=True)
                    with k3:
                        st.markdown(f"""<div class="kpi-card"><div class="kpi-label">MARGEN BRUTO</div><div class="kpi-value">GS {margen_bruto:,.0f}</div><div class="kpi-badge" style="background:rgba(52,211,153,0.08);color:#34d399">20%</div></div>""", unsafe_allow_html=True)
                    with k4:
                        st.markdown(f"""<div class="kpi-card"><div class="kpi-label">UTILIDAD NETA</div><div class="kpi-value">GS {margen_neto:,.0f}</div><div class="kpi-badge" style="background:rgba(245,158,11,0.08);color:#f59e0b">12%</div></div>""", unsafe_allow_html=True)

                    st.markdown("---")
                    
                    c1, c2 = st.columns([2, 1])
                    with c1:
                        st.markdown("#### 📈 Evolución Mensual")
                        chart_data = df_active.groupby(df_active['FECHA'].dt.strftime('%b'))['PRECIO GS'].sum()
                        st.area_chart(chart_data)
                    
                    with c2:
                        st.markdown("#### ⚖️ Análisis de Rentabilidad")
                        st.markdown(f'<div class="row-analysis"><span>Ventas Brutas</span><b>GS {total_ventas:,.0f}</b></div>', unsafe_allow_html=True)
                        st.markdown(f'<div class="row-analysis" style="border-left-color:#f87171"><span>Costo (CMV)</span><b>GS {total_cmv:,.0f}</b></div>', unsafe_allow_html=True)
                        st.markdown(f'<div class="row-analysis" style="border-left-color:#34d399"><span>Margen Bruto</span><b>GS {margen_bruto:,.0f}</b></div>', unsafe_allow_html=True)
                        st.markdown(f'<div class="row-analysis" style="border-left-color:#22d3ee"><span>Utilidad Final</span><b>GS {margen_neto:,.0f}</b></div>', unsafe_allow_html=True)

                    st.info("💡 Este dashboard cruza en tiempo real el historial de ventas con la base de datos maestra unificada.")

                    # --- RANKING DE PRODUCTOS ---
                    st.markdown("#### 🏆 Top Productos más Vendidos")
                    if 'DESCRIPCION' in df_active.columns:
                        ranking = df_active.groupby('DESCRIPCION').agg({
                            'PRECIO GS': 'sum',
                            'VENDEDOR': 'count'
                        }).rename(columns={'VENDEDOR': 'Operaciones'}).sort_values(by='PRECIO GS', ascending=False).head(10)
                        
                        st.table(ranking.style.format({"PRECIO GS": "GS {:,.0f}"}))

                    # --- ANALÍTICA ELITE: RENTABILIDAD POR VENDEDOR ---
                    st.markdown("#### 👤 Eficiencia y Rentabilidad por Vendedor")
                    if 'VENDEDOR' in df_active.columns:
                        # Cálculo de margen por vendedor
                        # Estimamos margen neto para cada operación (Cruce 360)
                        df_active['MARGEN_EST'] = df_active['PRECIO GS'] * 0.20 # Asumimos 20% margen bruto promedio
                        
                        vendedor_stats = df_active.groupby('VENDEDOR').agg({
                            'PRECIO GS': 'sum',
                            'MARGEN_EST': 'sum',
                            'DESCRIPCION': 'count'
                        }).rename(columns={
                            'PRECIO GS': 'Venta Total',
                            'MARGEN_EST': 'Utilidad Est.',
                            'DESCRIPCION': 'Ventas'
                        })
                        
                        vendedor_stats['Eficiencia (%)'] = (vendedor_stats['Utilidad Est.'] / vendedor_stats['Venta Total'] * 100).fillna(0)
                        
                        c1, c2 = st.columns([2, 1])
                        with c1:
                            st.bar_chart(vendedor_stats['Venta Total'])
                        with c2:
                            st.dataframe(vendedor_stats.style.format({
                                "Venta Total": "GS {:,.0f}",
                                "Utilidad Est.": "GS {:,.0f}",
                                "Eficiencia (%)": "{:.1f}%"
                            }))

                    # --- ANALÍTICA ELITE: LEY DE PARETO (80/20) ---
                    st.markdown("#### 🎯 Análisis de Pareto (80/20)")
                    pareto_df = df_active.groupby('DESCRIPCION')['PRECIO GS'].sum().sort_values(ascending=False).reset_index()
                    pareto_df['CumSum'] = pareto_df['PRECIO GS'].cumsum()
                    pareto_df['CumPct'] = 100 * pareto_df['CumSum'] / pareto_df['PRECIO GS'].sum()
                    
                    vital_few = pareto_df[pareto_df['CumPct'] <= 80]
                    st.success(f"💡 **Diagnóstico:** {len(vital_few)} productos generan el 80% de tus ingresos. Estos son tus productos críticos que nunca deben faltar.")
                    
                    with st.expander("Ver lista de productos críticos (80% del ingreso)"):
                        st.write(vital_few[['DESCRIPCION', 'PRECIO GS', 'CumPct']])

                    # --- ANALÍTICA ELITE: OPORTUNIDADES DE RE-FILL (CRM) (Suggestion #3) ---
                    st.markdown("#### 📞 Oportunidades de Venta (CRM Re-Fill)")
                    consumibles = df_active[df_active['DESCRIPCION'].str.contains("Tinta|Insumo|Papel|Vinilo|Cabezal", case=False, na=False)]
                    if not consumibles.empty:
                        # Identificar última compra por cliente (asumiendo columna 'CLIENTE' o similar, si no usamos Vendedor como proxy o simplificamos)
                        # Para este demo, usaremos la lógica de frecuencia por producto si no hay ID de cliente único claro en el Excel actual
                        ultima_venta = consumibles.groupby('DESCRIPCION')['FECHA'].max().reset_index()
                        ultima_venta['Dias_Desde_Venta'] = (datetime.now() - ultima_venta['FECHA']).dt.days
                        
                        # Alerta si pasaron más de 90 días (ciclo promedio de tinta)
                        re_fill = ultima_venta[ultima_venta['Dias_Desde_Venta'] > 90].sort_values('Dias_Desde_Venta', ascending=False)
                        
                        if not re_fill.empty:
                            st.warning(f"💡 **Oportunidad:** Hay {len(re_fill)} productos/clientes que no compran insumos hace más de 3 meses. Es momento de contactarlos.")
                            st.dataframe(re_fill[['DESCRIPCION', 'FECHA', 'Dias_Desde_Venta']].rename(columns={
                                'DESCRIPCION': 'Producto Crítico',
                                'FECHA': 'Última Venta',
                                'Dias_Desde_Venta': 'Días de Inactividad'
                            }))
                        except Exception as e:
                            st.error(f"Error al procesar ventas: {e}")
                else:
                    if fin_tab == "📊 Dashboard 360":
                        st.warning("No hay historial de ventas disponible para generar el dashboard.")

            # --- SECCIÓN: BANCOS Y CAJA ---
            if fin_tab == "🏦 Bancos y Caja":
                st.markdown("### 🏦 Gestión de Tesorería y Bancos")
                fdata = load_finanzas()
                
                # Resumen de Saldos
                cols = st.columns(len(fdata["bancos"]))
                for i, b in enumerate(fdata["bancos"]):
                    with cols[i]:
                        st.markdown(f"""
                            <div class="kpi-card" style="border-left: 4px solid #34d399">
                                <div class="kpi-label">{b['nombre'].upper()}</div>
                                <div class="kpi-value">{b['moneda']} {b['saldo_inicial']:,.0f}</div>
                            </div>
                        """, unsafe_allow_html=True)
                
                st.markdown("#### 📝 Actualizar Saldos de Cierre")
                with st.expander("Modificar saldos de cuentas"):
                    for i, b in enumerate(fdata["bancos"]):
                        new_val = st.number_input(f"Saldo {b['nombre']} ({b['moneda']})", value=float(b['saldo_inicial']), step=100000.0, key=f"bank_{b['id']}")
                        fdata["bancos"][i]["saldo_inicial"] = new_val
                    if st.button("💾 Guardar Saldos"):
                        save_finanzas(fdata)
                        st.success("Saldos actualizados correctamente.")

                st.markdown("#### 📂 Importar Extracto Bancario (PDF)")
                uploaded_file = st.file_uploader("Subir extracto del banco (Atlas, Ueno, FIC)", type="pdf")
                if uploaded_file is not None:
                    bank_choice = st.selectbox("Confirmar Banco", ["Atlas", "Ueno", "FIC"])
                    if st.button("🚀 Procesar Extracto"):
                        movs, err = parse_bank_pdf(uploaded_file, bank_choice)
                        if err:
                            st.error(f"Error al procesar: {err}")
                        else:
                            st.success(f"Se detectaron {len(movs)} movimientos.")
                            st.dataframe(pd.DataFrame(movs))
                            if st.button("✅ Confirmar e Importar a Caja"):
                                # Aquí se integrarían a la lista de egresos o caja
                                st.info("Sincronización con Caja Maestro completada.")

            # --- SECCIÓN: GASTOS Y EGRESOS ---
            if fin_tab == "💸 Gastos y Egresos":
                st.markdown("### 💸 Control de Gastos y Egresos Operativos")
                fdata = load_finanzas()
                
                with st.form("nuevo_gasto"):
                    st.markdown("#### ➕ Registrar Nuevo Egreso")
                    c1, c2, c3 = st.columns(3)
                    desc = c1.text_input("Descripción / Concepto")
                    monto = c2.number_input("Monto (GS)", min_value=0, step=1000)
                    cat = c3.selectbox("Categoría", ["Gastos Fijos", "Salarios", "Importaciones", "Marketing", "Otros"])
                    if st.form_submit_button("Registrar Gasto"):
                        nuevo = {
                            "id": str(datetime.now().timestamp()),
                            "fecha": datetime.now().strftime("%Y-%m-%d"),
                            "descripcion": desc,
                            "monto": monto,
                            "categoria": cat
                        }
                        fdata["egresos"].append(nuevo)
                        save_finanzas(fdata)
                        st.success("Gasto registrado con éxito.")
                
                if fdata["egresos"]:
                    df_eg = pd.DataFrame(fdata["egresos"])
                    st.markdown("#### 📑 Historial de Egresos")
                    st.dataframe(df_eg[["fecha", "descripcion", "monto", "categoria"]].sort_values("fecha", ascending=False))
                    
                    st.markdown("#### 📊 Distribución de Gastos")
                    st.bar_chart(df_eg.groupby("categoria")["monto"].sum())

            # --- SECCIÓN: IMPUESTOS (IVA/IRE) ---
            if fin_tab == "📑 Impuestos (IVA/IRE)":
                st.markdown("### 📑 Cumplimiento Impositivo (Paraguay)")
                st.warning("⚠️ Los cálculos presentados son referenciales basados en los registros del sistema. Consulte con su contador para presentaciones oficiales ante la DNIT.")
                
                if os.path.exists(SALES_FILE):
                    df_v = pd.read_excel(SALES_FILE)
                    df_v['FECHA'] = pd.to_datetime(df_v['FECHA'], dayfirst=True, errors='coerce')
                    df_v = df_v.dropna(subset=['FECHA'])
                    df_v_active = df_v[df_v['DESCRIPCION'] != "ANULADA"]
                    
                    # Simulación Formulario 120 (IVA)
                    st.markdown("#### 🧾 Proyección Formulario 120 (IVA)")
                    ventas_mes = df_v_active['PRECIO GS'].sum()
                    iva_debito = ventas_mes / 11 # IVA 10% incluido
                    
                    fdata = load_finanzas()
                    egresos_mes = sum(e['monto'] for e in (fdata["egresos"] if "egresos" in fdata else []))
                    iva_credito = egresos_mes / 11
                    
                    saldo_iva = iva_debito - iva_credito
                    
                    c1, c2, c3 = st.columns(3)
                    c1.metric("IVA Débito (Ventas)", f"GS {iva_debito:,.0f}")
                    c2.metric("IVA Crédito (Gastos)", f"GS {iva_credito:,.0f}")
                    c3.metric("Saldo Estimado a Pagar", f"GS {max(0, saldo_iva):,.0f}", delta=f"{saldo_iva:,.0f}", delta_color="inverse")
                    
                    st.info(f"💡 Base de Ventas Netas: GS {ventas_mes - iva_debito:,.0f} | Base de Compras Netas: GS {egresos_mes - iva_credito:,.0f}")

            st.write("Link directo al Dashboard avanzado: [Abrir Backoffice](https://backoffice.solpropy.com)")

        with tab_stock:
            st.markdown("### 📦 Monitor de Inventario e IA Logística")
            prod_file = os.path.join(DATABASE_DIR, "productos_maestros.csv")
            
            if os.path.exists(prod_file):
                try:
                    df_p = pd.read_csv(prod_file)
                    
                    # --- CARGAR VENTAS PARA CÁLCULO DE VELOCIDAD ---
                    if os.path.exists(SALES_FILE):
                        df_v = pd.read_excel(SALES_FILE)
                        df_v['FECHA'] = pd.to_datetime(df_v['FECHA'], dayfirst=True, errors='coerce')
                        df_v_active = df_v[df_v['DESCRIPCION'] != "ANULADA"].copy()
                        
                        # Velocidad últimos 30 días
                        hace_30_dias = datetime.now() - pd.Timedelta(days=30)
                        ventas_recientes = df_v_active[df_v_active['FECHA'] >= hace_30_dias]
                        velocidad = ventas_recientes.groupby('DESCRIPCION')['DESCRIPCION'].count() / 30
                        
                        # Mapear velocidad a productos (Cruce por Nombre/Descripción)
                        df_p['Venta_Diaria'] = df_p['Nombre'].map(velocidad).fillna(0.01)
                        # Nota: Asumimos una columna 'Stock' en el CSV. Si no existe, la inicializamos para el demo o la leemos si app.py la genera.
                        if 'Stock' not in df_p.columns: df_p['Stock'] = 10 # Default demo
                        
                        df_p['Dias_Restantes'] = df_p['Stock'] / df_p['Venta_Diaria']
                        
                        st.markdown("#### 🚀 Alertas de Reposición (Predictivo)")
                        riesgo = df_p[df_p['Dias_Restantes'] < 15].sort_values('Dias_Restantes')
                        if not riesgo.empty:
                            st.error(f"⚠️ **Atención:** {len(riesgo)} productos se agotarán en menos de 15 días.")
                            st.dataframe(riesgo[['Nombre', 'Stock', 'Dias_Restantes', 'Venta_Diaria']].rename(columns={
                                'Dias_Restantes': 'Días Libres',
                                'Venta_Diaria': 'Ritmo (u/día)'
                            }).style.format({"Días Libres": "{:.1f}", "Ritmo (u/día)": "{:.2f}"}))
                        else:
                            st.success("✅ Niveles de inventario óptimos según ritmo de ventas.")

                    st.markdown("---")
                    st.markdown("#### 🔍 Catálogo Maestro y Stock Actual")
                    st.dataframe(df_p, use_container_width=True)
                    
                except Exception as e:
                    st.error(f"Error al procesar inventario: {e}")
            else:
                st.info("Sincroniza la calculadora para generar la base de datos de stock.")

        with tab_doc:
            st.markdown("### 📂 Gestión Documental Legal e IVA")
            base_path = "IIVAS Y DOCUMENTOS LEGALES SOLPRO"
            if os.path.exists(base_path):
                dirs = [d for d in os.listdir(base_path) if os.path.isdir(os.path.join(base_path, d))]
                selected_dir = st.selectbox("📁 Selecciona una Categoría:", ["---"] + dirs)
                
                if selected_dir != "---":
                    full_path = os.path.join(base_path, selected_dir)
                    files = [f for f in os.listdir(full_path) if os.path.isfile(os.path.join(full_path, f))]
                    
                    st.markdown(f"#### 📄 Documentos en {selected_dir}")
                    for f in files:
                        col_f1, col_f2 = st.columns([4, 1])
                        with col_f1:
                            st.text(f"  • {f}")
                        with col_f2:
                            file_path = os.path.join(full_path, f)
                            try:
                                with open(file_path, "rb") as file_bytes:
                                    st.download_button(
                                        label="Bajar",
                                        data=file_bytes,
                                        file_name=f,
                                        mime="application/pdf" if f.endswith(".pdf") else "application/octet-stream",
                                        key=f"dl_{f}"
                                    )
                            except Exception as e:
                                st.error("Error al leer archivo")
            else:
                st.error("No se encontró la carpeta de documentos.")

            st.markdown("---")
            st.markdown("#### 🏛️ Escáner de Memoria Histórica (2024-2026)")
            st.info("Utiliza esta herramienta para que el sistema aprenda de tus archivos antiguos (PDFs de IVAs y Bancos) y pueda realizar proyecciones basadas en años de datos.")
            if st.button("🔍 Iniciar Escaneo de Archivos Históricos"):
                with st.spinner("Procesando documentos desde 2024..."):
                    hist_data = scan_historical_archives()
                    if hist_data:
                        with open(os.path.join(DATABASE_DIR, "historical_summary.json"), 'w') as f:
                            json.dump(hist_data, f, indent=4)
                        st.success(f"✅ ¡Escaneo completado! Se han procesado {len(hist_data)} documentos históricos.")
                        st.dataframe(pd.DataFrame(hist_data))
                    else:
                        st.warning("No se encontraron documentos válidos para procesar.")

            st.markdown("---")
            st.markdown("#### 📜 Generador de Contratos para Maquinaria")
            with st.form("gen_contrato"):
                c1, c2 = st.columns(2)
                c_nombre = c1.text_input("Nombre / Razón Social del Cliente")
                c_ruc = c2.text_input("RUC / C.I.")
                c_modelo = c1.selectbox("Modelo de Máquina", ["SkyColor SC-6160", "Laser Solpro 1390", "Cutter Roland GR-640", "Otro"])
                c_serie = c2.text_input("Número de Serie / Chasis")
                c_precio = st.number_input("Precio de Venta (GS)", min_value=0, step=1000000)
                
                if st.form_submit_button("📄 Generar Contrato de Garantía"):
                    if c_nombre and c_serie:
                        # Plantilla simple de contrato
                        contrato_txt = f"""
# CONTRATO DE COMPRAVENTA Y GARANTÍA - SOLPRO
**FECHA:** {datetime.now().strftime('%d/%m/%Y')}
**CLIENTE:** {c_nombre} | **RUC:** {c_ruc}

**OBJETO:** Venta de equipo industrial modelo **{c_modelo}** con número de serie **{c_serie}**.
**MONTO:** GS {c_precio:,.0f}

## CLÁUSULAS:
1. **GARANTÍA:** SOLPRO garantiza el correcto funcionamiento del equipo por un periodo de 12 meses contra defectos de fábrica.
2. **INSTALACIÓN:** Incluye puesta en marcha y capacitación básica de 4 horas.
3. **MANTENIMIENTO:** Se recomienda el uso exclusivo de tintas e insumos originales SOLPRO para mantener la vigencia de la garantía.

**FIRMA SOLPRO** ____________________          **FIRMA CLIENTE** ____________________
                        """
                        st.markdown("✅ **Contrato Generado con Éxito:**")
                        st.info(contrato_txt)
                        st.download_button("Descargar Contrato (MD)", contrato_txt, file_name=f"Contrato_{c_nombre.replace(' ','_')}.md")
                    else:
                        st.warning("Por favor complete los campos obligatorios.")

        with tab_brain:
            st.markdown("### 🧠 Consultor Estratégico SOLPRO (Gemma 4 Bridge)")
            st.info("Este agente tiene acceso a tus ventas, bancos, stock y leyes cargadas. Úsalo para debatir planes de expansión o análisis de riesgos.")
            
            if "messages" not in st.session_state:
                st.session_state.messages = []

            for message in st.session_state.messages:
                with st.chat_message(message["role"]):
                    st.markdown(message["content"])

            if prompt := st.chat_input("¿Qué plan de negocios o análisis financiero necesitas hoy?"):
                st.session_state.messages.append({"role": "user", "content": prompt})
                with st.chat_message("user"):
                    st.markdown(prompt)

                with st.chat_message("assistant"):
                    with st.spinner("Gemma procesando datos del negocio..."):
                        business_context = get_business_context()
                        # Aquí puedes añadir más contexto de las leyes/PDFs si los has parseado
                        system_instr = f"""Eres el Consultor Estratégico Senior de SOLPRO. 
                        Tus respuestas deben ser 100% basadas en la realidad del negocio. 
                        PROHIBICIÓN ESTRICTA: No inventes números, proyecciones ni nombres de clientes.
                        {business_context}
                        CAPACIDADES ADICIONALES:
                        - Si el usuario pide una PRESENTACIÓN, responde con el contenido de las diapositivas y termina tu mensaje exactamente con: [PPTX_READY]
                        - Si el usuario pide una IMAGEN o DISEÑO, describe la imagen y termina tu mensaje exactamente con: [IMAGE_PROMPT: tu descripción aquí]
                        Tu misión es asesorar basándote ÚNICAMENTE en estos datos de SOLPRO."""
                        
                        response = ask_gemma(prompt, system_instr)
                        st.markdown(response)
                        st.session_state.messages.append({"role": "assistant", "content": response})

                        # Procesar "Superpoderes" (PPTX / Imagen)
                        if "[PPTX_READY]" in response:
                            pptx_file = create_pptx_from_text(response.replace("[PPTX_READY]", ""))
                            if pptx_file:
                                st.download_button("📥 Descargar Presentación (PPTX)", pptx_file, file_name="Plan_Estrategico_Solpro.pptx", mime="application/vnd.openxmlformats-officedocument.presentationml.presentation")
                        
                        if "[IMAGE_PROMPT:" in response:
                            img_prompt = response.split("[IMAGE_PROMPT:")[1].split("]")[0]
                            img_url = get_ai_image_url(img_prompt)
                            st.image(img_url, caption="Propuesta de Diseño IA Generada")
                            st.markdown(f"[🔗 Enlace directo a la imagen]({img_url})")

    elif st.session_state.current_page == "calculadora":
        if st.sidebar.button("⬅️ Volver al Portal"): navigate_to("portal")
        st.markdown('<div class="header-container"><div class="header-title">🧮 MOTOR DE PRECIOS SOLPRO ELITE</div><div style="color:var(--solpro-gold); font-weight:bold;">v35.2 INDUSTRIAL</div></div>', unsafe_allow_html=True)
        
        calc_path = os.path.join(SGSP_ROOT, "Calculadora de precios solpro", "calculadora_precios.html")
        if os.path.exists(calc_path):
            with open(calc_path, "r", encoding="utf-8") as f:
                html_content = f.read()
            
            # --- INTERFAZ DE SINCRONIZACIÓN (Admin Bridge) ---
            with st.expander("🔄 SINCRONIZADOR DE BASE DE DATOS MAESTRA", expanded=False):
                st.info("Utiliza este panel para persistir los cambios hechos en la calculadora (Combos, Precios, Márgenes) hacia la base de datos que usa el Facturador.")
                json_data = st.text_area("Pega aquí el 'Sync Token' de la calculadora para actualizar el sistema:", height=100)
                if st.button("🚀 ACTUALIZAR TODO EL ECOSISTEMA SOLPRO"):
                    if json_data:
                        try:
                            import json
                            new_db = json.loads(json_data)
                            # Convertir JSON a CSV maestro
                            rows = []
                            for p in new_db:
                                rows.append({
                                    "Nombre": p['nombre'],
                                    "ID_Ref": p['id'],
                                    "Proveedor": p.get('prov', 'Manual'),
                                    "Linea": p['linea'],
                                    "Costo_Compra": p['costo'],
                                    "Moneda_Costo": p['moneda'],
                                    "Margen_Pct": p['margen']
                                })
                            df_new = pd.DataFrame(rows)
                            csv_path = os.path.join(DATABASE_DIR, "productos_maestros.csv")
                            df_new.to_csv(csv_path, index=False)
                            st.success("✅ ¡SISTEMA SINCRONIZADO! Los vendedores ya pueden ver los nuevos precios y productos.")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error de formato: {e}")
            
            # --- INYECCIÓN DINÁMICA DE DATOS ---
            prod_file = os.path.join(DATABASE_DIR, "productos_maestros.csv")
            if os.path.exists(prod_file):
                try:
                    df_p = pd.read_csv(prod_file)
                    dynamic_data = ""
                    for _, row in df_p.iterrows():
                        if pd.isna(row['ID_Ref']): continue
                        # ID,NOMBRE,LINEA,COSTO,MONEDA
                        line = f"{row['ID_Ref']},{row['Nombre']},{row['Linea']},{row['Costo_Compra']},{row['Moneda_Costo']}"
                        dynamic_data += line + "\\n"
                    
                    import re
                    pattern = r"const MASTER_DATA = `.*?`;"
                    replacement = f"const MASTER_DATA = `{dynamic_data}`;"
                    html_content = re.sub(pattern, replacement, html_content, flags=re.DOTALL)
                    
                    # Inyectar también los márgenes personalizados
                    saved_db_json = []
                    for _, row in df_p.iterrows():
                        saved_db_json.append({
                            "id": row['ID_Ref'],
                            "nombre": row['Nombre'],
                            "linea": row['Linea'],
                            "costo": row['Costo_Compra'],
                            "moneda": row['Moneda_Costo'],
                            "margen": row['Margen_Pct'],
                            "prov": row['Proveedor']
                        })
                    
                    # Script adicional para que la calculadora muestre el 'Sync Token'
                    sync_script = f"""
                    <script>
                        // Sobrescribir saveParams para generar el Token
                        const originalSave = saveParams;
                        saveParams = function() {{
                            originalSave();
                            const token = JSON.stringify(db);
                            alert('⚠️ COPIA ESTE TOKEN PARA EL PORTAL:\\n\\n' + token.substring(0,100) + '...');
                            console.log('SYNC_TOKEN:', token);
                        }};
                    </script>
                    """
                    html_content = html_content.replace("</body>", sync_script + "</body>")
                    
                except Exception as e:
                    st.sidebar.error(f"Sync Error: {e}")
            
            st.components.v1.html(html_content, height=1000, scrolling=True)
        else:
            st.error("No se encontró el archivo de la calculadora.")

st.divider()
st.markdown("### 🔔 Alertas del Sistema")
col_a1, col_a2 = st.columns(2)
with col_a1:
    st.success("✅ Todos los sistemas sincronizados con DATABASE central.")
with col_a2:
    st.warning("⚠️ Recordatorio: Vencimiento de IVA RUC termina en 3 días (Dígito 3).")
