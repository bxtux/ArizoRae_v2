FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

RUN playwright install chromium --with-deps

COPY . .

# Default: worker mode. Override CMD for beat.
CMD ["celery", "-A", "app.celery_app:celery_app", "worker", "--loglevel=info", "-Q", "default,scrapers"]
