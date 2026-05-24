import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadAudio } from '../../src/services/storageService.js';
import fs from 'node:fs';

vi.mock('../../src/db/supabase.js', () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: { path: 'audio/2026/abc.webm' }, error: null })),
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://signed.example/abc' }, error: null })),
      })),
    },
  },
}));

describe('storageService.uploadAudio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads file and returns a signed URL', async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValueOnce(Buffer.from('fake audio'));
    const url = await uploadAudio({
      localPath: '/tmp/uploads/x.webm',
      mimeType: 'audio/webm',
      workerId: 'w1',
    });
    expect(url).toBe('https://signed.example/abc');
  });
});
