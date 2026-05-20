# API Architecture - Second Opinion Doctor

## 1. API Style

- **Primary**: REST (NestJS controllers) with OpenAPI docs.
- **Realtime**: WebSocket gateway for consultation chat/status.
- **Async**: Event-driven jobs through Redis queues (BullMQ).

## 2. Service Domains

1. **Identity Service**
   - `/auth/register`, `/auth/login`, `/auth/social/google`, `/auth/social/apple`
   - `/auth/otp/send`, `/auth/otp/verify`, `/auth/forgot-password`
2. **Patient Service**
   - `/patients/profile`, `/patients/family-members`
   - `/patients/records` (presigned upload + metadata)
3. **Doctor Service**
   - `/doctors/onboarding`, `/doctors/:id`, `/doctors/:id/availability`
   - `/doctors/:id/verification`
4. **Case Service**
   - `/opinion-requests`
   - `/opinion-requests/:id/attachments`
   - `/opinion-requests/:id/assign-doctor`
5. **Consultation Service**
   - `/consultations`, `/consultations/:id/join-token`
   - `/consultations/:id/messages`
   - `/consultations/:id/prescriptions`
6. **Payments Service**
   - `/payments/intent`, `/payments/webhooks/stripe`, `/payments/webhooks/razorpay`
   - `/subscriptions/plans`, `/subscriptions/activate`
7. **AI Service**
   - `/ai/summary`, `/ai/timeline`, `/ai/symptoms`, `/ai/translate`
   - `/ai/recommend-specialist`
8. **Admin Service**
   - `/admin/metrics`, `/admin/users`, `/admin/doctors/verify`
   - `/admin/disputes`, `/admin/audit-logs`, `/admin/cms/*`

## 3. Common API Standards

- JWT bearer token + refresh token rotation.
- Role/permission guards:
  - `patient:*`, `doctor:*`, `admin:*`.
- Request id header (`x-request-id`) for traceability.
- Rate limiting:
  - auth routes: strict (IP + user).
  - read APIs: medium.
  - upload + AI APIs: token bucket.
- Consistent response envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

## 4. Security Controls

- Signed URLs for uploads/downloads.
- Field-level encryption for sensitive medical text.
- Audit events for PHI access.
- Webhook signatures validated for Stripe/Razorpay.
- Consent checks before doctor access to patient records.

## 5. Versioning

- URI versioning: `/v1/...`
- Backward-compatible additions only within same major version.
