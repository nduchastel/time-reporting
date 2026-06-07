import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureError, scrub, isEnabled, configure } from '../lib/errorReporter';

beforeEach(() => { configure({ dsn: null, transport: vi.fn() }); });

describe('errorReporter (frontend)', () => {
  it('is a no-op without a DSN', () => {
    const transport = vi.fn();
    configure({ dsn: null, transport });
    expect(isEnabled()).toBe(false);
    expect(captureError(new Error('x'), {})).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it('transports a scrubbed payload when configured', () => {
    const transport = vi.fn();
    configure({ dsn: 'https://dsn.example', transport });
    expect(captureError(new Error('x'), { route: '#/worker', pin: '1234' })).toBe(true);
    const payload = transport.mock.calls[0][0];
    expect(payload.message).toBe('x');
    expect(payload.context.route).toBe('#/worker');
    expect(payload.context.pin).toBe('[redacted]');
  });

  it('scrub redacts sensitive keys recursively', () => {
    expect(scrub({ a: 1, b: { password: 'p', token: 't', ok: 2 } })).toEqual({ a: 1, b: { password: '[redacted]', token: '[redacted]', ok: 2 } });
  });
});
