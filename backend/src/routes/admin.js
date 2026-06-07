// backend/src/routes/admin.js
// Admin-only user management. Mounted at /api/admin, gated by requireAuth(['admin']).
import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { hashSecret } from '../services/authService.js';
import { supabase } from '../db/supabase.js';
import { isValidPin, isValidPassword, ROLES, USER_STATUSES, ALLOWED_LANGUAGES } from '../services/validation.js';

const router = express.Router();
router.use(requireAuth(['admin']));

// Never expose secret columns (pin, password_hash).
const PUBLIC_FIELDS = 'id, name, phone, username, language, role, status, must_change_credential, visible_panels, created_at, updated_at';

function mapUserDbError(e, res, next) {
  if (e?.code === '23505') return res.status(409).json({ error: 'DUPLICATE', message: 'A user with that phone or username already exists' });
  if (e?.code === '23514') return res.status(400).json({ error: 'INVALID_VALUE', message: 'One or more fields have an invalid value' });
  if (e?.code === 'PGRST116') return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
  return next(e);
}

async function countActiveAdmins() {
  const { data, error } = await supabase.from('workers').select('id').eq('role', 'admin').eq('status', 'active');
  if (error) throw error;
  return data.length;
}

// GET /users — list across roles (optionally filtered by role/status).
router.get('/users', async (req, res, next) => {
  try {
    let q = supabase.from('workers').select(PUBLIC_FIELDS).order('name', { ascending: true });
    if (req.query.role && ROLES.includes(req.query.role)) q = q.eq('role', req.query.role);
    if (req.query.status && USER_STATUSES.includes(req.query.status)) q = q.eq('status', req.query.status);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// POST /users — create a user of any role with a TEMPORARY secret (forces first-login change).
router.post('/users', async (req, res, next) => {
  try {
    const { role, name, phone, username, password, pin, language = 'en' } = req.body || {};
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'INVALID_ROLE', message: `role must be one of ${ROLES.join(', ')}` });
    }
    if (!name) return res.status(400).json({ error: 'MISSING_FIELDS', message: 'name is required' });

    const row = { name, role, status: 'active', must_change_credential: true };

    if (role === 'worker') {
      if (!phone) return res.status(400).json({ error: 'MISSING_FIELDS', message: 'phone is required for a worker' });
      if (!ALLOWED_LANGUAGES.includes(language)) {
        return res.status(400).json({ error: 'INVALID_LANGUAGE', message: `language must be one of ${ALLOWED_LANGUAGES.join(', ')}` });
      }
      if (!isValidPin(String(pin ?? ''))) {
        return res.status(400).json({ error: 'INVALID_PIN', message: 'PIN must be 4-6 digits' });
      }
      row.phone = phone;
      row.language = language;
      row.pin = await hashSecret(String(pin));
    } else {
      if (!username) return res.status(400).json({ error: 'MISSING_FIELDS', message: 'username is required for a manager/admin' });
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'password must be at least 8 characters' });
      }
      row.username = username;
      row.password_hash = await hashSecret(password);
    }

    const { data, error } = await supabase.from('workers').insert(row).select(PUBLIC_FIELDS).single();
    if (error) return mapUserDbError(error, res, next);
    res.status(201).json(data);
  } catch (e) { next(e); }
});

// PATCH /users/:id — edit profile, change role, enable/disable.
router.patch('/users/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'username', 'language', 'role', 'status'];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    if ('role' in patch && !ROLES.includes(patch.role)) {
      return res.status(400).json({ error: 'INVALID_ROLE', message: `role must be one of ${ROLES.join(', ')}` });
    }
    if ('status' in patch && !USER_STATUSES.includes(patch.status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: `status must be one of ${USER_STATUSES.join(', ')}` });
    }
    if ('language' in patch && !ALLOWED_LANGUAGES.includes(patch.language)) {
      return res.status(400).json({ error: 'INVALID_LANGUAGE', message: `language must be one of ${ALLOWED_LANGUAGES.join(', ')}` });
    }

    // Don't allow demoting or disabling the last remaining active admin.
    const demotes = 'role' in patch && patch.role !== 'admin';
    const disables = 'status' in patch && patch.status !== 'active';
    if (demotes || disables) {
      const { data: target } = await supabase.from('workers').select('id, role, status').eq('id', req.params.id).single();
      if (target && target.role === 'admin' && target.status === 'active' && (await countActiveAdmins()) <= 1) {
        return res.status(400).json({ error: 'LAST_ADMIN', message: 'Cannot demote or disable the last remaining admin' });
      }
    }

    const { data, error } = await supabase.from('workers').update(patch).eq('id', req.params.id).select(PUBLIC_FIELDS).single();
    if (error) return mapUserDbError(error, res, next);
    res.json(data);
  } catch (e) { next(e); }
});

// POST /users/:id/reset-credential — set a new TEMPORARY secret, re-arm first-login change.
router.post('/users/:id/reset-credential', async (req, res, next) => {
  try {
    const { data: target, error: findErr } = await supabase.from('workers').select('id, role').eq('id', req.params.id).single();
    if (findErr) return mapUserDbError(findErr, res, next);

    const { pin, password } = req.body || {};
    const patch = { must_change_credential: true };
    if (target.role === 'worker') {
      if (!isValidPin(String(pin ?? ''))) return res.status(400).json({ error: 'INVALID_PIN', message: 'PIN must be 4-6 digits' });
      patch.pin = await hashSecret(String(pin));
    } else {
      if (!isValidPassword(password)) return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'password must be at least 8 characters' });
      patch.password_hash = await hashSecret(password);
    }

    const { data, error } = await supabase.from('workers').update(patch).eq('id', req.params.id).select(PUBLIC_FIELDS).single();
    if (error) return mapUserDbError(error, res, next);
    res.json(data);
  } catch (e) { next(e); }
});

// DELETE /users/:id — hard delete. Cannot delete self or the last active admin.
router.delete('/users/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (id === req.user.sub) {
      return res.status(400).json({ error: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own account' });
    }
    const { data: target, error: findErr } = await supabase.from('workers').select('id, role, status').eq('id', id).single();
    if (findErr) return mapUserDbError(findErr, res, next);

    if (target.role === 'admin' && target.status === 'active' && (await countActiveAdmins()) <= 1) {
      return res.status(400).json({ error: 'LAST_ADMIN', message: 'Cannot delete the last remaining admin' });
    }

    const { error } = await supabase.from('workers').delete().eq('id', id);
    if (error) return mapUserDbError(error, res, next);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
