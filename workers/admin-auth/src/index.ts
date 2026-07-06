import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGIN?: string;
  ALLOW_EMAILLESS_PATIENT_SIGNUP?: string;
  RESEND_API_KEY?: string;
  SMTP_ADMIN_EMAIL?: string;
  SMTP_SENDER_NAME?: string;
};

type Role = 'doctor' | 'patient';
type RequestLifecycleEvent =
  | 'patient_request_submitted'
  | 'request_assigned_to_pse'
  | 'request_released_to_doctor';

type ManageBody = {
  role: Role;
  profileId: string;
  action: 'enable' | 'disable' | 'set_password';
  password?: string;
};

type RequestLifecycleNotifyBody = {
  event: RequestLifecycleEvent;
  requestId: string;
};

type EnableLoginOptions = {
  forcePasswordChange?: boolean;
};

const BAN_DURATION = '876000h';

const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateTemporaryPassword(length = 8): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return output;
}

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = env.ALLOWED_ORIGIN?.trim();
  let value = '*';

  if (origin) {
    // Always echo localhost so Vite (http://localhost:3000) works while ALLOWED_ORIGIN is production.
    if (isLocalDevOrigin(origin) || isAllowedAppOrigin(origin, env) || !allowed || allowed === '*' || origin === allowed) {
      value = origin;
    }
  } else if (allowed && allowed !== '*') {
    value = allowed;
  }

  return {
    'Access-Control-Allow-Origin': value,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function isAllowedAppOrigin(origin: string, env: Env): boolean {
  const allowed = env.ALLOWED_ORIGIN?.trim();
  if (!allowed || allowed === '*') return false;
  if (origin === allowed) return true;
  return false;
}

function json(body: unknown, status: number, origin: string | null, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) }
  });
}

function serviceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function userClient(env: Env, accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

async function getUserIdFromToken(token: string, env: Env): Promise<string | null> {
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY }
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}

async function verifyStaffAuthUserId(request: Request, env: Env): Promise<{ userId: string; staffId: string } | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const userId = await getUserIdFromToken(token, env);
  if (!userId) return null;

  const { data, error } = await serviceClient(env)
    .from('admins')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data?.id) return null;
  return { userId, staffId: data.id as string };
}

type StaffCaller = {
  userId: string;
  staffId: string;
  role: string;
  clinicId: string | null;
};

async function verifyStaffCaller(request: Request, env: Env): Promise<StaffCaller | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const userId = await getUserIdFromToken(token, env);
  if (!userId) return null;

  const { data, error } = await serviceClient(env)
    .from('admins')
    .select('id, role, clinic_id')
    .eq('auth_user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data?.id) return null;
  return {
    userId,
    staffId: data.id as string,
    role: String(data.role ?? ''),
    clinicId: (data.clinic_id as string | null | undefined) ?? null
  };
}

async function verifyAdmin(request: Request, env: Env): Promise<string | null> {
  const caller = await verifyStaffCaller(request, env);
  return caller?.userId ?? null;
}

async function verifyAdministrator(request: Request, env: Env): Promise<string | null> {
  const caller = await verifyStaffCaller(request, env);
  if (!caller || caller.role !== 'administrator') return null;
  return caller.userId;
}

type StaffRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

type CreateStaffBody = {
  full_name: string;
  email: string;
  password?: string;
  role?: 'administrator' | 'patient_service_executive' | 'patient_service_executive_clinic';
  clinic_name?: string;
  clinic_id?: string;
};

type ManageStaffBody = {
  staffId: string;
  action: 'activate' | 'deactivate' | 'set_password' | 'update';
  password?: string;
  full_name?: string;
  email?: string;
  clinic_id?: string;
  clinic_name?: string;
};

async function loadStaffMember(staffId: string, env: Env): Promise<StaffRow | null> {
  const { data, error } = await serviceClient(env)
    .from('admins')
    .select('id, auth_user_id, email, full_name, role, is_active, clinic_id')
    .eq('id', staffId)
    .maybeSingle();

  if (error || !data) return null;
  return data as StaffRow & { clinic_id?: string | null };
}

async function resolveClinicWorkspaceId(
  admin: SupabaseClient,
  input: { clinic_id?: string; clinic_name?: string }
): Promise<{ clinicId: string | null; error?: string }> {
  const clinicId = input.clinic_id?.trim();
  if (clinicId) {
    const { data, error } = await admin.from('pse_clinics').select('id').eq('id', clinicId).maybeSingle();
    if (error) return { clinicId: null, error: error.message };
    if (!data) return { clinicId: null, error: 'Clinic workspace not found.' };
    return { clinicId };
  }

  const clinicName = input.clinic_name?.trim() ?? '';
  if (!clinicName) {
    return { clinicId: null, error: 'Select a clinic workspace or enter a new clinic name.' };
  }

  const { data: existing, error: existingError } = await admin
    .from('pse_clinics')
    .select('id')
    .ilike('name', clinicName)
    .maybeSingle();

  if (existingError) return { clinicId: null, error: existingError.message };
  if (existing?.id) return { clinicId: existing.id as string };

  const { data, error } = await admin.from('pse_clinics').insert({ name: clinicName }).select('id').single();
  if (error) return { clinicId: null, error: error.message };
  return { clinicId: data.id as string };
}

