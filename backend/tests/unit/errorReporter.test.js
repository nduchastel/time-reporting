// backend/tests/unit/errorReporter.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureError, scrub, isEnabled, configure } from '../../src/services/errorReporter.js';

beforeEach(() => {
  // Default each test to the disabled (no-DSN) state.
  configure({ dsn: null, transport: vi.fn() });
});

describe('errorReporter', () => {
  it('is a no-op when no DSN is configured', () => {
    const transport = vi.fn();
    configure({ dsn: null, transport });
    expect(isEnabled()).toBe(false);
    expect(captureError(new Error('boom'), { route: '/x' })).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it('captures and transports a scrubbed payload when a DSN is set', () => {
    const transport = vi.fn();
    configure({ dsn: 'https://dsn.example/ingest', transport });
    expect(isEnabled()).toBe(true);
    const ok = captureError(new Error('boom'), { route: '/api/x', method: 'GET' });
    expect(ok).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    const payload = transport.mock.calls[0][0];
    expect(payload.message).toBe('boom');
    expect(payload.context).toMatchObject({ route: '/api/x', method: 'GET' });
  });

  it('redacts PII from the reported context', () => {
    const transport = vi.fn();
    configure({ dsn: 'https://dsn.example/ingest', transport });
    captureError(new Error('boom'), { route: '/api/x', pin: '1234', transcription: 'secret words', nested: { password: 'p', keep: 1 } });
    const { context } = transport.mock.calls[0][0];
    expect(context.pin).toBe('[redacted]');
    expect(context.transcription).toBe('[redacted]');
    expect(context.nested.password).toBe('[redacted]');
    expect(context.nested.keep).toBe(1);
    expect(context.route).toBe('/api/x');
  });

  it('scrub() leaves non-sensitive data intact', () => {
    expect(scrub({ a: 1, b: { c: 2, token: 'abc' } })).toEqual({ a: 1, b: { c: 2, token: '[redacted]' } });
  });
});
