// backend/tests/integration/credentials.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { reset, seed, _state } from '../fakes/fakeSupabase.js';

process.env.JWT_SECRET = 'test-secret';

const { issueToken, hashSecret, verifySecret } = await import('../../src/services/authService.js');
const { createAdmin } = await import('../../src/db/create-admin.js');
const { default: app } = await import('../../src/server.js');

const workerToken  = issueToken({ sub: 'w1', role: 'worker' });
const managerToken = issueToken({ sub: 'm1', role: 'manager' });

describe('POST /api/auth/change-credential', () => {
  beforeEach(async () => {
    reset();
    seed({
      workers: [
        { id: 'w1', name: 'Worker', phone: '+1-555-0001', role: 'worker', status: 'active', pin: await hashSecret('1234'), must_change_credential: true },
        { id: 'm1', name: 'Manager', username: 'mgr', role: 'manager', status: 'active', password_hash: await hashSecret('old-password'), must_change_credential: true },
      ],
    });
  });

  it('worker changes PIN and the flag clears', async () => {
    const r = await request(app).post('/api/auth/change-credential')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ currentSecret: '1234', newSecret: '5678' });
    expect(r.status).toBe(200);
    const row = _state.workers.find((w) => w.id === 'w1');
    expect(row.must_change_credential).toBe(false);
    expect(await verifySecret('5678', row.pin)).toBe(true);
    expect(await verifySecret('1234', row.pin)).toBe(false);
  });

  it('rejects a wrong current secret', async () => {
    const r = await request(app).post('/api/auth/change-credential')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ currentSecret: '0000', newSecret: '5678' });
    expect(r.status).toBe(401);
    expect(_state.workers.find((w) => w.id === 'w1').must_change_credential).toBe(true);
  });

  it('rejects an invalid new PIN', async () => {
    const r = await request(app).post('/api/auth/change-credential')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ currentSecret: '1234', newSecret: 'ab' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_PIN');
  });

  it('manager changes password (min length enforced)', async () => {
    const short = await request(app).post('/api/auth/change-credential')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ currentSecret: 'old-password', newSecret: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.error).toBe('INVALID_PASSWORD');

    const ok = await request(app).post('/api/auth/change-credential')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ currentSecret: 'old-password', newSecret: 'new-password-1' });
    expect(ok.status).toBe(200);
    expect(_state.workers.find((w) => w.id === 'm1').must_change_credential).toBe(false);
  });

  it('requires authentication', async () => {
    const r = await request(app).post('/api/auth/change-credential').send({ currentSecret: '1234', newSecret: '5678' });
    expect(r.status).toBe(401);
  });
});

describe('login surfaces must_change_credential', () => {
  it('worker login returns the flag', async () => {
    reset();
    seed({ workers: [{ id: 'w1', name: 'W', phone: '+1-555-7', role: 'worker', status: 'active', pin: await hashSecret('1234'), must_change_credential: true }] });
    const r = await request(app).post('/api/auth/worker/login').send({ phone: '+1-555-7', pin: '1234' });
    expect(r.status).toBe(200);
    expect(r.body.worker.must_change_credential).toBe(true);
  });

  it('manager login returns the flag', async () => {
    reset();
    seed({ workers: [{ id: 'm1', name: 'M', username: 'mgr2', role: 'manager', status: 'active', password_hash: await hashSecret('a-password'), must_change_credential: true }] });
    const r = await request(app).post('/api/auth/manager/login').send({ username: 'mgr2', password: 'a-password' });
    expect(r.status).toBe(200);
    expect(r.body.user.must_change_credential).toBe(true);
  });
});

describe('createAdmin bootstrap (Task 17)', () => {
  beforeEach(() => { reset(); });

  it('inserts an active admin with a hashed password and no forced change', async () => {
    const admin = await createAdmin({ username: 'boss', password: 'boss-password-1', name: 'The Boss' });
    expect(admin.role).toBe('admin');
    expect(admin.status).toBe('active');
    const row = _state.workers.find((w) => w.id === admin.id);
    expect(row.must_change_credential).toBe(false);
    expect(await verifySecret('boss-password-1', row.password_hash)).toBe(true);
  });

  it('rejects a too-short password', async () => {
    await expect(createAdmin({ username: 'x', password: 'short' })).rejects.toThrow(/at least 8/);
  });

  it('rejects a duplicate username', async () => {
    await createAdmin({ username: 'dup', password: 'boss-password-1' });
    await expect(createAdmin({ username: 'dup', password: 'boss-password-1' })).rejects.toThrow(/already exists/);
  });
});
