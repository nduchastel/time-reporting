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
    <div className="text-center">
      <button
        onClick={handleRecord}
        disabled={isProcessing}
        aria-label={isProcessing ? 'Processing...' : isRecording ? 'Tap to stop recording' : 'Tap to record'}
        className={`w-20 h-20 rounded-full shadow-lg ${
          isRecording ? 'bg-red-500' : 'bg-blue-600'
        } ${isProcessing ? 'opacity-50' : ''}`}
      >
        <span className="text-white text-3xl">
          {isProcessing ? '⏳' : isRecording ? '⏹' : '⏺'}
        </span>
      </button>
      <p className="mt-2 text-gray-600">
        {isProcessing ? 'Processing...' : isRecording ? 'Tap to stop' : 'Tap to record'}
      </p>
    </div>
  );
}
