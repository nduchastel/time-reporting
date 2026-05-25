// backend/src/routes/manager.js
import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getTimeCards, updateTimeCard } from '../services/timeCardService.js';
import { hashSecret } from '../services/authService.js';
import { supabase } from '../db/supabase.js';

const router = express.Router();
router.use(requireAuth(['manager', 'admin']));

router.get('/time-cards', async (req, res, next) => {
  try {
    const { status, workerId, startDate, endDate, limit = 50 } = req.query;
    const cards = await getTimeCards({ workerId, status, startDate, endDate, limit });
    res.json(cards);
  } catch (e) { next(e); }
});

const EDITABLE = ['hours', 'start_time', 'end_time', 'date', 'worksite_id', 'notes'];

// Maps Supabase "no rows" error to a 404. PGRST116 is the postgrest code returned by .single() when 0 rows match.
function handleUpdateError(e, res, next) {
  if (e?.code === 'PGRST116') {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Time card not found' });
  }
  return next(e);
}

router.patch('/time-cards/:id', async (req, res, next) => {
  try {
    const fields = {};
    for (const k of EDITABLE) if (k in req.body) fields[k] = req.body[k];
    const card = await updateTimeCard({ id: req.params.id, fields, approverId: req.user.sub, status: 'edited' });
    res.json(card);
  } catch (e) { handleUpdateError(e, res, next); }
});

router.post('/time-cards/:id/approve', async (req, res, next) => {
  try {
    const card = await updateTimeCard({ id: req.params.id, fields: {}, approverId: req.user.sub, status: 'approved' });
    res.json(card);
  } catch (e) { handleUpdateError(e, res, next); }
});

router.post('/time-cards/:id/flag', async (req, res, next) => {
  try {
    const fields = req.body?.notes ? { notes: req.body.notes } : {};
    const card = await updateTimeCard({ id: req.params.id, fields, approverId: req.user.sub, status: 'flagged' });
    res.json(card);
  } catch (e) { handleUpdateError(e, res, next); }
});

router.get('/workers', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, phone, language, role, status, created_at, updated_at')
      .order('name', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

const ALLOWED_LANGUAGES = ['en', 'fr', 'es'];
const ALLOWED_STATUSES = ['active', 'disabled'];
const PIN_RE = /^\d{4,6}$/;

function validatePin(pin) {
  return typeof pin === 'string' && PIN_RE.test(pin);
}

function mapWorkerDbError(e, res, next) {
  // Postgres unique violation (e.g. duplicate phone)
  if (e?.code === '23505') {
    return res.status(409).json({ error: 'DUPLICATE', message: 'A worker with that value already exists' });
  }
  // CHECK constraint violation
  if (e?.code === '23514') {
    return res.status(400).json({ error: 'INVALID_VALUE', message: 'One or more fields have an invalid value' });
  }
  // Single() on no rows
  if (e?.code === 'PGRST116') {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Worker not found' });
  }
  return next(e);
}

router.post('/workers', async (req, res, next) => {
  try {
    const { name, phone, language = 'en', pin } = req.body || {};
    // Manager role is intentionally not creatable via the UI: managers must be DB-seeded
    // (they need a username + password_hash that this endpoint does not collect).
    const role = 'worker';

    if (!name || !phone) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'name and phone required' });
    }
    if (!ALLOWED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'INVALID_LANGUAGE', message: `language must be one of ${ALLOWED_LANGUAGES.join(', ')}` });
    }
    if (pin !== undefined && pin !== '' && !validatePin(String(pin))) {
      return res.status(400).json({ error: 'INVALID_PIN', message: 'PIN must be 4-6 digits' });
    }

    const insertRow = { name, phone, language, role, status: 'active' };
    if (pin) insertRow.pin = await hashSecret(String(pin));
    const { data, error } = await supabase.from('workers').insert(insertRow).select('id, name, phone, language, role, status').single();
    if (error) return mapWorkerDbError(error, res, next);
    res.status(201).json(data);
  } catch (e) { next(e); }
});

router.get('/reports/summary', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const cards = await getTimeCards({ startDate, endDate, limit: 5000 });
    const byWorker = new Map();
    const bySite = new Map();
    let flaggedCount = 0;
    for (const c of cards) {
      if (c.status === 'flagged') flaggedCount++;
      const wKey = c.workers?.name || 'Unknown';
      const sKey = c.worksites?.name || 'Unassigned';
      const hours = Number(c.hours) || 0;
      byWorker.set(wKey, (byWorker.get(wKey) || 0) + hours);
      bySite.set(sKey,   (bySite.get(sKey)   || 0) + hours);
    }
    res.json({
      byWorker:   [...byWorker].map(([name, hours]) => ({ name, hours })).sort((a,b)=>b.hours-a.hours),
      byWorksite: [...bySite].map(([name, hours]) => ({ name, hours })).sort((a,b)=>b.hours-a.hours),
      total: cards.reduce((s, c) => s + (Number(c.hours) || 0), 0),
      flaggedCount,
      count: cards.length,
    });
  } catch (e) { next(e); }
});

router.get('/reports/csv', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const cards = await getTimeCards({ startDate, endDate, limit: 5000 });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="time-cards.csv"');
    res.write('id,worker,worksite,action_type,date,hours,start_time,end_time,status\n');
    for (const c of cards) {
      const cells = [
        c.id, c.workers?.name || '', c.worksites?.name || '',
        c.action_type, c.date, c.hours ?? '', c.start_time ?? '', c.end_time ?? '', c.status,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      res.write(cells.join(',') + '\n');
    }
    res.end();
  } catch (e) { next(e); }
});

router.patch('/workers/:id', async (req, res, next) => {
  try {
    // role is intentionally NOT in the allowlist: prevents privilege escalation
    // (a manager could otherwise PATCH themselves or another worker to role='admin').
    const allowed = ['name', 'phone', 'language', 'status'];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    if ('language' in patch && !ALLOWED_LANGUAGES.includes(patch.language)) {
      return res.status(400).json({ error: 'INVALID_LANGUAGE', message: `language must be one of ${ALLOWED_LANGUAGES.join(', ')}` });
    }
    if ('status' in patch && !ALLOWED_STATUSES.includes(patch.status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: `status must be one of ${ALLOWED_STATUSES.join(', ')}` });
    }
    if (req.body.pin !== undefined && req.body.pin !== '' && !validatePin(String(req.body.pin))) {
      return res.status(400).json({ error: 'INVALID_PIN', message: 'PIN must be 4-6 digits' });
    }
    if (req.body.pin) patch.pin = await hashSecret(String(req.body.pin));

    const { data, error } = await supabase.from('workers').update(patch).eq('id', req.params.id).select('id, name, phone, language, role, status').single();
    if (error) return mapWorkerDbError(error, res, next);
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
