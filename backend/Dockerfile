# ---------- build stage ----------
FROM python:3.12-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files first for caching
COPY pyproject.toml uv.lock ./

# Install dependencies (no editable install yet)
RUN uv sync --frozen --no-install-project --prerelease=allow

# Copy source
COPY app/ app/

# Install project itself
RUN uv sync --frozen --prerelease=allow

# ---------- runtime stage ----------
FROM python:3.12-slim

# System deps for OpenCV headless
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy virtual environment and source from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/app /app/app
COPY --from=builder /app/pyproject.toml /app/pyproject.toml

# Data volume (SQLite DB, face embeddings, etc.)
RUN mkdir -p /app/data
VOLUME /app/data

# Use the venv python
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
