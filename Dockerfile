# --- Stage 1: build the PWA ---
FROM node:22-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
# Vite inlines VITE_* at build time, so the Google client id must be present now (not at
# runtime). Pass it in: `fly deploy --build-arg VITE_GOOGLE_CLIENT_ID=<id>`. Empty -> the
# built app shows "sign-in isn't configured".
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# --- Stage 2: python runtime serving API + built PWA ---
FROM python:3.12-slim
WORKDIR /app

# Install runtime deps + the app package straight from pyproject, so the image always
# matches the declared dependencies (no hardcoded list to keep in sync).
COPY pyproject.toml ./
COPY app/ ./app/
RUN pip install --no-cache-dir .

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
