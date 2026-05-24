// src/components/RecordButton.jsx
import { useState } from 'react';

export default function RecordButton({ onTranscription, onExtractedData, isRecording, setIsRecording }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRecord = async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setIsProcessing(true);

      // TODO: Send audio to backend
      // For now, simulate with mock data
      setTimeout(() => {
        onTranscription("I worked 8 hours at Simons Property");
        onExtractedData({
          action_type: "HOURS",
          hours: 8,
          worksite: "Simons Property",
          confidence: "high"
        });
        setIsProcessing(false);
      }, 1000);
    } else {
      // Start recording
      setIsRecording(true);
    }
  };

  return (
    <div className="text-center my-6">
      <button
        onClick={handleRecord}
        disabled={isProcessing}
        aria-label={isProcessing ? 'Processing...' : isRecording ? 'Tap to stop recording' : 'Tap to record'}
        className={`w-24 h-24 rounded-full shadow-xl mx-auto flex items-center justify-center ${
          isRecording ? 'bg-red-500' : 'bg-red-600'
        } ${isProcessing ? 'opacity-50' : ''}`}
        style={{ fontSize: '48px' }}
      >
        <span className="text-white">
          {isProcessing ? '⏳' : isRecording ? '⏹' : '⏺'}
        </span>
      </button>
      <p className="mt-4 text-gray-700 font-medium text-base">
        {isProcessing ? 'Processing...' : isRecording ? 'Recording... Tap to stop' : 'Tap to record'}
      </p>
    </div>
  );
}
