// backend/tests/integration/manager.test.js
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { reset, seed } from '../fakes/fakeSupabase.js';

process.env.JWT_SECRET = 'test-secret';

const { issueToken } = await import('../../src/services/authService.js');
const { default: app } = await import('../../src/server.js');

const managerToken = issueToken({ sub: 'm1', role: 'manager' });

describe('manager routes', () => {
  it('rejects request without token', async () => {
    const r = await request(app).get('/api/manager/time-cards');
    expect(r.status).toBe(401);
  });

  it('rejects request with worker role', async () => {
    const t = issueToken({ sub: 'w1', role: 'worker' });
    const r = await request(app).get('/api/manager/time-cards').set('Authorization', `Bearer ${t}`);
    expect(r.status).toBe(403);
  });

  it('approves a time card and propagates status + approver', async () => {
    const r = await request(app)
      .post('/api/manager/time-cards/tc1/approve')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('approved');
    expect(r.body.approved_by).toBe('m1');
    expect(r.body.approved_at).toBeTruthy();
  });

  it('PATCH only honors fields in the EDITABLE allowlist', async () => {
    const r = await request(app)
      .patch('/api/manager/time-cards/tc2')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        hours: 7.5,                        // allowed
        worker_id: 'attacker-uuid',        // disallowed - must be stripped
        status: 'approved',                // disallowed - must be stripped (route forces 'edited')
        transcription: 'tampered',         // disallowed
      });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('edited');                  // route status wins
    expect(r.body.hours).toBe(7.5);                        // allowed field persisted
    expect(r.body.worker_id).not.toBe('attacker-uuid');    // disallowed field stripped
    expect(r.body.transcription).not.toBe('tampered');     // disallowed field stripped
  });

  it('flags a card with notes', async () => {
    const r = await request(app)
      .post('/api/manager/time-cards/tc3/flag')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ notes: 'duplicate entry' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('flagged');
    expect(r.body.notes).toBe('duplicate entry');
  });
});

describe('manager workers', () => {
  it('lists workers', async () => {
    const r = await request(app).get('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
  });

  it('rejects worker creation without name', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`).send({});
    expect(r.status).toBe(400);
  });

  it('creates a worker and never returns pin or password_hash', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'New', phone: '+1-555-0199', language: 'en', pin: '4321' });
    expect(r.status).toBe(201);
    expect(r.body).not.toHaveProperty('pin');
    expect(r.body).not.toHaveProperty('password_hash');
  });

  it('rejects invalid PIN (non-numeric or wrong length)', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1', pin: 'abcd' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_PIN');
  });

  it('rejects invalid language', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1', language: 'de' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_LANGUAGE');
  });

  it('forces role=worker on POST regardless of body input (no privilege escalation)', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Sneaky', phone: '+1-555-0200', role: 'admin' });
    expect(r.status).toBe(201);
    expect(r.body.role).toBe('worker');
  });

  it('PATCH does not honor role field (privilege escalation guard)', async () => {
    const r = await request(app).patch('/api/manager/workers/wid1').set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'admin', name: 'Promoted' });
    expect(r.status).toBe(200);
    expect(r.body.role).not.toBe('admin');
  });
});

describe('manager reports', () => {
  it('returns summary structure', async () => {
    const r = await request(app)
      .get('/api/manager/reports/summary?startDate=2026-01-01&endDate=2026-12-31')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('byWorker');
    expect(r.body).toHaveProperty('byWorksite');
    expect(r.body).toHaveProperty('total');
  });

  it('returns CSV with header row', async () => {
    const r = await request(app)
      .get('/api/manager/reports/csv')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.text.split('\n')[0]).toContain('worker,worksite');
  });
});

describe('manager workers — PIN boundaries', () => {
  beforeEach(() => { reset(); });

  it('rejects PIN of length 3', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1-555-1', pin: '123' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_PIN');
  });

  it('rejects PIN of length 7', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1-555-2', pin: '1234567' });
    expect(r.status).toBe(400);
  });

  it('accepts PIN of length 4', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1-555-3', pin: '4321' });
    expect(r.status).toBe(201);
  });

  it('accepts PIN of length 6', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1-555-4', pin: '123456' });
    expect(r.status).toBe(201);
  });
});

describe('manager reports — CSV escaping & empty state', () => {
  beforeEach(() => {
    reset();
    seed({
      workers: [{ id: 'w1', name: "O'Brien, Inc" }],
      worksites: [{ id: 's1', name: 'Site "A"' }],
      time_cards: [{ id: 't1', worker_id: 'w1', worksite_id: 's1', action_type: 'HOURS', date: '2026-05-20', hours: 8, status: 'pending', created_at: new Date().toISOString() }],
    });
  });

  it('escapes quotes and commas in CSV cells', async () => {
    const r = await request(app).get('/api/manager/reports/csv').set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/"O'Brien, Inc"/);
    expect(r.text).toMatch(/"Site ""A"""/);
  });

  it('summary returns zeros for empty range', async () => {
    reset();
    const r = await request(app).get('/api/manager/reports/summary?startDate=2030-01-01&endDate=2030-12-31').set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ byWorker: [], byWorksite: [], total: 0, flaggedCount: 0, count: 0 });
  });
});
