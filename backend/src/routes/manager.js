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

router.post('/workers', async (req, res, next) => {
  try {
    const { name, phone, language, pin, role = 'worker' } = req.body || {};
    if (!name || !phone) return res.status(400).json({ error: 'MISSING_FIELDS', message: 'name and phone required' });
    const insertRow = { name, phone, language: language || 'en', role, status: 'active' };
    if (pin) insertRow.pin = await hashSecret(String(pin));
    const { data, error } = await supabase.from('workers').insert(insertRow).select('id, name, phone, language, role, status').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
});

router.patch('/workers/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'language', 'status', 'role'];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    if (req.body.pin) patch.pin = await hashSecret(String(req.body.pin));
    const { data, error } = await supabase.from('workers').update(patch).eq('id', req.params.id).select('id, name, phone, language, role, status').single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
