# -*- coding: utf-8 -*-
"""
SGSP — API REST Core
Módulo: api.py
Framework: FastAPI + JWT (HMAC-SHA256)

Arranque local:
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload

Arranque Railway (ver railway.toml):
    uvicorn api:app --host 0.0.0.0 --port 8000
"""

import os
import hashlib
import jwt
import pyotp
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import get_db_connection, inicializar_base_datos
from routes_bridge import router as bridge_router
import db_sgsp

# ── Configuración ──────────────────────────────────────────────────────────
JWT_SECRET    = os.environ.get("JWT_SECRET", "sgsp-dev-secret-cambiar-en-produccion")
SYSTEM_PEPPER = os.environ.get("SYSTEM_PEPPER", "SOLPRO_ULTRA_SECRET_2026_#!")
ALGORITMO     = "HS256"
TOKEN_HORAS   = 12

# CORS: lista de orígenes separados por coma en ALLOWED_ORIGINS
# Ejemplo: https://dashboard.solpropy.com,https://otro.com
_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
_lista = [o.strip() for o in _origins_env.split(",") if o.strip()]
ALLOWED_ORIGINS = _lista if _lista else ["*"]

# Forzar siempre los dominios de producción si no están
for dominio in ["https://facturacion.solpropy.com", "https://dashboard.solpropy.com"]:
    if dominio not in ALLOWED_ORIGINS and "*" not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(dominio)


# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SGSP Core API",
    description="Sistema de Gestión SolPro — Capa REST",
    version="1.0.0"
)

# allow_credentials=True es incompatible con allow_origins=["*"]
_use_credentials = "*" not in ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=_use_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bridge_router)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Modelos Pydantic ───────────────────────────────────────────────────────
class Credenciales(BaseModel):
    username: str
    password: str          # Contraseña en texto plano (se hashea aquí)
    totp_code: str = ""    # Vacío si el usuario no tiene 2FA activado


class ActualizacionMargen(BaseModel):
    nuevo_margen: float


class ProductoNuevo(BaseModel):
    codigo_ref:  str
    nombre:      str
    linea:       str
    costo_base:  float
    moneda:      str  = "USD"
    margen_pct:  float = 0.0


class ClienteNuevo(BaseModel):
    razon_social: str
    ruc:          str
    direccion:    str = ""
    telefono:     str = ""
    email:        str = ""


# ── Helpers JWT ────────────────────────────────────────────────────────────
def crear_token_acceso(datos: dict) -> str:
    payload = datos.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=TOKEN_HORAS)
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITMO)


def verificar_token(token: str = Depends(oauth2_scheme)) -> str:
    try:
        payload  = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITMO])
        username = payload.get("sub")
        role     = payload.get("role", "Vendedor")
        if not username:
            raise HTTPException(status_code=401, detail="Token sin sujeto.")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado. Volvé a iniciar sesión.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido.")


def hash_password(password: str) -> str:
    """Mismo algoritmo que main_portal.py — SHA-256 + SYSTEM_PEPPER."""
    return hashlib.sha256((password + SYSTEM_PEPPER).encode()).hexdigest()


# ── Eventos de inicio ──────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    """Inicializa las tablas al arrancar (idempotente)."""
    inicializar_base_datos()
    db_sgsp.init_db()   # Crea todas las tablas Postgres si no existen
    print("[api.py] API iniciada. SQLite + PostgreSQL listos.")


# ── AUTENTICACIÓN ──────────────────────────────────────────────────────────
@app.post("/api/auth/login", tags=["Auth"])
def autenticar_usuario(creds: Credenciales):
    """
    Login con usuario, contraseña y código TOTP (opcional).
    Retorna JWT válido por 12 horas.
    """
    conn    = get_db_connection()
    usuario = conn.execute(
        "SELECT * FROM Usuarios WHERE Username = ? AND Activo = 1",
        (creds.username,)
    ).fetchone()
    conn.close()

    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no encontrado.")

    # Verificar contraseña con pepper (igual que main_portal.py)
    hash_recibido = hash_password(creds.password)
    if hash_recibido != usuario["PasswordHash"]:
        # Compatibilidad: intentar también sin pepper (usuarios legacy)
        hash_legacy = hashlib.sha256(creds.password.encode()).hexdigest()
        if hash_legacy != usuario["PasswordHash"]:
            raise HTTPException(status_code=401, detail="Credenciales inválidas.")

    # Verificar TOTP si el usuario tiene secret configurado
    if usuario["TOTP_Secret"]:
        if not creds.totp_code:
            raise HTTPException(status_code=401, detail="Código 2FA requerido.")
        totp = pyotp.TOTP(usuario["TOTP_Secret"])
        if not totp.verify(creds.totp_code, valid_window=1):
            raise HTTPException(status_code=401, detail="Código 2FA inválido o expirado.")

    token = crear_token_acceso({
        "sub":  usuario["Username"],
        "role": usuario["Role"]
    })
    return {
        "access_token": token,
        "token_type":   "bearer",
        "role":         usuario["Role"],
        "expires_in":   TOKEN_HORAS * 3600
    }


# ── PRODUCTOS ──────────────────────────────────────────────────────────────
@app.get("/api/productos", tags=["Catálogo"])
def obtener_catalogo():
    """Lista todos los productos activos del catálogo maestro."""
    conn      = get_db_connection()
    productos = conn.execute(
        "SELECT * FROM Productos WHERE Activo = 1 ORDER BY Linea, Nombre"
    ).fetchall()
    conn.close()
    return [dict(row) for row in productos]


