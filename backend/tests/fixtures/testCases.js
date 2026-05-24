// tests/fixtures/testCases.js
import { GOOD_TRANSCRIPTIONS, BAD_TRANSCRIPTIONS, EDGE_CASES } from './transcriptions.js';

export const TEST_WORKER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Bob Martinez',
  language: 'en'
};

export const TEST_WORKSITES = {
  simons: {
    id: '660e8400-e29b-41d4-a716-446655440000',
    name: 'Simons Property'
  },
  acme: {
    id: '770e8400-e29b-41d4-a716-446655440000',
    name: 'ACME Construction'
  },
  hyatt: {
    id: '880e8400-e29b-41d4-a716-446655440000',
    name: 'Hyatt Hotel'
  }
};

export function createTestCase(transcriptionKey, category) {
  const categories = {
    good: GOOD_TRANSCRIPTIONS,
    bad: BAD_TRANSCRIPTIONS,
    edge: EDGE_CASES
  };

  const transcription = categories[category][transcriptionKey];

  return {
    name: transcriptionKey,
    category,
    worker: TEST_WORKER,
    transcription: transcription.text,
    expected: transcription.expected,
    mockDate: new Date('2026-05-23T10:00:00Z')
  };
}

export const ALL_TEST_CASES = [
  ...Object.keys(GOOD_TRANSCRIPTIONS).map(key => createTestCase(key, 'good')),
  ...Object.keys(BAD_TRANSCRIPTIONS).map(key => createTestCase(key, 'bad')),
  ...Object.keys(EDGE_CASES).map(key => createTestCase(key, 'edge'))
];
