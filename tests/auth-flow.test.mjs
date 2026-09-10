import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authReturnUrl,
  isEmailConfirmationRequired,
  passwordRecoveryUrl,
  PUBLIC_APP_URL,
} from '../lib/auth-flow.ts';

test('email confirmation always returns to the public app', () => {
  assert.equal(PUBLIC_APP_URL, 'https://leonardorr.github.io/aprende/');
  assert.equal(
    authReturnUrl('student'),
    'https://leonardorr.github.io/aprende/?auth=student',
  );
  assert.equal(
    authReturnUrl('teacher'),
    'https://leonardorr.github.io/aprende/?auth=teacher',
  );
  assert.equal(authReturnUrl('student').includes('localhost'), false);
});

test('password recovery returns to the public password screen', () => {
  assert.equal(
    passwordRecoveryUrl('student'),
    'https://leonardorr.github.io/aprende/?auth=student',
  );
  assert.equal(
    passwordRecoveryUrl('teacher'),
    'https://leonardorr.github.io/aprende/?auth=teacher',
  );
  assert.equal(passwordRecoveryUrl('student').includes('localhost'), false);
});

test('unconfirmed accounts can be offered a new confirmation link', () => {
  assert.equal(isEmailConfirmationRequired('Email not confirmed'), true);
  assert.equal(isEmailConfirmationRequired('Invalid login credentials'), false);
});
