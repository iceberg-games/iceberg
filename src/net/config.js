// Build-time configuration (Vite env). Set in .env.production / CI secrets:
//   VITE_SUPABASE_URL=https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<anon public key>          (public by design; RLS protects data)
//   VITE_USERNAME_EMAIL_DOMAIN=users.example.com      (usernames map to <name>@<domain> for Supabase Auth)
//   VITE_ICEBERG_SITE=1                               (production site build: no demo bucks)
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const CONFIG = {
  supabaseUrl: (env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
  anonKey: env.VITE_SUPABASE_ANON_KEY || '',
  usernameEmailDomain: env.VITE_USERNAME_EMAIL_DOMAIN || 'users.iceberg.invalid',
  isSite: env.VITE_ICEBERG_SITE === '1',
  isDev: !!env.DEV,
};

/** Accounts are available only when a backend URL + anon key were baked into the build. */
export const accountsEnabled = () => !!(CONFIG.supabaseUrl && CONFIG.anonKey);

/** Free demo Birg Bucks (demo packs + dev grants) exist only outside the production site build. */
export const demoBucksAllowed = () => !CONFIG.isSite;
