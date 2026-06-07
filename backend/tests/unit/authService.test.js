// backend/tests/unit/authService.test.js
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { hashSecret, verifySecret, issueToken, verifyToken } from '../../src/services/authService.js';

describe('authService', () => {
  it('hashSecret + verifySecret roundtrip', async () => {
    const hash = await hashSecret('1234');
    expect(await verifySecret('1234', hash)).toBe(true);
    expect(await verifySecret('9999', hash)).toBe(false);
  });

  it('issueToken + verifyToken roundtrip', () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = issueToken({ sub: 'w1', role: 'worker' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('w1');
    expect(payload.role).toBe('worker');
  });

  it('issueToken applies role-based TTL (worker 7d, manager/admin 24h)', () => {
    process.env.JWT_SECRET = 'test-secret';
    const worker  = jwt.decode(issueToken({ sub: 'w', role: 'worker' }));
    const manager = jwt.decode(issueToken({ sub: 'm', role: 'manager' }));
    const admin   = jwt.decode(issueToken({ sub: 'a', role: 'admin' }));
    expect(worker.exp  - worker.iat).toBe(7 * 24 * 60 * 60);
    expect(manager.exp - manager.iat).toBe(24 * 60 * 60);
    expect(admin.exp   - admin.iat).toBe(24 * 60 * 60);
  });

  it('issueToken honors an explicit expiresIn override', () => {
    process.env.JWT_SECRET = 'test-secret';
    const t = jwt.decode(issueToken({ sub: 'w', role: 'worker' }, { expiresIn: '1h' }));
    expect(t.exp - t.iat).toBe(60 * 60);
  });

  it('verifyToken throws on tampered token', () => {
    process.env.JWT_SECRET = 'test-secret';
    expect(() => verifyToken('not.a.token')).toThrow();
  });

  it('issueToken throws when JWT_SECRET is unset', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() => issueToken({ sub: 'x', role: 'worker' })).toThrow(/JWT_SECRET/);
    } finally {
      process.env.JWT_SECRET = original;
    }
  });

  it('verifyToken throws on expired token', () => {
    process.env.JWT_SECRET = 'test-secret';
    const t = jwt.sign({ sub: 'x', role: 'worker' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    expect(() => verifyToken(t)).toThrow();
  });
});
