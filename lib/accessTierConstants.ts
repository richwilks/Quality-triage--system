// Pure constant, no imports - safe to use from both server code
// (lib/accessTier.ts, the check-user-limit API route) and client components
// (the admin feature-toggle UI), unlike lib/accessTier.ts itself which pulls
// in the server-only Supabase client.
export const RESTRICTED_USER_LIMIT = 5
