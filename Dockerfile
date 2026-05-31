# --- Stage 1: build the PWA ---
FROM node:22-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Stage 2: python runtime serving API + built PWA ---
FROM python:3.12-slim
WORKDIR /app

# Install deps from pyproject (no dev extras).
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "python-multipart>=0.0.9" \
    "openai>=1.40" "sqlmodel>=0.0.22" "pydantic-settings>=2.4" \
    "pillow>=10.4" "pillow-heif>=0.18"

COPY app/ ./app/
COPY --from=web /web/dist ./web/dist

# Single-service mode: serve the built PWA from FastAPI.
ENV SERVE_STATIC=true \
    STATIC_DIR=web/dist \
    DB_PATH=/data/app.db \
    PHOTOS_DIR=/data/photos

# /data is a mounted volume so SQLite + photos survive restarts/redeploys.
VOLUME ["/data"]
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
