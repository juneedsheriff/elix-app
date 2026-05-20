# Supabase setup

## Quick fix: tables not created

### Option 1 — SQL Editor (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Click **New query**
3. Copy the entire file [`schema.sql`](./schema.sql) and paste it
4. Click **Run** (you should see “Success”)
5. In the app folder terminal:

```bash
npm run db:seed
npm run db:seed-records
```

6. Restart the dev server: `npm run dev`

### Option 2 — CLI script

Add to `.env.server.local` (see `.env.server.example`):

- `POSTGRES_URL_NON_POOLING` — Database → Connection string → URI (port **5432**)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then:

```bash
npm run db:setup
```

## Tables created

| Table | Purpose |
|-------|---------|
| `doctors` | Specialist directory |
| `patients` | Patient profiles (linked to Auth) |
| `uploaded_files` | Uploaded file metadata (name, size, Storage path) |
| `medical_records` | Legacy table — migrate with `004_uploaded_files.sql` |
| `opinion_requests` | Second opinion requests — run `006_doctor_opinion_access.sql` (doctor read) and `009_opinion_doctor_response.sql` (respond to patient) |
| `opinion_request_records` | Records linked to a request |

Storage bucket: `medical-records` (PDF, JPG, DOC uploads)

Demo rows from `npm run db:seed-records` are metadata only until you run:

```bash
npm run db:assign-records    # optional: attach null user_id rows to a patient
npm run db:upload-record-files   # upload PDF/JPEG blobs under the patient's auth folder
```

## Verify in Dashboard

**Table Editor** should list `doctors`, `patients`, `uploaded_files`, `opinion_requests`, `opinion_request_records`.

**Storage** should show bucket `medical-records`.
