// src/routes/timeCards.js
import express from 'express';
import { extractTimeCardData } from '../services/extractionService.js';
import { createTimeCard, getTimeCards } from '../services/timeCardService.js';
import { supabase } from '../db/supabase.js';

const router = express.Router();

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

export default router;
