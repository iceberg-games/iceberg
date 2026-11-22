// Settings > Account and Settings > Security & Privacy. Used by the portal settings view.
import { h, clear } from './dom.js';
import { modal, confirmModal, toast } from './overlay.js';
import { signIn } from '../net/auth.js';
import {
  resolveDob, saveDateOfBirth, deactivateAccount, deleteAccount,
  listSessions, revokeSession, revokeOtherSessions, formatLastActive, accountError,
} from '../net/account.js';
import './accountForms.css';

export function accountSettingsCard({ economy, remote, onSignedOut }) {
  const dobVal = resolveDob(economy.profile, remote?.userId);
  const dob = h('input', { name: 'dob', type: 'date', value: dobVal, required: true, min: '1900-01-01', max: new Date().toISOString().slice(0, 10) });
  const msg = h('p.p-error#account-dob-msg');
  const saveBtn = h('button.btn.small', { type: 'button', onclick: async () => {
    msg.textContent = ''; msg.classList.remove('ib-ok');
    saveBtn.disabled = true;
    try {
      const res = await saveDateOfBirth(remote, dob.value, { uid: remote?.userId });
      if (economy.profile) economy.profile.dateOfBirth = res.dateOfBirth || dob.value;
      msg.classList.add('ib-ok');
      msg.textContent = res.localOnly ? 'Saved on this device. It will also be saved to your account when the server update is applied.' : 'Date of birth saved.';
    } catch (e) { msg.textContent = e.message; }
    finally { saveBtn.disabled = false; }
  } }, 'Save date of birth');

  const deactivateBtn = h('button.btn.secondary#deactivate-account', { type: 'button', onclick: async () => {
    const ok = await confirmModal('This hides your profile and signs you out. You can come back by signing in again.', { title: 'Deactivate account?', okLabel: 'Deactivate', cancelLabel: 'Cancel', danger: true });
    if (!ok) return;
    try {
      await deactivateAccount(remote);
      toast('Account deactivated. Sign in again to turn it back on.', '👋');
      await onSignedOut?.({ reason: 'deactivated' });
    } catch (e) { toast(e.message, '⚠️'); }
  } }, 'Deactivate account');

  const deleteBtn = h('button.btn.danger#delete-account', { type: 'button', onclick: () => askDelete({ economy, remote, onSignedOut }) }, 'Delete account');

  return h('div.p-card.ib-settings#settings-account',
    h('h3', 'Account'),
    h('p', `Signed in as @${economy.profile.username}`),
    h('label.ib-auth', 'Date of birth', dob),
    h('div.row', saveBtn), msg,
    h('p.muted.small', 'Deactivating hides your profile and signs you out. Deleting is permanent.'),
    h('div.row', deactivateBtn, deleteBtn));
}

function askDelete({ economy, remote, onSignedOut }) {
  const username = economy.profile.username;
  const typed = h('input', { id: 'delete-username', name: 'confirm-username', autocomplete: 'off', placeholder: username, required: true });
  const err = h('p.p-error');
  const body = h('div',
    h('p.ib-danger-note', `This permanently deletes @${username} and cannot be undone. Type your username to confirm.`),
    h('label.ib-auth', 'Username', typed), err);
  modal({
    title: 'Delete account?',
    className: 'ib-confirm',
    body,
    initialFocus: '#delete-username',
    actions: [
      { label: 'Cancel', value: false },
      { label: 'Delete account', value: true, primary: true, danger: true, onClick: async (close) => {
        err.textContent = '';
        if (String(typed.value || '').trim().toLowerCase() !== String(username).toLowerCase()) {
          err.textContent = `Type ${username} to confirm.`;
          return false;
        }
        try {
          await deleteAccount(remote);
          toast('Your account has been deleted.', '👋');
          close(true);
          await onSignedOut?.({ reason: 'deleted' });
        } catch (e) {
          err.textContent = e.message;
          return false;
        }
      } },
    ],
  });
}

export function securitySettingsCard({ economy, remote, onSignedOut }) {
  const wrap = h('div.p-card.ib-settings#settings-security', h('h3', 'Security & Privacy'), h('p.muted.small', 'Options that make it harder for someone to get into your account.'));
  wrap.append(passwordSection({ economy, remote }), totpSection(remote), sessionsSection({ remote, onSignedOut }));
  return wrap;
}

function passwordSection({ economy, remote }) {
  const cur = h('input', { name: 'current-password', type: 'password', autocomplete: 'current-password', placeholder: 'Current password', required: true });
  const nxt = h('input', { name: 'new-password', type: 'password', autocomplete: 'new-password', placeholder: 'New password (8+ characters)', required: true });
  const msg = h('p.p-error#password-msg');
  const btn = h('button.btn.small', { type: 'submit' }, 'Change password');
  return h('form#form-change-password', { onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = ''; msg.classList.remove('ib-ok');
    if (String(nxt.value || '').length < 8) { msg.textContent = 'Passwords need at least 8 characters'; return; }
    btn.disabled = true;
    try {
      await signIn(remote.client, { username: economy.profile.username, password: cur.value });
      try { await remote.client.updateUser({ password: nxt.value }); }
      catch (err) { throw new Error(accountError(err, { action: 'Changing your password' })); }
      cur.value = ''; nxt.value = '';
      msg.classList.add('ib-ok'); msg.textContent = 'Password changed.';
    } catch (err) { msg.textContent = err.message; }
    finally { btn.disabled = false; }
  } }, h('h4', 'Change password'), cur, nxt, btn, msg);
}

