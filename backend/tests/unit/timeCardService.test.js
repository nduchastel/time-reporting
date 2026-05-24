// tests/unit/timeCardService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTimeCard, getTimeCards } from '../../src/services/timeCardService.js';

vi.mock('../../src/db/supabase.js', () => {
  const createChainableQuery = () => {
    const chain = {
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      then: vi.fn((resolve) => resolve({ data: [], error: null }))
    };
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { id: 'test-id', status: 'pending' },
              error: null
            }))
          }))
        })),
        select: vi.fn(() => ({
          order: vi.fn(() => createChainableQuery())
        }))
      }))
    }
  };
});

describe('timeCardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a time card', async () => {
    const timeCard = await createTimeCard({
      workerId: 'worker-123',
      worksiteId: 'site-456',
      actionType: 'HOURS',
      date: '2026-05-23',
      hours: 8,
      transcription: 'I worked 8 hours',
      extractedData: { confidence: 'high' },
      audioUrl: 'https://storage/audio.webm'
    });

    expect(timeCard).toBeDefined();
    expect(timeCard.status).toBe('pending');
  });

  it('should get time cards with filters', async () => {
    const timeCards = await getTimeCards({
      workerId: 'worker-123',
      status: 'pending'
    });

    expect(Array.isArray(timeCards)).toBe(true);
  });
});
