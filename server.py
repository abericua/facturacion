"""
SGSP Facturador v2.3 — ASGI Server
FastAPI (/api/*) + Streamlit (/*) en el mismo proceso y puerto.
"""
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from streamlit.starlette import App as StreamlitApp

from db_sgsp import (init_db, upsert_pago, conciliar_pago,
                     get_resumen, get_pagos)

# ── FastAPI ──────────────────────────────────────────────────────────────────
api = FastAPI(title="SGSP Conciliación API")
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@api.on_event("startup")
def on_startup():
    init_db()

@api.get("/api/conciliacion/resumen")
def resumen():
    return JSONResponse(get_resumen())

@api.get("/api/debug-env")
def debug_env():
    keys = list(os.environ.keys())
    db_val = os.environ.get("DATABASE_URL")
    safe_db_val = None
    if db_val:
        try:
            from urllib.parse import urlparse
            p = urlparse(db_val)
            safe_db_val = f"{p.scheme}://{p.username}:***@{p.hostname}:{p.port}{p.path}"
        except Exception as e:
            safe_db_val = f"parse_error: {e} | raw: {db_val.replace('postgres', '***')}"

    return JSONResponse({
        "keys": keys,
        "has_database_url": "DATABASE_URL" in os.environ,
        "db_url": safe_db_val
    })

@api.get("/api/pagos")
def pagos(conciliado: str = None, desde: str = None, hasta: str = None):
    c = None
    if conciliado is not None:
        c = conciliado.lower() == "true"
    return JSONResponse(get_pagos(conciliado=c, desde=desde, hasta=hasta))

@api.post("/api/pagos/{id_pago}/conciliar")
@api.patch("/api/pagos/{id_pago}/conciliar")
def conciliar(id_pago: str):
    ok = conciliar_pago(id_pago, True)
    return JSONResponse({"ok": ok, "id_pago": id_pago})

@api.post("/api/pagos/{id_pago}/desconciliar")
@api.patch("/api/pagos/{id_pago}/desconciliar")
def desconciliar(id_pago: str):
    ok = conciliar_pago(id_pago, False)
    return JSONResponse({"ok": ok, "id_pago": id_pago})

# ── Mount Streamlit en /* ─────────────────────────────────────────────────────
# Las rutas /api/* ya están definidas arriba y tienen prioridad por orden.
streamlit_app = StreamlitApp("app.py")
api.mount("/", streamlit_app)

# ── Entry point ───────────────────────────────────────────────────────────────
port = int(os.environ.get("PORT", 8501))
uvicorn.run(api, host="0.0.0.0", port=port, log_level="info")
