import streamlit as st
import pandas as pd
import os
import json
import hashlib
import base64
from sync_service import (
    sync_pago, sync_pedido, sync_tipo_cambio,
    sync_clientes_bulk, sync_productos_bulk
)
import io
import requests
import pyotp
import qrcode
from datetime import datetime, date
from pdf_generator import generate_invoice_pdf
from calcular_precio_final import calcular

# --- CONFIGURACIÓN DE RUTAS (Railway + Local) ---
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
PERSISTENT_DIR = "/app/data" # Mount path del volumen Railway
SGSP_DATABASE = os.path.join(BASE_DIR, "database") if not os.path.exists(PERSISTENT_DIR) else PERSISTENT_DIR
SYSTEM_PEPPER  = os.environ.get("SYSTEM_PEPPER", "SOLPRO_ULTRA_SECRET_2026_#!")


def inicializar_tipo_cambio():
    import json
    from datetime import datetime
    tc_path = os.path.join(SGSP_DATABASE, 'master_tipo_cambio.json')
    if not os.path.exists(tc_path):
        return
    with open(tc_path, 'r', encoding='utf-8') as f:
        try:
            tc = json.load(f)
        except:
            tc = {}
    if tc.get('dolar_mercado', 0) == 0:
        tc['dolar_mercado'] = 6250
        tc['banda_piso'] = 6250 + 150
        tc['banda_techo'] = 6250 + 350
        tc['ultima_actualizacion'] = datetime.now().strftime('%Y-%m-%d')
        tc['actualizado_por'] = 'Sistema (default)'
        with open(tc_path, 'w', encoding='utf-8') as f:
            json.dump(tc, f, indent=2, ensure_ascii=False)

def render_calculadora():
    import webbrowser
    st.markdown("""
    <div style="text-align:center; padding: 2rem;">
        <h2 style="color:#f59e0b;">🧮 Calculadora de Precios — Motor V5.0</h2>
        <p style="color:#7d9db5;">Hacé click para abrir la calculadora completa.</p>
    </div>
    """, unsafe_allow_html=True)
    col1, col2, col3 = st.columns([1,2,1])
    with col2:
        url = "https://facturacion.solpropy.com/app/static/calculadora_precios.html"
        st.link_button("⚡ ABRIR CALCULADORA DE PRECIOS", url, use_container_width=True)
