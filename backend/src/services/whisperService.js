// src/services/whisperService.js
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribe audio file using Whisper API
 * @param {string} audioFilePath - Path to audio file
 * @param {string} language - Language code (en, fr, es) - optional
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioFilePath, language = 'en') {
  try {
    console.log('Transcribing audio:', audioFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: 'whisper-1',
      language: language, // Optional: helps with accuracy
      response_format: 'text', // Get plain text instead of JSON
    });

    console.log('Transcription result:', transcription);

    return transcription;

  } catch (error) {
    console.error('Whisper API error:', error);

    if (error.response) {
      // OpenAI API error
      throw new Error(`Whisper API failed: ${error.response.data?.error?.message || 'Unknown error'}`);
    } else if (error.code === 'ENOENT') {
      // File not found
      throw new Error('Audio file not found');
    } else {
      // Other errors
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }
}

/**
 * Estimate Whisper API cost for audio duration
 * @param {number} durationSeconds - Audio duration in seconds
 * @returns {number} Cost in USD
 */
export function estimateWhisperCost(durationSeconds) {
  const durationMinutes = durationSeconds / 60;
  return durationMinutes * 0.006; // $0.006 per minute
}
