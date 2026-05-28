import { test, expect } from '@playwright/test';
import { reset, seed, openaiNext } from './helpers/testApi';

// bcrypt('1234', 10) — pre-computed; rotate if scheme changes.
const PIN_1234_HASH = '$2b$10$DqRGBB6kx5W7w1uvDmar4uOAYZYZoXu4JUKOtFDqEVtOh5dblqPpy';

test.beforeEach(async () => {
  await reset();
  await seed({
    workers: [{ id: 'w1', name: 'Bob', phone: '+1-555-0100', language: 'en', pin: PIN_1234_HASH, status: 'active', role: 'worker' }],
  });
});

test('worker submits time card via PIN + voice', async ({ page }) => {
  // The voice endpoint calls (transcribe, extract). The subsequent POST /api/time-cards
  // re-extracts from the transcription, so we queue extraction a second time.
  await openaiNext({
    transcription: 'I worked 8 hours at Simons',
    extraction: { action_type: 'HOURS', hours: 8, worksite: 'Simons', confidence: 'high' },
  });
  await openaiNext({
    extraction: { action_type: 'HOURS', hours: 8, worksite: 'Simons', confidence: 'high' },
  });

  await page.goto('/?testMode=1');
  await page.getByLabel(/phone/i).fill('+1-555-0100');
  await page.getByLabel(/pin/i).fill('1234');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.getByRole('button', { name: /submit fake recording/i }).click();
  await expect(page.getByText(/Confidence:/)).toBeVisible();
  await page.getByRole('button', { name: /^submit$/i }).click();
  await expect(page.getByText(/time card submitted/i)).toBeVisible();

  // History shows the entry
  await page.getByRole('button', { name: /view history/i }).click();
  await expect(page.getByText(/recent submissions/i)).toBeVisible();
});
