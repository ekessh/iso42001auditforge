# auditforge-vlm-py

Python sidecar for **Qwen2.5-VL** and **DeepSeek-OCR** schema-constrained
evidence extraction (model cards, datasheets, fairness reports, incident logs).

This is a Phase 7.6 *scaffold*. The wire shape, OpenAPI contract, and uvicorn
boot sequence are real; the VLM is a stub returning canned shapes per
`schemaId`. Replace with Qwen-VL / DeepSeek-OCR calls when the deployment
story is in place.

## Run (dev)

```bash
uv sync --extra dev
uv run uvicorn services.vlm_py.app:app --reload
```

## Endpoints

- `GET /healthz` — liveness probe.
- `POST /extract` — JSON `{ schemaId, image_b64, engagementId? }`,
  returns `{ value, confidence, sourceRegions, modelName, modelHash }`.

## Upgrade path to real VLMs

1. `uv sync --extra qwen` (or `deepseek`).
2. Implement `_qwen_extract(image: bytes, schema_id: str) -> dict[str, Any]`
   using `transformers.AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct")`
   with a JSON-schema constrained decoding pass.
3. Wire schema definitions to a JSON-schema generator that mirrors
   `@auditforge/vlm-extraction`'s zod schemas.
4. Surface model checkpoints + license keys via env vars handled by
   `pydantic-settings` `Settings`.

## Docker

```bash
docker build -t auditforge/vlm-py services/vlm-py
docker run --rm -p 8083:8083 auditforge/vlm-py
```
