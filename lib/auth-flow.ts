export type AuthRole = 'student' | 'teacher';

export const PUBLIC_APP_URL = 'https://leonardorr.github.io/aprende/';

export function authReturnUrl(role: AuthRole) {
  return `${PUBLIC_APP_URL}?auth=${role}`;
}

export function isEmailConfirmationRequired(message: string) {
  return message.toLowerCase().includes('email not confirmed');
}
