// src/components/RecordButton.jsx
import { useState, useRef, useEffect } from 'react';

const MAX_RECORDING_TIME = 60; // seconds
const WARNING_TIME = 50; // show warning at 50 seconds

// API configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// TODO Phase 3: Replace with real worker authentication
// For Phase 2 testing: Use Bob Martinez (seed data worker)
const TEMP_WORKER_ID = '913da062-eca3-4cd9-a74b-96e7428dc540';

export default function RecordButton({ onTranscription, onExtractedData, isRecording, setIsRecording, actionType }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);

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

    try {
      addDebugLog('🚀 Starting upload', {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: recordingTime
      });

      // Check for zero-size blob
      if (audioBlob.size === 0) {
        addDebugLog('❌ Empty audio blob!');
        setError('Recording was empty. Please try again.');
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
          'TRANSCRIPTION_FAILED': 'Could not transcribe audio. Please speak clearly and try again.',
          'EXTRACTION_FAILED': 'Could not understand entry. Please mention worksite and hours.',
          'DATABASE_ERROR': 'Could not save entry. Please try again.',
          'WORKER_NOT_FOUND': 'Worker not found. Please contact manager.',
        };

        setError(errorMessages[data.error] || data.message || 'An error occurred. Please try again.');
        return;
      }

      // Success! Show transcription and extracted data
      addDebugLog('✅ Success!', {
        transcription: data.transcription?.substring(0, 50),
        confidence: data.extractedData?.confidence
      });

      onTranscription(data.transcription);
      onExtractedData(data.extractedData);

    } catch (err) {
      addDebugLog('❌ Processing error', {
        name: err.name,
        message: err.message
      });

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Network error. Check your connection and try again.');
      } else {
        setError('Could not process recording. Please try again.');
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

  return (
    <div className="text-center my-6">
      {/* Debug Panel */}
      {debugLogs.length > 0 && (
        <div className="mb-4 p-3 bg-gray-900 text-green-400 rounded-lg text-left font-mono text-xs max-h-64 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-white">🐛 Debug Log</span>
            <button
              onClick={() => setDebugLogs([])}
              className="text-gray-400 hover:text-white text-xs"
            >
              Clear
            </button>
          </div>
          {debugLogs.map((log, i) => (
            <div key={i} className="mb-1 break-all">{log}</div>
          ))}
        </div>
      )}

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
  );
}
