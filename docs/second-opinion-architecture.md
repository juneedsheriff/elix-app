# Second Opinion Doctor - Production Architecture

## 1) System Overview

Second Opinion Doctor is a global, multi-tenant telehealth platform with three primary personas:

- **Patients**: upload records, request second opinions, pay, chat, video consult.
- **Doctors**: complete KYC, review cases, deliver opinions, prescribe, manage slots.
- **Admins**: verify doctors, monitor fraud, handle disputes, manage CMS and analytics.

Primary stack:

- **Mobile client**: React Native + TypeScript (UI blueprint delivered in this repository using web-compatible TS React patterns for portability).
- **Admin web**: React + TypeScript dashboard.
- **Backend**: NestJS modular monolith (ready for service extraction).
- **DB**: PostgreSQL.
- **Cache & jobs**: Redis + BullMQ.
- **Storage**: AWS S3 with KMS encryption.
- **Realtime**: WebSocket gateway for chat/consult status.
- **Video**: Agora or Twilio SDK integration.
- **Auth**: Firebase/Auth0 with JWT + refresh tokens.

---

## 2) Database Schema (PostgreSQL)

```sql
create extension if not exists "uuid-ossp";

create type user_role as enum ('patient', 'doctor', 'admin');
create type case_urgency as enum ('urgent', 'non_urgent');
create type case_status as enum ('draft', 'submitted', 'assigned', 'in_review', 'completed', 'closed');
create type doctor_verification_status as enum ('pending', 'in_review', 'approved', 'rejected', 'suspended');
create type payment_status as enum ('created', 'authorized', 'captured', 'failed', 'refunded');
create type consult_mode as enum ('written', 'audio', 'video');
create type notification_channel as enum ('push', 'sms', 'email', 'in_app');

create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  phone text,
  role user_role not null,
  password_hash text,
  oauth_provider text,
  oauth_subject text,
  is_email_verified boolean default false,
  is_phone_verified boolean default false,
  two_factor_enabled boolean default false,
  locale text default 'en',
  timezone text default 'UTC',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table patient_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  full_name text not null,
  age int check (age > 0),
  gender text,
  country_code text,
  blood_group text,
  medical_history jsonb default '[]'::jsonb,
  allergies jsonb default '[]'::jsonb,
  current_medications jsonb default '[]'::jsonb,
  emergency_contact jsonb default '{}'::jsonb,
  insurance_details jsonb default '{}'::jsonb,
  family_account_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table doctor_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  full_name text not null,
  specialization text not null,
  sub_specializations jsonb default '[]'::jsonb,
  years_experience int default 0,
  hospital_affiliation text,
  languages jsonb default '[]'::jsonb,
  consultation_fee_minor int not null,
  currency text not null default 'USD',
  verification_status doctor_verification_status default 'pending',
  rating numeric(3,2) default 0,
  total_reviews int default 0,
  success_metrics jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table doctor_credentials (
  id uuid primary key default uuid_generate_v4(),
  doctor_user_id uuid not null references doctor_profiles(user_id) on delete cascade,
  credential_type text not null, -- medical_license, degree, kyc_document
  document_url text not null,
  issuing_country text,
  verification_notes text,
  created_at timestamptz default now()
);

create table medical_records (
  id uuid primary key default uuid_generate_v4(),
  patient_user_id uuid not null references patient_profiles(user_id) on delete cascade,
  file_url text not null,
  file_type text not null, -- pdf,image,mri,xray,lab,voice
  mime_type text not null,
  checksum_sha256 text not null,
  size_bytes bigint not null,
  encrypted_key_ref text not null,
  ocr_status text default 'pending',
  ai_summary text,
  extracted_entities jsonb default '{}'::jsonb,
  source_language text,
  translated_language text,
  created_at timestamptz default now()
);

create table second_opinion_cases (
  id uuid primary key default uuid_generate_v4(),
  patient_user_id uuid not null references patient_profiles(user_id) on delete cascade,
  specialty text not null,
  preferred_doctor_user_id uuid references doctor_profiles(user_id),
  urgency case_urgency not null,
  consult_mode consult_mode not null default 'written',
  status case_status not null default 'draft',
  symptoms text not null,
  questions text not null,
  ai_triage jsonb default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table case_records (
  case_id uuid not null references second_opinion_cases(id) on delete cascade,
  medical_record_id uuid not null references medical_records(id) on delete cascade,
  primary key (case_id, medical_record_id)
);

create table doctor_assignments (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references second_opinion_cases(id) on delete cascade,
  doctor_user_id uuid not null references doctor_profiles(user_id),
  status text not null default 'pending', -- pending/accepted/rejected/completed
  priority_score numeric(5,2),
  assigned_at timestamptz default now(),
  responded_at timestamptz
);

create table opinions (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references second_opinion_cases(id) on delete cascade,
  doctor_user_id uuid not null references doctor_profiles(user_id),
  opinion_text text not null,
  recommendations jsonb default '[]'::jsonb,
  prescription_url text,
  follow_up_required boolean default false,
  created_at timestamptz default now()
);

create table consultations (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references second_opinion_cases(id) on delete cascade,
  doctor_user_id uuid not null references doctor_profiles(user_id),
  patient_user_id uuid not null references patient_profiles(user_id),
  mode consult_mode not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  provider_session_id text,
  recording_url text,
  status text not null default 'scheduled',
  created_at timestamptz default now()
);

create table chat_threads (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references second_opinion_cases(id) on delete cascade,
  created_at timestamptz default now()
);

create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  sender_user_id uuid not null references users(id),
  message_type text not null default 'text', -- text/file/voice/prescription
  message_body text,
  attachment_url text,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references second_opinion_cases(id),
  patient_user_id uuid not null references patient_profiles(user_id),
  provider text not null, -- stripe|razorpay
  provider_payment_id text,
  amount_minor int not null,
  currency text not null,
  status payment_status not null default 'created',
  coupon_code text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  patient_user_id uuid not null references patient_profiles(user_id),
  plan_code text not null,
  provider text not null,
  provider_subscription_id text not null,
  status text not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  channel notification_channel not null,
  title text not null,
  body text not null,
  metadata jsonb default '{}'::jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

create index idx_cases_patient on second_opinion_cases(patient_user_id);
create index idx_cases_status on second_opinion_cases(status);
create index idx_records_patient on medical_records(patient_user_id);
create index idx_messages_thread on chat_messages(thread_id, created_at);
create index idx_audit_created on audit_logs(created_at);
```