async function resolveProfileAuthUserId(
  email: string,
  admin: SupabaseClient
): Promise<{ authUserId: string | null; fullName: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: doctor } = await admin
    .from('doctors')
    .select('auth_user_id, full_name')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (doctor?.auth_user_id) {
    return { authUserId: doctor.auth_user_id, fullName: doctor.full_name ?? null };
  }

  const { data: patient } = await admin
    .from('patients')
    .select('auth_user_id, full_name')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (patient?.auth_user_id) {
    return { authUserId: patient.auth_user_id, fullName: patient.full_name ?? null };
  }

  const authUserId = await findUserByEmail(normalizedEmail, admin);
  return { authUserId, fullName: null };
}

function resolveStaffRole(value: unknown): NonNullable<CreateStaffBody['role']> {
  if (value === 'administrator') return 'administrator';
  if (value === 'patient_service_executive_clinic') return 'patient_service_executive_clinic';
  return 'patient_service_executive';
}

function staffAuthMetadataRole(role: NonNullable<CreateStaffBody['role']>): string {
  if (role === 'administrator') return 'admin';
  if (role === 'patient_service_executive_clinic') return 'patient_service_executive_clinic';
  return 'patient_service_executive';
}

function staffRoleConflictMessage(existingRole: string, requestedRole: string): string | null {
  if (existingRole === requestedRole) {
    if (requestedRole === 'patient_service_executive_clinic') {
      return 'This email is already a clinic Patient Service Executive.';
    }
    if (requestedRole === 'patient_service_executive') {
      return 'This email is already a Patient Service Executive.';
    }
    return 'This email is already an administrator.';
  }

  if (
    existingRole === 'patient_service_executive' &&
    requestedRole === 'patient_service_executive_clinic'
  ) {
    return null;
  }

  return `This email belongs to a ${existingRole.replaceAll('_', ' ')} account.`;
}

async function createStaffMember(body: CreateStaffBody, env: Env) {
  const email = body.email.trim().toLowerCase();
  const fullName = body.full_name.trim();
  const password = body.password?.trim() ?? '';
  const role = resolveStaffRole(body.role);
  const clinicName = body.clinic_name?.trim() ?? '';
  const clinicIdInput = body.clinic_id?.trim() ?? '';

  if (!fullName) return { error: 'Full name is required.' };
  if (!email) return { error: 'Email is required.' };
  if (role === 'patient_service_executive_clinic' && !clinicIdInput && !clinicName) {
    return { error: 'Select a clinic workspace or enter a new clinic name.' };
  }

  const admin = serviceClient(env);
  const { data: existingRow } = await admin.from('admins').select('id, role, auth_user_id').ilike('email', email).maybeSingle();

  if (existingRow?.role) {
    const conflict = staffRoleConflictMessage(String(existingRow.role), role);
    if (conflict) return { error: conflict };
  }

  let authUserId = existingRow?.auth_user_id ?? null;

  if (!authUserId) {
    const profileAuth = await resolveProfileAuthUserId(email, admin);
    authUserId = profileAuth.authUserId;
  }

  if (!authUserId && password.length < 6) {
    return { error: 'Password is required when creating a new login (at least 6 characters).' };
  }

  const metadataRole = staffAuthMetadataRole(role);

  if (!authUserId) {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: metadataRole, full_name: fullName }
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already')) {
        authUserId = await findUserByEmail(email, admin);
        if (!authUserId) return { error: authError.message };
      } else {
        return { error: authError.message };
      }
    } else {
      authUserId = authData.user?.id ?? null;
    }
  }

  if (!authUserId) return { error: 'Could not resolve auth user id.' };

  const { data: existingAuthUser, error: existingAuthError } = await admin.auth.admin.getUserById(authUserId);
  if (existingAuthError) return { error: existingAuthError.message };

  const existingMetadata =
    existingAuthUser.user?.user_metadata && typeof existingAuthUser.user.user_metadata === 'object'
      ? (existingAuthUser.user.user_metadata as Record<string, unknown>)
      : {};

  const authPatch: {
    ban_duration: string;
    user_metadata: Record<string, unknown>;
    password?: string;
  } = {
    ban_duration: 'none',
    user_metadata: {
      ...existingMetadata,
      full_name: fullName,
      staff_role: role,
      role: metadataRole
    }
  };

  if (password) authPatch.password = password;

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(authUserId, authPatch);
  if (authUpdateError) return { error: authUpdateError.message };

  let clinicId: string | null = null;
  if (role === 'patient_service_executive_clinic') {
    const resolved = await resolveClinicWorkspaceId(admin, {
      clinic_id: clinicIdInput || undefined,
      clinic_name: clinicIdInput ? undefined : clinicName
    });
    if (resolved.error || !resolved.clinicId) {
      return { error: resolved.error ?? 'Could not resolve clinic workspace.' };
    }
    clinicId = resolved.clinicId;
  }

  const rowPayload = {
    auth_user_id: authUserId,
    email,
    full_name: fullName,
    role,
    clinic_id: clinicId,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  const staffColumns = 'id, auth_user_id, email, full_name, role, clinic_id, is_active, created_at, updated_at';

  if (existingRow) {
    const { data, error } = await admin
      .from('admins')
      .update(rowPayload)
      .eq('id', existingRow.id)
      .select(staffColumns)
      .single();
    if (error) return { error: error.message };
    return { staff: data };
  }

  const { data, error } = await admin.from('admins').insert(rowPayload).select(staffColumns).single();
  if (error) return { error: error.message };
  return { staff: data };
}

