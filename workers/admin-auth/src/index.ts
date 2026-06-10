import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGIN?: string;
  ALLOW_EMAILLESS_PATIENT_SIGNUP?: string;
};

type Role = 'doctor' | 'patient';

type ManageBody = {
  role: Role;
  profileId: string;
  action: 'enable' | 'disable' | 'set_password';
  password?: string;
};

const BAN_DURATION = '876000h';

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = env.ALLOWED_ORIGIN?.trim();
  let value = '*';

  if (origin) {
    // Always echo localhost so Vite (http://localhost:3000) works while ALLOWED_ORIGIN is production.
    if (isLocalDevOrigin(origin) || !allowed || allowed === '*' || origin === allowed) {
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

async function verifyAdmin(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const userId = await getUserIdFromToken(token, env);
  if (!userId) return null;

  const { data, error } = await userClient(env, token)
    .from('admins')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return userId;
}

async function verifyAdministrator(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const userId = await getUserIdFromToken(token, env);
  if (!userId) return null;

  const { data, error } = await userClient(env, token)
    .from('admins')
    .select('id, role')
    .eq('auth_user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data || data.role !== 'administrator') return null;
  return userId;
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
  role?: 'administrator' | 'patient_service_executive';
};

type ManageStaffBody = {
  staffId: string;
  action: 'activate' | 'deactivate' | 'set_password' | 'update';
  password?: string;
  full_name?: string;
  email?: string;
};

async function loadStaffMember(staffId: string, env: Env): Promise<StaffRow | null> {
  const { data, error } = await serviceClient(env)
    .from('admins')
    .select('id, auth_user_id, email, full_name, role, is_active')
    .eq('id', staffId)
    .maybeSingle();

  if (error || !data) return null;
  return data as StaffRow;
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

async function createStaffMember(body: CreateStaffBody, env: Env) {
  const email = body.email.trim().toLowerCase();
  const fullName = body.full_name.trim();
  const password = body.password?.trim() ?? '';
  const role = body.role === 'administrator' ? 'administrator' : 'patient_service_executive';

  if (!fullName) return { error: 'Full name is required.' };
  if (!email) return { error: 'Email is required.' };

  const admin = serviceClient(env);
  const { data: existingRow } = await admin.from('admins').select('id, role, auth_user_id').ilike('email', email).maybeSingle();

  if (existingRow?.role === role) {
    return {
      error:
        role === 'patient_service_executive'
          ? 'This email is already a Patient Service Executive.'
          : 'This email is already an administrator.'
    };
  }

  if (existingRow?.role === 'administrator' && role === 'patient_service_executive') {
    return { error: 'This email belongs to an administrator account.' };
  }

  if (existingRow?.role === 'patient_service_executive' && role === 'administrator') {
    return { error: 'This email belongs to a Patient Service Executive account.' };
  }

  let authUserId = existingRow?.auth_user_id ?? null;

  if (!authUserId) {
    const profileAuth = await resolveProfileAuthUserId(email, admin);
    authUserId = profileAuth.authUserId;
  }

  if (!authUserId && password.length < 6) {
    return { error: 'Password is required when creating a new login (at least 6 characters).' };
  }

  const metadataRole = role === 'administrator' ? 'admin' : 'patient_service_executive';

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
      staff_role: role
    }
  };

  if (!existingMetadata.role) {
    authPatch.user_metadata.role = metadataRole;
  }

  if (password) authPatch.password = password;

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(authUserId, authPatch);
  if (authUpdateError) return { error: authUpdateError.message };

  const rowPayload = {
    auth_user_id: authUserId,
    email,
    full_name: fullName,
    role,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  if (existingRow) {
    const { data, error } = await admin
      .from('admins')
      .update(rowPayload)
      .eq('id', existingRow.id)
      .select('id, auth_user_id, email, full_name, role, is_active, created_at, updated_at')
      .single();
    if (error) return { error: error.message };
    return { staff: data };
  }

  const { data, error } = await admin
    .from('admins')
    .insert(rowPayload)
    .select('id, auth_user_id, email, full_name, role, is_active, created_at, updated_at')
    .single();
  if (error) return { error: error.message };
  return { staff: data };
}

async function manageStaffMember(body: ManageStaffBody, env: Env) {
  const staff = await loadStaffMember(body.staffId, env);
  if (!staff) return { error: 'Staff member not found.' };
  if (staff.role !== 'patient_service_executive') {
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
        user_metadata: { full_name: fullName, role: 'patient_service_executive' }
      };
      if (email !== staff.email.toLowerCase()) authPatch.email = email;
      if (password) authPatch.password = password;

      const { error: authError } = await admin.auth.admin.updateUserById(staff.auth_user_id, authPatch);
      if (authError) return { error: authError.message };
    }

    const { data, error } = await admin
      .from('admins')
      .update({
        full_name: fullName,
        email,
        updated_at: new Date().toISOString()
      })
      .eq('id', staff.id)
      .select('id, auth_user_id, email, full_name, role, is_active, created_at, updated_at')
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
};

async function loadProfile(role: Role, profileId: string, env: Env): Promise<ProfileRow | null> {
  const table = role === 'doctor' ? 'doctors' : 'patients';
  const cols =
    role === 'doctor'
      ? 'id,email,full_name,auth_user_id,login_disabled,mobile_no,phone'
      : 'id,email,full_name,auth_user_id,login_disabled,phone';

  const { data, error } = await serviceClient(env).from(table).select(cols).eq('id', profileId).maybeSingle();

  if (error || !data) return null;
  return data as ProfileRow;
}

async function findUserByEmail(email: string, admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data.users) return null;
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

async function enableLogin(profile: ProfileRow, role: Role, password: string, env: Env): Promise<{ error?: string }> {
  const email = profile.email?.trim().toLowerCase();
  if (!email) return { error: 'Profile email is required to enable login.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const table = role === 'doctor' ? 'doctors' : 'patients';
  const admin = serviceClient(env);
  let authUserId = profile.auth_user_id;

  if (!authUserId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        [`${role}_id`]: profile.id,
        full_name: profile.full_name
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

  const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
    password,
    ban_duration: 'none'
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

  const { error } = await serviceClient(env).auth.admin.updateUserById(profile.auth_user_id, { password });
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
      const administratorId = await verifyAdministrator(request, env);
      if (!administratorId) {
        return json({ error: 'Unauthorized. Sign in as an administrator.' }, 403, origin, env);
      }

      if (pathname === '/staff') {
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

      const result = await manageStaffMember(body, env);
      if (result.error) return json({ error: result.error }, 400, origin, env);
      return json({ ok: true, staff: result.staff }, 200, origin, env);
    }

    const adminId = await verifyAdmin(request, env);
    if (!adminId) {
      return json({ error: 'Unauthorized. Sign in as an active admin.' }, 401, origin, env);
    }

    if (request.method === 'GET' && pathname === '/status') {
      const role = url.searchParams.get('role') as Role | null;
      const profileId = url.searchParams.get('profileId');
      if ((role !== 'doctor' && role !== 'patient') || !profileId) {
        return json({ error: 'Query params role and profileId required.' }, 400, origin, env);
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
