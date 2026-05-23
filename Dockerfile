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
    && rm -rf /var/lib/apt/lists/*

# Instalar Caddy
RUN curl -sL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /usr/bin/caddy && chmod +x /usr/bin/caddy

# Copiar archivos de dependencias e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código del proyecto
COPY . .

# Copiar configuración de Caddy
COPY Caddyfile /app/Caddyfile

# Copiar start.sh y darle permisos
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Crear directorio de datos persistente
RUN mkdir -p /data

# Exponer el puerto que usará Caddy
EXPOSE 80

# Comando para ejecutar la aplicación usando start.sh
CMD ["/start.sh"]
