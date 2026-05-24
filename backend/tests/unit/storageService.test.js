import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

const uploadFn = vi.fn();
const signFn = vi.fn();

vi.mock('../../src/db/supabase.js', () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({ upload: uploadFn, createSignedUrl: signFn })),
    },
  },
}));

const { uploadAudio } = await import('../../src/services/storageService.js');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('fake audio'));
  uploadFn.mockResolvedValue({ data: { path: 'mock' }, error: null });
  signFn.mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null });
});

describe('storageService.uploadAudio', () => {
  it('returns the signed URL on success', async () => {
    const url = await uploadAudio({ localPath: '/tmp/x.webm', mimeType: 'audio/webm', workerId: 'w1' });
    expect(url).toBe('https://signed.example/x');
  });

  it('uploads with correct key shape, contentType, and upsert=false', async () => {
    await uploadAudio({ localPath: '/tmp/x.webm', mimeType: 'audio/webm', workerId: 'abc-123' });
    expect(uploadFn).toHaveBeenCalledTimes(1);
    const [key, buffer, opts] = uploadFn.mock.calls[0];
    expect(key).toMatch(/^audio\/\d{4}\/\d{2}\/abc-123\/[\w-]+\.webm$/);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(opts).toMatchObject({ contentType: 'audio/webm', upsert: false });
  });

  it('sanitizes unsafe characters in workerId', async () => {
    await uploadAudio({ localPath: '/tmp/x.webm', mimeType: 'audio/webm', workerId: '../evil/w' });
    const [key] = uploadFn.mock.calls[0];
    expect(key).not.toContain('..');
    expect(key).not.toContain('/evil/');
    // sanitized form: '../evil/w' -> '___evil_w' ('.', '.', '/' all become '_')
    expect(key).toMatch(/\/___evil_w\//);
  });

  it('signs URL with 90-day TTL', async () => {
    await uploadAudio({ localPath: '/tmp/x.webm', mimeType: 'audio/webm', workerId: 'w1' });
    const [signedKey, ttl] = signFn.mock.calls[0];
    expect(ttl).toBe(60 * 60 * 24 * 90);
    expect(signedKey).toMatch(/^audio\/\d{4}\/\d{2}\/w1\//);
  });

  it('throws when upload fails', async () => {
    uploadFn.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(
      uploadAudio({ localPath: '/tmp/x.webm', mimeType: 'audio/webm', workerId: 'w1' })
    ).rejects.toThrow(/Audio upload failed: boom/);
  });

  it('throws when signed URL generation fails', async () => {
    signFn.mockResolvedValueOnce({ data: null, error: { message: 'no sign' } });
    await expect(
      uploadAudio({ localPath: '/tmp/x.webm', mimeType: 'audio/webm', workerId: 'w1' })
    ).rejects.toThrow(/Signed URL failed: no sign/);
  });
});
