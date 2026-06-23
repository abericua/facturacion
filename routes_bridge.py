# -*- coding: utf-8 -*-
"""
SGSP — Bridge API v2 (PostgreSQL)
Módulo: routes_bridge.py
Propósito: Endpoints REST para sincronización bidireccional entre
           el Backoffice React y PostgreSQL (Railway).

Rutas registradas bajo /api/bridge/
Mismo contrato de API que v1 — cero cambios en el frontend.
"""

import os
import json
import re
import io
from datetime import datetime
from fastapi import APIRouter, HTTPException, Header, Request
from fastapi.responses import PlainTextResponse
from typing import Optional, List, Any
from pydantic import BaseModel

# ── DB (PostgreSQL) ─────────────────────────────────────────────────────────
import db_sgsp

# Clave de API para el bridge (configurar en Railway → Variables)
BRIDGE_KEY = os.environ.get("BRIDGE_API_KEY", "sgsp-bridge-2026")

EXCLUIR_VENTAS = re.compile(
    r'SEÑA|ANTICIPO|ACEPTACION DE PAGO|ANULADO|CANCELACION DE COMPRA',
    re.IGNORECASE
)

router = APIRouter(prefix="/api/bridge", tags=["Bridge — Backoffice Sync"])


# ── Modelos ─────────────────────────────────────────────────────────────────
class SyncPayload(BaseModel):
    records: List[Any]
    metadata: Optional[dict] = {}


# ── Auth helper ──────────────────────────────────────────────────────────────
def _check_key(key: Optional[str]):
    if key != BRIDGE_KEY:
        raise HTTPException(status_code=403, detail="Bridge API Key inválida.")


def _excluir_venta(r: dict) -> bool:
    """True si el registro debe filtrarse (señas, anulados, etc.)"""
    desc = str(r.get('descripcion', r.get('DESCRIPCION', '')) or '').upper()
    cli  = str(r.get('cliente', r.get('CLIENTE', '')) or '').upper()
    return bool(EXCLUIR_VENTAS.search(desc) or 'ANULADO' in cli or r.get('anulado'))


# ══════════════════════════════════════════════════════════════════════════
# STATUS
# ══════════════════════════════════════════════════════════════════════════
@router.get("/status")
def bridge_status():
    """Health check del bridge. No requiere autenticación."""
    db_ok = False
    try:
        conn = db_sgsp.get_conn()
        conn.close()
        db_ok = True
    except Exception:
        pass
    return {
        "status":    "ok" if db_ok else "db_down",
        "version":   "2.0.0",
        "backend":   "postgresql",
        "timestamp": datetime.utcnow().isoformat(),
        "db_ok":     db_ok,
    }


