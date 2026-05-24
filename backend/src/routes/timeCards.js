// src/routes/timeCards.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { extractTimeCardData } from '../services/extractionService.js';
import { createTimeCard, getTimeCards } from '../services/timeCardService.js';
import { transcribeAudio } from '../services/whisperService.js';
import { uploadAudio } from '../services/storageService.js';
import { supabase } from '../db/supabase.js';

const router = express.Router();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: '/tmp/uploads/',
  filename: (req, file, cb) => {
    // Preserve file extension for Whisper API
    const ext = file.mimetype === 'audio/webm' ? '.webm'
              : file.mimetype === 'audio/mp4' ? '.mp4'
              : file.mimetype === 'audio/wav' ? '.wav'
              : file.mimetype === 'audio/mpeg' ? '.mp3'
              : file.mimetype === 'audio/m4a' ? '.m4a'
              : '.audio';

    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max (60s at high quality ~= 2-3MB)
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/mpeg', 'audio/m4a'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Expected audio file.`));
    }
  }
});

router.post('/time-cards', async (req, res, next) => {
  try {
    const { workerId, transcription, audioUrl } = req.body;

    // Get worker info
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('name')
      .eq('id', workerId)
      .single();

    if (workerError) throw workerError;

    // Extract data from transcription
    const extracted = await extractTimeCardData({
      transcription,
      workerName: worker.name,
      date: new Date().toISOString().split('T')[0]
    });

    // Find or create worksite
    let worksiteId = null;
    if (extracted.worksite) {
      const { data: existingWorksite } = await supabase
        .from('worksites')
        .select('id')
        .ilike('name', `%${extracted.worksite}%`)
        .single();

      if (existingWorksite) {
        worksiteId = existingWorksite.id;
      }
    }

    // Create time card
    const timeCard = await createTimeCard({
      workerId,
      worksiteId,
      actionType: extracted.action_type,
      date: extracted.date,
      hours: extracted.hours,
      startTime: extracted.start_time,
      endTime: extracted.end_time,
      transcription,
      extractedData: extracted,
      audioUrl
    });

    res.status(201).json(timeCard);
  } catch (error) {
    next(error);
  }
});

router.get('/time-cards', async (req, res, next) => {
  try {
    const { workerId, status, startDate, endDate, limit } = req.query;

    const timeCards = await getTimeCards({
      workerId,
      status,
      startDate,
      endDate,
      limit
    });

    res.json(timeCards);
  } catch (error) {
    next(error);
  }
});

// POST /api/time-cards/voice - Create time card from voice recording
router.post('/time-cards/voice', upload.single('audio'), async (req, res, next) => {
  let audioFilePath = null;

  try {
    const { workerId, actionType } = req.body;
    const audioFile = req.file;

    // Validate required fields
    if (!workerId) {
      return res.status(400).json({
        error: 'MISSING_WORKER_ID',
        message: 'Worker ID is required'
      });
    }

    if (!actionType) {
      return res.status(400).json({
        error: 'MISSING_ACTION_TYPE',
        message: 'Action type is required (IN, OUT, HOURS, OFF)'
      });
    }

    if (!audioFile) {
      return res.status(400).json({
        error: 'MISSING_AUDIO',
        message: 'Audio file is required'
      });
    }

    audioFilePath = audioFile.path;

    console.log('Processing voice time card:', {
      workerId,
      actionType,
      audioFile: {
        originalName: audioFile.originalname,
        mimetype: audioFile.mimetype,
        size: audioFile.size,
        path: audioFilePath
      }
    });

    // Step 1: Get worker info
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('name, language')
      .eq('id', workerId)
      .single();

    if (workerError || !worker) {
      return res.status(404).json({
        error: 'WORKER_NOT_FOUND',
        message: 'Worker not found'
      });
    }

    // Step 2: Transcribe audio with Whisper
    let transcription;
    try {
      transcription = await transcribeAudio(audioFilePath, worker.language || 'en');
      console.log('Transcription:', transcription);
    } catch (error) {
      console.error('Transcription failed:', error);
      return res.status(500).json({
        error: 'TRANSCRIPTION_FAILED',
        message: 'Could not transcribe audio',
        details: error.message
      });
    }

    // Step 3: Extract structured data with GPT
    let extracted;
    try {
      extracted = await extractTimeCardData({
        transcription,
        workerName: worker.name,
        date: new Date().toISOString().split('T')[0]
      });
      console.log('Extracted data:', extracted);
    } catch (error) {
      console.error('Extraction failed:', error);
      return res.status(500).json({
        error: 'EXTRACTION_FAILED',
        message: 'Could not extract time card data',
        details: error.message
      });
    }

    // Step 3.5: Validate extracted data quality
    // Reject if confidence is low OR missing critical info
    if (extracted.confidence === 'low') {
      return res.status(400).json({
        error: 'LOW_CONFIDENCE',
        message: 'Could not clearly understand your entry. Please speak clearly and mention the worksite and hours worked.',
        transcription,
        extractedData: extracted
      });
    }

    // For HOURS and OFF actions, hours must be present
    if ((actionType === 'HOURS' || actionType === 'OFF') && !extracted.hours) {
      return res.status(400).json({
        error: 'MISSING_HOURS',
        message: 'Please mention how many hours you worked.',
        transcription,
        extractedData: extracted
      });
    }

    // Step 4: Find or create worksite (if mentioned)
    let worksiteId = null;
    if (extracted.worksite) {
      const { data: existingWorksite } = await supabase
        .from('worksites')
        .select('id')
        .ilike('name', `%${extracted.worksite}%`)
        .single();

      if (existingWorksite) {
        worksiteId = existingWorksite.id;
      }
    }

    // Step 4.5: Auto-capture time for IN/OUT actions ONLY if reporting TODAY
    // If worker says "yesterday" or mentions a past date, GPT should extract the time (or null if not mentioned)
    // If worker is reporting RIGHT NOW (date is today), auto-fill with server timestamp
    let startTime = extracted.start_time;
    let endTime = extracted.end_time;

    const today = new Date().toISOString().split('T')[0];
    const isReportingToday = extracted.date === today;

    if (actionType === 'IN' && !startTime && isReportingToday) {
      const now = new Date();
      startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    if (actionType === 'OUT' && !endTime && isReportingToday) {
      const now = new Date();
      endTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    // Step 4.6: Upload audio to Supabase Storage (best-effort)
    let audioUrl = null;
    try {
      audioUrl = await uploadAudio({
        localPath: audioFilePath,
        mimeType: audioFile.mimetype,
        workerId,
      });
    } catch (e) {
      console.error('Audio upload failed, continuing without URL:', e.message);
    }

    // Step 5: Return extracted data for user review (DON'T save yet)
    // User will click Submit to save via POST /api/time-cards
    res.status(200).json({
      transcription,
      extractedData: extracted,
      // Include processed values for frontend to submit
      processedData: {
        workerId,
        worksiteId,
        actionType: extracted.action_type || actionType,
        date: extracted.date,
        hours: extracted.hours,
        startTime,
        endTime,
        transcription,
        extractedData: extracted,
        audioUrl
      }
    });

  } catch (error) {
    console.error('Voice endpoint error:', error);
    next(error);
  } finally {
    // Clean up temporary file
    if (audioFilePath) {
      fs.unlink(audioFilePath, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    }
  }
});

export default router;