async function manageStaffMember(
  body: ManageStaffBody,
  env: Env,
  options?: { selfService?: boolean }
) {
  const staff = await loadStaffMember(body.staffId, env);
  if (!staff) return { error: 'Staff member not found.' };

  const isPse =
    staff.role === 'patient_service_executive' || staff.role === 'patient_service_executive_clinic';
  const isProfileUpdate = body.action === 'update';

  if (options?.selfService) {
    if (!isProfileUpdate) {
      return { error: 'You can only update your own profile.' };
    }
  } else if (!isPse && !(isProfileUpdate && staff.role === 'administrator')) {
    return { error: 'Only Patient Service Executive accounts can be managed here.' };
  }

  const admin = serviceClient(env);

  if (body.action === 'set_password') {
    const password = body.password?.trim() ?? '';
    if (password.length < 6) return { error: 'Password must be at least 6 characters.' };
    if (!staff.auth_user_id) return { error: 'No auth account linked for this staff member.' };
    const { error } = await admin.auth.admin.updateUserById(staff.auth_user_id, { password });
    if (error) return { error: error.message };
    return { staff };
  }

  if (body.action === 'deactivate') {
    if (staff.auth_user_id) {
      const { error } = await admin.auth.admin.updateUserById(staff.auth_user_id, { ban_duration: BAN_DURATION });
      if (error) return { error: error.message };
    }
    const { data, error } = await admin
      .from('admins')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', staff.id)
      .select('id, auth_user_id, email, full_name, role, is_active, created_at, updated_at')
      .single();
    if (error) return { error: error.message };
    return { staff: data };
  }

  if (body.action === 'activate') {
    if (staff.auth_user_id) {
      const { error } = await admin.auth.admin.updateUserById(staff.auth_user_id, { ban_duration: 'none' });
      if (error) return { error: error.message };
    }
    const { data, error } = await admin
      .from('admins')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', staff.id)
      .select('id, auth_user_id, email, full_name, role, is_active, created_at, updated_at')
      .single();
    if (error) return { error: error.message };
    return { staff: data };
  }

  if (body.action === 'update') {
    const fullName = body.full_name?.trim() ?? '';
    const email = body.email?.trim().toLowerCase() ?? '';
    if (!fullName) return { error: 'Full name is required.' };
    if (!email) return { error: 'Email is required.' };

    const { data: conflict } = await admin
      .from('admins')
      .select('id')
      .ilike('email', email)
      .neq('id', staff.id)
      .maybeSingle();

    if (conflict) return { error: 'Another staff account already uses this email.' };

    const password = body.password?.trim() ?? '';
    if (password && password.length < 6) {
      return { error: 'Password must be at least 6 characters.' };
    }

    if (staff.auth_user_id) {
      const authPatch: {
        email?: string;
        password?: string;
        user_metadata: { full_name: string; role: string };
      } = {
        user_metadata: {
          full_name: fullName,
          role: staffAuthMetadataRole(staff.role as NonNullable<CreateStaffBody['role']>)
        }
      };
      if (email !== staff.email.toLowerCase()) authPatch.email = email;
      if (password) authPatch.password = password;

      const { error: authError } = await admin.auth.admin.updateUserById(staff.auth_user_id, authPatch);
      if (authError) return { error: authError.message };
    }

    const adminUpdate: {
      full_name: string;
      email: string;
      updated_at: string;
      clinic_id?: string | null;
    } = {
      full_name: fullName,
      email,
      updated_at: new Date().toISOString()
    };

    if (
      !options?.selfService &&
      staff.role === 'patient_service_executive_clinic' &&
      (body.clinic_id?.trim() || body.clinic_name?.trim())
    ) {
      const resolved = await resolveClinicWorkspaceId(admin, {
        clinic_id: body.clinic_id,
        clinic_name: body.clinic_name
      });
      if (resolved.error || !resolved.clinicId) {
        return { error: resolved.error ?? 'Could not resolve clinic workspace.' };
      }
      adminUpdate.clinic_id = resolved.clinicId;
    }

    const { data, error } = await admin
      .from('admins')
      .update(adminUpdate)
      .eq('id', staff.id)
      .select('id, auth_user_id, email, full_name, role, clinic_id, is_active, created_at, updated_at')
      .single();

    if (error) return { error: error.message };
    return { staff: data };
  }

  return { error: 'Unknown action.' };
}

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  auth_user_id: string | null;
  login_disabled: boolean;
  phone?: string | null;
  mobile_no?: string | null;
  clinic_id?: string | null;
};

