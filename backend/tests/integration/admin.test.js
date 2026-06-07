// backend/tests/integration/admin.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { reset, seed, _state } from '../fakes/fakeSupabase.js';

process.env.JWT_SECRET = 'test-secret';

const { issueToken } = await import('../../src/services/authService.js');
const { default: app } = await import('../../src/server.js');

const adminToken   = issueToken({ sub: 'admin1', role: 'admin' });
const managerToken = issueToken({ sub: 'm1', role: 'manager' });
const workerToken  = issueToken({ sub: 'w1', role: 'worker' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeEach(() => {
  reset();
  seed({
    workers: [
      { id: 'admin1', name: 'Admin One', username: 'admin', role: 'admin', status: 'active' },
      { id: 'm1', name: 'Manager One', username: 'mgr', role: 'manager', status: 'active' },
      { id: 'w1', name: 'Worker One', phone: '+1-555-0001', role: 'worker', status: 'active' },
    ],
  });
});

describe('admin route guard', () => {
  it('401 without a token', async () => {
    expect((await request(app).get('/api/admin/users')).status).toBe(401);
  });
  it('403 for a manager', async () => {
    expect((await request(app).get('/api/admin/users').set(auth(managerToken))).status).toBe(403);
  });
  it('403 for a worker', async () => {
    expect((await request(app).get('/api/admin/users').set(auth(workerToken))).status).toBe(403);
  });
});

describe('GET /api/admin/users', () => {
  it('lists all users without secret fields', async () => {
    const r = await request(app).get('/api/admin/users').set(auth(adminToken));
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(3);
    for (const u of r.body) {
      expect(u).not.toHaveProperty('pin');
      expect(u).not.toHaveProperty('password_hash');
    }
  });

  it('filters by role', async () => {
    const r = await request(app).get('/api/admin/users?role=worker').set(auth(adminToken));
    expect(r.status).toBe(200);
    expect(r.body.every((u) => u.role === 'worker')).toBe(true);
  });
});

describe('POST /api/admin/users', () => {
  it('creates a worker with a temp PIN and arms first-login change', async () => {
    const r = await request(app).post('/api/admin/users').set(auth(adminToken))
      .send({ role: 'worker', name: 'New Worker', phone: '+1-555-9999', pin: '4321' });
    expect(r.status).toBe(201);
    expect(r.body.role).toBe('worker');
    expect(r.body.must_change_credential).toBe(true);
    expect(r.body).not.toHaveProperty('pin');
  });

  it('creates a manager with a temp password', async () => {
    const r = await request(app).post('/api/admin/users').set(auth(adminToken))
      .send({ role: 'manager', name: 'New Mgr', username: 'newmgr', password: 'temp-pass-1' });
    expect(r.status).toBe(201);
    expect(r.body.role).toBe('manager');
    expect(r.body.must_change_credential).toBe(true);
    expect(r.body).not.toHaveProperty('password_hash');
  });

  it('creates an admin', async () => {
    const r = await request(app).post('/api/admin/users').set(auth(adminToken))
      .send({ role: 'admin', name: 'New Admin', username: 'newadmin', password: 'temp-pass-1' });
    expect(r.status).toBe(201);
    expect(r.body.role).toBe('admin');
  });

  it('rejects an invalid role', async () => {
    const r = await request(app).post('/api/admin/users').set(auth(adminToken))
      .send({ role: 'superuser', name: 'X', username: 'x', password: 'temp-pass-1' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_ROLE');
  });

  it('rejects a worker without a valid PIN', async () => {
    const r = await request(app).post('/api/admin/users').set(auth(adminToken))
      .send({ role: 'worker', name: 'X', phone: '+1-555-1', pin: 'ab' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_PIN');
  });

  it('rejects a manager with a too-short password', async () => {
    const r = await request(app).post('/api/admin/users').set(auth(adminToken))
      .send({ role: 'manager', name: 'X', username: 'shortpw', password: 'short' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_PASSWORD');
  });

  it('maps a duplicate username to 409', async () => {
    const r = await request(app).post('/api/admin/users').set(auth(adminToken))
      .send({ role: 'manager', name: 'Dup', username: 'mgr', password: 'temp-pass-1' });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('DUPLICATE');
  });
});

describe('PATCH /api/admin/users/:id', () => {
  it('changes a role (worker -> manager)', async () => {
    const r = await request(app).patch('/api/admin/users/w1').set(auth(adminToken)).send({ role: 'manager' });
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('manager');
  });

  it('disables a user', async () => {
    const r = await request(app).patch('/api/admin/users/w1').set(auth(adminToken)).send({ status: 'disabled' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('disabled');
  });

  it('cannot demote the last remaining admin', async () => {
    const r = await request(app).patch('/api/admin/users/admin1').set(auth(adminToken)).send({ role: 'manager' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('LAST_ADMIN');
  });
});

describe('POST /api/admin/users/:id/reset-credential', () => {
  it('re-arms first-login change after resetting a worker PIN', async () => {
    // clear the flag first so we can observe it being re-set
    _state.workers.find((w) => w.id === 'w1').must_change_credential = false;
    const r = await request(app).post('/api/admin/users/w1/reset-credential').set(auth(adminToken)).send({ pin: '5678' });
    expect(r.status).toBe(200);
    expect(r.body.must_change_credential).toBe(true);
  });

  it('rejects an invalid new password for a manager', async () => {
    const r = await request(app).post('/api/admin/users/m1/reset-credential').set(auth(adminToken)).send({ password: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_PASSWORD');
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('cannot delete self', async () => {
    const r = await request(app).delete('/api/admin/users/admin1').set(auth(adminToken));
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('CANNOT_DELETE_SELF');
  });

  it('deletes a non-admin user', async () => {
    const r = await request(app).delete('/api/admin/users/w1').set(auth(adminToken));
    expect(r.status).toBe(204);
    expect(_state.workers.some((w) => w.id === 'w1')).toBe(false);
  });

  it('cannot delete the last active admin', async () => {
    // Make admin1 (the caller) disabled so admin2 is the only ACTIVE admin,
    // then deleting admin2 (not self) must be blocked.
    reset();
    seed({
      workers: [
        { id: 'admin1', name: 'Caller', username: 'admin', role: 'admin', status: 'disabled' },
        { id: 'admin2', name: 'Last Active', username: 'admin2', role: 'admin', status: 'active' },
      ],
    });
    const r = await request(app).delete('/api/admin/users/admin2').set(auth(adminToken));
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('LAST_ADMIN');
  });
});
