#!/bin/bash
# Iniciar Caddy en segundo plano
caddy run --config /app/Caddyfile &

# Iniciar Streamlit (incluye FastAPI en thread)
streamlit run app.py \
    --server.port 8501 \
    --server.address 0.0.0.0 \
    --server.headless true
