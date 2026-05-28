// frontend/src/test/testMode.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RecordButton from '../components/RecordButton';

const setSearch = (qs) => {
  // jsdom: use URL replace + history. Reload not needed because component reads on mount.
  Object.defineProperty(window, 'location', { value: new URL(`http://localhost/?${qs}`), writable: true });
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('time-reporting.worker', JSON.stringify({ id: 'w1', token: 't' }));
  vi.restoreAllMocks();
});
afterEach(() => {
  Object.defineProperty(window, 'location', { value: new URL('http://localhost/'), writable: true });
});

describe('RecordButton ?testMode=1', () => {
  it('renders the test-mode submit button when ?testMode=1', () => {
    setSearch('testMode=1');
    render(<RecordButton isRecording={false} setIsRecording={() => {}} onTranscription={() => {}} onExtractedData={() => {}} onProcessedData={() => {}} actionType="HOURS" />);
    expect(screen.getByRole('button', { name: /submit fake recording/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tap to record/i })).toBeNull();
  });

  it('renders the real record button without ?testMode=1', () => {
    setSearch('');
    render(<RecordButton isRecording={false} setIsRecording={() => {}} onTranscription={() => {}} onExtractedData={() => {}} onProcessedData={() => {}} actionType="HOURS" />);
    expect(screen.getByRole('button', { name: /tap to record/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit fake recording/i })).toBeNull();
  });

  it('test-mode button POSTs to /voice with a fixed audio fixture', async () => {
    setSearch('testMode=1');
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        transcription: 'fake', extractedData: { action_type: 'HOURS', hours: 8, confidence: 'high' },
        processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
      }),
    });
    render(<RecordButton isRecording={false} setIsRecording={() => {}} onTranscription={() => {}} onExtractedData={() => {}} onProcessedData={() => {}} actionType="HOURS" />);
    fireEvent.click(screen.getByRole('button', { name: /submit fake recording/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/time-cards\/voice$/);
  });
});
