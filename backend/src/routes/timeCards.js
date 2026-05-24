// src/routes/timeCards.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { extractTimeCardData } from '../services/extractionService.js';
import { createTimeCard, getTimeCards } from '../services/timeCardService.js';
import { transcribeAudio } from '../services/whisperService.js';
import { supabase } from '../db/supabase.js';

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({
  dest: '/tmp/uploads/', // Temporary storage
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
    const { workerId, status, startDate, endDate } = req.query;

    const timeCards = await getTimeCards({
      workerId,
      status,
      startDate,
      endDate
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

    // Step 5: Create time card in database
    let timeCard;
    try {
      timeCard = await createTimeCard({
        workerId,
        worksiteId,
        actionType: extracted.action_type || actionType,
        date: extracted.date,
        hours: extracted.hours,
        startTime: extracted.start_time,
        endTime: extracted.end_time,
        transcription,
        extractedData: extracted,
        audioUrl: null // TODO Phase 3: Store in Supabase Storage
      });
      console.log('Time card created:', timeCard.id);
    } catch (error) {
      console.error('Database save failed:', error);
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Could not save time card',
        details: error.message
      });
    }

    // Success response
    res.status(201).json({
      timeCard,
      transcription,
      extractedData: extracted
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
