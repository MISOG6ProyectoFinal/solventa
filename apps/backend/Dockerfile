# Imagen única para todos los microservicios. Se construye desde apps/backend:
#   docker build --build-arg SERVICE=cotizacion_rating -t solventa/cotizacion-rating .
# El mismo Dockerfile sirve para la API y para los workers; el Deployment elige el comando.
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

ARG SERVICE
RUN test -n "$SERVICE" || (echo "Falta --build-arg SERVICE" && exit 1)

WORKDIR /app
COPY libs/solventa_common /src/libs/solventa_common
COPY services/${SERVICE} /src/services/${SERVICE}
RUN pip install /src/libs/solventa_common /src/services/${SERVICE} \
    && rm -rf /src

RUN useradd --uid 10001 --no-create-home solventa
USER 10001

ENV SERVICE=${SERVICE}
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn ${SERVICE}.entrypoints.api:app --host 0.0.0.0 --port 8000 --no-access-log"]
