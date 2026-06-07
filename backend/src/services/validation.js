// backend/src/services/validation.js
// Shared credential / field validators used by auth, manager, and admin routes.

export const ROLES = ['worker', 'manager', 'admin'];
export const USER_STATUSES = ['active', 'disabled'];
export const ALLOWED_LANGUAGES = ['en', 'fr', 'es'];
export const PANELS = ['IN', 'OUT', 'HOURS', 'OFF'];

const PIN_RE = /^\d{4,6}$/;
const MIN_PASSWORD_LENGTH = 8;

export function isValidPin(pin) {
  return typeof pin === 'string' && PIN_RE.test(pin);
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

// A worker's secret is a PIN; a manager/admin's secret is a password.
export function secretFieldForRole(role) {
  return role === 'worker' ? 'pin' : 'password_hash';
}

// Validate + normalize a visible_panels array: non-empty subset of PANELS, deduped,
// in canonical order. Returns null if invalid.
export function normalizePanels(panels) {
  if (!Array.isArray(panels) || panels.length === 0) return null;
  if (!panels.every((p) => PANELS.includes(p))) return null;
  return PANELS.filter((p) => panels.includes(p));
}
