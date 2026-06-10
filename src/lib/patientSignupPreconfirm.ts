type PreconfirmResponse = {
  ok?: boolean;
  bootstrapPassword?: string;
  error?: string;
};

export type EmaillessPatientSignupResult = {
  bootstrapPassword: string | null;
  error: string | null;
};

function patientSignupWorkerUrl(): string | null {
  const url = import.meta.env.VITE_ADMIN_AUTH_API_URL?.trim();
  return url ? url.replace(/\/$/, '') : null;
}

/** Creates a pre-confirmed auth user when Supabase cannot send verification email. */
export async function startEmaillessPatientSignup(
  email: string,
  fullName: string
): Promise<EmaillessPatientSignupResult> {
  const base = patientSignupWorkerUrl();
  if (!base) {
    return {
      bootstrapPassword: null,
      error:
        'Signup email service is unavailable. Set VITE_ADMIN_AUTH_API_URL and deploy the admin-auth worker with ALLOW_EMAILLESS_PATIENT_SIGNUP=true.'
    };
  }

  try {
    const res = await fetch(`${base}/patient-signup/preconfirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), fullName: fullName.trim() })
    });

    const body = (await res.json().catch(() => ({}))) as PreconfirmResponse;
    if (!res.ok || !body.bootstrapPassword) {
      return {
        bootstrapPassword: null,
        error: body.error ?? 'Could not start signup without email verification.'
      };
    }

    return { bootstrapPassword: body.bootstrapPassword, error: null };
  } catch {
    return {
      bootstrapPassword: null,
      error:
        'Could not reach the signup service. Check VITE_ADMIN_AUTH_API_URL and that the admin-auth worker is deployed.'
    };
  }
}
