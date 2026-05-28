// frontend/src/test/WorkerReview.test.jsx
// Exercises the review section of WorkerUI: extracted-data display, Submit, Re-record.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkerUI from '../components/WorkerUI';

class MockMediaRecorder {
  static instances = [];
  constructor() {
    this.state = 'inactive';
    this.mimeType = 'audio/webm';
    MockMediaRecorder.instances.push(this);
  }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1])], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  MockMediaRecorder.instances = [];
  global.MediaRecorder = MockMediaRecorder;
  global.navigator.mediaDevices = {
    getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
  };
  localStorage.clear();
  localStorage.setItem('time-reporting.worker', JSON.stringify({ id: 'w1', token: 't' }));
  vi.restoreAllMocks();
});

async function recordSuccessfully() {
  fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
  await waitFor(() => expect(MockMediaRecorder.instances.length).toBe(1));
  act(() => MockMediaRecorder.instances[0].stop());
}

describe('WorkerUI review section', () => {
  it('shows extracted data after recording', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        transcription: 'I worked 8 hours at Simons',
        extractedData: { action_type: 'HOURS', hours: 8, worksite: 'Simons', confidence: 'high' },
        processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
      }),
    });
    render(<WorkerUI />);
    await recordSuccessfully();
    await waitFor(() => expect(screen.getByText(/Worksite:/i)).toBeInTheDocument());
    expect(screen.getByText(/Worksite:/i).parentElement.textContent).toMatch(/Simons/);
    expect(screen.getByText(/Confidence:/i).parentElement.textContent).toMatch(/high/);
  });

  it('Submit POSTs to /api/time-cards', async () => {
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcription: 'I worked 8 hours',
          extractedData: { action_type: 'HOURS', hours: 8, confidence: 'high' },
          processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tc1' }) });
    render(<WorkerUI />);
    await recordSuccessfully();
    await waitFor(() => expect(screen.getByRole('button', { name: /^submit$/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/time-cards$/);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(await screen.findByText(/time card submitted/i)).toBeInTheDocument();
  });

  it('Re-record disables Submit until next recording', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        transcription: 'I worked 8 hours',
        extractedData: { action_type: 'HOURS', hours: 8, confidence: 'high' },
        processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
      }),
    });
    render(<WorkerUI />);
    await recordSuccessfully();
    await waitFor(() => expect(screen.getByRole('button', { name: /^submit$/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /re-record/i }));
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeDisabled();
  });
});
