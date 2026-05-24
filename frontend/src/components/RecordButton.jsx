// src/components/RecordButton.jsx
import { useState, useRef, useEffect } from 'react';

const MAX_RECORDING_TIME = 60; // seconds
const WARNING_TIME = 50; // show warning at 50 seconds

// API configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// TODO Phase 3: Replace with real worker authentication
// For Phase 2 testing: Use Bob Martinez (seed data worker)
const TEMP_WORKER_ID = '913da062-eca3-4cd9-a74b-96e7428dc540';

export default function RecordButton({ onTranscription, onExtractedData, isRecording, setIsRecording, actionType, onProcessedData }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [debugExpanded, setDebugExpanded] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Debug logging helper
  const addDebugLog = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
    console.log(logEntry, data);
    setDebugLogs(prev => [...prev.slice(-10), logEntry]); // Keep last 10 logs
  };

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;

          // Auto-stop at max duration
          if (newTime >= MAX_RECORDING_TIME) {
            handleStop();
          }

          return newTime;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const handleStart = async () => {
    try {
      setError(null);
      addDebugLog('🎤 Requesting microphone access');

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      addDebugLog('✅ Microphone granted');

      // Create MediaRecorder with browser's default format
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      addDebugLog('📼 MediaRecorder created', {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state
      });

      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          addDebugLog(`📊 Audio chunk: ${event.data.size} bytes`);
        }
      };

      // Handle recording completion
      mediaRecorder.onstop = async () => {
        addDebugLog('⏹️ Recording stopped');

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          addDebugLog('🔇 Audio tracks stopped');
        }

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm'
        });

        addDebugLog('📦 Audio blob created', {
          size: audioBlob.size,
          type: audioBlob.type,
          chunks: audioChunksRef.current.length
        });

        // Process the audio
        await processAudio(audioBlob);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      addDebugLog('🔴 Recording started');

    } catch (err) {
      addDebugLog('❌ Recording error', {
        name: err.name,
        message: err.message
      });

      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Enable in browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Check your device.');
      } else {
        setError('Recording failed. Please try again.');
      }
    }
  };

  const handleStop = () => {
    addDebugLog('🛑 Stop requested');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      addDebugLog(`📝 MediaRecorder state: ${mediaRecorderRef.current.state}`);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      addDebugLog('⚠️ Cannot stop - MediaRecorder inactive or null');
    }
  };

  const processAudio = async (audioBlob) => {
    setIsProcessing(true);
    setError(null);
    // Clear old data when starting new processing
    onTranscription('');
    onExtractedData(null);

    try {
      addDebugLog('🚀 Starting upload', {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: recordingTime
      });

      // Check for zero-size blob
      if (audioBlob.size === 0) {
        addDebugLog('❌ Empty audio blob!');
        setError('Heard nothing! Record again.');
        return;
      }

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('workerId', TEMP_WORKER_ID);
      formData.append('actionType', actionType);

      addDebugLog('📤 Sending to backend', {
        url: `${API_URL}/api/time-cards/voice`,
        workerId: TEMP_WORKER_ID,
        actionType
      });

      // Send to backend
      const response = await fetch(`${API_URL}/api/time-cards/voice`, {
        method: 'POST',
        body: formData,
      });

      addDebugLog('📥 Response received', {
        status: response.status,
        ok: response.ok
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error response
        addDebugLog('❌ Backend error', data);

        const errorMessages = {
          'TRANSCRIPTION_FAILED': 'Heard nothing! Record again.',
          'EXTRACTION_FAILED': 'Unclear. Mention worksite and hours.',
          'LOW_CONFIDENCE': 'Unclear. Mention worksite and hours.',
          'MISSING_HOURS': 'Please mention how many hours you worked.',
          'DATABASE_ERROR': 'Save failed. Try again.',
          'WORKER_NOT_FOUND': 'Worker not found. Contact manager.',
        };

        setError(errorMessages[data.error] || data.message || 'An error occurred. Please try again.');
        return;
      }

      // Success! Show transcription and extracted data (NOT saved yet)
      addDebugLog('✅ Transcription complete', {
        transcription: data.transcription?.substring(0, 50),
        confidence: data.extractedData?.confidence
      });

      onTranscription(data.transcription);
      onExtractedData(data.extractedData);
      // Pass processed data to parent for Submit button
      if (onProcessedData) {
        onProcessedData(data.processedData);
      }

    } catch (err) {
      addDebugLog('❌ Processing error', {
        name: err.name,
        message: err.message
      });

      // TypeError with 'Load failed' or 'fetch' = network issue
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Load failed') || err.message.includes('Network request failed'))) {
        setError('Network issue. Check connection.');
      } else {
        setError('Processing failed. Try again.');
      }
    } finally {
      setIsProcessing(false);
      addDebugLog('🏁 Processing complete');
    }
  };

  const handleRecord = () => {
    if (isRecording) {
      handleStop();
    } else {
      handleStart();
    }
  };

  const showWarning = isRecording && recordingTime >= WARNING_TIME;
  const remainingTime = MAX_RECORDING_TIME - recordingTime;

  const copyLogsToClipboard = () => {
    const logsText = debugLogs.join('\n');
    navigator.clipboard.writeText(logsText).then(() => {
      // Optional: show a brief success indicator
      console.log('Logs copied to clipboard');
    });
  };

  return (
    <>
      <div className="text-center my-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-red-600 underline text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        <button
          onClick={handleRecord}
          disabled={isProcessing}
          aria-label={isProcessing ? 'Processing...' : isRecording ? 'Tap to stop recording' : 'Tap to record'}
          className={`w-24 h-24 rounded-full shadow-xl mx-auto flex items-center justify-center ${
            isRecording ? 'bg-red-500 animate-pulse' : 'bg-red-600'
          } ${isProcessing ? 'opacity-50' : ''}`}
          style={{ fontSize: '48px' }}
        >
          <span className="text-white">
            {isProcessing ? '⏳' : isRecording ? '⏹' : '⏺'}
          </span>
        </button>

        <div className="mt-4">
          {isRecording && (
            <div className="mb-2">
              <p className={`text-lg font-bold ${showWarning ? 'text-red-600' : 'text-gray-700'}`}>
                {showWarning ? `${remainingTime}s remaining` : `${recordingTime}s`}
              </p>
            </div>
          )}

          <p className="text-gray-700 font-medium text-base">
            {isProcessing
              ? 'Processing...'
              : isRecording
                ? 'Recording... Tap to stop'
                : 'Tap to record'}
          </p>
        </div>
      </div>

      {/* Debug Bar (Bottom) - DevTools Style */}
      {debugLogs.length > 0 && (
        <>
          {/* Debug Bar */}
          <div
            onClick={() => setDebugExpanded(!debugExpanded)}
            className={`fixed bottom-0 left-0 right-0 bg-gray-800 h-12 flex items-center justify-between px-5 cursor-pointer z-50 transition-colors hover:bg-gray-700 shadow-lg ${debugExpanded ? 'shadow-2xl' : ''}`}
          >
            <div className="flex items-center gap-2 text-white text-sm">
              <span className="text-lg">🐛</span>
              <span>Debug</span>
              <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                {debugLogs.length} logs
              </span>
            </div>
            <span className={`text-gray-400 text-xl transition-transform ${debugExpanded ? 'rotate-180' : ''}`}>
              ▲
            </span>
          </div>

          {/* Debug Panel (Expands upward) */}
          <div
            className={`fixed left-0 right-0 bg-gray-900 z-40 transition-all duration-300 ease-out overflow-hidden shadow-2xl ${
              debugExpanded ? 'bottom-12 max-h-96' : 'bottom-12 max-h-0'
            }`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 bg-gray-800">
              <div className="text-white font-semibold text-base flex items-center gap-2">
                🐛 Debug Log
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyLogsToClipboard();
                }}
                className="bg-gray-700 text-white px-3 py-1.5 rounded text-xs hover:bg-gray-600 transition-colors flex items-center gap-1"
              >
                📋 Copy
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 font-mono text-xs text-green-400 leading-relaxed" style={{ maxHeight: 'calc(24rem - 3.5rem)' }}>
              {debugLogs.map((log, i) => (
                <div key={i} className="mb-2 break-all">{log}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
