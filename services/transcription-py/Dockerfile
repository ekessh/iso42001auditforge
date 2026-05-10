# SPDX-License-Identifier: BUSL-1.1
FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir uv
COPY pyproject.toml ./
COPY services ./services
RUN uv pip install --system -e .[dev]
EXPOSE 8082
CMD ["uvicorn", "services.transcription_py.app:app", "--host", "0.0.0.0", "--port", "8082"]