function canManagePatientAuth(caller: StaffCaller, patient: Pick<ProfileRow, 'clinic_id'>): boolean {
  if (caller.role === 'administrator') return true;
  if (caller.role === 'patient_service_executive_clinic') {
    return Boolean(patient.clinic_id && caller.clinicId && patient.clinic_id === caller.clinicId);
  }
  if (caller.role === 'patient_service_executive') {
    return patient.clinic_id == null;
  }
  return false;
}

function canManageDoctorAuth(caller: StaffCaller): boolean {
  return caller.role === 'administrator';
}

async function loadProfile(role: Role, profileId: string, env: Env): Promise<ProfileRow | null> {
  const table = role === 'doctor' ? 'doctors' : 'patients';
  const colsWithClinic =
    role === 'doctor'
      ? 'id,email,full_name,auth_user_id,login_disabled,mobile_no,phone,clinic_id'
      : 'id,email,full_name,auth_user_id,login_disabled,phone,clinic_id';
  const colsLegacy =
    role === 'doctor'
      ? 'id,email,full_name,auth_user_id,login_disabled,mobile_no,phone'
      : 'id,email,full_name,auth_user_id,login_disabled,phone';

  let { data, error } = await serviceClient(env).from(table).select(colsWithClinic).eq('id', profileId).maybeSingle();
  if (error && /clinic_id|column/.test(error.message)) {
    ({ data, error } = await serviceClient(env).from(table).select(colsLegacy).eq('id', profileId).maybeSingle());
  }

  if (error || !data) return null;
  return data as unknown as ProfileRow;
}

async function findUserByEmail(email: string, admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data.users) return null;
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

async function sendTemporaryPasswordEmail(
  toEmail: string,
  patientName: string,
  temporaryPassword: string,
  env: Env
): Promise<{ error?: string }> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const senderEmail = env.SMTP_ADMIN_EMAIL?.trim();
  const senderName = env.SMTP_SENDER_NAME?.trim() || 'ElixClinix';
  if (!apiKey || !senderEmail) {
    return {
      error:
        'Login enabled, but welcome email was not sent (missing RESEND_API_KEY or SMTP_ADMIN_EMAIL in admin-auth worker).'
    };
  }

  const appUrl = env.ALLOWED_ORIGIN?.trim() || 'https://app.elixclinix.com';
  const safeName = patientName.trim() || 'Patient';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${senderName} <${senderEmail}>`,
      to: [toEmail],
      subject: 'Your ElixClinix login is ready',
      html: `
        <p>Hi ${safeName},</p>
        <p>Your clinic created your ElixClinix account.</p>
        <p><strong>Temporary password:</strong> ${temporaryPassword}</p>
        <p>Sign in at <a href="${appUrl}">${appUrl}</a>. On first login, you will be asked to change your password.</p>
      `
    })
  });

  if (!response.ok) {
    const message = await response.text();
    return { error: `Login enabled, but email failed to send: ${message || `HTTP ${response.status}`}` };
  }

  return {};
}

async function sendEmailViaResend(input: {
  toEmail: string;
  subject: string;
  html: string;
  env: Env;
}): Promise<{ error?: string }> {
  const apiKey = input.env.RESEND_API_KEY?.trim();
  const senderEmail = input.env.SMTP_ADMIN_EMAIL?.trim();
  const senderName = input.env.SMTP_SENDER_NAME?.trim() || 'ElixClinix';
  if (!apiKey || !senderEmail) {
    return {
      error:
        'Notification email service is not configured (missing RESEND_API_KEY or SMTP_ADMIN_EMAIL in admin-auth worker).'
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${senderName} <${senderEmail}>`,
      to: [input.toEmail],
      subject: input.subject,
      html: input.html
    })
  });

  if (!response.ok) {
    const message = await response.text();
    return { error: message || `HTTP ${response.status}` };
  }

  return {};
}

type RequestNotificationContext = {
  requestId: string;
  patientId: string | null;
  patientName: string | null;
  patientEmail: string | null;
  doctorName: string | null;
  doctorEmail: string | null;
  assignedPseName: string | null;
  assignedPseEmail: string | null;
  submittedAt: string | null;
  assignedAt: string | null;
};

