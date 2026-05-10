# SPDX-License-Identifier: BUSL-1.1
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_LINK_MODE=copy

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && mv /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /build
COPY pyproject.toml README.md ./
COPY services ./services

RUN uv venv /opt/venv \
    && uv pip install --python /opt/venv/bin/python --no-cache .

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

RUN groupadd --system audit && useradd --system --gid audit --home /app audit \
    && mkdir -p /tmp/auditforge-checks \
    && chown -R audit:audit /tmp/auditforge-checks

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /build/services /app/services

USER audit

EXPOSE 8088

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8088/healthz', timeout=3).status == 200 else 1)" || exit 1

CMD ["uvicorn", "services.audit_evidence_runner.main:app", "--host", "0.0.0.0", "--port", "8088"]
