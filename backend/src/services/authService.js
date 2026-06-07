// backend/src/services/authService.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const ROUNDS = 10;

// Role-based session lifetimes. Workers stay logged in longer (field convenience,
// low privilege); managers/admins re-auth daily (they can change data + manage users).
const TTL_BY_ROLE = { worker: '7d', manager: '24h', admin: '24h' };
const DEFAULT_TTL = '24h';

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not set');
  return s;
}

export async function hashSecret(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifySecret(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export function issueToken(payload, { expiresIn } = {}) {
  const ttl = expiresIn || TTL_BY_ROLE[payload.role] || DEFAULT_TTL;
  return jwt.sign(payload, getSecret(), { expiresIn: ttl });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