async function loadRequestNotificationContext(
  requestId: string,
  env: Env
): Promise<{ data: RequestNotificationContext | null; error?: string }> {
  const admin = serviceClient(env);
  const { data, error } = await admin
    .from('opinion_requests')
    .select(
      `
      id,
      patient_id,
      patient_name,
      patient_email,
      doctor_id,
      doctor_name,
      assigned_to,
      assigned_at,
      created_at,
      assignee:admins!opinion_requests_assigned_to_fkey(full_name, email),
      doctors(full_name, email)
    `
    )
    .eq('id', requestId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Request not found.' };

  const assignee = Array.isArray(data.assignee) ? data.assignee[0] : data.assignee;
  const doctor = Array.isArray(data.doctors) ? data.doctors[0] : data.doctors;

  let patientEmail = (data.patient_email as string | null | undefined)?.trim() || null;
  if (!patientEmail && data.patient_id) {
    const { data: patient } = await admin
      .from('patients')
      .select('email')
      .eq('auth_user_id', data.patient_id as string)
      .maybeSingle();
    patientEmail = (patient?.email as string | null | undefined)?.trim() || null;
  }

  return {
    data: {
      requestId: data.id as string,
      patientId: (data.patient_id as string | null | undefined) ?? null,
      patientName: (data.patient_name as string | null | undefined) ?? null,
      patientEmail,
      doctorName: ((doctor?.full_name as string | null | undefined) ?? (data.doctor_name as string | null)) ?? null,
      doctorEmail: (doctor?.email as string | null | undefined) ?? null,
      assignedPseName: (assignee?.full_name as string | null | undefined) ?? null,
      assignedPseEmail: (assignee?.email as string | null | undefined) ?? null,
      submittedAt: (data.created_at as string | null | undefined) ?? null,
      assignedAt: (data.assigned_at as string | null | undefined) ?? null
    }
  };
}

async function sendRequestLifecycleNotification(
  body: RequestLifecycleNotifyBody,
  request: Request,
  env: Env
): Promise<{ delivered: number; skipped?: boolean; error?: string }> {
  const requestId = body.requestId?.trim();
  if (!requestId) return { delivered: 0, error: 'requestId is required.' };

  const requestContext = await loadRequestNotificationContext(requestId, env);
  if (requestContext.error || !requestContext.data) {
    return { delivered: 0, error: requestContext.error ?? 'Could not load request details.' };
  }
  const ctx = requestContext.data;

  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return { delivered: 0, error: 'Unauthorized.' };
  }
  const token = auth.slice(7);
  const callerUserId = await getUserIdFromToken(token, env);
  if (!callerUserId) return { delivered: 0, error: 'Unauthorized.' };

  const staffCaller = await verifyStaffCaller(request, env);

  if (body.event === 'patient_request_submitted') {
    if (!ctx.patientId || callerUserId !== ctx.patientId) {
      return { delivered: 0, error: 'Only the request patient can send this notification.' };
    }

    const { data: admins, error: adminsError } = await serviceClient(env)
      .from('admins')
      .select('email, full_name')
      .eq('role', 'administrator')
      .eq('is_active', true);
    if (adminsError) return { delivered: 0, error: adminsError.message };

    const recipients = (admins ?? [])
      .map((row) => ({ email: String(row.email ?? '').trim(), name: String(row.full_name ?? '').trim() }))
      .filter((row) => row.email.length > 0);
    if (!recipients.length) return { delivered: 0, skipped: true };

    const subject = `New patient request submitted · ${ctx.requestId.slice(0, 8).toUpperCase()}`;
    let delivered = 0;
    for (const recipient of recipients) {
      const email = await sendEmailViaResend({
        toEmail: recipient.email,
        subject,
        html: `
          <p>Hi ${recipient.name || 'Admin'},</p>
          <p>A new patient request was submitted and is awaiting assignment.</p>
          <p><strong>Request ID:</strong> ${ctx.requestId.slice(0, 8).toUpperCase()}</p>
          <p><strong>Patient:</strong> ${ctx.patientName || 'Patient'}</p>
          ${ctx.submittedAt ? `<p><strong>Submitted:</strong> ${new Date(ctx.submittedAt).toLocaleString()}</p>` : ''}
        `,
        env
      });
      if (!email.error) delivered += 1;
    }
    return { delivered };
  }

  if (body.event === 'request_assigned_to_pse') {
    if (!staffCaller || staffCaller.role !== 'administrator') {
      return { delivered: 0, error: 'Only administrators can send this notification.' };
    }
    if (!ctx.assignedPseEmail?.trim()) return { delivered: 0, skipped: true };

    const result = await sendEmailViaResend({
      toEmail: ctx.assignedPseEmail.trim(),
      subject: `New request assigned to you · ${ctx.requestId.slice(0, 8).toUpperCase()}`,
      html: `
        <p>Hi ${ctx.assignedPseName || 'PSE'},</p>
        <p>A patient request has been assigned to you for coordination.</p>
        <p><strong>Request ID:</strong> ${ctx.requestId.slice(0, 8).toUpperCase()}</p>
        <p><strong>Patient:</strong> ${ctx.patientName || 'Patient'}</p>
        ${ctx.assignedAt ? `<p><strong>Assigned:</strong> ${new Date(ctx.assignedAt).toLocaleString()}</p>` : ''}
      `,
      env
    });
    if (result.error) return { delivered: 0, error: result.error };
    return { delivered: 1 };
  }

  if (body.event === 'request_released_to_doctor') {
    if (
      !staffCaller ||
      (staffCaller.role !== 'patient_service_executive' &&
        staffCaller.role !== 'patient_service_executive_clinic')
    ) {
      return { delivered: 0, error: 'Only PSE users can send this notification.' };
    }
    if (!ctx.doctorEmail?.trim()) return { delivered: 0, skipped: true };

    const result = await sendEmailViaResend({
      toEmail: ctx.doctorEmail.trim(),
      subject: `Patient request ready for consultation · ${ctx.requestId.slice(0, 8).toUpperCase()}`,
      html: `
        <p>Hi ${ctx.doctorName || 'Doctor'},</p>
        <p>A patient request has been coordinated and released to you for consultation.</p>
        <p><strong>Request ID:</strong> ${ctx.requestId.slice(0, 8).toUpperCase()}</p>
        <p><strong>Patient:</strong> ${ctx.patientName || 'Patient'}</p>
      `,
      env
    });
    if (result.error) return { delivered: 0, error: result.error };
    return { delivered: 1 };
  }

  return { delivered: 0, error: 'Unsupported event.' };
}

