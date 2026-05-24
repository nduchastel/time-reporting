// backend/src/routes/manager.js
import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { supabase } from '../db/supabase.js';
import { getTimeCards, updateTimeCard } from '../services/timeCardService.js';

const router = express.Router();
router.use(requireAuth(['manager', 'admin']));

router.get('/time-cards', async (req, res, next) => {
  try {
    const { status, workerId, worksiteId, startDate, endDate, limit = 50 } = req.query;
    const cards = await getTimeCards({ workerId, status, startDate, endDate, limit });
    res.json(cards);
  } catch (e) { next(e); }
});

const EDITABLE = ['hours', 'start_time', 'end_time', 'date', 'worksite_id', 'notes'];

router.patch('/time-cards/:id', async (req, res, next) => {
  try {
    const fields = {};
    for (const k of EDITABLE) if (k in req.body) fields[k] = req.body[k];
    const card = await updateTimeCard({ id: req.params.id, fields, approverId: req.user.sub, status: 'edited' });
    res.json(card);
  } catch (e) { next(e); }
});

router.post('/time-cards/:id/approve', async (req, res, next) => {
  try {
    const card = await updateTimeCard({ id: req.params.id, fields: {}, approverId: req.user.sub, status: 'approved' });
    res.json(card);
  } catch (e) { next(e); }
});

router.post('/time-cards/:id/flag', async (req, res, next) => {
  try {
    const fields = req.body?.notes ? { notes: req.body.notes } : {};
    const card = await updateTimeCard({ id: req.params.id, fields, approverId: req.user.sub, status: 'flagged' });
    res.json(card);
  } catch (e) { next(e); }
});

export default router;
