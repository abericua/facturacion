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
from fastapi.responses import PlainTextResponse
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


@router.get("/ventas/csv")
def get_ventas_csv(x_api_key: Optional[str] = Header(None)):
    """
    Sirve VENTAS TOTALES 2026.xlsx como CSV semicolon-delimited.
    Formato esperado por DashboardReal2026 y VentasAnalytics:
    FECHA;CANTIDAD;DESCRIPCION;CODIGO
    """
    _check_key(x_api_key)
    if not os.path.exists(SALES_FILE):
        return PlainTextResponse("FECHA;CANTIDAD;DESCRIPCION;CODIGO\n", media_type="text/csv; charset=utf-8")

    df = pd.read_excel(SALES_FILE)
    mask = (
        df['DESCRIPCION'].astype(str).str.upper().str.contains(EXCLUIR_VENTAS, na=False) |
        df['CLIENTE'].astype(str).str.upper().str.contains('ANULADO', na=False)
    )
    df = df[~mask].copy()

    df['FECHA_DT'] = pd.to_datetime(df['FECHA'], dayfirst=True, errors='coerce')
    df = df[df['FECHA_DT'].notna()]

    MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    df['FECHA_CSV'] = df['FECHA_DT'].apply(
        lambda d: f"{d.day:02d}-{MESES_CORTO[d.month-1]}-{str(d.year)[2:]}"
    )

    qty_col = 'CANTIDAD' if 'CANTIDAD' in df.columns else None

    lines = ['FECHA;CANTIDAD;DESCRIPCION;CODIGO']
    for _, row in df.iterrows():
        qty  = int(row[qty_col]) if qty_col and pd.notna(row[qty_col]) else 1
        desc = str(row.get('DESCRIPCION', '')).replace(';', ',').strip()
        code = str(row.get('CODIGO', row.get('COD', ''))).replace(';', ',').strip()
        lines.append(f"{row['FECHA_CSV']};{qty};{desc};{code}")

    return PlainTextResponse('\n'.join(lines), media_type="text/csv; charset=utf-8")


