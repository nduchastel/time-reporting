// tests/integration/timeCards.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { ALL_TEST_CASES } from '../fixtures/testCases.js';

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
