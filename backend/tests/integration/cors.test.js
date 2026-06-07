// backend/tests/integration/cors.test.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret';
process.env.ALLOWED_ORIGINS = 'https://allowed.example.com';

const { default: app } = await import('../../src/server.js');

describe('CORS allowlist (A3)', () => {
  it('reflects an allowlisted origin', async () => {
    const r = await request(app).get('/health').set('Origin', 'https://allowed.example.com');
    expect(r.status).toBe(200);
    expect(r.headers['access-control-allow-origin']).toBe('https://allowed.example.com');
  });

  it('does not grant CORS to a disallowed origin', async () => {
    const r = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows requests with no Origin (curl / same-origin / mobile webview)', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
  });
});