@router.get("/productos/csv")
def get_productos_csv(x_api_key: Optional[str] = Header(None)):
    """
    Sirve productos_maestros.csv directamente como texto.
    Usado por CalculadoraPrecios y DashboardReal2026.
    """
    _check_key(x_api_key)
    if not os.path.exists(PRODUCTOS_CSV):
        return PlainTextResponse(
            "Nombre,ID_Ref,Proveedor,Linea,Costo_Compra,Moneda_Costo,Margen_Pct\n",
            media_type="text/csv; charset=utf-8"
        )
    with open(PRODUCTOS_CSV, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    return PlainTextResponse(content, media_type="text/csv; charset=utf-8")


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
# STOCK (desde ImportadorCompras → productos_maestros.csv)
# ══════════════════════════════════════════════════════════════════════════
@router.post("/stock/sync")
def sync_stock(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """
    Recibe items agregados desde ImportadorCompras (codigo, descripcion,
    cantidad, precio_unit_usd) y actualiza la columna 'Stock' en
    productos_maestros.csv usando matching por código o descripción.
    """
    _check_key(x_api_key)
    if not payload.records:
        raise HTTPException(status_code=400, detail="Sin items de stock.")

    os.makedirs(DATA_DIR, exist_ok=True)

    # Leer CSV actual (o crear vacío con columnas base)
    if os.path.exists(PRODUCTOS_CSV):
        df = pd.read_csv(PRODUCTOS_CSV)
    else:
        df = pd.DataFrame(columns=["Nombre","ID_Ref","Proveedor","Linea",
                                    "Costo_Compra","Moneda_Costo","Margen_Pct"])

    # Asegurar columnas de stock y costo actualizado
    if "Stock" not in df.columns:
        df["Stock"] = 0
    if "Costo_USD" not in df.columns:
        df["Costo_USD"] = 0.0
    if "Codigo_Proveedor" not in df.columns:
        df["Codigo_Proveedor"] = ""

    df["Stock"] = pd.to_numeric(df["Stock"], errors="coerce").fillna(0)

    actualizados = 0
    nuevos = 0

    for item in payload.records:
        cod   = str(item.get("codigo", "")).strip().upper()
        desc  = str(item.get("descripcion", "")).strip().upper()
        qty   = float(item.get("cantidad", 0))
        precio = float(item.get("precio_unit_usd", 0) or 0)

        if not cod or qty <= 0:
            continue

        # 1. Match por Codigo_Proveedor exacto
        mask = df["Codigo_Proveedor"].astype(str).str.upper() == cod
        # 2. Si no matchea, buscar por código en el Nombre o ID_Ref
        if not mask.any():
            mask = (
                df["Nombre"].astype(str).str.upper().str.contains(cod, na=False) |
                df["ID_Ref"].astype(str).str.upper().str.contains(cod, na=False)
            )

        if mask.any():
            df.loc[mask, "Stock"] += qty
            if precio > 0:
                df.loc[mask, "Costo_Compra"] = precio
                df.loc[mask, "Moneda_Costo"] = "USD"
            df.loc[mask, "Codigo_Proveedor"] = cod
            actualizados += 1
        else:
            # Producto nuevo — agregarlo al CSV
            nuevo = {
                "Nombre":           desc or cod,
                "ID_Ref":           cod,
                "Proveedor":        "SOL CONTROL / TODO COSTURA",
                "Linea":            "INSUMOS",
                "Costo_Compra":     precio,
                "Moneda_Costo":     "USD",
                "Margen_Pct":       15.0,
                "Stock":            qty,
                "Costo_USD":        precio,
                "Codigo_Proveedor": cod,
            }
            df = pd.concat([df, pd.DataFrame([nuevo])], ignore_index=True)
            nuevos += 1

    df["Stock"] = df["Stock"].astype(int)
    df.to_csv(PRODUCTOS_CSV, index=False, encoding="utf-8-sig")

    return {
        "status":      "synced",
        "actualizados": actualizados,
        "nuevos":       nuevos,
        "total_csv":    len(df),
        "ts":           datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# CONCILIACIÓN DE PAGOS (TabConciliacion en FinanzasPro)
# ══════════════════════════════════════════════════════════════════════════
PAGOS_FILE = os.path.join(DATA_DIR, "pagos.json")

@router.get("/conciliacion/resumen")
def get_conciliacion_resumen(x_api_key: Optional[str] = Header(None)):
    """
    Lee pagos.json del volumen Railway y retorna el listado para la
    vista de conciliación en FinanzasPro.
    """
    _check_key(x_api_key)
    if not os.path.exists(PAGOS_FILE):
        return {"pagos": [], "total_pendiente": 0, "total_conciliado": 0}

    with open(PAGOS_FILE, 'r', encoding='utf-8') as f:
        pagos = json.load(f)

    total_pendiente  = sum(p.get('monto_gs', 0) for p in pagos if not p.get('conciliado'))
    total_conciliado = sum(p.get('monto_gs', 0) for p in pagos if p.get('conciliado'))

    return {
        "pagos":             pagos,
        "total":             len(pagos),
        "total_pendiente":   total_pendiente,
        "total_conciliado":  total_conciliado,
        "ts":                datetime.utcnow().isoformat(),
    }


@router.patch("/pagos/{id_pago}/conciliar")
def conciliar_pago(id_pago: str, x_api_key: Optional[str] = Header(None)):
    """Marca un pago como conciliado."""
    _check_key(x_api_key)
    if not os.path.exists(PAGOS_FILE):
        raise HTTPException(status_code=404, detail="Sin pagos registrados.")

    with open(PAGOS_FILE, 'r', encoding='utf-8') as f:
        pagos = json.load(f)

    encontrado = False
    for p in pagos:
        if p.get('id_pago') == id_pago:
            p['conciliado']        = True
            p['fecha_conciliacion'] = datetime.utcnow().strftime('%Y-%m-%d')
            encontrado = True
            break

    if not encontrado:
        raise HTTPException(status_code=404, detail=f"Pago {id_pago} no encontrado.")

    with open(PAGOS_FILE, 'w', encoding='utf-8') as f:
        json.dump(pagos, f, ensure_ascii=False, indent=2)

    return {"status": "conciliado", "id_pago": id_pago}


@router.patch("/pagos/{id_pago}/desconciliar")
def desconciliar_pago(id_pago: str, x_api_key: Optional[str] = Header(None)):
    """Revierte la conciliación de un pago."""
    _check_key(x_api_key)
    if not os.path.exists(PAGOS_FILE):
        raise HTTPException(status_code=404, detail="Sin pagos registrados.")

    with open(PAGOS_FILE, 'r', encoding='utf-8') as f:
        pagos = json.load(f)

    encontrado = False
    for p in pagos:
        if p.get('id_pago') == id_pago:
            p['conciliado']        = False
            p['fecha_conciliacion'] = ''
            encontrado = True
            break

    if not encontrado:
        raise HTTPException(status_code=404, detail=f"Pago {id_pago} no encontrado.")

    with open(PAGOS_FILE, 'w', encoding='utf-8') as f:
        json.dump(pagos, f, ensure_ascii=False, indent=2)

    return {"status": "desconciliado", "id_pago": id_pago}


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

# ══════════════════════════════════════════════════════════════════════════
# ANTHROPIC PROXY (Para evitar CORS y ocultar API Key)
# ══════════════════════════════════════════════════════════════════════════
@router.post("/anthropic/messages")
async def proxy_anthropic(request: Request, x_api_key: Optional[str] = Header(None)):
    """Proxy para Anthropic para evitar problemas de CORS y ocultar la API key."""
    # Saltamos la validación _check_key si vienen vacías para facilitar al frontend
    # Pero si quieres seguridad total:
    # _check_key(x_api_key)
    
    body = await request.json()
    
    anthropic_key = os.environ.get("VITE_ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="API Key de Anthropic no configurada en el servidor.")

    import requests
    headers = {
        "x-api-key": anthropic_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    resp = requests.post("https://api.anthropic.com/v1/messages", json=body, headers=headers)
    
    # Devuelve los headers y status original de Anthropic para que el frontend no se rompa
    return PlainTextResponse(resp.text, status_code=resp.status_code, media_type="application/json")
