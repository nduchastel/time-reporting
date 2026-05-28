// backend/tests/fakes/fakeOpenAI.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import OpenAI, { reset, next, failNext, registerFixture } from './fakeOpenAI.js';

beforeEach(() => reset());

describe('fakeOpenAI scripted mode', () => {
  it('chat.completions.create returns the queued response', async () => {
    next({ extraction: { action_type: 'HOURS', hours: 8, confidence: 'high' } });
    const client = new OpenAI();
    const r = await client.chat.completions.create({ messages: [{ role: 'user', content: 'x' }] });
    const parsed = JSON.parse(r.choices[0].message.content);
    expect(parsed.hours).toBe(8);
  });

  it('audio.transcriptions.create returns the queued transcription', async () => {
    next({ transcription: 'hello world' });
    const client = new OpenAI();
    const r = await client.audio.transcriptions.create({ file: 'x', model: 'whisper-1' });
    expect(r).toBe('hello world'); // response_format: 'text' returns a bare string
  });

  it('throws when queue is empty', async () => {
    const client = new OpenAI();
    await expect(client.chat.completions.create({ messages: [] }))
      .rejects.toThrow(/no scripted response/i);
  });

  it('failNext queues a thrown error', async () => {
    failNext({ kind: 'transcription', error: new Error('boom') });
    const client = new OpenAI();
    await expect(client.audio.transcriptions.create({ file: 'x', model: 'whisper-1' })).rejects.toThrow('boom');
  });
});

describe('fakeOpenAI fixture mode', () => {
  it('looks up by audio buffer hash', async () => {
    const buf = Buffer.from('canned audio');
    registerFixture(buf, { transcription: 'eight hours', extraction: { hours: 8, confidence: 'high' } });
    const client = new OpenAI();
    const t = await client.audio.transcriptions.create({ _buffer: buf, model: 'whisper-1' });
    expect(t).toBe('eight hours');
    const e = await client.chat.completions.create({ messages: [{ role: 'user', content: `Transcription: "eight hours"\nWorker name: "x"\nToday's date: "2026-05-27"` }] });
    expect(JSON.parse(e.choices[0].message.content).hours).toBe(8);
  });
});
