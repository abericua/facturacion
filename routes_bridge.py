# -*- coding: utf-8 -*-
"""
SGSP — Bridge API
Módulo: routes_bridge.py
Propósito: Endpoints REST para sincronización bidireccional entre
           el Backoffice React (IndexedDB) y el volumen Railway.

Rutas registradas bajo /api/bridge/
"""

import os
import json
import pandas as pd
from datetime import datetime
from fastapi import APIRouter, HTTPException, Header
from typing import Optional, List, Any
from pydantic import BaseModel

# ── Rutas de datos (mismo patrón que database.py) ─────────────────────────
DATA_DIR = os.environ.get(
    "DATA_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "database")
)

# Clave de API para el bridge (configurar en Railway → Variables)
BRIDGE_KEY = os.environ.get("BRIDGE_API_KEY", "sgsp-bridge-2026")

# Archivos del volumen
SALES_FILE    = os.path.join(DATA_DIR, "VENTAS TOTALES 2026.xlsx")
COMPRAS_FILE  = os.path.join(DATA_DIR, "compras_proveedores.json")
FINANZAS_FILE = os.path.join(DATA_DIR, "finanzas_pro.json")
PRODUCTOS_CSV = os.path.join(DATA_DIR, "productos_maestros.csv")

EXCLUIR_VENTAS = r'SEÑA|ANTICIPO|ACEPTACION DE PAGO|ANULADO|CANCELACION DE COMPRA'

router = APIRouter(prefix="/api/bridge", tags=["Bridge — Backoffice Sync"])


# ── Modelos ────────────────────────────────────────────────────────────────
class SyncPayload(BaseModel):
    records: List[Any]
    metadata: Optional[dict] = {}


# ── Auth helper ────────────────────────────────────────────────────────────
def _check_key(key: Optional[str]):
    if key != BRIDGE_KEY:
        raise HTTPException(status_code=403, detail="Bridge API Key inválida.")


# ══════════════════════════════════════════════════════════════════════════
# STATUS
# ══════════════════════════════════════════════════════════════════════════
@router.get("/status")
def bridge_status():
    """Health check del bridge. No requiere autenticación."""
    archivos = {
        "ventas_excel":   os.path.exists(SALES_FILE),
        "compras_json":   os.path.exists(COMPRAS_FILE),
        "finanzas_json":  os.path.exists(FINANZAS_FILE),
        "productos_csv":  os.path.exists(PRODUCTOS_CSV),
    }
    return {
        "status":    "ok",
        "version":   "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "data_dir":  DATA_DIR,
        "archivos":  archivos,
    }


# ══════════════════════════════════════════════════════════════════════════
# VENTAS
# ══════════════════════════════════════════════════════════════════════════
@router.get("/ventas")
def get_ventas(x_api_key: Optional[str] = Header(None)):
    """
    Lee VENTAS TOTALES 2026.xlsx del volumen Railway.
    Filtra señas, anulaciones y registros sin fecha.
    Retorna JSON limpio para el Backoffice React.
    """
    _check_key(x_api_key)
    if not os.path.exists(SALES_FILE):
        return {"records": [], "total": 0, "fuente": "sin_archivo"}

    df = pd.read_excel(SALES_FILE)

    # Filtrar señas y anulaciones
    mask = (
        df['DESCRIPCION'].astype(str).str.upper().str.contains(EXCLUIR_VENTAS, na=False) |
        df['CLIENTE'].astype(str).str.upper().str.contains('ANULADO', na=False)
    )
    df = df[~mask].copy()

    # Normalizar fechas
    df['FECHA'] = pd.to_datetime(df['FECHA'], dayfirst=True, errors='coerce')
    df['FECHA'] = df['FECHA'].dt.strftime('%d/%m/%Y')
    df['FECHA'] = df['FECHA'].fillna('')

    # NaN → None para JSON válido
    df = df.where(pd.notna(df), None)

    records = df.to_dict(orient='records')
    return {"records": records, "total": len(records), "fuente": SALES_FILE}


@router.get("/ventas/resumen")
def get_ventas_resumen(x_api_key: Optional[str] = Header(None)):
    """Resumen mensual de ventas (GS + USD) sin señas/anulaciones."""
    _check_key(x_api_key)
    if not os.path.exists(SALES_FILE):
        return {"meses": []}

    df = pd.read_excel(SALES_FILE)
    mask = (
        df['DESCRIPCION'].astype(str).str.upper().str.contains(EXCLUIR_VENTAS, na=False) |
        df['CLIENTE'].astype(str).str.upper().str.contains('ANULADO', na=False)
    )
    df = df[~mask].copy()
    df['FECHA_DT'] = pd.to_datetime(df['FECHA'], dayfirst=True, errors='coerce')
    df = df[df['FECHA_DT'].notna()]
    df['MES'] = df['FECHA_DT'].dt.to_period('M').astype(str)

    meses = []
    for mes, g in df.groupby('MES'):
        meses.append({
            "mes":       mes,
            "ventas_gs": float(g['PRECIO GS'].sum()),
            "ventas_usd": float(g['PRECIO USD'].sum()),
            "facturas":  int(len(g)),
        })
    return {"meses": sorted(meses, key=lambda x: x['mes'])}


