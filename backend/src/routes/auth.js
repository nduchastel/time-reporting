// backend/src/routes/auth.js
import express from 'express';
import { supabase } from '../db/supabase.js';
import { verifySecret, issueToken, hashSecret } from '../services/authService.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { isValidPin, isValidPassword } from '../services/validation.js';

// Equal-timing dummy: forces a bcrypt compare on the not-found branch
// so attackers can't enumerate valid phones/usernames via response timing.
const TIMING_EQUALIZER_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.ABeTQDUz5JeJZTmUkn0Vt9P9Q3eW';

const router = express.Router();

// Throttle the credential-checking endpoints (per-IP) against brute force.
router.use(['/worker/login', '/manager/login'], authLimiter);

router.post('/worker/login', async (req, res, next) => {
  try {
    const { phone, pin } = req.body || {};
    if (!phone || !pin) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'phone and pin required' });
    }
    const { data: worker } = await supabase
      .from('workers')
      .select('id, name, language, pin, status, role, must_change_credential, visible_panels')
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
      worker: {
        id: worker.id,
        name: worker.name,
        language: worker.language,
        visible_panels: worker.visible_panels,
        must_change_credential: !!worker.must_change_credential,
      },
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
      .select('id, name, role, password_hash, status, must_change_credential')
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
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        must_change_credential: !!user.must_change_credential,
      },
    });
  } catch (e) { next(e); }
});

// Authenticated secret change. Serves both the forced first-login change and
// self-service: the caller proves they hold the current secret, then sets a new
// one (PIN for workers, password for managers/admins) and the
// must_change_credential flag is cleared.
router.post('/change-credential', requireAuth(), async (req, res, next) => {
  try {
    const { currentSecret, newSecret } = req.body || {};
    if (!currentSecret || !newSecret) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'currentSecret and newSecret required' });
    }

    const { data: user } = await supabase
      .from('workers')
      .select('id, role, pin, password_hash')
      .eq('id', req.user.sub)
      .single();
    if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });

    const isWorker = user.role === 'worker';
    const currentHash = isWorker ? user.pin : user.password_hash;
    if (!(await verifySecret(String(currentSecret), currentHash))) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Current secret is incorrect' });
    }

    if (isWorker && !isValidPin(String(newSecret))) {
      return res.status(400).json({ error: 'INVALID_PIN', message: 'PIN must be 4-6 digits' });
    }
    if (!isWorker && !isValidPassword(String(newSecret))) {
      return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'password must be at least 8 characters' });
    }

    const hashed = await hashSecret(String(newSecret));
    const patch = isWorker
      ? { pin: hashed, must_change_credential: false }
      : { password_hash: hashed, must_change_credential: false };
    const { error } = await supabase.from('workers').update(patch).eq('id', user.id).select('id').single();
    if (error) throw error;

    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
