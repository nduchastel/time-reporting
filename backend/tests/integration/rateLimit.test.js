// backend/tests/integration/rateLimit.test.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret';

const { default: app } = await import('../../src/server.js');

describe('auth rate limiting (A2)', () => {
  it('lets attempts through up to the limit, then returns 429', async () => {
    // Default limit is 10 per window. These all use an unknown phone, so each
    // request that reaches the handler returns 401; once the limiter trips it
    // short-circuits with 429 before the handler runs.
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      const r = await request(app).post('/api/auth/worker/login').send({ phone: 'unknown', pin: '0000' });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10).every((s) => s === 429)).toBe(true);
    expect(statuses).toContain(429);
  });
});