---

## 3) API Architecture (NestJS)

### Core modules

- `AuthModule`: email/password, OTP, Google, Apple, refresh token, 2FA.
- `UsersModule`: profile management for patient/doctor/admin.
- `DoctorVerificationModule`: KYC, credentials upload, admin approvals.
- `RecordsModule`: secure upload URLs, OCR status, AI summaries.
- `CasesModule`: create/manage second opinion requests.
- `MatchingModule`: doctor recommendation and prioritization.
- `ConsultationsModule`: scheduling + video session orchestration.
- `ChatModule`: realtime secure messaging.
- `PaymentsModule`: Stripe + Razorpay checkout and webhooks.
- `SubscriptionsModule`: recurring plans and entitlement checks.
- `NotificationsModule`: push/SMS/email queue dispatch.
- `CmsModule`: blogs, FAQs, terms/privacy pages.
- `AnalyticsModule`: cohort and KPI projections.
- `AuditModule`: immutable compliance event ledger.
- `AdminModule`: moderation, disputes, fraud workflows.

### API surface (representative)

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/oauth/google`
- `POST /v1/auth/oauth/apple`
- `POST /v1/auth/otp/send`, `POST /v1/auth/otp/verify`
- `POST /v1/records/upload-url`
- `POST /v1/records`
- `POST /v1/cases`
- `POST /v1/cases/:id/submit`
- `POST /v1/cases/:id/assign`
- `POST /v1/opinions`
- `POST /v1/consultations`
- `POST /v1/chat/:threadId/messages`
- `POST /v1/payments/checkout`
- `POST /v1/payments/webhooks/stripe`
- `POST /v1/payments/webhooks/razorpay`
- `GET /v1/admin/analytics/overview`

---

## 4) Backend Runtime Architecture

- **Gateway layer**: API gateway + WAF + rate-limits.
- **Application layer**: NestJS app pods (autoscaled).
- **Worker layer**: BullMQ workers for OCR/AI/notification/payment reconciliation.
- **Data layer**: PostgreSQL primary + read replicas, Redis cache.
- **Storage layer**: S3 buckets with object lock and lifecycle policies.
- **Observability**: OpenTelemetry traces, structured logs, Prometheus metrics, alerting.

---

## 5) Authentication & Authorization Flow

1. User signs up via email/password, Google, or Apple.
2. OTP verifies email/phone for high-trust flows.
3. Auth provider returns identity token -> backend exchanges for platform JWT + refresh token.
4. Optional 2FA challenge enforced for sensitive actions.
5. RBAC + ABAC policies check access to case, records, admin controls.
6. Session and device events logged in `audit_logs`.

Token strategy:

- Access token: short-lived (15 min), signed JWT.
- Refresh token: rotating with revocation list in Redis.
- Step-up token: required for payments, data export, or admin suspension actions.

---

## 6) AI Integration Architecture

### Pipeline

1. **Ingestion**: uploaded docs trigger object-created event.
2. **OCR extraction**: text + key-value extraction per file type.
3. **Normalization**: map entities to clinical dictionary and timelines.
4. **LLM summarization**: concise case summary + risk flags + missing data prompts.
5. **Symptom extraction**: structured symptom graph.
6. **Specialist recommendation**: ranking model combines specialty fit, outcomes, language, timezone.
7. **Translation**: report and summary translation for patient + doctor locale.
8. **Human-in-loop**: confidence thresholds route to review queue.

### Safety controls

- Prompt hardening with medical policy templates.
- Hallucination checks against extracted source passages.
- Confidence scoring and mandatory disclaimers.
- Full AI action auditability with model/version metadata.

---

## 7) Security & Compliance Controls

- **HIPAA**: encrypted PHI at rest/in transit, access logs, minimum necessary access.
- **GDPR**: data export/delete workflows, purpose limitation, consent logs.
- **Encryption**: TLS 1.3, KMS-managed envelope encryption.
- **RBAC**: strict role boundaries and scoped resource access.
- **Audit trails**: immutable admin/doctor/patient actions.
- **DLP**: document scanning, malware checks, signed URL expiry.
- **Breach readiness**: anomaly detection + incident response playbooks.

---

## 8) User Flows (End-to-End)

### Patient flow

1. Onboarding -> Auth -> OTP.
2. Profile completion (history/allergies/medications).
3. Record upload + AI summary generation.
4. Specialist selection + doctor choice + urgency.
5. Payment + case submission.
6. Doctor opinion + chat/video follow-up.
7. Prescription + timeline updates + subscription upsell.

### Doctor flow

1. KYC + license + credential upload.
2. Admin verification.
3. Receive prioritized requests.
4. Accept/reject, review records, annotate files.
5. Publish written opinion, optional consult, prescription.
6. Track outcomes and earnings.

### Admin flow

1. Verify doctors and monitor risk.
2. Resolve disputes and moderate content.
3. Observe revenue, satisfaction, and AI quality KPIs.
4. Manage CMS and policy updates.

---

## 9) Deployment Blueprint

- Infrastructure as Code: Terraform.
- CI/CD: GitHub Actions with SAST, tests, container scans.
- Environment tiers: dev/stage/prod with isolated secrets.
- Multi-region strategy for low-latency consults and resiliency.
- Feature flags for phased rollout of AI modules and new markets.
