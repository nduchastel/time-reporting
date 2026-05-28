// backend/tests/fakes/fakeOpenAI.js
//
// Drop-in replacement for the `openai` package's default export. Used by
// vitest's global `vi.mock('openai', () => ({ default: FakeOpenAI }))`.
//
// Two response modes:
//
// 1. Fixture mode (preferred for unit/integration tests). Pre-register an
//    audio buffer via `registerFixture(buf, { transcription, extraction })`.
//    `audio.transcriptions.create({ file: buf })` returns the canned
//    transcription. The matching `chat.completions.create({...})` returns the
//    canned extraction (matched by transcription text in the user message).
//
// 2. Scripted mode (preferred for E2E and one-off tests). Tests call
//    `next({ transcription, extraction })` to queue the next response. Calls
//    consume the queue FIFO. `failNext({ kind, error })` queues an error.

import { createHash } from 'node:crypto';
import fs from 'node:fs';

let queue = [];
let fixtureByHash = new Map();
let fixtureByTranscription = new Map();

export function reset() {
  queue = [];
  fixtureByHash = new Map();
  fixtureByTranscription = new Map();
}

export function next(response) {
  queue.push({ kind: 'response', response });
}

export function failNext({ kind, error }) {
  queue.push({ kind: 'error', errorKind: kind, error });
}

function hashBuf(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

export function registerFixture(audioBuffer, { transcription, extraction }) {
  const h = hashBuf(audioBuffer);
  fixtureByHash.set(h, { transcription, extraction });
  fixtureByTranscription.set(transcription, { transcription, extraction });
}

function fillExtraction(partial, { todayDate }) {
  return {
    action_type: partial.action_type ?? 'HOURS',
    worker: partial.worker ?? null,
    worksite: partial.worksite ?? null,
    hours: partial.hours ?? null,
    start_time: partial.start_time ?? null,
    end_time: partial.end_time ?? null,
    date: partial.date ?? todayDate ?? null,
    confidence: partial.confidence ?? 'high',
    additional_workers: partial.additional_workers ?? [],
    notes: partial.notes ?? null,
  };
}

async function bufferOf(file) {
  if (!file) return null;
  if (Buffer.isBuffer(file)) return file;
  if (typeof file === 'string') {
    try { return await fs.promises.readFile(file); } catch { return null; }
  }
  if (file._buffer) return file._buffer;
  if (typeof file.path === 'string') {
    try { return await fs.promises.readFile(file.path); } catch { return null; }
  }
  if (typeof file.on === 'function') {
    return new Promise((resolve, reject) => {
      const chunks = [];
      file.on('data', (c) => chunks.push(c));
      file.on('end', () => resolve(Buffer.concat(chunks)));
      file.on('error', reject);
    });
  }
  return null;
}

async function consumeOrFixture(kind, ctx) {
  // 1. Fixture lookup
  if (kind === 'transcription' && ctx.audioBuffer) {
    const fix = fixtureByHash.get(hashBuf(ctx.audioBuffer));
    if (fix) return fix.transcription;
  }
  if (kind === 'extraction' && ctx.transcription) {
    const fix = fixtureByTranscription.get(ctx.transcription);
    if (fix) return JSON.stringify(fillExtraction(fix.extraction, ctx));
  }

  // 2. Scripted queue
  if (queue.length === 0) {
    throw new Error(`no scripted response for ${kind}; call fakeOpenAI.next(...) or registerFixture(...) before this call`);
  }
  const item = queue.shift();
  if (item.kind === 'error') {
    if (item.errorKind && item.errorKind !== kind) {
      // Wrong kind — re-queue at front and complain so test mistakes surface.
      queue.unshift(item);
      throw new Error(`scripted error queued for kind=${item.errorKind} but got kind=${kind}`);
    }
    throw item.error;
  }
  if (kind === 'transcription') return item.response.transcription ?? '';
  if (kind === 'extraction')    return JSON.stringify(fillExtraction(item.response.extraction || {}, ctx));
  throw new Error(`unknown kind ${kind}`);
}

export default class OpenAI {
  constructor() {
    this.audio = {
      transcriptions: {
        create: async (args = {}) => {
          // Tests can pass a raw Buffer via `_buffer` as a shortcut;
          // production code passes a ReadStream via `file`.
          const audioBuffer = args._buffer ?? await bufferOf(args.file);
          return consumeOrFixture('transcription', { audioBuffer });
        },
      },
    };
    this.chat = {
      completions: {
        create: async ({ messages = [] }) => {
          const userMsg = messages.find((m) => m.role === 'user');
          const content = typeof userMsg?.content === 'string' ? userMsg.content : '';
          const transcription = content.match(/Transcription: "(.+)"/)?.[1];
          const todayDate    = content.match(/Today's date: "(.+)"/)?.[1];
          const responseContent = await consumeOrFixture('extraction', { transcription, todayDate });
          return { choices: [{ message: { content: responseContent } }] };
        },
      },
    };
  }
}
