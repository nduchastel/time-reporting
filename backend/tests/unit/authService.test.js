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
