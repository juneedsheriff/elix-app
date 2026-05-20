# AI Integration Architecture

## AI Capabilities

1. Medical record summarization
2. Case timeline generation
3. Symptom extraction
4. Multi-language translation
5. Specialist recommendation
6. AI health assistant chatbot

## Processing Pipeline

1. Upload completed to object storage.
2. OCR service extracts structured text from scans/PDF/images.
3. PHI scrubber classifies and masks fields where required.
4. LLM orchestration executes task-specific prompts:
   - summary prompt
   - timeline prompt
   - symptoms extraction schema prompt
   - translation prompt
5. Results validated against JSON schemas.
6. Persist output in `ai_jobs.output_payload`.
7. Push updates to UI via WebSocket notifications.

## Model and Prompt Strategy

- Dedicated prompt templates per workflow.
- Medical safety layer:
  - confidence scoring
  - "not medical advice" disclaimer controls
  - escalation flags to human doctors
- Language support via translation + locale post-processing.

## Risk Controls

- Do not auto-diagnose; provide clinical context only.
- Human-in-the-loop checkpoints for high-risk findings.
- Prompt/response logs with PHI redaction for auditing.
- Retry with fallback model when primary model times out.

## Integration Endpoints

- `POST /v1/ai/summary`
- `POST /v1/ai/timeline`
- `POST /v1/ai/symptoms`
- `POST /v1/ai/translate`
- `POST /v1/ai/recommend-specialist`
- `POST /v1/ai/chat`