async function enableLogin(
  profile: ProfileRow,
  role: Role,
  password: string,
  env: Env,
  options?: EnableLoginOptions
): Promise<{ error?: string }> {
  const email = profile.email?.trim().toLowerCase();
  if (!email) return { error: 'Profile email is required to enable login.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const table = role === 'doctor' ? 'doctors' : 'patients';
  const admin = serviceClient(env);
  let authUserId = profile.auth_user_id;
  const forcePasswordChange = options?.forcePasswordChange ?? false;

  if (!authUserId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        [`${role}_id`]: profile.id,
        full_name: profile.full_name,
        force_password_change: forcePasswordChange,
        temporary_password: forcePasswordChange
      }
    });

    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        authUserId = await findUserByEmail(email, admin);
        if (!authUserId) return { error: error.message };
      } else {
        return { error: error.message };
      }
    } else {
      authUserId = data.user?.id ?? null;
    }
  }

  if (!authUserId) return { error: 'Could not resolve auth user id.' };

  const { data: existingAuth, error: existingAuthError } = await admin.auth.admin.getUserById(authUserId);
  if (existingAuthError) return { error: existingAuthError.message };
  const existingMetadata =
    existingAuth.user?.user_metadata && typeof existingAuth.user.user_metadata === 'object'
      ? (existingAuth.user.user_metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
    password,
    ban_duration: 'none',
    user_metadata: {
      ...existingMetadata,
      role,
      [`${role}_id`]: profile.id,
      full_name: profile.full_name,
      force_password_change: forcePasswordChange,
      temporary_password: forcePasswordChange
    }
  });
  if (updateError) return { error: updateError.message };

  const patch: Record<string, unknown> = { auth_user_id: authUserId, login_disabled: false };
  if (role === 'doctor') {
    patch.email = email;
    if (profile.mobile_no ?? profile.phone) patch.phone = profile.mobile_no ?? profile.phone;
  }

  const { error: linkError } = await admin.from(table).update(patch).eq('id', profile.id);
  if (linkError) return { error: linkError.message };

  return {};
}

async function disableLogin(profile: ProfileRow, role: Role, env: Env): Promise<{ error?: string }> {
  const table = role === 'doctor' ? 'doctors' : 'patients';
  const admin = serviceClient(env);

  if (profile.auth_user_id) {
    const { error } = await admin.auth.admin.updateUserById(profile.auth_user_id, {
      ban_duration: BAN_DURATION
    });
    if (error) return { error: error.message };
  }

  const { error } = await admin.from(table).update({ login_disabled: true }).eq('id', profile.id);
  if (error) return { error: error.message };
  return {};
}

