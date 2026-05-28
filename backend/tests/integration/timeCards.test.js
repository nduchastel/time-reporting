// tests/integration/timeCards.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { ALL_TEST_CASES } from '../fixtures/testCases.js';
import { reset, seed } from '../fakes/fakeSupabase.js';
import { registerFixture } from '../fakes/fakeOpenAI.js';

describe('POST /api/time-cards', () => {
  it('should create time card from voice transcription', async () => {
    const testCase = ALL_TEST_CASES.find(tc => tc.name === 'simpleHours');

    const response = await request(app)
      .post('/api/time-cards')
      .send({
        workerId: testCase.worker.id,
        transcription: testCase.transcription,
        audioUrl: 'https://test.com/audio.webm'
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.action_type).toBe('HOURS');
    expect(response.body.hours).toBe(8);
    expect(response.body.confidence).toBe('high');
  });

  it('should handle low confidence transcriptions', async () => {
    const testCase = ALL_TEST_CASES.find(tc => tc.name === 'unclearHours');

    const response = await request(app)
      .post('/api/time-cards')
      .send({
        workerId: testCase.worker.id,
        transcription: testCase.transcription,
        audioUrl: 'https://test.com/audio.webm'
      })
      .expect(201);

    expect(response.body.confidence).toBe('low');
  });
});

describe('GET /api/time-cards', () => {
  it('should get time cards with filters', async () => {
    const response = await request(app)
      .get('/api/time-cards')
      .query({ workerId: 'test-worker-id' })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('POST /api/time-cards/voice — validation', () => {
  beforeEach(() => {
    reset();
    seed({ workers: [{ id: 'w1', name: 'Bob', language: 'en', role: 'worker', status: 'active' }] });
  });

  it('400 when audio file is missing', async () => {
    const r = await request(app).post('/api/time-cards/voice').field('workerId', 'w1').field('actionType', 'HOURS');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_AUDIO');
  });

  it('400 when workerId is missing', async () => {
    const r = await request(app).post('/api/time-cards/voice')
      .attach('audio', Buffer.from('fake'), { filename: 'x.webm', contentType: 'audio/webm' })
      .field('actionType', 'HOURS');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_WORKER_ID');
  });

  it('400 when actionType is missing', async () => {
    const r = await request(app).post('/api/time-cards/voice')
      .attach('audio', Buffer.from('fake'), { filename: 'x.webm', contentType: 'audio/webm' })
      .field('workerId', 'w1');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_ACTION_TYPE');
  });

  it('rejects non-audio mimetype with multer error', async () => {
    const r = await request(app)
      .post('/api/time-cards/voice')
      .attach('audio', Buffer.from('fake'), { filename: 'x.txt', contentType: 'text/plain' })
      .field('workerId', 'w1').field('actionType', 'HOURS');
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/Invalid file type/i);
  });

  it('returns 400 LOW_CONFIDENCE without persisting', async () => {
    const audio = Buffer.from('low-confidence-bytes');
    registerFixture(audio, {
      transcription: 'mumble',
      extraction: { confidence: 'low', hours: null, action_type: 'HOURS' },
    });
    const r = await request(app)
      .post('/api/time-cards/voice')
      .attach('audio', audio, { filename: 'x.webm', contentType: 'audio/webm' })
      .field('workerId', 'w1').field('actionType', 'HOURS');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('LOW_CONFIDENCE');
  });

  it('returns 400 MISSING_HOURS for HOURS action without hours', async () => {
    const audio = Buffer.from('missing-hours-bytes');
    registerFixture(audio, {
      transcription: 'I worked',
      extraction: { confidence: 'high', hours: null, action_type: 'HOURS' },
    });
    const r = await request(app)
      .post('/api/time-cards/voice')
      .attach('audio', audio, { filename: 'x.webm', contentType: 'audio/webm' })
      .field('workerId', 'w1').field('actionType', 'HOURS');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_HOURS');
  });
});

describe('GET /api/time-cards — limit clamping', () => {
  beforeEach(() => {
    reset();
    seed({
      time_cards: Array.from({ length: 1500 }, (_, i) => ({
        id: `tc${i}`, status: 'pending', date: '2026-05-20', hours: 1,
      })),
    });
  });

  it('caps limit at 1000 even when query asks for more', async () => {
    const r = await request(app).get('/api/time-cards?limit=99999');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeLessThanOrEqual(1000);
  });

  it('uses default 100 when limit is invalid', async () => {
    const r = await request(app).get('/api/time-cards?limit=oops');
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(100);
  });
});