@router.post("/ventas/upload")
def upload_ventas_master(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """
    Reemplaza VENTAS TOTALES 2026.xlsx en el volumen con el master enviado
    desde el Backoffice React. Requiere autenticación.
    """
    _check_key(x_api_key)
    if not payload.records:
        raise HTTPException(status_code=400, detail="Sin registros para guardar.")

    os.makedirs(DATA_DIR, exist_ok=True)
    df = pd.DataFrame(payload.records)
    df.to_excel(SALES_FILE, index=False, engine='openpyxl')
    return {
        "status":  "saved",
        "total":   len(payload.records),
        "archivo": SALES_FILE,
        "ts":      datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# COMPRAS (Sol Control + Todo Costura — ImportadorCompras)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/compras")
def get_compras(x_api_key: Optional[str] = Header(None)):
    """
    Lee el JSON de compras de proveedores guardado en el volumen Railway.
    Si no existe, retorna lista vacía (backoffice usa su IndexedDB local).
    """
    _check_key(x_api_key)
    if not os.path.exists(COMPRAS_FILE):
        return {"records": [], "total": 0}

    with open(COMPRAS_FILE, 'r', encoding='utf-8') as f:
        records = json.load(f)
    return {"records": records, "total": len(records)}


@router.post("/compras/sync")
def sync_compras(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """
    Recibe todos los comprobantes procesados por ImportadorCompras
    y los persiste en el volumen Railway como compras_proveedores.json.
    """
    _check_key(x_api_key)
    os.makedirs(DATA_DIR, exist_ok=True)

    with open(COMPRAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload.records, f, ensure_ascii=False, indent=2, default=str)

    return {
        "status": "synced",
        "total":  len(payload.records),
        "ts":     datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# IVA (F120 — CargadorDocumentos)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/iva/{anio}")
def get_iva(anio: str, x_api_key: Optional[str] = Header(None)):
    """Retorna los registros de IVA mensual del año indicado."""
    _check_key(x_api_key)
    if not os.path.exists(FINANZAS_FILE):
        return {"records": []}

    with open(FINANZAS_FILE, 'r', encoding='utf-8') as f:
        finanzas = json.load(f)

    iva = finanzas.get("iva_mensual", {})
    records = [
        {"periodo": periodo, **datos}
        for periodo, datos in iva.items()
        if periodo.startswith(anio)
    ]
    return {"records": records, "anio": anio}


@router.post("/iva/sync")
def sync_iva(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """
    Recibe los registros de IVA procesados en el Backoffice React
    y los merge en finanzas_pro.json del volumen Railway.
    """
    _check_key(x_api_key)
    os.makedirs(DATA_DIR, exist_ok=True)

    finanzas = {}
    if os.path.exists(FINANZAS_FILE):
        with open(FINANZAS_FILE, 'r', encoding='utf-8') as f:
            finanzas = json.load(f)

    if "iva_mensual" not in finanzas:
        finanzas["iva_mensual"] = {}

    for record in payload.records:
        periodo = record.get("periodo")
        if periodo:
            datos = {k: v for k, v in record.items() if k != "periodo"}
            finanzas["iva_mensual"][periodo] = datos

    with open(FINANZAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(finanzas, f, ensure_ascii=False, indent=2, default=str)

    return {
        "status": "synced",
        "total":  len(payload.records),
        "ts":     datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# CLIENTES (Directorio maestro)
# ══════════════════════════════════════════════════════════════════════════
CLIENTES_FILE = os.path.join(DATA_DIR, "master_clientes.json")

@router.get("/clientes")
def get_clientes(x_api_key: Optional[str] = Header(None)):
    """Lee el directorio de clientes del volumen Railway."""
    _check_key(x_api_key)
    if not os.path.exists(CLIENTES_FILE):
        return {"records": [], "total": 0}
    with open(CLIENTES_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Soporta dict {ruc: {...}} y lista [...]
    if isinstance(data, dict):
        records = list(data.values())
    else:
        records = data
    return {"records": records, "total": len(records)}


from fastapi import Request

@router.post("/clientes/sync")
async def sync_clientes(request: Request, x_api_key: Optional[str] = Header(None)):
    """Sincroniza clientes — acepta lista JSON directa o {records:[...]}."""
    _check_key(x_api_key)
    body = await request.json()

    if isinstance(body, list):
        records = body
    elif isinstance(body, dict):
        records = body.get("records", list(body.values()))
    else:
        raise HTTPException(status_code=400, detail="Formato de payload inválido.")

    os.makedirs(DATA_DIR, exist_ok=True)
    creados = actualizados = 0

    # Cargar existentes
    existing = {}
    if os.path.exists(CLIENTES_FILE):
        with open(CLIENTES_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        existing = data if isinstance(data, dict) else {str(c.get('ruc', i)): c for i, c in enumerate(data)}

    for cliente in records:
        key = str(cliente.get('ruc') or cliente.get('RUC') or cliente.get('id', ''))
        if key in existing:
            existing[key].update(cliente)
            actualizados += 1
        else:
            existing[key] = cliente
            creados += 1

    with open(CLIENTES_FILE, 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False, indent=2, default=str)

    return {
        "status":      "synced",
        "creados":     creados,
        "actualizados": actualizados,
        "total":       len(existing),
        "ts":          datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# PRODUCTOS (Catálogo maestro — CalculadoraPrecios)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/productos")
def get_productos_bridge(x_api_key: Optional[str] = Header(None)):
    """
    Lee productos_maestros.csv del volumen Railway.
    Complementa el endpoint /api/productos (SQLite) con el CSV maestro.
    """
    _check_key(x_api_key)
    if not os.path.exists(PRODUCTOS_CSV):
        return {"records": [], "total": 0}

    df = pd.read_csv(PRODUCTOS_CSV)
    df = df.where(pd.notna(df), None)
    records = df.to_dict(orient='records')
    return {"records": records, "total": len(records)}


@router.post("/productos/sync")
def sync_productos(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """Actualiza productos_maestros.csv en el volumen con el catálogo del Backoffice."""
    _check_key(x_api_key)
    if not payload.records:
        raise HTTPException(status_code=400, detail="Sin registros.")

    os.makedirs(DATA_DIR, exist_ok=True)
    df = pd.DataFrame(payload.records)
    df.to_csv(PRODUCTOS_CSV, index=False, encoding='utf-8-sig')
    return {"status": "synced", "total": len(payload.records)}


# ══════════════════════════════════════════════════════════════════════════
# RESUMEN FINANCIERO (para Dashboard)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/dashboard/resumen")
def get_dashboard_resumen(x_api_key: Optional[str] = Header(None)):
    """
    Endpoint de alto nivel para el Dashboard Real 2026.
    Combina ventas reales (Excel) + compras (JSON) + IVA (finanzas_pro.json).
    """
    _check_key(x_api_key)

    # Ventas
    ventas_gs = ventas_usd = 0
    facturas_activas = 0
    if os.path.exists(SALES_FILE):
        try:
            df = pd.read_excel(SALES_FILE)
            mask = (
                df['DESCRIPCION'].astype(str).str.upper().str.contains(EXCLUIR_VENTAS, na=False) |
                df['CLIENTE'].astype(str).str.upper().str.contains('ANULADO', na=False)
            )
            df = df[~mask]
            ventas_gs = float(df['PRECIO GS'].sum())
            ventas_usd = float(df['PRECIO USD'].sum())
            facturas_activas = int(len(df))
        except Exception:
            pass

    # Compras
    compras_total = 0
    compras_count = 0
    if os.path.exists(COMPRAS_FILE):
        try:
            with open(COMPRAS_FILE, 'r', encoding='utf-8') as f:
                compras = json.load(f)
            compras_count = len(compras)
            for c in compras:
                if c.get('tipo') == 'FAC':
                    compras_total += float(c.get('subtotal_usd') or 0)
                    compras_total -= float(c.get('subtotal_usd') or 0) if c.get('tipo') == 'NC' else 0
        except Exception:
            pass

    # IVA
    iva_declarado = 0
    if os.path.exists(FINANZAS_FILE):
        try:
            with open(FINANZAS_FILE, 'r', encoding='utf-8') as f:
                fin = json.load(f)
            for periodo, datos in fin.get("iva_mensual", {}).items():
                if periodo.startswith("2026"):
                    iva_declarado += float(datos.get("total_ventas_brutas") or datos.get("debito_fiscal", 0))
        except Exception:
            pass

    return {
        "ventas": {
            "gs":      ventas_gs,
            "usd":     ventas_usd,
            "facturas": facturas_activas,
        },
        "compras": {
            "total_usd": compras_total,
            "documentos": compras_count,
        },
        "iva_declarado_gs": iva_declarado,
        "ts": datetime.utcnow().isoformat(),
    }
