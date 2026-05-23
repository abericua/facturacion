FROM python:3.10-slim-bookworm

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
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código del proyecto
COPY . .

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar start.sh y darle permisos
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Crear directorio de datos persistente
RUN mkdir -p /data

# Exponer el puerto que usará Nginx
EXPOSE 80

# Comando para ejecutar la aplicación usando start.sh
CMD ["/start.sh"]
