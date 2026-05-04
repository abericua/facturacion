FROM python:3.10-slim

# Evitar que Python genere archivos .pyc y habilitar logs en tiempo real
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

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

# Exponer el puerto que usará Streamlit
EXPOSE 8501

# Comando para ejecutar la aplicación usando la variable de entorno PORT de Railway
CMD streamlit run app.py --server.port $PORT --server.address 0.0.0.0