def run_facturador_app():
    inicializar_tipo_cambio()
    if 'user' in st.session_state and 'user_data' not in st.session_state:
        st.session_state.user_data = st.session_state.user
    elif 'user' in st.session_state:
        st.session_state.user_data = st.session_state.user

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
        @media (max-width: 768px) {
            .header-container {
                flex-direction: column !important;
                text-align: center !important;
                gap: 10px !important;
                padding: 15px !important;
                margin-bottom: 20px !important;
            }

            .login-container {
                margin: 20px 10px !important;
                padding: 25px 15px !important;
            }

            .responsive-flex {
                flex-direction: column !important;
                align-items: flex-start !important;
                gap: 10px !important;
            }

            /* Ajustes para tabla de items en móvil */
            [data-testid="stMetric"] {
                padding: 10px !important;
            }

            .stButton>button {
                height: 4.5em !important; /* Botones más grandes para dedos */
                font-size: 0.9rem !important;
            }

            .stTabs [data-baseweb="tab"] {
                padding: 10px 10px !important;
                font-size: 0.8rem !important;
            }

            /* Ocultar elementos no críticos en móvil para ahorrar espacio */
            .sp-left { display: none !important; }
            [data-testid="column"]:nth-child(1) { display: none !important; }
            [data-testid="column"]:nth-child(2) { width: 100% !important; flex: 1 1 100% !important; }
        }
        </style>
        """, unsafe_allow_html=True)

    # --- CONFIGURACIÓN DE RUTAS ---
    # Priorizar volumen persistente de Railway para la Base de Datos Maestra
    _db_default = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database")
    SGSP_DATABASE = os.environ.get("SGSP_DATABASE", _db_default)
    # SGSP_DATABASE ya definido arriba. Solo sobreescribir si hay variable de entorno explícita.
    _env_override = os.environ.get("SGSP_DATABASE")
    if _env_override:
        SGSP_DATABASE = _env_override

    # Copiar archivos del repo al volumen si no existen
    import shutil
    _repo_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database")
    if os.path.exists(_repo_db) and _repo_db != SGSP_DATABASE:
        os.makedirs(SGSP_DATABASE, exist_ok=True)
        for _fname in os.listdir(_repo_db):
            _src = os.path.join(_repo_db, _fname)
            _dst = os.path.join(SGSP_DATABASE, _fname)
            if os.path.isfile(_src) and not os.path.exists(_dst):
                shutil.copy2(_src, _dst)
                print(f"[INIT] Copiado al volumen: {_fname}")

    PRODUCTS_FILE = os.path.join(SGSP_DATABASE, "productos_maestros.csv") # Unificado a CSV
    CLIENTS_FILE = os.path.join(SGSP_DATABASE, "clientes.json")
    SALES_FILE = os.path.join(SGSP_DATABASE, "VENTAS TOTALES 2026.xlsx")
    USERS_FILE = os.path.join(SGSP_DATABASE, "usuarios.json")
    OUTPUT_DIR = os.path.join(SGSP_DATABASE, "Facturas_Emitidas")

    # Inicialización de carpeta de datos si es persistente
    import shutil
    if SGSP_DATABASE != _db_default and not os.path.exists(USERS_FILE):
        if not os.path.exists(SGSP_DATABASE):
            os.makedirs(SGSP_DATABASE, exist_ok=True)
        from datetime import datetime as _dt
        print(f"[{_dt.now()}] Inicializando volumen persistente desde {_db_default} a {SGSP_DATABASE}...")
        for item in os.listdir(_db_default):
            src = os.path.join(_db_default, item)
            dst = os.path.join(SGSP_DATABASE, item)
            if os.path.isfile(src) and not os.path.exists(dst):
                shutil.copy2(src, dst)
        print(f"[{datetime.now()}] Inicialización de volumen completa.")
        
    # Sincronizacion desactivada para evitar pisar datos de la database maestra
    LOGO_FILE = os.path.join(BASE_DIR, "LOGO  2D FONDO NEGRO 2026.png")

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # --- MANTENIMIENTO DE EMERGENCIA (REPARACIÓN DE FECHAS CORRUPTAS) ---
    def emergency_data_fix():
        if os.path.exists(SALES_FILE):
            try:
                df = pd.read_excel(SALES_FILE)
                needs_fix = False

                # Si detectamos facturas recientes con meses incoherentes (ej: mes 8 o 9 cuando estamos en mayo)
                for idx, row in df.iterrows():
                    try:
                        current_date = pd.to_datetime(row['FECHA'])
                        if row['NRO_FACTURA'] >= 270 and current_date.month > 5:
                            df.at[idx, 'FECHA'] = date(2026, 5, 8)
                            needs_fix = True
                    except: pass

                if needs_fix:
                    # Usar guardado limpio con XlsxWriter
                    df['FECHA'] = pd.to_datetime(df['FECHA'], errors='coerce')
                    writer = pd.ExcelWriter(SALES_FILE, engine='xlsxwriter')
                    df.to_excel(writer, sheet_name='Ventas', index=False)
                    workbook = writer.book
                    worksheet = writer.sheets['Ventas']
                    date_format = workbook.add_format({'num_format': 'dd/mm/yyyy'})
                    worksheet.set_column('A:A', 15, date_format)
                    writer.close()
            except Exception: pass

    emergency_data_fix()

    # --- SEGURIDAD Y SESIÓN ---
    # Punto 2: Añadimos un 'PEPPER' (salt) para fortalecer los hashes
    def hash_password(password):
        # Combinamos el password con el pepper del sistema
        salted_pass = password + SYSTEM_PEPPER
        return hashlib.sha256(salted_pass.encode()).hexdigest()

    def load_users():
        import json
        ADMIN_HASH = "5497feda4f88c5ebadc4de1587dd3828ca535bf85f4b5e91aa7e8a8c13178622"
        default_users = [
            {
                "usuario": "admin",
                "password": ADMIN_HASH,
                "rol": "admin",
                "nombre": "Administrador SOLPRO",
                "totp_secret": ""
            }
        ]
        if os.path.exists(USERS_FILE):
            try:
                with open(USERS_FILE, 'r', encoding='utf-8', errors='replace') as f:
                    users = json.load(f)
                if users:
                    return users
            except:
                pass
        os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_users, f, ensure_ascii=False, indent=2)
        return default_users

    def save_users(users):
        import json
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users, f, ensure_ascii=False, indent=4)

    # --- MANEJO DE LOGIN (Punto 1: Eliminado login por URL por seguridad) ---
    if 'logged_in' not in st.session_state:
        st.session_state.logged_in = False
    if 'user_data' not in st.session_state:
        st.session_state.user_data = st.session_state.get('user', None)
    if 'login_step' not in st.session_state:
        st.session_state.login_step = 1 # 1: Credenciales, 2: 2FA (TOTP)
    if 'temp_user' not in st.session_state:
        st.session_state.temp_user = None

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

    @st.cache_data(ttl=30)
    def load_products(dolar_mercado=None):
        import json, sys
        sys.path.insert(0, BASE_DIR)
        from calcular_precio_final import calcular
        master_path = os.path.join(SGSP_DATABASE, 'master_productos.json')

        if dolar_mercado is None:
            tc_path = os.path.join(SGSP_DATABASE, 'master_tipo_cambio.json')
            try:
                with open(tc_path, 'r') as f: tc = json.load(f)
                dolar_mercado = tc.get('dolar_mercado', 0) or 6250
            except: dolar_mercado = 6250

        productos = []
        try:
            import db_sgsp
            prods = db_sgsp.get_productos(solo_activos=True)
            for p in prods:
                # db_sgsp ya filtra los inactivos si usamos solo_activos=True
                precios = calcular(p['costo'], p['moneda_costo'], p['margen_pct'], p['linea'], dolar_mercado=dolar_mercado)
                
                # Extraer ids_externos (psycopg2 lo devuelve como dict, pero por seguridad)
                ids_ext = p.get('ids_externos') or {}
                if isinstance(ids_ext, str):
                    try:
                        ids_ext = json.loads(ids_ext)
                    except:
                        ids_ext = {}
                
                productos.append({
                    'id_solpro': p.get('id_solpro',''),
                    'CODIGO': ids_ext.get('id_maestro', p.get('id_solpro','')),
                    'DESCRIPCION': p.get('nombre_canonico', ''),
                    'LINEA': p.get('linea', ''),
                    'PRECIO_CONTADO': precios['precio_contado'],
                    'PRECIO_QR': precios['precio_qr'],
                    'PRECIO_CREDITO': precios['precio_credito'],
                    'CREDITO_BLOQUEADO': precios['credito_bloqueado'],
                    'STOCK': max(0, p.get('stock_actual', 0) - p.get('stock_reservado', 0)),
                    'MONEDA': p.get('moneda_costo', ''),
                    'BANDA_PISO': precios['banda_piso'],
                    'BANDA_TECHO': precios['banda_techo'],
                    'COSTO': p.get('costo', 0),
                    'MARGEN_PCT': p.get('margen_pct', 0)
                })
        except Exception as e:
            import traceback
            print(f"[ERROR load_products] {e}", file=sys.stderr)
            traceback.print_exc()
            pass
            
        return pd.DataFrame(productos) if productos else pd.DataFrame(columns=['CODIGO', 'LINEA', 'DESCRIPCION', 'PRECIO_CONTADO', 'STOCK'])

    @st.cache_data(ttl=30)
    def load_clients():
        all_clients = {}
        try:
            import db_sgsp
            clientes = db_sgsp.get_clientes(solo_activos=True)
            for c in clientes:
                key = c['nombre_canonico'].upper()
                
                # Extraer aliases del JSONB
                aliases = c.get('aliases', [])
                if isinstance(aliases, str):
                    try:
                        import json
                        aliases = json.loads(aliases)
                    except:
                        aliases = []
                        
                all_clients[key] = {
                    'id_solpro': c.get('id_solpro',''),
                    'nombre': c['nombre_canonico'],
                    'ruc': c.get('ruc', ''),
                    'direccion': c.get('direccion',''),
                    'telefono': c.get('telefono',''),
                    'aliases': aliases
                }
        except Exception as e:
            import sys, traceback
            print(f"[ERROR load_clients] {e}", file=sys.stderr)
            traceback.print_exc()
        return all_clients

    def buscar_cliente(query, clientes):
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

    def save_client(client_data):
        import json
        clients = []
        if os.path.exists(CLIENTS_FILE):
            try:
                with open(CLIENTS_FILE, 'r', encoding='utf-8', errors='replace') as f:
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
            df = pd.read_csv(PRODUCTS_FILE)
            start_row = 0
            for sale in sales_list:
                codigo = sale['COD_PRODUCTO']
                # Buscar el código en la primera columna, asegurando alineación de índices
                full_mask = df['ID_Ref'].astype(str).str.strip() == str(codigo).strip()
                # Filtrar para ignorar la fila de cabecera si es necesario
                if start_row > 0:
                    full_mask.iloc[0:start_row] = False

                if full_mask.any():
                    idx = full_mask[full_mask].index[0]
                    if 'Stock' not in df.columns:
                        df['Stock'] = 0
                    try:
                        current_stock = pd.to_numeric(df.at[idx, 'Stock'], errors='coerce')
                        if pd.isna(current_stock): current_stock = 0
                        df.at[idx, 'Stock'] = current_stock - sale.get('_CANT_NUM', 0)
                    except: pass
            df.to_csv(PRODUCTS_FILE, index=False)
            st.cache_data.clear()

    def validate_stock(inventory_log):
        """
        Valida stock disponible para cada item del pedido consultando PostgreSQL.
        Retorna (True, "") si hay stock suficiente, o (False, mensaje) si no.
        """
        if not inventory_log:
            return True, ""
        try:
            import db_sgsp
            productos = db_sgsp.get_productos(solo_activos=False)
            stock_map = {}
            for p in productos:
                id_s = str(p.get('id_solpro', '') or '').strip()
                stock_disp = float(p.get('stock_disponible', 0) or 0)
                if id_s:
                    stock_map[id_s] = stock_disp
                cod_prov = str(p.get('codigo_proveedor', '') or '').strip()
                if cod_prov:
                    stock_map[cod_prov] = stock_disp
        except Exception as e:
            print(f"[validate_stock] Error al consultar DB: {e}", file=sys.stderr)
            # No bloquear la venta por error de conectividad
            return True, ""

        for item in inventory_log:
            cod = str(item.get('COD_PRODUCTO', '')).strip()
            cant_solicitada = float(item.get('_CANT_NUM', 0) or 0)
            if not cod or cant_solicitada <= 0:
                continue
            if cod not in stock_map:
                continue  # Producto no registrado en DB, no bloquear
            stock = stock_map[cod]
            if cant_solicitada > stock:
                return False, f"⚠️ Stock insuficiente para {cod}. Disponible: {stock:g}, Solicitado: {cant_solicitada:g}"
        return True, ""

    def add_inventory(codigo, cantidad_a_sumar):
        import db_sgsp
        codigo = str(codigo).strip()
        try:
            success = db_sgsp.update_stock_producto(codigo, float(cantidad_a_sumar))
            if success:
                st.cache_data.clear()
                return True, None
            else:
                return False, f"Producto '{codigo}' no encontrado en la base de datos."
        except Exception as e:
            return False, str(e)

    def descontar_stock(items_entregados):
        import db_sgsp as _db
        for item in items_entregados:
            id_prod = item.get('id_producto_solpro', '')
            cantidad = float(item.get('cantidad', 0))
            if id_prod and cantidad > 0:
                # update_stock_producto usa delta: negativo = descuento
                _db.update_stock_producto(id_prod, -cantidad)

    def reservar_stock(items):
        import db_sgsp as _db
        for item in items:
            id_prod = item.get('id_producto_solpro', '')
            cantidad = float(item.get('cantidad', 0))
            if id_prod and cantidad > 0:
                _db.reservar_stock_producto(id_prod, cantidad)

    def registrar_pedido(venta_data):
        import json, uuid
        from datetime import datetime
        pedidos_path = os.path.join(SGSP_DATABASE, 'pedidos.json')
        items_path = os.path.join(SGSP_DATABASE, 'pedido_items.json')
        pagos_path = os.path.join(SGSP_DATABASE, 'pagos.json')

        pedidos, items, pagos = [], [], []
        if os.path.exists(pedidos_path):
            with open(pedidos_path, 'r', encoding='utf-8') as f:
                try: pedidos = json.load(f)
                except: pass
        if os.path.exists(items_path):
            with open(items_path, 'r', encoding='utf-8') as f:
                try: items = json.load(f)
                except: pass
        if os.path.exists(pagos_path):
            with open(pagos_path, 'r', encoding='utf-8') as f:
                try: pagos = json.load(f)
                except: pass

        now = datetime.now().isoformat()
        num_pedido = len(pedidos) + 1
        id_pedido = f"PED-{num_pedido:04d}"
        es_sena = venta_data.get('es_sena', False)
        estado = 'señado' if es_sena else 'entregado'

        pedido = {
          'id_pedido': id_pedido,
          'id_cliente_solpro': venta_data.get('id_cliente_solpro', ''),
          'nombre_cliente_factura': venta_data.get('cliente',''),
          'ruc_cliente_factura': venta_data.get('ruc', ''),
          'fecha_pedido': venta_data.get('fecha',''),
          'vendedor': venta_data.get('vendedor',''),
          'estado': estado,
          'precio_total_gs': venta_data.get('total',0),
          'monto_señado_gs': venta_data.get('monto_sena', 0) if es_sena else venta_data.get('total',0),
          'saldo_pendiente_gs': venta_data.get('total',0) - venta_data.get('monto_sena', 0) if es_sena else 0,
          'dolar_mercado_dia': venta_data.get('dolar_mercado', 0),
          'banda_piso_dia': venta_data.get('banda_piso', 0),
          'banda_techo_dia': venta_data.get('banda_techo', 0),
          'nro_factura_sena': venta_data.get('nro_factura', '') if es_sena else '',
          'nro_factura_final': venta_data.get('nro_factura', '') if not es_sena else '',
          'tipo_doc_sena': venta_data.get('tipo_doc', '') if es_sena else '',
          'notas': venta_data.get('notas', ''),
          'creado_en': now,
          'actualizado_en': now
        }
        pedidos.append(pedido)

        for i, itm in enumerate(venta_data.get('items', []), 1):
            num_item = len(items) + 1
            items.append({
              'id_item': f"ITM-{num_item:04d}",
              'id_pedido': id_pedido,
              'id_producto_solpro': itm.get('id_solpro', ''),
              'nombre_vendido': itm.get('descripcion',''),
              'cantidad': itm.get('cantidad',0),
              'moneda_costo': itm.get('moneda','GS'),
              'costo_unitario': itm.get('costo', 0),
              'costo_gs_dia': itm.get('costo_gs_dia', 0),
              'margen_pct_teorico': itm.get('margen_pct', 0),
              'precio_contado_teorico_gs': itm.get('precio_contado_teorico', 0),
              'precio_qr_teorico_gs': itm.get('precio_qr_teorico', 0),
              'precio_credito_teorico_gs': itm.get('precio_credito_teorico', 0),
              'precio_aplicado_gs': itm.get('precio',0),
              'forma_pago': itm.get('forma_pago', 'contado'),
              'precio_esperado_gs': itm.get('precio_esperado', 0),
              'diferencia_gs': itm.get('precio',0) - itm.get('precio_esperado', itm.get('precio',0)),
              'margen_real_pct': itm.get('margen_real', 0),
              'profit_real_gs': itm.get('profit_real', 0),
              'alerta': itm.get('alerta', 'ok'),
              'stock_descontado': not es_sena,
              'stock_descontado_fecha': now if not es_sena else ''
            })

        num_pago = len(pagos) + 1
        pagos.append({
          'id_pago': f"PAG-{num_pago:04d}",
          'id_pedido': id_pedido,
          'fecha_pago': venta_data.get('fecha',''),
          'tipo': 'seña' if es_sena else 'contado_total',
          'monto_gs': venta_data.get('monto_sena', 0) if es_sena else venta_data.get('total',0),
          'forma_pago': venta_data.get('forma_pago', 'efectivo'),
          'nro_documento': venta_data.get('nro_factura', ''),
          'tipo_documento': venta_data.get('tipo_doc', 'factura_oficial'),
          'nro_factura': venta_data.get('nro_factura', ''),
          'conciliado': False,
          'fecha_conciliacion': '',
          'observaciones': venta_data.get('notas', '')
        })

        with open(pedidos_path, 'w', encoding='utf-8') as f: json.dump(pedidos, f, indent=2, ensure_ascii=False)
        with open(items_path, 'w', encoding='utf-8') as f: json.dump(items, f, indent=2, ensure_ascii=False)
        with open(pagos_path, 'w', encoding='utf-8') as f: json.dump(pagos, f, indent=2, ensure_ascii=False)
        
        # -- SYNC API --
        try:
            sync_pedido(venta_data)
            if venta_data.get("monto_señado_gs", 0) > 0:
                pago = {
                    "id_pago": f"pago_{venta_data['id_pedido']}",
                    "id_pedido": venta_data['id_pedido'],
                    "fecha_pago": venta_data['fecha_pedido'],
                    "tipo": "sena",
                    "monto_gs": venta_data['monto_señado_gs'],
                    "forma_pago": "Efectivo", # Default provisorio
                    "nro_documento": venta_data.get('nro_factura_sena', ''),
                    "tipo_documento": venta_data.get('tipo_doc_sena', 'recibo')
                }
                sync_pago(pago)
        except Exception as e:
            print(f"Error llamando a sync: {e}")

        return id_pedido

    def log_sales(sales_list, venta_data=None):
        if os.path.exists(SALES_FILE):
            try:
                df = pd.read_excel(SALES_FILE)
                df = pd.concat([df, pd.DataFrame(sales_list)], ignore_index=True)
            except Exception as e:
                st.error(f"Error al leer la planilla: {e}")
                return
        else:
            df = pd.DataFrame(sales_list)
        try:
            df['FECHA'] = pd.to_datetime(df['FECHA'], errors='coerce')
            writer = pd.ExcelWriter(SALES_FILE, engine='xlsxwriter')
            df.to_excel(writer, index=False, sheet_name='Ventas')
            workbook  = writer.book
            worksheet = writer.sheets['Ventas']
            date_format = workbook.add_format({'num_format': 'dd/mm/yyyy'})
            worksheet.set_column('A:A', 15, date_format)
            writer.close()
        except Exception as e:
            st.error(f"Error al guardar la planilla: {e}")
            
        if venta_data:
            registrar_pedido(venta_data)
            if venta_data.get('es_sena', False):
                reservar_stock(venta_data.get('items', []))
            else:
                descontar_stock(venta_data.get('items', []))

    def get_next_invoice_number():
        import pandas as pd
        if os.path.exists(SALES_FILE):
            df = pd.read_excel(SALES_FILE)
            if not df.empty and 'NRO_FACTURA' in df.columns:
                try:
                    last_num = pd.to_numeric(df['NRO_FACTURA'], errors='coerce').max()
                    return str(int(last_num) + 1).zfill(4) if not pd.isna(last_num) else "0501"
                except: pass
        return "0501"

    def void_invoice(invoice_num, current_user):
        if os.path.exists(SALES_FILE):
            df = pd.read_excel(SALES_FILE)
            mask = df['NRO_FACTURA'].astype(str) == str(invoice_num)
            if mask.any():
                row_idx = mask[mask].index[0]

                # --- VALIDACIÓN DE SEGURIDAD (Punto 3: RBAC) ---
                # Si no es admin, solo puede anular si él es el vendedor
                if current_user['rol'] != 'admin':
                    vendedor_registro = str(df.loc[row_idx, 'VENDEDOR']).strip().upper()
                    vendedor_actual = str(current_user['nombre']).strip().upper()
                    if vendedor_registro != vendedor_actual:
                        return False, f"⛔ Error: Esta factura pertenece a {vendedor_registro}. Solo el administrador puede anular facturas ajenas."
                # -----------------------------------------------

                if df.loc[row_idx, 'DESCRIPCION'] == "ANULADA":
                    return False, "⚠️ Esta factura ya se encuentra anulada."

                if 'RAW_ITEMS' in df.columns:
                    raw_items_str = df.loc[row_idx, 'RAW_ITEMS']
                    if pd.notna(raw_items_str) and str(raw_items_str).strip():
                        try:
                            import json
                            items_to_restore = json.loads(raw_items_str)
                            df_inv = get_inventory_data()
                            for item in items_to_restore:
                                cod = item.get('COD_PRODUCTO', '')
                                id_para_db = cod
                                if not df_inv.empty and 'CODIGO' in df_inv.columns and 'id_solpro' in df_inv.columns:
                                    mask = df_inv['CODIGO'] == cod
                                    if mask.any():
                                        id_para_db = df_inv.loc[mask, 'id_solpro'].values[0]
                                
                                ok, msg = add_inventory(id_para_db, item.get('_CANT_NUM', 0))
                                if not ok:
                                    print(f"Error devolviendo stock para {cod}: {msg}")
                        except Exception as e:
                            print(f"Error restoring inventory: {e}")

                df.loc[mask, ['DESCRIPCION', 'PRECIO GS', 'PRECIO USD']] = ["ANULADA", 0, 0]
                df.to_excel(SALES_FILE, index=False)
                return True, "✅ Factura anulada exitosamente y stock devuelto."
        return False, "❌ Factura no encontrada."

    def update_invoice_master(invoice_num, new_data):
        """Función exclusiva de Admin para correcciones maestras"""
        if os.path.exists(SALES_FILE):
            df = pd.read_excel(SALES_FILE)
            mask = df['NRO_FACTURA'].astype(str) == str(invoice_num)
            if mask.any():
                for key, value in new_data.items():
                    if key in df.columns:
                        df.loc[mask, key] = value
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
    if not st.session_state.get('logged_in', False) or st.session_state.get('user_data') is None:
        st.session_state.user_data = st.session_state.get('user')
    if not st.session_state.get('logged_in', False) or st.session_state.get('user_data') is None:
        st.markdown("""
        <style>
        #MainMenu, header, footer, section[data-testid="stSidebar"] {visibility: hidden;}
        .stApp {background: #08090c !important;}
        .block-container {max-width: 420px !important; padding-top: 4rem !important;}
        .stTextInput input {background: #111 !important; color: #fff !important; border: 1px solid #333 !important; border-radius: 8px !important;}
        .stButton button {width: 100%; background: #f59e0b !important; color: #000 !important; font-weight: 700 !important; border-radius: 8px !important; padding: .75rem !important; border: none !important; font-size: 15px !important;}
        </style>
        """, unsafe_allow_html=True)

        st.markdown("## 🏢 SOLPRO Facturación")
        st.markdown("Ingresá tus credenciales para continuar")
        st.divider()

        with st.container():
            if st.session_state.login_step == 1:
                with st.form("solpro_login_form"):
                    user_input = st.text_input("USUARIO", placeholder="admin", key="login_user")
                    pass_input = st.text_input("CONTRASEÑA", type="password", key="login_pass")
                    submitted = st.form_submit_button("Siguiente Paso ➔")

                if submitted:
                    users = load_users()

                    # Intentar login con hash nuevo (salted)
                    hashed_input = hash_password(pass_input)
                    user_found = next((u for u in users if u['usuario'] == user_input and u['password'] == hashed_input), None)
                    
                    # --- EMERGENCY OVERRIDE FOR ADMIN ---
                    if user_input == "admin" and pass_input == "admin123" and not user_found:
                        admin_found = False
                        for u in users:
                            if u['usuario'] == 'admin':
                                u['password'] = hashed_input
                                u['totp_secret'] = ''
                                user_found = u
                                admin_found = True
                        if not admin_found:
                            new_admin = {
                                "usuario": "admin",
                                "password": hashed_input,
                                "rol": "admin",
                                "nombre": "Administrador SOLPRO",
                                "totp_secret": ""
                            }
                            users.append(new_admin)
                            user_found = new_admin
                        
                        save_users(users)
                    # ------------------------------------

                    # MIGRACIÓN AUTOMÁTICA: Si no se encuentra con el hash nuevo, probar con el hash viejo (sin salt)
                    if not user_found:
                        old_hash = hashlib.sha256(pass_input.encode()).hexdigest()
                        user_found = next((u for u in users if u['usuario'] == user_input and u['password'] == old_hash), None)
                        if user_found:
                            # Actualizar usuario a hash nuevo para la próxima vez
                            for u in users:
                                if u['usuario'] == user_input:
                                    u['password'] = hashed_input
                            save_users(users)

                    if user_found:
                        st.session_state.temp_user = user_found
                        st.session_state.login_step = 2
                        st.rerun()
                    else:
                        st.error("Credenciales incorrectas.")

            else:
                # --- PASO 2: AUTENTICACIÓN DE GOOGLE (2FA) ---
                user = st.session_state.temp_user
                st.markdown(f"**Verificación de Seguridad para: {user['nombre']}**")

                # Si el usuario no tiene secreto TOTP, generarlo (primera vez)
                if 'totp_secret' not in user or not user['totp_secret']:
                    new_secret = pyotp.random_base32()
                    user['totp_secret'] = new_secret

                    # Actualizar base de datos
                    users = load_users()
                    for u in users:
                        if u['usuario'] == user['usuario']:
                            u['totp_secret'] = new_secret
                    save_users(users)

                    st.warning("⚠️ Configuración Inicial de 2FA")
                    st.write("Escanea este código con Google Authenticator:")

                    totp_uri = pyotp.totp.TOTP(new_secret).provisioning_uri(name=user['usuario'], issuer_name="SOLPRO")
                    img = qrcode.make(totp_uri)
                    buf = io.BytesIO()
                    img.save(buf)
                    st.image(buf.getvalue(), width=200)
                    st.info(f"O ingresa este código manualmente: `{new_secret}`")

                otp_input = st.text_input("Ingresa el código de 6 dígitos", placeholder="000000", max_chars=6)
                col_b1, col_b2 = st.columns(2)

                if col_b1.button("✓ VERIFICAR ENTRAR"):
                    totp = pyotp.TOTP(user['totp_secret'])
                    if totp.verify(otp_input):
                        st.session_state.logged_in = True
                        st.session_state.user_data = user
                        st.session_state.login_step = 1
                        st.rerun()
                    else:
                        st.error("Código inválido. Intenta de nuevo.")

                if col_b2.button("← VOLVER"):
                    st.session_state.login_step = 1
                    st.session_state.temp_user = None
                    st.rerun()

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
        clients_dict = load_clients()
        query_cliente = st.text_input("🔍 Buscar Cliente por Alias (opcional)")
        
        if query_cliente:
            matches = buscar_cliente(query_cliente, clients_dict)
        else:
            matches = sorted(list(clients_dict.values()), key=lambda x: x['nombre'])

        client_names = ["-- NUEVO CLIENTE --"] + [c['nombre'] for c in matches]
        selected_client_name = st.selectbox("Buscar Cliente", client_names)
        
        sel_data = next((c for c in matches if c['nombre'] == selected_client_name), None)

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
        st.session_state.user_data = st.session_state.get('user', st.session_state.get('user_data'))
        current_user_name = st.session_state.user_data['nombre'] if st.session_state.get('user_data') else 'Desconocido'

        # Selector de vendedor
        vendedor = st.selectbox(
            "Vendedor", 
            options=vendedor_names,
            index=vendedor_names.index(current_user_name) if current_user_name in vendedor_names else 0
        )
        nro_factura = st.text_input("Nro. Factura", value=get_next_invoice_number())
        
        # Fecha de emisión configurable (solo admin)
        is_admin = st.session_state.user_data and st.session_state.user_data.get('rol') == 'admin'
        if is_admin:
            fecha_emision = st.date_input("Fecha de Emisión", value=date.today())
        else:
            fecha_emision = date.today()
            
        condicion = st.radio("Condición", ["CONTADO", "CRÉDITO"], horizontal=True)
        moneda = st.radio("Moneda", ["PYG", "USD"], horizontal=True)

        if st.button("🔄 SINCRONIZAR DATOS"):
            st.cache_data.clear()
            st.success("Sincronizado")

        if st.session_state.user_data and st.session_state.user_data.get('rol') == 'admin':
            st.divider()
            st.header("🤖 AI TUNNEL")
            ai_url = st.text_input("Endpoint URL", value="http://localhost:1234/v1")
        else:
            ai_url = "http://localhost:1234/v1"

        tc_path = os.path.join(SGSP_DATABASE, 'master_tipo_cambio.json')
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
        st.subheader("Sincronización Cloud (Railway)")
        c1, c2 = st.columns(2)
        if c1.button("Sincronizar Clientes"):
            import db_sgsp
            clientes_db = db_sgsp.get_clientes(solo_activos=False)
            res = sync_clientes_bulk(clientes_db)
            if "error" in res:
                st.error(f"Error: {res['error']}")
            else:
                st.success(f"Sync OK: {res.get('creados', 0)} procesados.")
        
        if c2.button("Sincronizar Productos"):
            import json as _json
            df_prod = load_products()
            records = _json.loads(df_prod.to_json(orient='records', force_ascii=False))
            res = sync_productos_bulk(records)
            if "error" in res:
                st.error(f"Error: {res['error']}")
            else:
                st.success(f"Sync OK: {res.get('creados', 0)} creados, {res.get('actualizados', 0)} actualizados.")

        st.divider()
        if st.button("🚪 CERRAR SESIÓN"):
            st.session_state.logged_in = False
            st.session_state.user_data = None
            st.rerun()

    # --- TABS PRINCIPALES ---
    rol_actual = (st.session_state.get('user_data', {}).get('rol', '') 
                  or st.session_state.get('user_data', {}).get('role', '')
                  or st.session_state.get('rol', '')
                  or st.session_state.get('role', '')).lower()
    es_admin = rol_actual == 'admin'

    if es_admin:
        tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab_calc = st.tabs(["🛒 FACTURACIÓN", "🚫 ANULAR", "📦 STOCK", "📊 HISTORIAL", "🤖 AI", "📦 PEDIDOS PENDIENTES", "💱 TIPO DE CAMBIO", "🧮 CALCULADORA"])
    else:
        tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs(["🛒 FACTURACIÓN", "🚫 ANULAR", "📦 STOCK", "📊 HISTORIAL", "🤖 AI", "📦 PEDIDOS PENDIENTES", "💱 TIPO DE CAMBIO"])
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
                            'tipo_precio': 'Contado',
                            'tipo_precio_idx': 0,
                            'costo': row.get('COSTO', 0),
                            'margen_pct': row.get('MARGEN_PCT', 0),
                            'moneda': row.get('MONEDA', 'GS')
                        })
                        st.session_state[f"desc_{i}"] = row['DESCRIPCION']
                        st.session_state[f"precio_{i}"] = float(row['PRECIO_CONTADO']) if pd.notna(row.get('PRECIO_CONTADO')) else 0.0
                        st.rerun()

                desc = st.text_area("d", value=item['desc'], key=f"desc_{i}", height=60, label_visibility="collapsed")

            with c_stock:
                codigo = item.get('codigo', '')
                if codigo:
                    mask = df_products['CODIGO'].astype(str) == str(codigo)
                    if mask.any():
                        s_val = int(df_products.loc[mask, 'STOCK'].values[0])
                        st.markdown(f"<div style='color:{'#4ade80' if s_val>0 else '#ef4444'}; font-weight:bold; text-align:center; padding-top:10px;'>{s_val}</div>", unsafe_allow_html=True)

            with c3:
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
                precio = st.number_input("p", value=item.get('precio', 0.0), key=f"precio_{i}", format="%.2f", label_visibility="collapsed")
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

            tipo_venta = st.radio("Tipo de venta", ["Contado / Entrega inmediata", "Seña / Pago parcial"], horizontal=True)
            monto_sena = 0
            tipo_doc_sena = "Factura oficial"
            if tipo_venta == "Seña / Pago parcial":
                monto_sena = st.number_input("Monto de la seña (Gs)", min_value=0, value=int(total_factura*0.3) if total_factura > 0 else 0)
                tipo_doc_sena = st.radio("Documento a emitir por la seña", ["Recibo interno", "Factura oficial con leyenda PAGO PARCIAL"], horizontal=True)
                st.info(f"Saldo pendiente: Gs {total_factura - monto_sena:,.0f} | Stock: Será reservado (no descontado)")

            if 'invoice_generated' in st.session_state:
                st.success(f"Documento {st.session_state.invoice_nro} emitido")
                try:
                    with open(st.session_state.invoice_pdf_path, "rb") as f: 
                        st.download_button("📥 DESCARGAR PDF", f, os.path.basename(st.session_state.invoice_pdf_path), "application/pdf", key="dl_btn_after_gen")
                except Exception: pass

            if st.button("⚡ GENERAR Y REGISTRAR"):
                if not nombre or not st.session_state.factura_items: st.error("Faltan datos")
                else:
                    with st.spinner("Procesando..."):
                        inventory_log = []
                        descripciones = []
                        codigos = []
                        items_for_venta = []
                        for it in st.session_state.factura_items:
                            descripciones.append(f"{it['cant']} {it['desc']}")
                            if it.get('codigo'): codigos.append(str(it['codigo']))
                            inventory_log.append({
                                "COD_PRODUCTO": it.get('codigo', ''),
                                "_CANT_NUM": it['cant']
                            })
                            items_for_venta.append({
                                'id_solpro': it.get('id_solpro', ''),
                                'id_producto_solpro': it.get('id_solpro', ''),
                                'descripcion': it['desc'],
                                'cantidad': it['cant'],
                                'precio': it['precio'],
                                'costo': it.get('costo', 0),
                                'margen_pct': it.get('margen_pct', 0),
                                'moneda': it.get('moneda', 'GS')
                            })

                        es_sena = (tipo_venta == "Seña / Pago parcial")
                        if not es_sena:
                            is_valid, error_msg = validate_stock(inventory_log)
                            if not is_valid:
                                st.error(error_msg)
                                st.stop()

                        save_client({"nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono})
                        
                        fecha_str_pdf = fecha_emision.strftime("%d/%m/%Y")
                        fecha_str_file = fecha_emision.strftime("%Y%m%d")
                        
                        doc_num = nro_factura
                        if es_sena and tipo_doc_sena == "Recibo interno":
                            from datetime import datetime
                            doc_num = f"REC-{str(int(datetime.now().timestamp()))[-5:]}"

                        pdf_path = os.path.join(OUTPUT_DIR, f"Doc_{doc_num}_{fecha_str_file}.pdf")
                        
                        pdf_data = {
                            "nro_factura": doc_num, "fecha": fecha_str_pdf,
                            "nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono,
                            "condicion": condicion, "moneda": moneda,
                            "productos": [{"c": it['cant'], "d": it['desc'], "p": it['precio'], "t": it['total']} for it in st.session_state.factura_items]
                        }
                        if es_sena:
                            pdf_data["leyenda_extra"] = f"PAGO PARCIAL - Seña recibida: Gs {monto_sena:,.0f} | Saldo: Gs {total_factura - monto_sena:,.0f}"

                        generate_invoice_pdf(pdf_data, pdf_path)

                        import json
                        sales_log = [{
                            "FECHA": fecha_emision,
                            "DESCRIPCION": ", ".join(descripciones),
                            "CLIENTE": nombre,
                            "PRECIO GS": total_factura if moneda == "PYG" else None,
                            "PRECIO USD": total_factura if moneda == "USD" else None,
                            "NRO_FACTURA": doc_num,
                            "VENDEDOR": vendedor,
                            "FORMA PAGO": condicion,
                            "COD_PRODUCTO": ", ".join(codigos),
                            "LINEA": "CORP",
                            "RAW_ITEMS": json.dumps(inventory_log)
                        }]

                        venta_data = {
                            'es_sena': es_sena,
                            'monto_sena': monto_sena,
                            'tipo_doc': tipo_doc_sena if es_sena else 'factura_oficial',
                            'cliente': nombre,
                            'id_cliente_solpro': sel_data.get('id_solpro', '') if sel_data else '',
                            'ruc': ruc,
                            'fecha': fecha_emision.isoformat(),
                            'vendedor': vendedor,
                            'total': total_factura,
                            'forma_pago': condicion,
                            'nro_factura': doc_num,
                            'items': items_for_venta
                        }

                        log_sales(sales_log, venta_data)

                        st.session_state.invoice_generated = True
                        st.session_state.invoice_nro = doc_num
                        st.session_state.invoice_pdf_path = pdf_path
                        st.session_state.factura_items = [{"cant": 1, "desc": "", "precio": 0.0, "codigo": ""}]
                        st.rerun()

    if True:
        with tab2:
            st.header("🚫 ANULACIONES")
            st.info("Nota: Los vendedores solo pueden anular sus propias facturas. Los administradores tienen acceso total.")
            inv_v = st.text_input("Nro Factura a anular", placeholder="0000")
            if st.button("EJECUTAR ANULACIÓN", type="primary"):
                if inv_v:
                    success, msg = void_invoice(inv_v, st.session_state.user_data)
                    if success: st.success(msg)
                    else: st.error(msg)
                else: st.error("Ingresa un número de factura.")

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
                        try:
                            mask = df_i['CODIGO'] == cod_load
                            id_para_db = df_i.loc[mask, 'id_solpro'].values[0] if (mask.any() and 'id_solpro' in df_i.columns) else cod_load
                        except Exception as e:
                            id_para_db = cod_load
                            st.warning(f"⚠️ No se pudo leer id_solpro: {e}. Usando código: {cod_load}")
                        
                        ok, err = add_inventory(id_para_db, cant_to_load)
                        if ok:
                            accion = "sumaron" if cant_to_load > 0 else "restaron"
                            st.success(f"✅ Se {accion} {abs(cant_to_load)} unidades al producto {cod_load}.")
                            st.rerun()
                        else:
                            st.error(f"❌ Error al actualizar stock: {err}")
                    else:
                        st.warning("Seleccioná un producto primero.")

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

            # Botón de reporte generado en memoria para asegurar formato limpio
            if os.path.exists(SALES_FILE):
                st.info("💡 Desde aquí puedes exportar el reporte completo de ventas acumulado en formato Excel.")

                # Generar el Excel en un buffer de memoria
                buffer = io.BytesIO()
                df_export = load_sales()

                if not df_export.empty:
                    # Asegurar que la fecha no tenga horas antes de pasar a ExcelWriter
                    df_export['FECHA'] = pd.to_datetime(df_export['FECHA']).dt.date

                    with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
                        df_export.to_excel(writer, index=False, sheet_name='Ventas')
                        workbook  = writer.book
                        worksheet = writer.sheets['Ventas']

                        # Formato de fecha estricto dd/mm/yyyy
                        date_format = workbook.add_format({'num_format': 'dd/mm/yyyy'})
                        worksheet.set_column('A:A', 15, date_format)

                    st.download_button(
                        label="📥 EXPORTAR REPORTE DE VENTAS COMPLETO (EXCEL)",
                        data=buffer.getvalue(),
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

            # --- PANEL DE EDICIÓN MAESTRA (SOLO ADMIN) ---
            if st.session_state.user_data and st.session_state.user_data.get('rol') == 'admin':
                st.divider()
                st.markdown("<h3 style='color: #f1c232;'>🛠️ PANEL DE EDICIÓN MAESTRA (ADMIN)</h3>", unsafe_allow_html=True)
                st.write("Usa esta herramienta para corregir errores de fecha, vendedor o datos generales de una factura emitida.")

                edit_nro = st.text_input("Nro. Factura a Corregir", placeholder="Ej: 0501", key="edit_master_nro")

                if edit_nro:
                    df_s = load_sales()
                    match = df_s[df_s['NRO_FACTURA'].astype(str) == str(edit_nro)]

                    if not match.empty:
                        row = match.iloc[0]
                        with st.form("master_edit_form"):
                            col_ed1, col_ed2 = st.columns(2)

                            with col_ed1:
                                new_fecha = st.date_input("Nueva Fecha", value=row['FECHA'])
                                new_cliente = st.text_input("Nombre Cliente", value=row['CLIENTE'])

                                # Cargar lista de vendedores para el selector
                                all_users = load_users()
                                v_names = [u['nombre'] for u in all_users]
                                try:
                                    v_idx = v_names.index(row['VENDEDOR'])
                                except: v_idx = 0

                                new_vendedor = st.selectbox("Asignar a Vendedor", options=v_names, index=v_idx)

                            with col_ed2:
                                new_desc = st.text_area("Descripción/Items", value=row['DESCRIPCION'])
                                new_p_gs = st.number_input("Precio Total GS", value=float(row['PRECIO GS']) if pd.notna(row['PRECIO GS']) else 0.0)
                                new_p_usd = st.number_input("Precio Total USD", value=float(row['PRECIO USD']) if pd.notna(row['PRECIO USD']) else 0.0)

                            if st.form_submit_button("💾 GUARDAR CAMBIOS CORRECTIVOS"):
                                changes = {
                                    "FECHA": pd.to_datetime(new_fecha),
                                    "CLIENTE": new_cliente,
                                    "VENDEDOR": new_vendedor,
                                    "DESCRIPCION": new_desc,
                                    "PRECIO GS": new_p_gs if new_p_gs > 0 else None,
                                    "PRECIO USD": new_p_usd if new_p_usd > 0 else None
                                }
                                if update_invoice_master(edit_nro, changes):
                                    st.success(f"✅ Factura {edit_nro} actualizada correctamente.")
                                    st.cache_data.clear()
                                    st.rerun()
                                else:
                                    st.error("Error al guardar los cambios.")
                    else:
                        st.warning("Factura no encontrada para edición.")

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

    if True:
        with tab6:
            st.header("📦 PEDIDOS PENDIENTES")
            pedidos_path = os.path.join(SGSP_DATABASE, 'pedidos.json')
            if os.path.exists(pedidos_path):
                import json
                with open(pedidos_path, 'r', encoding='utf-8') as f:
                    pedidos_all = json.load(f)
                
                pedidos_pendientes = [p for p in pedidos_all if p.get('estado') in ['señado', 'reservado']]
                
                if not pedidos_pendientes:
                    st.info("No hay pedidos pendientes.")
                else:
                    for p in pedidos_pendientes:
                        st.markdown(f"### {p['id_pedido']} - {p['nombre_cliente_factura']}")
                        st.write(f"**Fecha:** {p['fecha_pedido']} | **Vendedor:** {p['vendedor']}")
                        st.write(f"**Total:** Gs {p['precio_total_gs']:,.0f} | **Señado:** Gs {p.get('monto_señado_gs',0):,.0f} | **Saldo:** Gs {p.get('saldo_pendiente_gs',0):,.0f}")
                        
                        if st.button(f"✅ Registrar entrega y liquidar saldo", key=f"liq_{p['id_pedido']}"):
                            st.session_state.liquidar_pedido = p
                            st.rerun()

                    if 'liquidar_pedido' in st.session_state:
                        p_liq = st.session_state.liquidar_pedido
                        st.divider()
                        st.subheader(f"Liquidando saldo de {p_liq['id_pedido']}")
                        with st.form("form_liquidar"):
                            saldo_cobrado = st.number_input("Saldo cobrado", value=int(p_liq.get('saldo_pendiente_gs',0)))
                            forma_pago_liq = st.radio("Forma de Pago", ["CONTADO", "TRANSFERENCIA", "TARJETA"])
                            if st.form_submit_button("Confirmar Entrega y Factura Final"):
                                p_liq['estado'] = 'entregado'
                                p_liq['saldo_pendiente_gs'] = max(0, p_liq.get('saldo_pendiente_gs',0) - saldo_cobrado)
                                p_liq['monto_señado_gs'] = p_liq.get('monto_señado_gs',0) + saldo_cobrado
                                p_liq['nro_factura_final'] = get_next_invoice_number()

                                with open(pedidos_path, 'w', encoding='utf-8') as f:
                                    json.dump(pedidos_all, f, indent=2, ensure_ascii=False)

                                items_path = os.path.join(SGSP_DATABASE, 'pedido_items.json')
                                items_all = []
                                if os.path.exists(items_path):
                                    with open(items_path, 'r', encoding='utf-8') as f: items_all = json.load(f)
                                items_del_pedido = [i for i in items_all if i['id_pedido'] == p_liq['id_pedido']]
                                descontar_stock(items_del_pedido)

                                pagos_path = os.path.join(SGSP_DATABASE, 'pagos.json')
                                pagos_all = []
                                if os.path.exists(pagos_path):
                                    with open(pagos_path, 'r', encoding='utf-8') as f: pagos_all = json.load(f)
                                from datetime import datetime
                                pagos_all.append({
                                    'id_pago': f"PAG-{len(pagos_all)+1:04d}",
                                    'id_pedido': p_liq['id_pedido'],
                                    'fecha_pago': datetime.now().isoformat(),
                                    'tipo': 'saldo_final',
                                    'monto_gs': saldo_cobrado,
                                    'forma_pago': forma_pago_liq,
                                    'nro_documento': p_liq['nro_factura_final']
                                })
                                with open(pagos_path, 'w', encoding='utf-8') as f:
                                    json.dump(pagos_all, f, indent=2, ensure_ascii=False)

                                st.success("Pedido liquidado y stock actualizado.")
                                del st.session_state.liquidar_pedido
                                st.rerun()
            else:
                st.info("No hay base de pedidos inicializada.")


    with tab7:
        st.header("💱 Tipo de Cambio")
        
        is_admin = st.session_state.user_data and st.session_state.user_data.get('rol') == 'admin'
        
        if not is_admin:
            st.warning("⚠️ Acceso restringido. Solo Administración puede modificar el tipo de cambio.")
        else:
            tc_path = os.path.join(SGSP_DATABASE, 'master_tipo_cambio.json')
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
                
                try:
                    from datetime import datetime
                    sync_tipo_cambio({
                        "dolar_mercado": nuevo_dolar,
                        "banda_piso": nuevo_dolar + 150,
                        "banda_techo": nuevo_dolar + 350,
                        "fecha": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    })
                except:
                    pass
                
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
                df_hist = pd.DataFrame(hist_data, columns=["Fecha", "Dólar", "Banda Piso", "Banda Techo", "Actualizado por"])
                st.dataframe(df_hist, use_container_width=True)
            else:
                st.write("No hay historial disponible.")

    if es_admin:
        with tab_calc:
            render_calculadora()


if __name__ == "__main__":

    st.set_page_config(
        page_title="SOLPRO - Facturación Corporativa",
        layout="wide",
        page_icon="📄",
        initial_sidebar_state="expanded"
    )
    run_facturador_app()
























