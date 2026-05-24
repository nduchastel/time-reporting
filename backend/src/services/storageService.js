import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../db/supabase.js';

const BUCKET = process.env.AUDIO_BUCKET || 'time-card-audio';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

export async function uploadAudio({ localPath, mimeType, workerId }) {
  const buffer = await fs.promises.readFile(localPath);
  const safeWorker = String(workerId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = path.extname(localPath) || '.webm';
  const key = `audio/${yyyy}/${mm}/${safeWorker}/${randomUUID()}${ext}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType: mimeType, upsert: false });
  if (uploadErr) throw new Error(`Audio upload failed: ${uploadErr.message}`);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}
