import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from streamlit.web.bootstrap import run as st_run

# ── DB ──────────────────────────────────────────────────────────────────────
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

# ── Mount Streamlit ───────────────────────────────────────────────────────────
try:
    from streamlit.web.server.server import Server as StServer
    from streamlit.runtime.scriptrunner import get_script_run_ctx
    # Streamlit >= 1.53 ASGI support
    from streamlit.starlette import App as StreamlitApp
    streamlit_app = StreamlitApp("app.py")
    api.mount("/", streamlit_app)
    USE_ASGI = True
except ImportError:
    USE_ASGI = False

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8501))
    uvicorn.run(api, host="0.0.0.0", port=port,
                log_level="info")
