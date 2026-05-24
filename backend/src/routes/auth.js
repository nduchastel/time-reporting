// backend/src/routes/auth.js
import express from 'express';
import { supabase } from '../db/supabase.js';
import { verifySecret, issueToken } from '../services/authService.js';

// Equal-timing dummy: forces a bcrypt compare on the not-found branch
// so attackers can't enumerate valid phones/usernames via response timing.
const TIMING_EQUALIZER_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.ABeTQDUz5JeJZTmUkn0Vt9P9Q3eW';

const router = express.Router();

router.post('/worker/login', async (req, res, next) => {
  try {
    const { phone, pin } = req.body || {};
    if (!phone || !pin) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'phone and pin required' });
    }
    const { data: worker } = await supabase
      .from('workers')
      .select('id, name, language, pin, status, role')
      .eq('phone', phone)
      .single();

    if (!worker || worker.status !== 'active' || !worker.pin) {
      await verifySecret(String(pin), TIMING_EQUALIZER_HASH);
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid phone or PIN' });
    }
    if (!(await verifySecret(String(pin), worker.pin))) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid phone or PIN' });
    }
    const token = issueToken({ sub: worker.id, role: worker.role || 'worker' });
    res.json({
      token,
      worker: { id: worker.id, name: worker.name, language: worker.language },
    });
  } catch (e) { next(e); }
});

router.post('/manager/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'username and password required' });
    }
    const { data: user } = await supabase
      .from('workers')
      .select('id, name, role, password_hash, status')
      .eq('username', username)
      .single();

    if (!user || user.status !== 'active' || !['manager', 'admin'].includes(user.role) || !user.password_hash) {
      await verifySecret(password, TIMING_EQUALIZER_HASH);
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid username or password' });
    }
    if (!(await verifySecret(password, user.password_hash))) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid username or password' });
    }
    const token = issueToken({ sub: user.id, role: user.role });
    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role },
    });
  } catch (e) { next(e); }
});

export default router;
