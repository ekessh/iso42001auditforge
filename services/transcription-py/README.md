# auditforge-transcription-py

Python sidecar for **WhisperX** transcription and **Pyannote 3.1** speaker diarization.

This is a Phase 7.6 *scaffold*. The wire shape, OpenAPI contract, and uvicorn
boot sequence are real; the transcription/diarization implementations are stubs
that return canned segments. Replace with WhisperX / Pyannote calls when the
deployment story is in place.

## Run (dev)

```bash
uv sync --extra dev
uv run uvicorn services.transcription_py.app:app --reload
```

## Endpoints

- `GET /healthz` — liveness probe.
- `POST /transcribe` — accepts an audio body (`audio/webm`, `audio/wav`, etc.)
  and returns `{ "segments": [...] }` matching the
  `@auditforge/transcription` `TranscriptSegmentSchema`.
- `POST /diarize` — accepts JSON `{ audio_b64?, segments?, num_speakers? }`
  and returns `{ "segments": [...] }` matching
  `@auditforge/diarization` `SpeakerSegmentSchema`.

## Upgrade path to real WhisperX

1. `uv sync --extra whisperx --extra pyannote`.
2. Replace `_stub_transcribe` with `whisperx.load_model(...)` + alignment.
3. Replace `_stub_diarize` with `pyannote.audio.Pipeline.from_pretrained(...)`.
4. Surface model checkpoints + license keys via env vars handled by
   `pydantic-settings` `Settings`.

## Docker

```bash
docker build -t auditforge/transcription-py services/transcription-py
docker run --rm -p 8082:8082 auditforge/transcription-py
```
