// tests/integration/timeCards.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret';

import app from '../../src/server.js';
import { ALL_TEST_CASES, TEST_WORKER } from '../fixtures/testCases.js';
import { reset, seed } from '../fakes/fakeSupabase.js';
import { registerFixture } from '../fakes/fakeOpenAI.js';
import { issueToken } from '../../src/services/authService.js';

const workerToken  = issueToken({ sub: TEST_WORKER.id, role: 'worker' });
const managerToken = issueToken({ sub: 'm1', role: 'manager' });

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
  it('should get time cards with filters (manager token)', async () => {
    const response = await request(app)
      .get('/api/time-cards')
      .query({ workerId: 'test-worker-id' })
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('GET /api/time-cards — ownership (A1)', () => {
  beforeEach(() => {
    reset();
    seed({
      workers: [
        { id: TEST_WORKER.id, name: 'Bob', phone: '+1-555-0000', role: 'worker', status: 'active' },
        { id: 'wid1', name: 'Other', phone: '+1-555-0001', role: 'worker', status: 'active' },
      ],
      time_cards: [
        { id: 'own1', worker_id: TEST_WORKER.id, action_type: 'HOURS', date: '2026-05-20', hours: 8, status: 'pending' },
        { id: 'own2', worker_id: TEST_WORKER.id, action_type: 'HOURS', date: '2026-05-21', hours: 8, status: 'pending' },
        { id: 'other1', worker_id: 'wid1', action_type: 'HOURS', date: '2026-05-20', hours: 8, status: 'pending' },
      ],
    });
  });

  it('rejects unauthenticated request with 401', async () => {
    const r = await request(app).get('/api/time-cards');
    expect(r.status).toBe(401);
  });

  it('worker sees only their own cards', async () => {
    const r = await request(app).get('/api/time-cards').set('Authorization', `Bearer ${workerToken}`);
    expect(r.status).toBe(200);
    expect(r.body.map((c) => c.id).sort()).toEqual(['own1', 'own2']);
  });

  it('worker cannot read another worker by passing workerId (override ignored)', async () => {
    const r = await request(app)
      .get('/api/time-cards?workerId=wid1')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(r.status).toBe(200);
    expect(r.body.every((c) => c.worker_id === TEST_WORKER.id)).toBe(true);
    expect(r.body.some((c) => c.id === 'other1')).toBe(false);
  });

  it('manager can read any worker', async () => {
    const r = await request(app)
      .get('/api/time-cards?workerId=wid1')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.body.map((c) => c.id)).toEqual(['other1']);
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
    const r = await request(app).get('/api/time-cards?limit=99999').set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.body.length).toBeLessThanOrEqual(1000);
  });

  it('uses default 100 when limit is invalid', async () => {
    const r = await request(app).get('/api/time-cards?limit=oops').set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(100);
  });
});
