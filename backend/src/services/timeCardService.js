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

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export async function getTimeCards({ workerId, status, startDate, endDate, limit }) {
  let query = supabase
    .from('time_cards')
    .select('*, workers(name), worksites(name)')
    .order('created_at', { ascending: false });

  if (workerId) query = query.eq('worker_id', workerId);
  if (status) query = query.eq('status', status);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  // Always apply a bounded limit. Prevents unbounded reads / DoS.
  const parsed = parseInt(limit, 10);
  const safeLimit = Math.min(Math.max(Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT, 1), MAX_LIMIT);
  query = query.limit(safeLimit);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateTimeCard({ id, fields, approverId, status }) {
  const patch = { ...fields, updated_at: new Date().toISOString() };
  if (status)     patch.status      = status;
  if (approverId) { patch.approved_by = approverId; patch.approved_at = new Date().toISOString(); }
  const { data, error } = await supabase
    .from('time_cards')
    .update(patch)
    .eq('id', id)
    .select('*, workers(name), worksites(name)')
    .single();
  if (error) throw error;
  return data;
}
