-- Second Opinion Doctor: PostgreSQL schema (v1)
-- Supports patient, doctor, admin, consultations, documents, payments, AI pipelines, and audit.

create extension if not exists "uuid-ossp";

create table users (
  id uuid primary key default uuid_generate_v4(),
  role varchar(20) not null check (role in ('patient', 'doctor', 'admin')),
  email varchar(255) unique not null,
  phone varchar(30),
  password_hash text,
  firebase_uid varchar(128) unique,
  auth0_sub varchar(128) unique,
  is_email_verified boolean not null default false,
  is_2fa_enabled boolean not null default false,
  status varchar(20) not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table patient_profiles (
  user_id uuid primary key references users(id),
  full_name varchar(140) not null,
  age int,
  gender varchar(30),
  country_code varchar(10),
  blood_group varchar(5),
  medical_history text,
  allergies text,
  current_medications text,
  insurance_provider varchar(140),
  emergency_contact jsonb default '{}'::jsonb
);

create table doctor_profiles (
  user_id uuid primary key references users(id),
  full_name varchar(140) not null,
  specialization varchar(140) not null,
  years_experience int not null default 0,
  hospital_affiliation varchar(200),
  license_number varchar(120),
  consultation_fee numeric(10,2) not null default 0,
  languages text[] default '{}',
  rating numeric(3,2) default 0,
  total_reviews int default 0,
  timezone varchar(80) default 'UTC',
  verification_status varchar(20) not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected'))
);

create table doctor_documents (
  id uuid primary key default uuid_generate_v4(),
  doctor_id uuid not null references users(id),
  doc_type varchar(40) not null,
  storage_key text not null,
  uploaded_at timestamptz not null default now(),
  verification_note text
);

create table medical_records (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references users(id),
  file_name varchar(255) not null,
  file_type varchar(50) not null,
  storage_provider varchar(30) not null check (storage_provider in ('s3', 'cloudinary')),
  storage_key text not null,
  encrypted_checksum text not null,
  ocr_text text,
  uploaded_at timestamptz not null default now()
);

create table opinion_requests (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references users(id),
  assigned_doctor_id uuid references users(id),
  specialty varchar(100) not null,
  urgency varchar(20) not null check (urgency in ('urgent', 'non_urgent')),
  symptoms text,
  patient_questions text,
  status varchar(30) not null default 'submitted' check (status in ('submitted', 'assigned', 'in_review', 'consultation_scheduled', 'closed')),
  preferred_language varchar(20) default 'en',
  video_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table request_attachments (
  request_id uuid not null references opinion_requests(id),
  record_id uuid not null references medical_records(id),
  primary key (request_id, record_id)
);

create table consultations (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references opinion_requests(id),
  doctor_id uuid not null references users(id),
  patient_id uuid not null references users(id),
  mode varchar(20) not null check (mode in ('chat', 'audio', 'video')),
  starts_at timestamptz,
  ends_at timestamptz,
  meeting_provider varchar(20) check (meeting_provider in ('agora', 'twilio')),
  meeting_room_id varchar(120),
  status varchar(20) not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled'))
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid not null references consultations(id),
  sender_id uuid not null references users(id),
  message_type varchar(20) not null default 'text' check (message_type in ('text', 'file', 'voice', 'system')),
  body text,
  attachment_key text,
  created_at timestamptz not null default now()
);

create table prescriptions (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid not null references consultations(id),
  doctor_id uuid not null references users(id),
  patient_id uuid not null references users(id),
  prescription_file_key text,
  notes text,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references users(id),
  request_id uuid references opinion_requests(id),
  provider varchar(20) not null check (provider in ('stripe', 'razorpay')),
  provider_payment_id varchar(120) not null,
  amount numeric(10,2) not null,
  currency varchar(10) not null,
  status varchar(20) not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at timestamptz
);

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references users(id),
  plan_code varchar(50) not null,
  provider varchar(20) not null check (provider in ('stripe', 'razorpay')),
  status varchar(20) not null check (status in ('active', 'paused', 'cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz
);

create table ai_jobs (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references users(id),
  request_id uuid references opinion_requests(id),
  job_type varchar(40) not null check (job_type in ('summary', 'timeline', 'symptom_extraction', 'translation', 'doctor_recommendation')),
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb,
  status varchar(20) not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table audit_logs (
  id bigserial primary key,
  actor_user_id uuid references users(id),
  actor_role varchar(20),
  action varchar(120) not null,
  target_entity varchar(60),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_users_role on users(role);
create index idx_medical_records_patient on medical_records(patient_id);
create index idx_requests_patient_status on opinion_requests(patient_id, status);
create index idx_requests_doctor on opinion_requests(assigned_doctor_id);
create index idx_consultations_request on consultations(request_id);
create index idx_messages_consultation_created_at on messages(consultation_id, created_at);
create index idx_payments_patient_status on payments(patient_id, status);
create index idx_ai_jobs_patient on ai_jobs(patient_id);
create index idx_audit_logs_actor_created_at on audit_logs(actor_user_id, created_at);
