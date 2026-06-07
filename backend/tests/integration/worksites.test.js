// backend/tests/integration/worksites.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { reset, seed } from '../fakes/fakeSupabase.js';

process.env.JWT_SECRET = 'test-secret';

const { issueToken } = await import('../../src/services/authService.js');
const { default: app } = await import('../../src/server.js');

const managerToken = issueToken({ sub: 'm1', role: 'manager' });
const workerToken  = issueToken({ sub: 'w1', role: 'worker' });
const mauth = { Authorization: `Bearer ${managerToken}` };

beforeEach(() => {
  reset();
  seed({
    worksites: [
      { id: 's1', name: 'Active Site' },
      { id: 's2', name: 'Old Site', status: 'archived' },
    ],
  });
});

describe('worksite CRUD (Task 18)', () => {
  it('forbids a worker', async () => {
    const r = await request(app).get('/api/manager/worksites').set('Authorization', `Bearer ${workerToken}`);
    expect(r.status).toBe(403);
  });

  it('lists all worksites', async () => {
    const r = await request(app).get('/api/manager/worksites').set(mauth);
    expect(r.status).toBe(200);
    expect(r.body.map((w) => w.id).sort()).toEqual(['s1', 's2']);
  });

  it('filters to active only (archived excluded)', async () => {
    const r = await request(app).get('/api/manager/worksites?status=active').set(mauth);
    expect(r.status).toBe(200);
    expect(r.body.map((w) => w.id)).toEqual(['s1']);
  });

  it('creates a worksite', async () => {
    const r = await request(app).post('/api/manager/worksites').set(mauth)
      .send({ name: 'New Site', address: '1 Main St', client: 'Acme' });
    expect(r.status).toBe(201);
    expect(r.body.name).toBe('New Site');
    expect(r.body.status).toBe('active');
  });

  it('rejects a missing name', async () => {
    const r = await request(app).post('/api/manager/worksites').set(mauth).send({ address: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_FIELDS');
  });

  it('maps a duplicate name to 409', async () => {
    const r = await request(app).post('/api/manager/worksites').set(mauth).send({ name: 'Active Site' });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('DUPLICATE');
  });

  it('archives a worksite via PATCH', async () => {
    const r = await request(app).patch('/api/manager/worksites/s1').set(mauth).send({ status: 'archived' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('archived');
    const active = await request(app).get('/api/manager/worksites?status=active').set(mauth);
    expect(active.body.map((w) => w.id)).toEqual([]);
  });

  it('rejects an invalid status', async () => {
    const r = await request(app).patch('/api/manager/worksites/s1').set(mauth).send({ status: 'bogus' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_STATUS');
  });
});

describe('archived worksites still resolve on existing time cards', () => {
  it('a card referencing an archived worksite keeps its name', async () => {
    reset();
    seed({
      workers: [{ id: 'w1', name: 'Bob', role: 'worker', status: 'active' }],
      worksites: [{ id: 's2', name: 'Old Site', status: 'archived' }],
      time_cards: [{ id: 'tc1', worker_id: 'w1', worksite_id: 's2', action_type: 'HOURS', date: '2026-05-20', hours: 8, status: 'pending' }],
    });
    const r = await request(app).get('/api/manager/time-cards').set(mauth);
    expect(r.status).toBe(200);
    const card = r.body.find((c) => c.id === 'tc1');
    expect(card.worksites?.name).toBe('Old Site');
  });
});
