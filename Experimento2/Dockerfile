FROM python:3.10-slim

WORKDIR /code

# Instalar dependencias del sistema para PostgreSQL (libpq)
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ /code/app/

# Asegurar que los módulos internos se encuentren
ENV PYTHONPATH=/code/app
