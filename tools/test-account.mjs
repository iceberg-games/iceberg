// Unit tests for date-of-birth validation, device labels, and account error mapping.
import assert from 'node:assert/strict';
import { validateDateOfBirth, deviceLabel, formatLastActive, accountError, formatDob } from '../src/net/account.js';

const now = new Date(Date.UTC(2026, 10, 22)); // 2026-11-22

assert.equal(validateDateOfBirth('', { now }), 'Enter your date of birth');
assert.equal(validateDateOfBirth('2000-13-01', { now }), 'Use a valid date');
assert.equal(validateDateOfBirth('2000-02-30', { now }), 'Use a valid date');
assert.equal(validateDateOfBirth('1899-12-31', { now }), 'Use a valid date');
assert.equal(validateDateOfBirth('2026-11-23', { now }), 'Date of birth can’t be in the future');
assert.equal(validateDateOfBirth('2026-11-22', { now }), null);
assert.equal(validateDateOfBirth('2012-05-01', { now }), null);
assert.equal(validateDateOfBirth('1999-07-04', { now }), null);
assert.equal(formatDob('1999-07-04T00:00:00.000Z'), '1999-07-04');

assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'), 'Chrome on Windows');
assert.equal(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'), 'Safari on iOS');
assert.equal(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'), 'Chrome on macOS');

assert.equal(formatLastActive(new Date(Date.UTC(2026, 10, 22, 0, 0, 0)).toISOString(), { now: Date.UTC(2026, 10, 22, 0, 0, 10) }), 'Just now');
assert.equal(formatLastActive(new Date(Date.UTC(2026, 10, 21, 0, 0, 0)).toISOString(), { now: Date.UTC(2026, 10, 22, 0, 0, 0) }), 'Yesterday');

assert.match(accountError({ status: 404, message: 'PGRST202' }, { action: 'Account deletion' }), /not available yet/);
assert.match(accountError({ code: 'PGRST202', message: 'could not find the function' }, { action: 'Account deletion' }), /not available yet/);

console.log('account helpers: all checks passed');
