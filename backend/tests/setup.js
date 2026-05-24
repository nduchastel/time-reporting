// tests/setup.js
import { vi } from 'vitest';
import { GOOD_TRANSCRIPTIONS, BAD_TRANSCRIPTIONS } from './fixtures/transcriptions.js';

// Mock OpenAI for all tests
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      constructor() {
        this.chat = {
          completions: {
            create: vi.fn(async ({ messages }) => {
              const userMessage = messages.find(m => m.role === 'user');
              const transcription = userMessage.content.match(/Transcription: "(.+)"/)?.[1];

              if (!transcription) {
                throw new Error('No transcription found in message');
              }

              // Find matching fixture
              const allTranscriptions = { ...GOOD_TRANSCRIPTIONS, ...BAD_TRANSCRIPTIONS };
              const fixture = Object.values(allTranscriptions).find(t => t.text === transcription);

              if (!fixture) {
                throw new Error(`No mock data for transcription: ${transcription}`);
              }

              // Build response from expected data
              const extracted = {
                action_type: fixture.expected.action_type,
                worker: fixture.expected.worker || null,
                worksite: fixture.expected.worksite || null,
                hours: fixture.expected.hours !== undefined ? fixture.expected.hours : null,
                start_time: fixture.expected.start_time || null,
                end_time: fixture.expected.end_time || null,
                date: fixture.expected.date || userMessage.content.match(/Today's date: "(.+)"/)?.[1],
                confidence: fixture.expected.confidence,
                additional_workers: fixture.expected.additional_workers || [],
                notes: fixture.expected.notes || null
              };

              return {
                choices: [{
                  message: {
                    content: JSON.stringify(extracted)
                  }
                }]
              };
            })
          }
        };
      }
    }
  };
});

// Mock Supabase for all tests
vi.mock('../src/db/supabase.js', () => {
  return {
    supabase: {
      from: vi.fn((table) => {
        let insertedData = null;

        const mockChain = {
          select: vi.fn((fields = '*') => mockChain),
          eq: vi.fn(() => mockChain),
          ilike: vi.fn(() => mockChain),
          gte: vi.fn(() => mockChain),
          lte: vi.fn(() => mockChain),
          order: vi.fn(() => mockChain),
          limit: vi.fn(() => mockChain),
          single: vi.fn(async () => {
            // If we have inserted data, return it
            if (insertedData) {
              return {
                data: { id: 'test-timecard-id', ...insertedData },
                error: null
              };
            }

            // Return mock data based on table
            if (table === 'workers') {
              return {
                data: { id: 'test-worker-id', name: 'Bob Martinez' },
                error: null
              };
            }
            if (table === 'worksites') {
              return {
                data: { id: 'test-worksite-id', name: 'Simons Property' },
                error: null
              };
            }
            return { data: null, error: null };
          }),
          insert: vi.fn((data) => {
            insertedData = data;
            return mockChain;
          }),
          update: vi.fn((patch) => {
            insertedData = { id: insertedData?.id || 'test-timecard-id', ...(insertedData || {}), ...patch };
            return mockChain;
          }),
          // For GET queries that don't call .single()
          then: vi.fn(async (resolve) => {
            const result = {
              data: [],
              error: null
            };
            return resolve(result);
          })
        };
        return mockChain;
      })
    },
    supabaseAdmin: {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ data: { path: 'mock/path' }, error: null })),
          createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://mock-signed.example' }, error: null })),
        })),
      },
    }
  };
});
