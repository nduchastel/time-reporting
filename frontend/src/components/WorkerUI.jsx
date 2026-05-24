// src/components/WorkerUI.jsx
import { useState } from 'react';
import RecordButton from './RecordButton';
import './WorkerUI.css';

const ACTION_TYPES = [
  { type: 'IN', label: 'Check IN', emoji: '📍', color: 'bg-teal-500' },
  { type: 'OUT', label: 'Check OUT', emoji: '🏠', color: 'bg-green-500' },
  { type: 'HOURS', label: 'Hours Worked', emoji: '⏱️', color: 'bg-blue-500' },
  { type: 'OFF', label: 'Time OFF', emoji: '🌴', color: 'bg-orange-500' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function WorkerUI() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [slideDirection, setSlideDirection] = useState('');

  const currentAction = ACTION_TYPES[currentScreen];

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentScreen < ACTION_TYPES.length - 1) {
      setSlideDirection('slide-in-right');
      setCurrentScreen(currentScreen + 1);
      setTimeout(() => setSlideDirection(''), 300);
    }
    if (isRightSwipe && currentScreen > 0) {
      setSlideDirection('slide-in-left');
      setCurrentScreen(currentScreen - 1);
      setTimeout(() => setSlideDirection(''), 300);
    }
  };

  const handleSubmit = async () => {
    if (!processedData) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/time-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedData)
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      // Show success toast
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);

      // Clear form after successful submit
      setTimeout(() => {
        setTranscription('');
        setExtractedData(null);
        setProcessedData(null);
      }, 3000);
    } catch (error) {
      alert('Submit failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRerecord = () => {
    // Keep transcription and extracted data visible as reference
    // Only clear processedData so Submit won't work until new recording
    setProcessedData(null);
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header with swipe dots */}
      <div className="bg-white shadow p-4">
        <div className="flex justify-center gap-2">
          {ACTION_TYPES.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentScreen(index)}
              className={`w-3 h-3 rounded-full ${
                index === currentScreen ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              aria-label={`Go to ${ACTION_TYPES[index].label}`}
            />
          ))}
        </div>
      </div>

      {/* Action screen */}
      <div className={`${currentAction.color} py-8 px-4 text-center text-white ${slideDirection}`}>
        <div className="text-6xl mb-4">{currentAction.emoji}</div>
        <h1 className="text-3xl font-bold">{currentAction.label}</h1>
      </div>

      {/* Instructions */}
      <div className="p-6 bg-white">
        <p className="text-gray-700 mb-4 text-base">
          Tap the record button and describe your time:
        </p>
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-600 italic">
            Example: "I worked 8 hours at Simons Property today"
          </p>
        </div>

        {/* Success toast */}
        {submitSuccess && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
            ✓ Time card submitted!
          </div>
        )}

        {/* Record button */}
        <RecordButton
          onTranscription={setTranscription}
          onExtractedData={setExtractedData}
          onProcessedData={setProcessedData}
          isRecording={isRecording}
          setIsRecording={setIsRecording}
          actionType={currentAction.type}
        />

        {/* Transcription preview */}
        {transcription && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2 text-base">Transcription:</h3>
            <p className="text-gray-700 text-lg">{transcription}</p>
          </div>
        )}

        {/* Extracted data preview */}
        {extractedData && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold mb-2 text-base">Extracted Data:</h3>
            <div className="space-y-2 text-base">
              <p><strong>Action:</strong> {extractedData.action_type}</p>
              {extractedData.hours && <p><strong>Hours:</strong> {extractedData.hours}</p>}
              {extractedData.worksite && <p><strong>Worksite:</strong> {extractedData.worksite}</p>}
              <p><strong>Confidence:</strong> {extractedData.confidence}</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !processedData}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
              <button
                onClick={handleRerecord}
                className="px-6 bg-gray-400 text-white py-3 rounded-lg"
              >
                Re-record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
