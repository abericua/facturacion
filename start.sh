#!/bin/bash
# Reemplazar el puerto 80 por el puerto asignado por Railway en nginx.conf
sed -i "s/listen 80;/listen ${PORT:-80};/g" /etc/nginx/conf.d/default.conf

# Iniciar nginx
nginx -g "daemon off;" &

# Iniciar Streamlit (incluye FastAPI en thread)
streamlit run app.py \
    --server.port 8501 \
    --server.address 0.0.0.0 \
    --server.headless true
