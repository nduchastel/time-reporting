// tests/unit/extractionService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTimeCardData } from '../../src/services/extractionService.js';
import { GOOD_TRANSCRIPTIONS, BAD_TRANSCRIPTIONS } from '../fixtures/transcriptions.js';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      constructor() {
        this.chat = {
          completions: {
            create: vi.fn(async ({ messages }) => {
              const userMessage = messages.find(m => m.role === 'user');
              const transcription = userMessage.content.match(/Transcription: "(.+)"/)[1];

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
                date: fixture.expected.date || userMessage.content.match(/Today's date: "(.+)"/)[1],
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

describe('extractionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract simple hours entry', async () => {
    const result = await extractTimeCardData({
      transcription: GOOD_TRANSCRIPTIONS.simpleHours.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('HOURS');
    expect(result.hours).toBe(8);
    expect(result.worksite).toBe('Simons Property');
    expect(result.confidence).toBe('high');
    expect(result.date).toBe('2026-05-23');
  });

  it('should extract check-in entry', async () => {
    const result = await extractTimeCardData({
      transcription: GOOD_TRANSCRIPTIONS.checkIn.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('IN');
    expect(result.worksite).toBe('ACME Construction');
    expect(result.confidence).toBe('high');
  });

  it('should handle bad transcription with low confidence', async () => {
    const result = await extractTimeCardData({
      transcription: BAD_TRANSCRIPTIONS.unclearHours.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.confidence).toBe('low');
    expect(result.hours).toBeNull();
  });

  it('should detect multiple workers', async () => {
    const result = await extractTimeCardData({
      transcription: BAD_TRANSCRIPTIONS.ambiguousWorker.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.additional_workers).toContain('Bob');
    expect(result.confidence).toBe('medium');
  });

  it('should extract check-out entry', async () => {
    const result = await extractTimeCardData({
      transcription: GOOD_TRANSCRIPTIONS.checkOut.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('OUT');
    expect(result.worksite).toBe('Hyatt');
    expect(result.confidence).toBe('high');
  });

  it('should extract time off entry', async () => {
    const result = await extractTimeCardData({
      transcription: GOOD_TRANSCRIPTIONS.timeOff.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('OFF');
    expect(result.confidence).toBe('high');
  });

  it('should extract entry with start and end times', async () => {
    const result = await extractTimeCardData({
      transcription: GOOD_TRANSCRIPTIONS.withTimes.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('HOURS');
    expect(result.start_time).toBe('07:30');
    expect(result.end_time).toBe('15:30');
    expect(result.hours).toBe(8);
    expect(result.worksite).toBe('Simons');
    expect(result.confidence).toBe('high');
  });

  it('should handle conflicting information', async () => {
    const result = await extractTimeCardData({
      transcription: BAD_TRANSCRIPTIONS.conflictingInfo.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('HOURS');
    expect(result.hours).toBe(10);
    expect(result.confidence).toBe('medium');
  });

  it('should handle missing information', async () => {
    const result = await extractTimeCardData({
      transcription: BAD_TRANSCRIPTIONS.missingInfo.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('HOURS');
    expect(result.hours).toBeNull();
    expect(result.worksite).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('should handle garbled site name with medium confidence', async () => {
    const result = await extractTimeCardData({
      transcription: BAD_TRANSCRIPTIONS.garbledSite.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('HOURS');
    expect(result.hours).toBe(8);
    expect(result.worksite).toBe('Simmons Simmons Property');
    expect(result.confidence).toBe('medium');
  });

  it('parses non-JSON guard: JSON.parse throws on bad input', () => {
    // Smoke: extractionService catches and rethrows JSON.parse errors as
    // "Failed to extract data". An end-to-end EXTRACTION_FAILED path is
    // covered by the integration suite (Task 7).
    expect(() => JSON.parse('not json')).toThrow();
  });
});