# ══════════════════════════════════════════════════════════════════════════
# VENTAS
# ══════════════════════════════════════════════════════════════════════════
@router.get("/ventas")
def get_ventas(x_api_key: Optional[str] = Header(None)):
    """
    Lee ventas de PostgreSQL.
    Filtra señas, anulaciones. Retorna JSON limpio para el Backoffice React.
    """
    _check_key(x_api_key)
    try:
        rows = db_sgsp.get_ventas(excluir_anuladas=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")

    # Filtro adicional por descripción/cliente (copia semántica del filtro v1)
    records = [r for r in rows if not _excluir_venta(r)]

    # Normalizar: devolver en el shape original del Excel para no romper el frontend
    def _fmt(r):
        return {
            "FECHA":       r.get('fecha', ''),
            "CLIENTE":     r.get('cliente', ''),
            "DESCRIPCION": r.get('descripcion', ''),
            "CODIGO":      r.get('codigo', ''),
            "CANTIDAD":    r.get('cantidad', 1),
            "PRECIO GS":   r.get('precio_gs', 0),
            "PRECIO USD":  r.get('precio_usd', 0),
            "NRO_FACTURA": r.get('nro_factura', ''),
            "VENDEDOR":    r.get('vendedor', ''),
        }

    clean = [_fmt(r) for r in records]
    return {"records": clean, "total": len(clean), "fuente": "postgresql"}


@router.get("/ventas/resumen")
def get_ventas_resumen(x_api_key: Optional[str] = Header(None)):
    """Resumen mensual de ventas (GS + USD) sin señas/anulaciones."""
    _check_key(x_api_key)
    try:
        rows = db_sgsp.get_ventas(excluir_anuladas=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")

    rows = [r for r in rows if not _excluir_venta(r)]

    # Agrupar por mes (YYYY-MM)
    meses: dict = {}
    for r in rows:
        fecha_str = str(r.get('fecha', '') or '')
        dt = None
        for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y'):
            try:
                dt = datetime.strptime(fecha_str[:10], fmt)
                break
            except Exception:
                pass
        if not dt:
            continue
        mes = dt.strftime('%Y-%m')
        if mes not in meses:
            meses[mes] = {'mes': mes, 'ventas_gs': 0.0, 'ventas_usd': 0.0, 'facturas': 0}
        meses[mes]['ventas_gs']  += float(r.get('precio_gs', 0) or 0)
        meses[mes]['ventas_usd'] += float(r.get('precio_usd', 0) or 0)
        meses[mes]['facturas']   += 1

    return {"meses": sorted(meses.values(), key=lambda x: x['mes'])}


@router.post("/ventas/upload")
async def upload_ventas_master(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """
    Reemplaza todas las ventas en PostgreSQL con el master enviado
    desde el Backoffice React.
    """
    _check_key(x_api_key)
    if not payload.records:
        raise HTTPException(status_code=400, detail="Sin registros para guardar.")

    try:
        result = db_sgsp.sync_ventas_bulk(payload.records)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")

    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])

    return {
        "status":  "saved",
        "total":   result.get('insertados', 0),
        "fuente":  "postgresql",
        "ts":      datetime.utcnow().isoformat(),
    }


@router.get("/ventas/csv")
def get_ventas_csv(x_api_key: Optional[str] = Header(None)):
    """
    Sirve ventas como CSV semicolon-delimited.
    Formato esperado por DashboardReal2026 y VentasAnalytics:
    FECHA;CANTIDAD;DESCRIPCION;CODIGO
    """
    _check_key(x_api_key)
    try:
        rows = db_sgsp.get_ventas(excluir_anuladas=True)
    except Exception:
        rows = []

    rows = [r for r in rows if not _excluir_venta(r)]

    MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    lines = ['FECHA;CANTIDAD;DESCRIPCION;CODIGO']
    for r in rows:
        fecha_str = str(r.get('fecha', '') or '')
        dt = None
        for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
            try:
                dt = datetime.strptime(fecha_str[:10], fmt)
                break
            except Exception:
                pass
        if not dt:
            continue
        fecha_csv = f"{dt.day:02d}-{MESES_CORTO[dt.month-1]}-{str(dt.year)[2:]}"
        qty  = int(r.get('cantidad', 1) or 1)
        desc = str(r.get('descripcion', '') or '').replace(';', ',').strip()
        code = str(r.get('codigo', '') or '').replace(';', ',').strip()
        lines.append(f"{fecha_csv};{qty};{desc};{code}")

    return PlainTextResponse('\n'.join(lines), media_type="text/csv; charset=utf-8")


# ══════════════════════════════════════════════════════════════════════════
# COMPRAS (Sol Control + Todo Costura — ImportadorCompras)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/compras")
def get_compras(x_api_key: Optional[str] = Header(None)):
    """Lee el registro de compras de proveedores desde PostgreSQL."""
    _check_key(x_api_key)
    try:
        records = db_sgsp.get_compras()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")
    return {"records": records, "total": len(records)}


@router.post("/compras/sync")
def sync_compras(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """
    Recibe todos los comprobantes procesados por ImportadorCompras
    y los persiste en PostgreSQL (reemplaza todo).
    """
    _check_key(x_api_key)
    try:
        result = db_sgsp.sync_compras_bulk(payload.records)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")

    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])

    return {
        "status": "synced",
        "total":  result.get('insertados', 0),
        "ts":     datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# IVA (F120 — CargadorDocumentos)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/iva/{anio}")
def get_iva(anio: str, x_api_key: Optional[str] = Header(None)):
    """Retorna los registros de IVA mensual del año indicado."""
    _check_key(x_api_key)
    try:
        rows = db_sgsp.get_iva(anio=anio)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")

    # Serializar datos JSONB
    records = []
    for r in rows:
        datos = r.get('datos', {})
        if isinstance(datos, str):
            try:
                datos = json.loads(datos)
            except Exception:
                datos = {}
        entry = {"periodo": r['periodo'], **datos}
        entry['total_ventas_brutas'] = r.get('total_ventas_brutas', 0)
        entry['debito_fiscal']       = r.get('debito_fiscal', 0)
        entry['credito_fiscal']      = r.get('credito_fiscal', 0)
        entry['iva_a_pagar']         = r.get('iva_a_pagar', 0)
        records.append(entry)

    return {"records": records, "anio": anio}


@router.post("/iva/sync")
def sync_iva(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """
    Recibe los registros de IVA procesados en el Backoffice React
    y los upserta en PostgreSQL por periodo.
    """
    _check_key(x_api_key)
    count = 0
    errors = []
    for record in payload.records:
        periodo = record.get("periodo")
        if not periodo:
            continue
        try:
            db_sgsp.upsert_iva(periodo, record)
            count += 1
        except Exception as e:
            errors.append(str(e))

    return {
        "status": "synced",
        "total":  count,
        "errors": errors,
        "ts":     datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# CLIENTES (Directorio maestro)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/clientes")
def get_clientes(x_api_key: Optional[str] = Header(None)):
    """Lee el directorio de clientes desde PostgreSQL."""
    _check_key(x_api_key)
    try:
        records = db_sgsp.get_clientes(solo_activos=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")
    return {"records": records, "total": len(records)}


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
        records = []

    result = db_sgsp.bulk_upsert_clientes(records)

    return {
        "status":       "synced",
        "creados":      result.get('insertados', 0),
        "actualizados": 0,
        "errors":       result.get('errors', []),
        "ts":           datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# PRODUCTOS (Catálogo maestro — CalculadoraPrecios)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/productos")
def get_productos_bridge(x_api_key: Optional[str] = Header(None)):
    """Lee productos desde PostgreSQL."""
    _check_key(x_api_key)
    try:
        records = db_sgsp.get_productos(solo_activos=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")
    return {"records": records, "total": len(records)}


@router.get("/productos/csv")
def get_productos_csv(x_api_key: Optional[str] = Header(None)):
    """
    Sirve productos como CSV semicolon-delimited para CalculadoraPrecios y DashboardReal2026.
    Formato: Nombre,ID_Ref,Proveedor,Linea,Costo_Compra,Moneda_Costo,Margen_Pct,Stock,Costo_USD,Codigo_Proveedor
    """
    _check_key(x_api_key)
    try:
        records = db_sgsp.get_productos(solo_activos=False)
    except Exception:
        records = []

    headers = ['Nombre','ID_Ref','Proveedor','Linea','Costo_Compra','Moneda_Costo','Margen_Pct','Stock','Costo_USD','Codigo_Proveedor']
    lines = [','.join(headers)]
    for r in records:
        row = [
            str(r.get('nombre_canonico', '') or '').replace(',', ';'),
            str(r.get('id_solpro', '') or '').replace(',', ';'),
            str(r.get('proveedor', '') or '').replace(',', ';'),
            str(r.get('linea', '') or '').replace(',', ';'),
            str(r.get('costo', 0) or 0),
            str(r.get('moneda_costo', 'USD') or 'USD'),
            str(r.get('margen_pct', 0) or 0),
            str(int(r.get('stock_actual', 0) or 0)),
            str(r.get('costo_usd', 0) or 0),
            str(r.get('codigo_proveedor', '') or '').replace(',', ';'),
        ]
        lines.append(','.join(row))

    return PlainTextResponse('\n'.join(lines), media_type="text/csv; charset=utf-8")


@router.post("/productos/sync")
def sync_productos(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """Actualiza el catálogo de productos en PostgreSQL (bulk transaction)."""
    _check_key(x_api_key)
    if not payload.records:
        raise HTTPException(status_code=400, detail="Sin registros.")

    result = db_sgsp.bulk_upsert_productos(payload.records)

    return {
        "status": "synced",
        "total":  result.get('insertados', 0),
        "errors": result.get('errors', []),
        "ts":     datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# STOCK (desde ImportadorCompras → sgsp_productos)
# ══════════════════════════════════════════════════════════════════════════
@router.post("/stock/sync")
def sync_stock(payload: SyncPayload, x_api_key: Optional[str] = Header(None)):
    """
    Recibe items de compras (codigo, descripcion, cantidad, precio_unit_usd)
    y actualiza stock en sgsp_productos.
    """
    _check_key(x_api_key)
    if not payload.records:
        raise HTTPException(status_code=400, detail="Sin items de stock.")

    actualizados = 0
    nuevos = 0
    errors = []

    for item in payload.records:
        cod   = str(item.get("codigo", "")).strip()
        desc  = str(item.get("descripcion", "")).strip()
        qty   = float(item.get("cantidad", 0) or 0)
        precio = float(item.get("precio_unit_usd", 0) or 0)

        if not cod or qty <= 0:
            continue

        try:
            ok = db_sgsp.update_stock_producto(cod, qty, precio)
            if ok:
                actualizados += 1
            else:
                # Producto no existe — crearlo
                nuevo = {
                    'id_solpro':          cod,
                    'nombre_canonico':    desc or cod,
                    'codigo_proveedor':   cod,
                    'proveedor':          'SOL CONTROL / TODO COSTURA',
                    'linea':              'INSUMOS',
                    'moneda_costo':       'USD',
                    'costo':              precio,
                    'costo_usd':          precio,
                    'margen_pct':         15.0,
                    'stock_actual':       qty,
                    'stock_disponible':   qty,
                    'activo':             True,
                }
                db_sgsp.upsert_producto(nuevo)
                nuevos += 1
        except Exception as e:
            errors.append(f"{cod}: {e}")

    return {
        "status":       "synced",
        "actualizados": actualizados,
        "nuevos":       nuevos,
        "errors":       errors,
        "ts":           datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════
# CONCILIACIÓN DE PAGOS (TabConciliacion en FinanzasPro)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/conciliacion/resumen")
def get_conciliacion_resumen(x_api_key: Optional[str] = Header(None)):
    """Retorna el listado de pagos para la vista de conciliación."""
    _check_key(x_api_key)
    try:
        pagos = db_sgsp.get_pagos()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")

    total_pendiente  = sum(p.get('monto_gs', 0) for p in pagos if not p.get('conciliado'))
    total_conciliado = sum(p.get('monto_gs', 0) for p in pagos if p.get('conciliado'))

    return {
        "pagos":            pagos,
        "total":            len(pagos),
        "total_pendiente":  total_pendiente,
        "total_conciliado": total_conciliado,
        "ts":               datetime.utcnow().isoformat(),
    }


@router.patch("/pagos/{id_pago}/conciliar")
def conciliar_pago_route(id_pago: str, x_api_key: Optional[str] = Header(None)):
    """Marca un pago como conciliado."""
    _check_key(x_api_key)
    try:
        ok = db_sgsp.conciliar_pago(id_pago, conciliado=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")

    if not ok:
        raise HTTPException(status_code=404, detail=f"Pago {id_pago} no encontrado.")

    return {"status": "conciliado", "id_pago": id_pago}


@router.patch("/pagos/{id_pago}/desconciliar")
def desconciliar_pago_route(id_pago: str, x_api_key: Optional[str] = Header(None)):
    """Revierte la conciliación de un pago."""
    _check_key(x_api_key)
    try:
        ok = db_sgsp.conciliar_pago(id_pago, conciliado=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {e}")

    if not ok:
        raise HTTPException(status_code=404, detail=f"Pago {id_pago} no encontrado.")

    return {"status": "desconciliado", "id_pago": id_pago}


# ══════════════════════════════════════════════════════════════════════════
# RESUMEN FINANCIERO (para Dashboard)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/dashboard/resumen")
def get_dashboard_resumen(x_api_key: Optional[str] = Header(None)):
    """
    Resumen de alto nivel para el Dashboard Real 2026.
    Combina ventas + compras + IVA de PostgreSQL.
    """
    _check_key(x_api_key)

    # Ventas
    ventas_gs = ventas_usd = facturas_activas = 0
    try:
        rows = db_sgsp.get_ventas(excluir_anuladas=True)
        rows = [r for r in rows if not _excluir_venta(r)]
        ventas_gs       = sum(float(r.get('precio_gs', 0) or 0) for r in rows)
        ventas_usd      = sum(float(r.get('precio_usd', 0) or 0) for r in rows)
        facturas_activas = len(rows)
    except Exception:
        pass

    # Compras
    compras_total = compras_count = 0
    try:
        compras = db_sgsp.get_compras()
        compras_count = len(compras)
        for c in compras:
            if c.get('tipo') == 'FAC':
                compras_total += float(c.get('subtotal_usd', 0) or 0)
            elif c.get('tipo') == 'NC':
                compras_total -= float(c.get('subtotal_usd', 0) or 0)
    except Exception:
        pass

    # IVA 2026
    iva_declarado = 0
    try:
        rows_iva = db_sgsp.get_iva(anio='2026')
        for r in rows_iva:
            iva_declarado += float(r.get('total_ventas_brutas', 0) or 0)
    except Exception:
        pass

    return {
        "ventas": {
            "gs":       ventas_gs,
            "usd":      ventas_usd,
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
# LLM PROXY (Anthropic / Gemini) — evita CORS y oculta la API Key
# ══════════════════════════════════════════════════════════════════════════
# Sin cambios respecto a v1 — el proxy no toca almacenamiento.

def _resolver_proveedor() -> str:
    forzado = (os.environ.get("LLM_PROVIDER") or "").strip().lower()
    if forzado in ("local", "gemini", "anthropic"):
        return forzado
    
    # Si detectamos entorno local de PC sin RAILWAY, usamos LM Studio
    if not os.environ.get("RAILWAY_ENVIRONMENT"):
        return "local"
        
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return "gemini"
    return "anthropic"


def _anthropic_a_gemini(body: dict) -> dict:
    """Traduce un payload estilo Anthropic Messages a un request de Gemini."""
    gemini_req: dict = {"contents": []}

    system = body.get("system")
    if system:
        gemini_req["system_instruction"] = {"parts": [{"text": str(system)}]}

    for msg in body.get("messages", []):
        role = "model" if msg.get("role") == "assistant" else "user"
        content = msg.get("content", "")
        if isinstance(content, list):
            text = "".join(b.get("text", "") for b in content if isinstance(b, dict))
        else:
            text = str(content)
        gemini_req["contents"].append({"role": role, "parts": [{"text": text}]})

    gen_cfg = {"responseMimeType": "application/json"}
    if body.get("max_tokens"):
        gen_cfg["maxOutputTokens"] = int(body["max_tokens"])
    if body.get("temperature") is not None:
        gen_cfg["temperature"] = float(body["temperature"])
    gemini_req["generationConfig"] = gen_cfg

    return gemini_req


def _gemini_a_anthropic(gemini_json: dict, modelo: str) -> dict:
    """Reformatea la respuesta de Gemini al shape Anthropic que espera el frontend."""
    texto = ""
    try:
        partes = gemini_json["candidates"][0]["content"]["parts"]
        texto = "".join(p.get("text", "") for p in partes)
    except (KeyError, IndexError, TypeError):
        texto = ""
    return {
        "id": "gemini-proxy",
        "type": "message",
        "role": "assistant",
        "model": modelo,
        "content": [{"type": "text", "text": texto}],
        "stop_reason": "end_turn",
    }


@router.post("/anthropic/messages")
async def proxy_llm(request: Request, x_api_key: Optional[str] = Header(None)):
    """
    Proxy de LLM para el Backoffice. Mantiene la ruta /anthropic/messages por
    compatibilidad con el frontend ya compilado, pero puede enrutar a Gemini.
    """
    body = await request.json()
    proveedor = _resolver_proveedor()
    import requests

    # ── LOCAL (LM Studio / OpenAI compatible) ──────────────────────────────
    if proveedor == "local":
        modelo = (os.environ.get("LOCAL_MODEL") or "google/gemma-4-12b-qat").strip()
        base_url = (os.environ.get("LOCAL_API_BASE") or "http://127.0.0.1:1234/v1").strip()
        if not base_url.endswith("/v1") and not base_url.endswith("/v1/"):
            base_url = base_url.rstrip("/") + "/v1"
            
        url = f"{base_url}/chat/completions"
        
        openai_req = {
            "model": modelo,
            "messages": [],
            "temperature": body.get("temperature", 0.0)
        }
        if body.get("max_tokens"):
            openai_req["max_tokens"] = int(body["max_tokens"])
            
        system = body.get("system")
        if system:
            openai_req["messages"].append({"role": "system", "content": str(system)})
            
        for msg in body.get("messages", []):
            role = msg.get("role")
            content = msg.get("content", "")
            if isinstance(content, list):
                text = "".join(b.get("text", "") for b in content if isinstance(b, dict))
            else:
                text = str(content)
            openai_req["messages"].append({"role": role, "content": text})
            
        try:
            resp = requests.post(url, json=openai_req, headers={"content-type": "application/json"}, timeout=120)
        except requests.RequestException as e:
            return PlainTextResponse(
                json.dumps({"error": {"message": f"Error de red hacia modelo Local: {e}"}}),
                status_code=502, media_type="application/json")
                
        if resp.status_code != 200:
            try:
                err = resp.json().get("error", {})
                msg = err.get("message", resp.text)
            except Exception:
                msg = resp.text
            return PlainTextResponse(
                json.dumps({"error": {"message": f"Local LLM: {msg}"}}),
                status_code=resp.status_code, media_type="application/json")
                
        try:
            resp_json = resp.json()
            texto = resp_json["choices"][0]["message"]["content"]
        except Exception:
            texto = resp.text or "Error al parsear respuesta del modelo."
        
        anthropic_shape = {
            "id": "local-proxy",
            "type": "message",
            "role": "assistant",
            "model": modelo,
            "content": [{"type": "text", "text": texto}],
            "stop_reason": "end_turn",
        }
        return PlainTextResponse(json.dumps(anthropic_shape), media_type="application/json")

    # ── GEMINI ────────────────────────────────────────────────────────────
    if proveedor == "gemini":
        gemini_key = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
        if not gemini_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY no configurada en el servidor.")

        modelo = (os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash").strip()
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{modelo}:generateContent?key={gemini_key}"
        )
        gemini_req = _anthropic_a_gemini(body)

        try:
            resp = requests.post(url, json=gemini_req,
                                 headers={"content-type": "application/json"}, timeout=120)
        except requests.RequestException as e:
            return PlainTextResponse(
                json.dumps({"error": {"message": f"Error de red hacia Gemini: {e}"}}),
                status_code=502, media_type="application/json")

        if resp.status_code != 200:
            try:
                err = resp.json().get("error", {})
                msg = err.get("message", resp.text)
            except Exception:
                msg = resp.text
            return PlainTextResponse(
                json.dumps({"error": {"message": f"Gemini: {msg}"}}),
                status_code=resp.status_code, media_type="application/json")

        anthropic_shape = _gemini_a_anthropic(resp.json(), modelo)
        return PlainTextResponse(json.dumps(anthropic_shape), media_type="application/json")

    # ── ANTHROPIC (fallback) ───────────────────────────────────────────────
    anthropic_key = os.environ.get("VITE_ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="API Key de Anthropic no configurada en el servidor.")

    headers = {
        "x-api-key": anthropic_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    resp = requests.post("https://api.anthropic.com/v1/messages", json=body, headers=headers, timeout=120)
    return PlainTextResponse(resp.text, status_code=resp.status_code, media_type="application/json")