function totpSection(remote) {
  const box = h('div#totp-section', h('h4', 'Two-step verification'), h('p.muted.small', 'Loading…'));
  const render = async () => {
    clear(box).append(h('h4', 'Two-step verification'));
    let factors = [];
    try { factors = await remote.client.listFactors(); }
    catch (e) {
      box.append(h('p.muted.small', accountError(e, { action: 'Two-step verification' })));
      return;
    }
    const list = Array.isArray(factors) ? factors : (factors.factors || []);
    const on = list.find((f) => (f.status === 'verified' || f.status === 'active') && (f.type === 'totp' || f.factor_type === 'totp'));
    if (on) {
      const msg = h('p.p-error');
      box.append(h('p', 'Two-step verification is on for this account.'),
        h('button.btn.secondary.small#totp-off', { type: 'button', onclick: async () => {
          const ok = await confirmModal('Turn off two-step verification? Your account will only need a password to sign in.', { title: 'Turn off two-step verification?', okLabel: 'Turn off', danger: true });
          if (!ok) return;
          try { await remote.client.unenrollFactor(on.id); toast('Two-step verification is off.', '✅'); render(); }
          catch (e) { msg.textContent = accountError(e, { action: 'Turning off two-step verification' }); }
        } }, 'Turn off'), msg);
      return;
    }
    const start = h('button.btn.small#totp-on', { type: 'button', onclick: () => startEnroll() }, 'Turn on two-step verification');
    box.append(h('p.muted.small', 'Add a code from an authenticator app as a second step when you sign in.'), start);
    async function startEnroll() {
      start.disabled = true;
      try {
        const enrolled = await remote.client.enrollTotp('Iceberg');
        const secret = enrolled?.totp?.secret || enrolled?.secret || '';
        const qr = enrolled?.totp?.qr_code || enrolled?.totp?.uri || '';
        const factorId = enrolled?.id;
        const code = h('input', { name: 'totp-code', inputMode: 'numeric', autocomplete: 'one-time-code', placeholder: '6-digit code', maxLength: 8 });
        const msg = h('p.p-error');
        const confirm = h('button.btn.small', { type: 'button', onclick: async () => {
          msg.textContent = '';
          try {
            const ch = await remote.client.challengeFactor(factorId);
            await remote.client.verifyFactor(factorId, { challengeId: ch.id || ch.challenge_id, code: code.value.trim() });
            toast('Two-step verification is on.', '✅');
            render();
          } catch (e) { msg.textContent = accountError(e, { action: 'Turning on two-step verification' }); }
        } }, 'Confirm');
        clear(box).append(
          h('h4', 'Two-step verification'),
          h('p.muted.small', 'Add this key to your authenticator app, then enter a code to confirm.'),
          secret ? h('p.ib-totp-secret', secret) : null,
          qr && String(qr).startsWith('otpauth:') ? h('p.muted.small', qr) : null,
          code, confirm, msg);
      } catch (e) {
        start.disabled = false;
        clear(box).append(h('h4', 'Two-step verification'), h('p.muted.small', accountError(e, { action: 'Two-step verification' })), start);
      }
    }
  };
  queueMicrotask(render);
  return box;
}

function sessionsSection({ remote, onSignedOut }) {
  const listEl = h('ul.ib-session-list#session-list', h('li.muted', 'Loading sessions…'));
  const msg = h('p.p-error#sessions-msg');
  const refresh = async () => {
    msg.textContent = '';
    try {
      const rows = await listSessions(remote);
      clear(listEl);
      if (!rows.length) { listEl.append(h('li.muted', 'No active sessions.')); return; }
      for (const s of rows) {
        const signOutBtn = s.current
          ? h('span.muted.small', '')
          : h('button.btn.secondary.small', { type: 'button', 'data-session': s.id, onclick: async () => {
            try { await revokeSession(remote, s.id); toast('Signed out that session.', '✅'); refresh(); }
            catch (e) { msg.textContent = e.message; }
          } }, 'Sign out');
        listEl.append(h('li.ib-session', { 'data-current': s.current ? '1' : '0' },
          h('div.ib-session-meta',
            h('div.ib-session-name', s.deviceLabel || 'Unknown device', s.current ? h('span.ib-badge', 'This device') : null),
            h('div.ib-session-sub', `Last active: ${formatLastActive(s.lastActive)}`)),
          signOutBtn));
      }
    } catch (e) { clear(listEl).append(h('li.muted', e.message)); }
  };
  const others = h('button.btn.secondary.small#sign-out-others', { type: 'button', onclick: async () => {
    const ok = await confirmModal('This signs out every other device and browser, but keeps you signed in here.', { title: 'Sign out of all other sessions?', okLabel: 'Sign out others' });
    if (!ok) return;
    try { await revokeOtherSessions(remote); toast('Other sessions have been signed out.', '✅'); refresh(); }
    catch (e) { msg.textContent = e.message; }
  } }, 'Sign out of all other sessions');
  queueMicrotask(refresh);
  return h('div#sessions-section', h('h4', 'Active sessions'), h('p.muted.small', 'These are the devices and browsers signed in right now.'), others, listEl, msg);
}
