import httpx
import json
import os
import streamlit as st
import threading
from datetime import datetime

# API URL
API_BASE_URL = "https://solpro-master-tec-production.up.railway.app/api/sgsp"

# Funciones de utilidad para limpiar claves con 'ñ'
def clean_keys(data):
    """Reemplaza 'ñ' por 'n' en las claves del diccionario."""
    if isinstance(data, dict):
        return {k.replace('ñ', 'n'): clean_keys(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_keys(item) for item in data]
    return data

def run_async(func, *args, **kwargs):
    """Ejecuta una funcion en un hilo separado para no bloquear."""
    thread = threading.Thread(target=func, args=args, kwargs=kwargs)
    thread.daemon = True
    thread.start()

# --- Funciones de Sync (Silenciosas) ---

def _sync_pago_task(pago_data):
    try:
        clean_data = clean_keys(pago_data)
        with httpx.Client(timeout=10.0) as client:
            client.post(f"{API_BASE_URL}/pagos/sync", json=[clean_data])
    except Exception as e:
        print(f"[SYNC ERROR] Pago {pago_data.get('id_pago')}: {e}")

def sync_pago(pago_data):
    run_async(_sync_pago_task, pago_data)


def _sync_pedido_task(pedido_data):
    try:
        clean_data = clean_keys(pedido_data)
        with httpx.Client(timeout=10.0) as client:
            client.post(f"{API_BASE_URL}/pedidos/sync", json=[clean_data])
    except Exception as e:
        print(f"[SYNC ERROR] Pedido {pedido_data.get('id_pedido')}: {e}")

def sync_pedido(pedido_data):
    run_async(_sync_pedido_task, pedido_data)


def _sync_tipo_cambio_task(tc_data):
    try:
        with httpx.Client(timeout=10.0) as client:
            client.post(f"{API_BASE_URL}/tipo-cambio/sync", json=tc_data)
    except Exception as e:
        print(f"[SYNC ERROR] Tipo Cambio: {e}")

def sync_tipo_cambio(tc_data):
    run_async(_sync_tipo_cambio_task, tc_data)


# --- Funciones Bulk (Con UI) ---

def sync_clientes_bulk(clientes_list):
    """Sincroniza todos los clientes. Retorna dict con 'creados' y 'actualizados'."""
    try:
        clean_list = clean_keys(clientes_list)
        with httpx.Client(timeout=30.0) as client:
            r = client.post(f"{API_BASE_URL}/clientes/sync", json=clean_list)
            if r.status_code == 200:
                return r.json()
            return {"error": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"error": str(e)}


def sync_productos_bulk(productos_list):
    """Sincroniza todos los productos. Retorna dict con 'creados' y 'actualizados'."""
    try:
        clean_list = clean_keys(productos_list)
        with httpx.Client(timeout=30.0) as client:
            r = client.post(f"{API_BASE_URL}/productos/sync", json=clean_list)
            if r.status_code == 200:
                return r.json()
            return {"error": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"error": str(e)}
