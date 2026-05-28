// src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import timeCardsRouter from './routes/timeCards.js';
import authRouter from './routes/auth.js';
import managerRouter from './routes/manager.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', timeCardsRouter);
app.use('/api/auth', authRouter);
app.use('/api/manager', managerRouter);

// Test-mode endpoints — only when TEST_MODE=1 AND NODE_ENV !== 'production'.
// Used by smoke E2E and Playwright to seed state and queue OpenAI responses.
if (process.env.TEST_MODE === '1' && process.env.NODE_ENV !== 'production') {
  const { reset: resetSupabase, seed } = await import('../tests/fakes/fakeSupabase.js');
  const { reset: resetOpenAI, next: nextOpenAI } = await import('../tests/fakes/fakeOpenAI.js');

  app.post('/__test__/reset', (req, res) => {
    resetSupabase();
    resetOpenAI();
    res.json({ ok: true });
  });
  app.post('/__test__/seed', (req, res) => {
    seed(req.body || {});
    res.json({ ok: true });
  });
  app.post('/__test__/openai-next', (req, res) => {
    // The fake's queue is FIFO with one consume per OpenAI call. A voice upload makes two calls
    // (transcription then extraction), so when both fields are provided we enqueue twice so each
    // call is satisfied — the first item satisfies transcription, the second satisfies extraction.
    const body = req.body || {};
    if (body.transcription && body.extraction) {
      nextOpenAI({ transcription: body.transcription });
      nextOpenAI({ extraction: body.extraction });
    } else {
      nextOpenAI(body);
    }
    res.json({ ok: true });
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

// When this file is the main entry point (node src/server.js), start the listener.
// Skip when imported by tests (Vitest sets NODE_ENV=test).
if (process.env.NODE_ENV !== 'test') {
  const { resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  if (isMain) {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

export default app;
