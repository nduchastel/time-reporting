// backend/src/db/create-admin.js
//
// One-time bootstrap CLI: creates the very first admin so there's someone who can
// log in and create everyone else through the admin portal (chicken-and-egg).
//
//   node src/db/create-admin.js <username> <password> [name...]
//
// The password is bcrypt-hashed; nothing is stored in plaintext. must_change_credential
// is left false for the bootstrap admin (the operator chose the password themselves).
// See docs/security.md.
import dotenv from 'dotenv';
import { supabase } from './supabase.js';
import { hashSecret } from '../services/authService.js';
import { isValidPassword } from '../services/validation.js';

dotenv.config();

export async function createAdmin({ username, password, name }) {
  if (!username || !password) throw new Error('username and password are required');
  if (!isValidPassword(password)) throw new Error('password must be at least 8 characters');

  const password_hash = await hashSecret(password);
  const { data, error } = await supabase
    .from('workers')
    .insert({
      name: name || username,
      username,
      password_hash,
      role: 'admin',
      status: 'active',
      must_change_credential: false,
    })
    .select('id, name, username, role, status')
    .single();

  if (error) {
    if (error.code === '23505') throw new Error(`username "${username}" already exists`);
    throw error;
  }
  return data;
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , username, password, ...nameParts] = process.argv;
  const name = nameParts.join(' ') || undefined;
  if (!username || !password) {
    console.error('Usage: node src/db/create-admin.js <username> <password> [name]');
    process.exit(1);
  }
  createAdmin({ username, password, name })
    .then((admin) => { console.log('Created admin:', admin); process.exit(0); })
    .catch((err) => { console.error('Failed to create admin:', err.message); process.exit(1); });
}
