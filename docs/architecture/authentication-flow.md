# Authentication and Authorization Flow

## Supported Sign-In Methods

- Email + password
- Google OAuth
- Apple Sign In
- OTP verification (email or SMS)
- Optional 2FA for all roles

## Flow Steps

1. User chooses method (email/social).
2. Identity provider validates credentials (Firebase/Auth0).
3. Backend exchanges identity token and creates/updates user profile.
4. OTP challenge triggered for risky logins or first-time devices.
5. Backend issues:
   - short-lived access JWT
   - rotating refresh token
6. Client stores tokens securely (Keychain/Keystore on mobile).
7. RBAC policy attached to every protected API route.

## Role-Based Access Matrix

- **Patient**
  - own records, own requests, own payments, own consultations
- **Doctor**
  - assigned cases, consultation notes, prescriptions, availability
- **Admin**
  - verification, moderation, analytics, dispute tools, CMS

## Security Hardening

- Device fingerprinting and geo-anomaly checks
- Session revocation on password change
- Brute force protection on auth/OTP endpoints
- Signed action tokens for sensitive operations