@app.post("/api/productos", tags=["Catálogo"])
def crear_producto(producto: ProductoNuevo, user: str = Depends(verificar_token)):
    """Crea un nuevo producto en el catálogo."""
    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT INTO Productos (CodigoRef, Nombre, Linea, CostoBase, Moneda, MargenPct)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (producto.codigo_ref, producto.nombre, producto.linea,
              producto.costo_base, producto.moneda, producto.margen_pct))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Error al crear producto: {e}")
    conn.close()
    return {"status": "created", "codigo_ref": producto.codigo_ref}


@app.put("/api/productos/{producto_id}", tags=["Catálogo"])
def actualizar_margen(producto_id: int, datos: ActualizacionMargen, user: str = Depends(verificar_token)):
    """Actualiza el margen de ganancia de un producto. Requiere autenticación."""
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE Productos SET MargenPct = ?, FechaModif = CURRENT_TIMESTAMP WHERE ProductoID = ?",
        (datos.nuevo_margen, producto_id)
    )
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    conn.commit()
    conn.close()
    return {"status": "updated", "producto_id": producto_id, "nuevo_margen": datos.nuevo_margen}


# ── CLIENTES ───────────────────────────────────────────────────────────────
@app.get("/api/clientes", tags=["Clientes"])
def obtener_clientes(user: str = Depends(verificar_token)):
    conn     = get_db_connection()
    clientes = conn.execute("SELECT * FROM Clientes ORDER BY RazonSocial").fetchall()
    conn.close()
    return [dict(row) for row in clientes]


@app.post("/api/clientes", tags=["Clientes"])
def crear_cliente(cliente: ClienteNuevo, user: str = Depends(verificar_token)):
    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT INTO Clientes (RazonSocial, RUC, Direccion, Telefono, Email)
            VALUES (?, ?, ?, ?, ?)
        """, (cliente.razon_social, cliente.ruc, cliente.direccion,
              cliente.telefono, cliente.email))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Error al crear cliente: {e}")
    conn.close()
    return {"status": "created", "ruc": cliente.ruc}


# ── FACTURAS ───────────────────────────────────────────────────────────────
@app.get("/api/facturas", tags=["Facturación"])
def obtener_facturas(user: str = Depends(verificar_token), limite: int = 100):
    """Lista las últimas N facturas activas con datos del cliente."""
    conn     = get_db_connection()
    facturas = conn.execute("""
        SELECT f.*, c.RazonSocial, c.RUC
        FROM Facturas f
        LEFT JOIN Clientes c ON f.ClienteID = c.ClienteID
        ORDER BY f.FechaEmision DESC
        LIMIT ?
    """, (limite,)).fetchall()
    conn.close()
    return [dict(row) for row in facturas]


@app.get("/api/facturas/{factura_id}", tags=["Facturación"])
def obtener_factura(factura_id: int, user: str = Depends(verificar_token)):
    """Retorna factura con líneas de detalle."""
    conn      = get_db_connection()
    encabezado = conn.execute("""
        SELECT f.*, c.RazonSocial, c.RUC
        FROM Facturas f
        LEFT JOIN Clientes c ON f.ClienteID = c.ClienteID
        WHERE f.FacturaID = ?
    """, (factura_id,)).fetchone()

    if not encabezado:
        conn.close()
        raise HTTPException(status_code=404, detail="Factura no encontrada.")

    detalles = conn.execute("""
        SELECT df.*, p.Nombre, p.Linea
        FROM Detalle_Facturas df
        JOIN Productos p ON df.ProductoID = p.ProductoID
        WHERE df.FacturaID = ?
    """, (factura_id,)).fetchall()
    conn.close()

    return {
        "encabezado": dict(encabezado),
        "detalles":   [dict(d) for d in detalles]
    }


# ── ANALYTICS ─────────────────────────────────────────────────────────────
@app.get("/api/analytics/ventas-por-linea", tags=["Analytics"])
def ventas_por_linea(user: str = Depends(verificar_token)):
    """
    Reemplaza el cruce String-Matching de main_portal.py.
    Cruza Detalle_Facturas → Productos por ProductoID (FK real).
    """
    conn  = get_db_connection()
    datos = conn.execute("""
        SELECT
            p.Linea,
            COUNT(DISTINCT f.FacturaID)            AS cantidad_facturas,
            SUM(df.Cantidad * df.PrecioUnitario)   AS total_ventas_gs,
            SUM(df.Cantidad * p.CostoBase)         AS total_costo_gs,
            ROUND(
                (SUM(df.Cantidad * df.PrecioUnitario) - SUM(df.Cantidad * p.CostoBase))
                / NULLIF(SUM(df.Cantidad * df.PrecioUnitario), 0) * 100
            , 2)                                   AS margen_real_pct
        FROM Detalle_Facturas df
        JOIN Productos p ON df.ProductoID = p.ProductoID
        JOIN Facturas f  ON df.FacturaID  = f.FacturaID
        WHERE f.Estado = 'Activa'
        GROUP BY p.Linea
        ORDER BY total_ventas_gs DESC
    """).fetchall()
    conn.close()
    return [dict(row) for row in datos]


# ── HEALTH CHECK ───────────────────────────────────────────────────────────
@app.get("/", tags=["Sistema"])
def health_check():
    return {
        "sistema":  "SGSP Core API",
        "version":  "1.0.0",
        "estado":   "operativo",
        "timestamp": datetime.utcnow().isoformat()
    }
