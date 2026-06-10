import type { AuthError } from '@supabase/supabase-js';

export type SendSignupEmailOtpResult = {
  error: AuthError | null;
  /** True when Supabase did not require email confirmation (session already active). */
  skipVerification?: boolean;
};

export function createTempSignupPassword(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `Elix-${crypto.randomUUID()}9!`;
  }
  return `Elix-${Date.now().toString(36)}-Temp9!`;
}

export function formatAuthEmailError(error: AuthError): string {
  const message = error.message ?? 'Could not send verification email.';
  const lower = message.toLowerCase();

  if (error.status === 429 || lower.includes('rate limit')) {
    return 'Too many verification emails were sent. Wait about an hour, then tap Resend code. In Supabase, check Authentication → Rate Limits or set up custom SMTP.';
  }

  if (lower.includes('email_address_invalid') || (lower.includes('invalid') && lower.includes('email'))) {
    return 'That email address is not accepted. Use a real inbox (Gmail, Outlook, Yahoo, etc.).';
  }

  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'This email is already registered. Sign in instead, or use a different email.';
  }

  return message;
}

export function isExistingUserSignupError(error: AuthError): boolean {
  const lower = (error.message ?? '').toLowerCase();
  return lower.includes('already registered') || lower.includes('already been registered');
}
