// src/test/RecordButton.test.jsx
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RecordButton from '../components/RecordButton';

class MockMediaRecorder {
  static instances = [];
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.mimeType = 'audio/webm';
    this.ondataavailable = null;
    this.onstop = null;
    MockMediaRecorder.instances.push(this);
  }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }) });
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
});

function setup() {
  const onTranscription = vi.fn();
  const onExtractedData = vi.fn();
  const onProcessedData = vi.fn();
  const setIsRecording = vi.fn();
  render(
    <RecordButton
      isRecording={false}
      setIsRecording={setIsRecording}
      onTranscription={onTranscription}
      onExtractedData={onExtractedData}
      onProcessedData={onProcessedData}
      actionType="HOURS"
    />
  );
  return { onTranscription, onExtractedData, onProcessedData, setIsRecording };
}

describe('RecordButton', () => {
  it('renders idle button by default', () => {
    setup();
    expect(screen.getByRole('button', { name: /tap to record/i })).toBeInTheDocument();
  });

  it('starts recording on click', async () => {
    const { setIsRecording } = setup();
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    await waitFor(() => expect(setIsRecording).toHaveBeenCalledWith(true));
  });

  it('shows error when getUserMedia is denied', async () => {
    global.navigator.mediaDevices.getUserMedia = vi.fn(async () => {
      const e = new Error('denied');
      e.name = 'NotAllowedError';
      throw e;
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    expect(await screen.findByText(/microphone access denied/i)).toBeInTheDocument();
  });

  it('uploads to backend and surfaces transcription on success', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        transcription: 'I worked 8 hours',
        extractedData: { action_type: 'HOURS', hours: 8, confidence: 'high' },
        processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
      }),
    });
    const { onTranscription, onExtractedData, onProcessedData } = setup();
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    await waitFor(() => expect(MockMediaRecorder.instances.length).toBe(1));
    act(() => { MockMediaRecorder.instances[0].stop(); });
    await waitFor(() => expect(onTranscription).toHaveBeenCalledWith('I worked 8 hours'));
    expect(onExtractedData).toHaveBeenCalledWith(expect.objectContaining({ hours: 8 }));
    expect(onProcessedData).toHaveBeenCalled();
  });

  it('shows backend error message for known error codes', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'LOW_CONFIDENCE', message: 'unclear' }),
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    await waitFor(() => expect(MockMediaRecorder.instances.length).toBe(1));
    act(() => { MockMediaRecorder.instances[0].stop(); });
    expect(await screen.findByText(/unclear\. mention worksite and hours/i)).toBeInTheDocument();
  });
});
