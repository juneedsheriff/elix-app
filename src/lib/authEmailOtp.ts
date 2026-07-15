import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type SendSignupEmailOtpResult = {
  error: AuthError | null;
  /** True when Supabase did not require email confirmation (session already active). */
  skipVerification?: boolean;
};

export const EXISTING_USER_EMAIL_MESSAGE =
  'This email is already registered. Please enter another email address.';

export const LOGIN_NOT_REGISTERED_MESSAGE = 'This email is not registered.';
export const LOGIN_INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';

export function existingUserEmailMessage(): string {
  return EXISTING_USER_EMAIL_MESSAGE;
}

export function isInvalidLoginCredentialsError(error: { message?: string } | null | undefined): boolean {
  const lower = (error?.message ?? '').toLowerCase();
  return (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('invalid credentials')
  );
}

/** Distinguish unknown email vs wrong password after a failed sign-in. */
export async function resolveLoginCredentialError(
  email: string,
  error: { message?: string } | null | undefined
): Promise<string> {
  if (!isInvalidLoginCredentialsError(error)) {
    return error?.message?.trim() || 'Sign in failed.';
  }

  const registered = await isAuthEmailRegistered(email);
  if (registered === false) return LOGIN_NOT_REGISTERED_MESSAGE;
  return LOGIN_INVALID_CREDENTIALS_MESSAGE;
}

export function createTempSignupPassword(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `Elix-${crypto.randomUUID()}9!`;
  }
  return `Elix-${Date.now().toString(36)}-Temp9!`;
}

type SignUpResponse = {
  user?: {
    identities?: unknown[] | null;
    email_confirmed_at?: string | null;
  } | null;
  session?: unknown | null;
};

/** Supabase may return success with an empty identities array when the email already exists. */
export function isDuplicateSignupResponse(data: SignUpResponse | null): boolean {
  const user = data?.user;
  if (!user) return false;

  const identities = user.identities;
  if (Array.isArray(identities) && identities.length === 0) {
    return true;
  }

  // Confirmed account surfaced again without a new session — treat as duplicate signup.
  if (!data?.session && user.email_confirmed_at) {
    return true;
  }

  return false;
}

/** Server-side check (migration 033). Returns null when RPC is unavailable. */
export async function isAuthEmailRegistered(email: string): Promise<boolean | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.rpc('is_auth_email_registered', { p_email: trimmed });
  if (error) return null;
  return Boolean(data);
}

/** Removes auth-only patient signups that never created a patients row (migration 033). */
export async function cleanupPatientSignupOrphan(email: string): Promise<boolean> {
  const trimmed = email.trim();
  if (!trimmed) return false;

  const { data, error } = await supabase.rpc('cleanup_patient_signup_orphan', { p_email: trimmed });
  if (error) return false;
  return Boolean(data);
}

export function isConfirmationEmailSendError(error: AuthError): boolean {
  const lower = (error.message ?? '').toLowerCase();
  return lower.includes('error sending confirmation');
}

export function isExistingUserSignupError(error: AuthError): boolean {
  const lower = (error.message ?? '').toLowerCase();
  return (
    lower.includes('already registered') ||
    lower.includes('already been registered') ||
    lower.includes('user already exists') ||
    lower.includes('email address is already') ||
    lower.includes('already in use') ||
    lower.includes('duplicate')
  );
}

export function isExistingUserEmailMessage(message: string): boolean {
  return message.trim() === EXISTING_USER_EMAIL_MESSAGE;
}

export function formatAuthEmailError(error: AuthError): string {
  const message = error.message ?? 'Could not send verification email.';
  const lower = message.toLowerCase();

  if (error.status === 429 || lower.includes('rate limit')) {
    return 'Too many verification emails were sent. Wait about an hour, then tap Resend code, or ask your administrator to review email rate limits.';
  }

  if (lower.includes('email_address_invalid') || (lower.includes('invalid') && lower.includes('email'))) {
    return 'That email address is not accepted. Use a real inbox (Gmail, Outlook, Yahoo, etc.).';
  }

  if (isExistingUserSignupError(error)) {
    return existingUserEmailMessage();
  }

  if (isConfirmationEmailSendError(error)) {
    return 'We could not send a verification email. If this address is already registered, use another email or sign in. Otherwise wait a few minutes and try again, or ask your administrator to configure ElixClinix email delivery.';
  }

  return message;
}

export async function resolveSignupEmailError(email: string, error: AuthError): Promise<AuthError> {
  if (isConfirmationEmailSendError(error) || isExistingUserSignupError(error)) {
    await cleanupPatientSignupOrphan(email);
    const registered = await isAuthEmailRegistered(email);
    if (registered === true) {
      return duplicateSignupAuthError();
    }
  }

  return {
    ...error,
    message: formatAuthEmailError(error)
  } as AuthError;
}

export function duplicateSignupAuthError(): AuthError {
  return {
    message: existingUserEmailMessage(),
    name: 'AuthError',
    status: 400
  } as AuthError;
}

export async function assertEmailAvailableForSignup(email: string): Promise<AuthError | null> {
  await cleanupPatientSignupOrphan(email);
  const registered = await isAuthEmailRegistered(email);
  if (registered === true) {
    return duplicateSignupAuthError();
  }
  return null;
}
