// src/services/timeCardService.js
import { supabase } from '../db/supabase.js';

export async function createTimeCard({
  workerId,
  worksiteId,
  actionType,
  date,
  hours,
  startTime,
  endTime,
  transcription,
  extractedData,
  audioUrl
}) {
  const { data, error } = await supabase
    .from('time_cards')
    .insert({
      worker_id: workerId,
      worksite_id: worksiteId,
      action_type: actionType,
      date,
      hours,
      start_time: startTime,
      end_time: endTime,
      transcription,
      extracted_data: extractedData,
      confidence: extractedData.confidence,
      audio_url: audioUrl,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTimeCards({ workerId, status, startDate, endDate }) {
  let query = supabase
    .from('time_cards')
    .select('*, workers(name), worksites(name)')
    .order('created_at', { ascending: false });

  if (workerId) query = query.eq('worker_id', workerId);
  if (status) query = query.eq('status', status);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
