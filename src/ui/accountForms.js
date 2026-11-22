// Shared sign-in / sign-up forms used by the portal and the play-page gate.
import { h } from './dom.js';
import { signIn, signUp, validateCredentials } from '../net/auth.js';
import { getRemote, connectStoredSession } from '../net/session.js';
import { accountsEnabled } from '../net/config.js';
import { isBanned, showBanned } from '../net/ban.js';
import './accountForms.css';

export function renderAuthForms({ economy, onSignedIn, guestNote = true } = {}) {
  if (!accountsEnabled()) {
    return h('div.ib-auth-disabled', h('p.muted', 'Accounts are not configured on this build (see DEPLOY.md).'));
  }
  const mk = (mode) => {
    const u = h('input', { name: 'username', placeholder: 'Username', autocomplete: 'username', maxLength: 20, required: true });
    const p = h('input', { name: 'password', type: 'password', placeholder: 'Password (8+ characters)', autocomplete: mode === 'up' ? 'new-password' : 'current-password', required: true });
    const d = mode === 'up' ? h('input', { name: 'display', placeholder: 'Display name (optional)', maxLength: 24 }) : null;
    const dob = mode === 'up' ? h('input', { name: 'dob', type: 'date', required: true, max: new Date().toISOString().slice(0, 10), min: '1900-01-01' }) : null;
    const err = h('p.p-error');
    const btn = h('button.btn', { type: 'submit' }, mode === 'up' ? 'Create account' : 'Sign in');
    const form = h(`form.p-card.p-auth.ib-auth#form-sign${mode}`, { onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      if (mode === 'up') {
        const bad = validateCredentials(u.value, p.value); if (bad) { err.textContent = bad; return; }
      }
      btn.disabled = true;
      try {
        const client = getRemote().client;
        if (mode === 'up') await signUp(client, { username: u.value, password: p.value, displayName: d.value, dateOfBirth: dob.value });
        else await signIn(client, { username: u.value, password: p.value });
        const remote = await connectStoredSession(economy);
        if (await isBanned(remote)) return showBanned();
        if (!remote) throw new Error('Signed in, but the profile could not be loaded.');
        await onSignedIn?.(remote, { mode });
      } catch (ex) { err.textContent = ex.message; }
      finally { btn.disabled = false; }
    } },
      h('h3', mode === 'up' ? 'New here? Create an account' : 'Sign in'),
      h('label', 'Username', u),
      h('label', 'Password', p),
      mode === 'up' ? h('label', 'Display name (optional)', d) : null,
      mode === 'up' ? h('label', 'Date of birth', dob) : null,
      btn, err);
    return form;
  };
  return h('div',
    h('div.p-two.ib-auth-two', mk('in'), mk('up')),
    guestNote ? h('p.muted.small', 'If you had guest progress on this device, it moves to the first account you sign in with. Free demo bucks do not carry over.') : null);
}

export function renderAuthGate({ title = 'Sign in to Iceberg', message = 'An Iceberg account is required to play.', economy, onSignedIn } = {}) {
  return h('div.ib-auth-gate#auth-gate', h('div.ib-auth-gate-inner',
    h('h1', title),
    h('p.muted', message),
    renderAuthForms({ economy, onSignedIn })));
}
