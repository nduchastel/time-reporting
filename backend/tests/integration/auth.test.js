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
