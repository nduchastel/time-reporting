// src/components/RecordButton.jsx
import { useState, useRef, useEffect } from 'react';

const MAX_RECORDING_TIME = 60; // seconds
const WARNING_TIME = 50; // show warning at 50 seconds

export default function RecordButton({ onTranscription, onExtractedData, isRecording, setIsRecording }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

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

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder with browser's default format
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording completion
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm'
        });

        // Process the audio
        await processAudio(audioBlob);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

    } catch (err) {
      console.error('Recording error:', err);

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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob) => {
    setIsProcessing(true);

    try {
      // TODO Task 3: Send audio to backend API
      // For now, still using mock data
      await new Promise(resolve => setTimeout(resolve, 1000));

      onTranscription("I worked 8 hours at Simons Property");
      onExtractedData({
        action_type: "HOURS",
        hours: 8,
        worksite: "Simons Property",
        confidence: "high"
      });

      console.log('Audio recorded:', {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: recordingTime
      });

    } catch (err) {
      console.error('Processing error:', err);
      setError('Could not process recording. Please try again.');
    } finally {
      setIsProcessing(false);
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
