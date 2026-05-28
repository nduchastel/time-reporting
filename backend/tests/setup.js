// tests/setup.js
//
// Global test setup. Delegates to the in-memory fakes in tests/fakes/. Each
// test starts with the same baseline seed (see beforeEach) so per-test
// `vi.mock(...)` overrides remain optional. Per-test vi.mock takes precedence
// over the global mocks defined here.

import { vi, beforeEach } from 'vitest';
import * as fakeSupabaseModule from './fakes/fakeSupabase.js';
import FakeOpenAI, {
  reset as resetOpenAI,
  registerFixture,
} from './fakes/fakeOpenAI.js';
import {
  GOOD_TRANSCRIPTIONS,
  BAD_TRANSCRIPTIONS,
  EDGE_CASES,
} from './fixtures/transcriptions.js';
import { TEST_WORKER, TEST_WORKSITES } from './fixtures/testCases.js';

vi.mock('openai', () => ({ default: FakeOpenAI }));
vi.mock('../src/db/supabase.js', () => fakeSupabaseModule);

beforeEach(() => {
  fakeSupabaseModule.reset();
  resetOpenAI();

  // Pre-register every transcription fixture so `extractionService.create({...})`
  // can resolve a canned extraction without scripted setup.
  for (const fix of [
    ...Object.values(GOOD_TRANSCRIPTIONS),
    ...Object.values(BAD_TRANSCRIPTIONS),
    ...Object.values(EDGE_CASES),
  ]) {
    registerFixture(Buffer.from(fix.text), {
      transcription: fix.text,
      extraction: { ...fix.expected },
    });
  }

  // Baseline seed used by integration tests. Tests that need different state
  // can call `_state` / `seed()` from fakeSupabase directly.
  fakeSupabaseModule.seed({
    workers: [
      { id: TEST_WORKER.id, name: TEST_WORKER.name, phone: '+1-555-0000', language: TEST_WORKER.language, role: 'worker', status: 'active' },
      { id: 'wid1', name: 'Worker One', phone: '+1-555-0001', language: 'en', role: 'worker', status: 'active' },
    ],
    worksites: [
      { id: TEST_WORKSITES.simons.id, name: TEST_WORKSITES.simons.name },
      { id: TEST_WORKSITES.acme.id, name: TEST_WORKSITES.acme.name },
      { id: TEST_WORKSITES.hyatt.id, name: TEST_WORKSITES.hyatt.name },
    ],
    time_cards: [
      { id: 'tc1', worker_id: TEST_WORKER.id, worksite_id: TEST_WORKSITES.simons.id, action_type: 'HOURS', date: '2026-05-20', hours: 8, status: 'pending' },
      { id: 'tc2', worker_id: TEST_WORKER.id, worksite_id: TEST_WORKSITES.simons.id, action_type: 'HOURS', date: '2026-05-21', hours: 8, status: 'pending' },
      { id: 'tc3', worker_id: TEST_WORKER.id, worksite_id: TEST_WORKSITES.acme.id, action_type: 'HOURS', date: '2026-05-22', hours: 8, status: 'pending' },
    ],
  });
});
