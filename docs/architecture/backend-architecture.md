# Backend Architecture (Node.js + NestJS)

## High-Level Components

1. **API Gateway (NestJS)**
   - AuthN/AuthZ
   - Input validation
   - Routing, throttling, API docs
2. **Core Modules**
   - User/Profile module
   - Doctor verification module
   - Opinion request module
   - Consultation module
   - Payment/subscription module
   - Notification module
   - CMS/admin module
3. **AI/OCR Pipeline**
   - OCR extractor (document parsers)
   - LLM summarizer/translator
   - Symptom entity extraction
   - Specialist recommendation engine
4. **Realtime Layer**
   - WebSocket gateway for chat and call signaling
5. **Storage & Data**
   - PostgreSQL (transactional source of truth)
   - Redis (cache, queues, pub/sub)
   - S3/Cloudinary (documents and generated files)

## Module Boundaries

- Keep PHI handling centralized in record and case modules.
- AI jobs read from sanitized payloads and output structured JSON.
- Payment module isolated with idempotent webhook handlers.
- Admin module reads via analytics views; writes via explicit commands.

## Deployment Topology

- **App tier**: multiple NestJS instances behind load balancer.
- **Workers**: separate queue consumers for:
  - AI jobs
  - OCR extraction
  - Notification dispatch
- **Observability**:
  - OpenTelemetry traces
  - structured logs (PII redaction)
  - dashboards + alerting (latency, queue lag, webhook errors)

## Compliance and Governance

- HIPAA:
  - encrypted at rest/in transit
  - access logs + least privilege
- GDPR:
  - data export/delete workflows
  - consent records and region-aware storage
- RBAC:
  - policy layer at controller + data filter levels

## Suggested Monorepo Layout

```text
apps/
  api/
  worker-ai/
  worker-notifications/
packages/
  shared-types/
  validation/
  observability/
```
