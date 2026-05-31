FROM python:3.10-slim-bookworm

# Evitar que Python genere archivos .pyc y habilitar logs en tiempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código del proyecto
COPY . .

# Exponer el puerto 8501
EXPOSE 8501

# Comando dinámico inteligente según el servicio de Railway
CMD ["sh", "-c", "if [ \"$RAILWAY_SERVICE_NAME\" = \"SOLPRO-MASTER-TEC\" ]; then uvicorn api:app --host 0.0.0.0 --port ${PORT:-8080}; else streamlit run app.py --server.port ${PORT:-8501} --server.address 0.0.0.0 --server.headless true --server.enableCORS false --server.enableXsrfProtection false; fi"]

