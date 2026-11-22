// Full-page sign-in gate for the play page when accounts are required and no session is present.
import { accountsEnabled } from '../net/config.js';
import { renderAuthGate } from './accountForms.js';
import { clear } from './dom.js';

export function needsAccountGate(remote) {
  return accountsEnabled() && !remote;
}

export function mountAuthGate(root, { economy, onSignedIn, title, message } = {}) {
  clear(root).append(renderAuthGate({
    economy,
    title: title || 'Sign in to Iceberg',
    message: message || 'An Iceberg account is required to play.',
    onSignedIn: async (remote, info) => { await onSignedIn?.(remote, info); },
  }));
}
