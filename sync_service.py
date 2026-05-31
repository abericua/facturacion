import httpx
import json
import os
import threading
from datetime import datetime

API_BASE_URL = "https://solpro-master-tec-production.up.railway.app/api/bridge"
BRIDGE_KEY = os.environ.get("BRIDGE_API_KEY", "sgsp-bridge-2026")


def _headers():
    return {"Content-Type": "application/json", "x-api-key": BRIDGE_KEY}


def clean_keys(data):
    if isinstance(data, dict):
        return {k.replace('ñ', 'n'): clean_keys(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_keys(item) for item in data]
    return data


def run_async(func, *args, **kwargs):
    t = threading.Thread(target=func, args=args, kwargs=kwargs)
    t.daemon = True
    t.start()


def _sync_pago_task(pago_data):
    try:
        with httpx.Client(timeout=10.0) as c:
            c.post(f"{API_BASE_URL}/pagos/sync", json=[clean_keys(pago_data)], headers=_headers())
    except Exception as e:
        print(f"[SYNC ERROR] Pago: {e}")


def sync_pago(pago_data):
    run_async(_sync_pago_task, pago_data)


def _sync_pedido_task(pedido_data):
    try:
        with httpx.Client(timeout=10.0) as c:
            c.post(f"{API_BASE_URL}/pedidos/sync", json=[clean_keys(pedido_data)], headers=_headers())
    except Exception as e:
        print(f"[SYNC ERROR] Pedido: {e}")


def sync_pedido(pedido_data):
    run_async(_sync_pedido_task, pedido_data)


def _sync_tipo_cambio_task(tc_data):
    try:
        with httpx.Client(timeout=10.0) as c:
            c.post(f"{API_BASE_URL}/tipo-cambio/sync", json=tc_data, headers=_headers())
    except Exception as e:
        print(f"[SYNC ERROR] TipoCambio: {e}")


def sync_tipo_cambio(tc_data):
    run_async(_sync_tipo_cambio_task, tc_data)


def sync_clientes_bulk(clientes_list):
    try:
        payload = clean_keys(clientes_list)
        with httpx.Client(timeout=30.0) as c:
            r = c.post(f"{API_BASE_URL}/clientes/sync", json=payload, headers=_headers())
        if r.status_code == 200:
            return r.json()
        return {"error": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"error": str(e)}


def sync_productos_bulk(productos_list):
    try:
        payload = {"records": clean_keys(productos_list)}
        with httpx.Client(timeout=30.0) as c:
            r = c.post(f"{API_BASE_URL}/productos/sync", json=payload, headers=_headers())
        if r.status_code == 200:
            return r.json()
        return {"error": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"error": str(e)}
