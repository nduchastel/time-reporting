// backend/tests/integration/manager.test.js
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

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

  it('approves a time card', async () => {
    const r = await request(app)
      .post('/api/manager/time-cards/tc1/approve')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
  });
});
