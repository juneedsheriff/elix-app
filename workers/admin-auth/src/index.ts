import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGIN?: string;
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
    if (!allowed || allowed === '*' || origin === allowed) {
      value = origin;
    } else if (isLocalDevOrigin(origin) && allowed && isLocalDevOrigin(allowed)) {
      value = origin;
    } else if (allowed) {
      value = allowed;
    } else {
      value = origin;
    }
  } else if (allowed) {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Worker misconfigured.' }, 500, origin, env);
    }

    const adminId = await verifyAdmin(request, env);
    if (!adminId) {
      return json({ error: 'Unauthorized. Sign in as an active admin.' }, 401, origin, env);
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/status') {
      const role = url.searchParams.get('role') as Role | null;
      const profileId = url.searchParams.get('profileId');
      if ((role !== 'doctor' && role !== 'patient') || !profileId) {
        return json({ error: 'Query params role and profileId required.' }, 400, origin, env);
      }
      const status = await getAccountStatus(role, profileId, env);
      if (!status) return json({ error: 'Profile not found.' }, 404, origin, env);
      return json(status, 200, origin, env);
    }

    if (request.method === 'POST' && url.pathname === '/manage') {
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
