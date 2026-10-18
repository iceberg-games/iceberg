// Username + password accounts on top of Supabase email auth.
// Kids never type an email: "<username>@<VITE_USERNAME_EMAIL_DOMAIN>" is used internally.
// Supabase project settings needed: Email provider ON, "Confirm email" OFF (see DEPLOY.md).
import { CONFIG } from './config.js';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const normalizeUsername = (u) => String(u || '').trim().toLowerCase();
export const usernameToEmail = (u) => `${normalizeUsername(u)}@${CONFIG.usernameEmailDomain}`;

export function validateCredentials(username, password) {
  const u = normalizeUsername(username);
  if (!USERNAME_RE.test(u)) return 'Usernames are 3-20 letters, numbers or _';
  if (String(password || '').length < 8) return 'Passwords need at least 8 characters';
  return null;
}

const friendly = (e) => {
  const m = String(e?.message || e);
  if (/invalid login|invalid_grant|invalid credentials/i.test(m)) return 'Wrong username or password';
  if (/already registered|already exists|user_already_exists/i.test(m)) return 'That username is taken';
  if (/database error saving new user|invalid_username/i.test(m)) return 'That username is not allowed';
  if (/network/i.test(m)) return 'Cannot reach the server. Check your connection.';
  return m;
};

export async function signUp(client, { username, password, displayName }) {
  const err = validateCredentials(username, password); if (err) throw new Error(err);
  const u = normalizeUsername(username);
  let free = true;
  try { free = await client.rpc('username_available', { p_username: u }, { anon: true }); } catch { /* server decides */ }
  if (free === false) throw new Error('That username is taken (or not allowed)');
  try {
    const s = await client.signUp({ email: usernameToEmail(u), password, data: { username: u, display_name: (displayName || u).slice(0, 24) } });
    if (!s) throw new Error('Account created. Email confirmation is on in Supabase; turn it off (DEPLOY.md).');
    return s;
  } catch (e) { throw new Error(friendly(e)); }
}

export async function signIn(client, { username, password }) {
  try { return await client.signIn({ email: usernameToEmail(username), password }); }
  catch (e) { throw new Error(friendly(e)); }
}