async function setPassword(profile: ProfileRow, password: string, env: Env): Promise<{ error?: string }> {
  if (!profile.auth_user_id) return { error: 'No auth account linked. Enable login first.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const admin = serviceClient(env);
  const { data: existingAuth, error: existingAuthError } = await admin.auth.admin.getUserById(profile.auth_user_id);
  if (existingAuthError) return { error: existingAuthError.message };
  const existingMetadata =
    existingAuth.user?.user_metadata && typeof existingAuth.user.user_metadata === 'object'
      ? (existingAuth.user.user_metadata as Record<string, unknown>)
      : {};

  const { error } = await admin.auth.admin.updateUserById(profile.auth_user_id, {
    password,
    user_metadata: {
      ...existingMetadata,
      force_password_change: false,
      temporary_password: false
    }
  });
  if (error) return { error: error.message };
  return {};
}

async function getAccountStatus(role: Role, profileId: string, env: Env) {
  const profile = await loadProfile(role, profileId, env);
  if (!profile) return null;

  const hasAuth = Boolean(profile.auth_user_id);
  const enabled = hasAuth && !profile.login_disabled;

  return {
    role,
    profileId: profile.id,
    email: profile.email,
    hasAuth,
    loginEnabled: enabled,
    loginDisabled: profile.login_disabled
  };
}

async function provisionPatientLogin(profileId: string, env: Env) {
  const profile = await loadProfile('patient', profileId, env);
  if (!profile) return { error: 'Patient profile not found.' };

  const temporaryPassword = generateTemporaryPassword(8);
  const enable = await enableLogin(profile, 'patient', temporaryPassword, env, {
    forcePasswordChange: true
  });
  if (enable.error) return { error: enable.error };

  const emailResult = await sendTemporaryPasswordEmail(
    profile.email.trim().toLowerCase(),
    profile.full_name,
    temporaryPassword,
    env
  );

  const status = await getAccountStatus('patient', profile.id, env);
  return {
    status,
    emailSent: !emailResult.error,
    warning: emailResult.error
  };
}

type PatientPreconfirmBody = {
  email: string;
  fullName: string;
};

function createBootstrapPassword(): string {
  return `Elix-${crypto.randomUUID()}9!Ab`;
}

async function preconfirmPatientSignup(body: PatientPreconfirmBody, env: Env) {
  if (env.ALLOW_EMAILLESS_PATIENT_SIGNUP !== 'true') {
    return { error: 'Email verification is required for signup.' };
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  const fullName = body.fullName?.trim() ?? '';

  if (!fullName) return { error: 'Full name is required.' };
  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' };

  const admin = serviceClient(env);

  await admin.rpc('cleanup_patient_signup_orphan', { p_email: email });

  const { data: registered, error: registeredError } = await admin.rpc('is_auth_email_registered', {
    p_email: email
  });
  if (registeredError) {
    const existingAuthUserId = await findUserByEmail(email, admin);
    if (existingAuthUserId) {
      return { error: 'This email is already registered. Please enter another email address.' };
    }
  } else if (registered === true) {
    return { error: 'This email is already registered. Please enter another email address.' };
  }

  const bootstrapPassword = createBootstrapPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: bootstrapPassword,
    email_confirm: true,
    user_metadata: {
      role: 'patient',
      full_name: fullName
    }
  });

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return { error: 'This email is already registered. Please enter another email address.' };
    }
    return { error: error.message };
  }

  if (!data.user?.id) {
    return { error: 'Could not create account.' };
  }

  return { bootstrapPassword };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Worker misconfigured.' }, 500, origin, env);
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if ((pathname === '/' || pathname === '/health') && request.method === 'GET') {
      return json({ ok: true, service: 'elix-admin-auth' }, 200, origin, env);
    }

    if (request.method === 'POST' && pathname === '/patient-signup/preconfirm') {
      let body: PatientPreconfirmBody;
      try {
        body = (await request.json()) as PatientPreconfirmBody;
      } catch {
        return json({ error: 'Invalid JSON body.' }, 400, origin, env);
      }

      const result = await preconfirmPatientSignup(body, env);
      if (result.error) return json({ error: result.error }, 400, origin, env);
      return json({ ok: true, bootstrapPassword: result.bootstrapPassword }, 200, origin, env);
    }

    if (request.method === 'POST' && (pathname === '/staff' || pathname === '/staff/manage')) {
      if (pathname === '/staff') {
        const administratorId = await verifyAdministrator(request, env);
        if (!administratorId) {
          return json({ error: 'Unauthorized. Sign in as an administrator.' }, 403, origin, env);
        }

        let body: CreateStaffBody;
        try {
          body = (await request.json()) as CreateStaffBody;
        } catch {
          return json({ error: 'Invalid JSON body.' }, 400, origin, env);
        }

        const result = await createStaffMember(body, env);
        if (result.error) return json({ error: result.error }, 400, origin, env);
        return json({ ok: true, staff: result.staff }, 201, origin, env);
      }

      let body: ManageStaffBody;
      try {
        body = (await request.json()) as ManageStaffBody;
      } catch {
        return json({ error: 'Invalid JSON body.' }, 400, origin, env);
      }

      if (!body.staffId || !body.action) {
        return json({ error: 'staffId and action are required.' }, 400, origin, env);
      }

      const administratorId = await verifyAdministrator(request, env);
      if (administratorId) {
        const result = await manageStaffMember(body, env);
        if (result.error) return json({ error: result.error }, 400, origin, env);
        return json({ ok: true, staff: result.staff }, 200, origin, env);
      }

      const caller = await verifyStaffAuthUserId(request, env);
      if (!caller) {
        return json({ error: 'Unauthorized. Sign in as an active admin.' }, 401, origin, env);
      }

      if (caller.staffId !== body.staffId) {
        return json({ error: 'You can only update your own profile.' }, 403, origin, env);
      }

      if (body.action !== 'update') {
        return json({ error: 'You can only update your own profile.' }, 403, origin, env);
      }

      const result = await manageStaffMember(body, env, { selfService: true });
      if (result.error) return json({ error: result.error }, 400, origin, env);
      return json({ ok: true, staff: result.staff }, 200, origin, env);
    }

    if (request.method === 'POST' && pathname === '/notify/request-lifecycle') {
      let body: RequestLifecycleNotifyBody;
      try {
        body = (await request.json()) as RequestLifecycleNotifyBody;
      } catch {
        return json({ error: 'Invalid JSON body.' }, 400, origin, env);
      }

      if (!body.event || !body.requestId) {
        return json({ error: 'event and requestId are required.' }, 400, origin, env);
      }

      const result = await sendRequestLifecycleNotification(body, request, env);
      if (result.error) return json({ error: result.error }, 400, origin, env);
      return json(
        { ok: true, delivered: result.delivered, skipped: Boolean(result.skipped) },
        200,
        origin,
        env
      );
    }

    const caller = await verifyStaffCaller(request, env);
    if (!caller) {
      return json({ error: 'Unauthorized. Sign in as an active admin.' }, 401, origin, env);
    }

    if (request.method === 'POST' && pathname === '/patient/provision-login') {
      let body: { profileId?: string };
      try {
        body = (await request.json()) as { profileId?: string };
      } catch {
        return json({ error: 'Invalid JSON body.' }, 400, origin, env);
      }

      const profileId = body.profileId?.trim();
      if (!profileId) {
        return json({ error: 'profileId is required.' }, 400, origin, env);
      }

      const patient = await loadProfile('patient', profileId, env);
      if (!patient) return json({ error: 'Profile not found.' }, 404, origin, env);
      if (!canManagePatientAuth(caller, patient)) {
        return json({ error: 'You do not have permission to manage this patient login.' }, 403, origin, env);
      }

      const result = await provisionPatientLogin(profileId, env);
      if (result.error) {
        return json({ error: result.error }, 400, origin, env);
      }

      return json(
        { ok: true, status: result.status ?? null, emailSent: result.emailSent, warning: result.warning },
        200,
        origin,
        env
      );
    }

    if (request.method === 'GET' && pathname === '/status') {
      const role = url.searchParams.get('role') as Role | null;
      const profileId = url.searchParams.get('profileId');
      if ((role !== 'doctor' && role !== 'patient') || !profileId) {
        return json({ error: 'Query params role and profileId required.' }, 400, origin, env);
      }

      const profile = await loadProfile(role, profileId, env);
      if (!profile) return json({ error: 'Profile not found.' }, 404, origin, env);

      if (role === 'patient') {
        if (!canManagePatientAuth(caller, profile)) {
          return json({ error: 'You do not have permission to view this patient login.' }, 403, origin, env);
        }
      } else if (!canManageDoctorAuth(caller)) {
        return json({ error: 'Unauthorized. Sign in as an administrator.' }, 403, origin, env);
      }

      const status = await getAccountStatus(role, profileId, env);
      if (!status) return json({ error: 'Profile not found.' }, 404, origin, env);
      return json(status, 200, origin, env);
    }

    if (request.method === 'POST' && pathname === '/manage') {
      let body: ManageBody;
      try {
        body = (await request.json()) as ManageBody;
      } catch {
        return json({ error: 'Invalid JSON body.' }, 400, origin, env);
      }

      if ((body.role !== 'doctor' && body.role !== 'patient') || !body.profileId || !body.action) {
        return json({ error: 'role, profileId, and action are required.' }, 400, origin, env);
      }

      const profile = await loadProfile(body.role, body.profileId, env);
      if (!profile) return json({ error: 'Profile not found.' }, 404, origin, env);

      if (body.role === 'patient') {
        if (!canManagePatientAuth(caller, profile)) {
          return json({ error: 'You do not have permission to manage this patient login.' }, 403, origin, env);
        }
      } else if (!canManageDoctorAuth(caller)) {
        return json({ error: 'Unauthorized. Sign in as an administrator.' }, 403, origin, env);
      }

      let result: { error?: string };
      if (body.action === 'enable') {
        if (!body.password?.trim()) {
          return json({ error: 'password is required when enabling login.' }, 400, origin, env);
        }
        result = await enableLogin(profile, body.role, body.password.trim(), env);
      } else if (body.action === 'disable') {
        result = await disableLogin(profile, body.role, env);
      } else if (body.action === 'set_password') {
        if (!body.password?.trim()) {
          return json({ error: 'password is required.' }, 400, origin, env);
        }
        result = await setPassword(profile, body.password.trim(), env);
      } else {
        return json({ error: 'Unknown action.' }, 400, origin, env);
      }

      if (result.error) return json({ error: result.error }, 400, origin, env);

      const status = await getAccountStatus(body.role, body.profileId, env);
      return json({ ok: true, status }, 200, origin, env);
    }

    return json({ error: 'Not found.' }, 404, origin, env);
  }
};
