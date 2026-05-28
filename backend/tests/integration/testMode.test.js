// backend/tests/integration/testMode.test.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret';

describe('test-mode endpoints', () => {
  it('404 when TEST_MODE is unset', async () => {
    delete process.env.TEST_MODE;
    const { default: app } = await import('../../src/server.js?off');
    const r = await request(app).post('/__test__/reset');
    expect(r.status).toBe(404);
  });

  it('200 when TEST_MODE=1 and resets fakes', async () => {
    process.env.TEST_MODE = '1';
    process.env.NODE_ENV = 'test';
    const { default: app } = await import('../../src/server.js?on');
    const seed = await request(app).post('/__test__/seed').send({ workers: [{ id: 'w1', name: 'Bob', phone: '+1', status: 'active', role: 'worker' }] });
    expect(seed.status).toBe(200);
    const reset = await request(app).post('/__test__/reset');
    expect(reset.status).toBe(200);
  });

  it('refuses to mount in production even with TEST_MODE=1', async () => {
    process.env.TEST_MODE = '1';
    process.env.NODE_ENV = 'production';
    const { default: app } = await import('../../src/server.js?prod');
    const r = await request(app).post('/__test__/reset');
    expect(r.status).toBe(404);
  });
});
