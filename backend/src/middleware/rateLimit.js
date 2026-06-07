// backend/src/middleware/rateLimit.js
import rateLimit from 'express-rate-limit';

// Per-IP throttle for auth endpoints to blunt PIN/password brute-forcing.
// Window + max are env-tunable. Skipped under TEST_MODE so the real-server
// E2E/Playwright flows (which log in repeatedly) aren't throttled; vitest
// integration tests do NOT set TEST_MODE, so the limiter is active there.
const WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const MAX = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10;

export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.TEST_MODE === '1',
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please try again later.' },
});
