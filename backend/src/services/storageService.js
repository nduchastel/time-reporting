import fs from 'node:fs';
import path from 'node:path';
import { supabaseAdmin } from '../db/supabase.js';

const BUCKET = process.env.AUDIO_BUCKET || 'time-card-audio';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

export async function uploadAudio({ localPath, mimeType, workerId }) {
  const buffer = await fs.promises.readFile(localPath);
  const yyyy = new Date().getUTCFullYear();
  const mm = String(new Date().getUTCMonth() + 1).padStart(2, '0');
  const ext = path.extname(localPath) || '.webm';
  const key = `audio/${yyyy}/${mm}/${workerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

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
