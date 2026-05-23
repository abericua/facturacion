#!/bin/bash

# Iniciar Streamlit (incluye FastAPI en thread) en segundo plano
streamlit run app.py \
    --server.port 8501 \
    --server.address 0.0.0.0 \
    --server.headless true &

# Esperar a que Streamlit esté listo (evita que Railway lea un 502 temporal de Caddy)
while ! curl -s http://localhost:8501 > /dev/null; do
    sleep 2
done

# Iniciar Caddy en primer plano (escucha en $PORT)
caddy run --config /app/Caddyfile
