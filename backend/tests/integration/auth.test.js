// backend/tests/integration/auth.test.js
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret';
beforeAll(() => { process.env.JWT_SECRET = 'test-secret'; });

vi.mock('../../src/db/supabase.js', async () => {
  const { hashSecret } = await import('../../src/services/authService.js');
  const pinHash = await hashSecret('1234');
  const pwHash  = await hashSecret('s3cret');
  return {
    supabase: {
      from: vi.fn((table) => {
        const chain = {
          select: () => chain,
          eq: (col, val) => { chain._col = col; chain._val = val; return chain; },
          single: async () => {
            if (table !== 'workers') return { data: null, error: null };
            if (chain._col === 'phone' && chain._val === '+1-555-0100') {
              return { data: { id: 'w1', name: 'Bob', language: 'en', pin: pinHash, status: 'active', role: 'worker' }, error: null };
            }
            if (chain._col === 'username' && chain._val === 'mgr1') {
              return { data: { id: 'm1', name: 'Manager', role: 'manager', password_hash: pwHash, status: 'active' }, error: null };
            }
            return { data: null, error: null };
          },
        };
        return chain;
      }),
    },
    supabaseAdmin: {},
  };
});

const { default: app } = await import('../../src/server.js');

describe('POST /api/auth/worker/login', () => {
  it('returns token for correct phone+pin', async () => {
    const r = await request(app).post('/api/auth/worker/login').send({ phone: '+1-555-0100', pin: '1234' });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.worker.id).toBe('w1');
  });

  it('rejects wrong pin', async () => {
    const r = await request(app).post('/api/auth/worker/login').send({ phone: '+1-555-0100', pin: '0000' });
    expect(r.status).toBe(401);
  });
});

describe('POST /api/auth/manager/login', () => {
  it('returns token for correct username+password', async () => {
    const r = await request(app).post('/api/auth/manager/login').send({ username: 'mgr1', password: 's3cret' });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.role).toBe('manager');
  });
});

import express from 'express';
import { requireAuth } from '../../src/middleware/requireAuth.js';

describe('requireAuth middleware', () => {
  function makeApp(roles) {
    const a = express();
    a.use(express.json());
    a.get('/protected', requireAuth(roles), (req, res) => res.json({ ok: true, user: req.user }));
    return a;
  }

  it('401 when no Authorization header', async () => {
    const r = await request(makeApp(['manager'])).get('/protected');
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('UNAUTHORIZED');
  });

  it('401 on malformed Authorization header', async () => {
    const r = await request(makeApp(['manager'])).get('/protected').set('Authorization', 'Token xyz');
    expect(r.status).toBe(401);
  });

  it('401 on expired token', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const token = jwt.sign({ sub: 'm1', role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const r = await request(makeApp(['manager'])).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('INVALID_TOKEN');
  });

  it('403 on wrong role', async () => {
    const { issueToken } = await import('../../src/services/authService.js');
    const token = issueToken({ sub: 'w1', role: 'worker' });
    const r = await request(makeApp(['manager'])).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('FORBIDDEN');
  });

  it('200 with user attached on valid token in allowedRoles', async () => {
    const { issueToken } = await import('../../src/services/authService.js');
    const token = issueToken({ sub: 'm1', role: 'manager' });
    const r = await request(makeApp(['manager'])).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ sub: 'm1', role: 'manager' });
  });

  it('case-insensitive Bearer prefix', async () => {
    const { issueToken } = await import('../../src/services/authService.js');
    const token = issueToken({ sub: 'm1', role: 'manager' });
    const r = await request(makeApp(['manager'])).get('/protected').set('Authorization', `bearer ${token}`);
    expect(r.status).toBe(200);
  });
});
