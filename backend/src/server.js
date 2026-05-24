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

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
