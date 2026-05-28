// backend/tests/e2e/smoke.test.js
// One narrative test: worker logs in, voice-uploads, manager logs in, approves, sees report.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reset, seed } from '../fakes/fakeSupabase.js';
import { registerFixture } from '../fakes/fakeOpenAI.js';
import { hashSecret } from '../../src/services/authService.js';

process.env.JWT_SECRET = 'smoke-secret';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_AUDIO = path.join(here, '..', 'fixtures', 'audio', 'sample.webm');
const today = new Date().toISOString().slice(0, 10);

let app;
beforeAll(async () => {
  ({ default: app } = await import('../../src/server.js?smoke'));
});

describe('full happy path', () => {
  it('worker submits voice, manager approves, summary reflects hours', async () => {
    reset();
    seed({
      workers: [
        { id: 'w1', name: 'Bob', phone: '+1-555-0100', language: 'en', pin: await hashSecret('1234'), status: 'active', role: 'worker' },
        { id: 'm1', name: 'Mgr', username: 'mgr', password_hash: await hashSecret('test-pw'), status: 'active', role: 'manager' },
      ],
      worksites: [{ id: 's1', name: 'Simons Property' }],
    });

    // 1. Worker login
    const wlogin = await request(app).post('/api/auth/worker/login').send({ phone: '+1-555-0100', pin: '1234' });
    expect(wlogin.status).toBe(200);
    const wToken = wlogin.body.token;

    // 2. Register OpenAI fixture by audio hash so both transcription and extraction return the same canned data
    const audioBuffer = fs.readFileSync(SAMPLE_AUDIO);
    registerFixture(audioBuffer, {
      transcription: 'I worked 8 hours at Simons today',
      extraction: { action_type: 'HOURS', hours: 8, worksite: 'Simons Property', confidence: 'high', date: today },
    });

    // 3. Voice upload
    const voice = await request(app).post('/api/time-cards/voice')
      .set('Authorization', `Bearer ${wToken}`)
      .attach('audio', audioBuffer, { filename: 'sample.webm', contentType: 'audio/webm' })
      .field('workerId', 'w1').field('actionType', 'HOURS');
    expect(voice.status).toBe(200);
    expect(voice.body.extractedData.hours).toBe(8);

    // 4. Persist
    const persist = await request(app).post('/api/time-cards')
      .set('Authorization', `Bearer ${wToken}`)
      .send(voice.body.processedData);
    expect(persist.status).toBe(201);
    const tcId = persist.body.id;

    // 5. Manager login
    const mlogin = await request(app).post('/api/auth/manager/login').send({ username: 'mgr', password: 'test-pw' });
    expect(mlogin.status).toBe(200);
    const mToken = mlogin.body.token;

    // 6. Pending list contains the new entry
    const pending = await request(app).get('/api/manager/time-cards?status=pending').set('Authorization', `Bearer ${mToken}`);
    expect(pending.status).toBe(200);
    expect(pending.body.find((c) => c.id === tcId)).toBeTruthy();

    // 7. Approve
    const approve = await request(app).post(`/api/manager/time-cards/${tcId}/approve`).set('Authorization', `Bearer ${mToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('approved');

    // 8. Summary reflects 8 hours for Bob
    const summary = await request(app).get(`/api/manager/reports/summary?startDate=${today}&endDate=${today}`).set('Authorization', `Bearer ${mToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.byWorker.find((w) => w.name === 'Bob')?.hours).toBe(8);

    // 9. CSV contains the entry
    const csv = await request(app).get(`/api/manager/reports/csv?startDate=${today}&endDate=${today}`).set('Authorization', `Bearer ${mToken}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('Bob');
    expect(csv.text).toContain('Simons Property');
  });
});
