import { test, expect } from '@playwright/test';
import { reset, seed } from './helpers/testApi';

// bcrypt('test-pw', 10) — pre-computed.
const MGR_PASSWORD_HASH = '$2b$10$ZOG3y4CcwC2OUtMcGrt7beIPPoFgD5sqSlyUkoHmKHclVcsll0z1G';

test.beforeEach(async () => {
  await reset();
  await seed({
    workers: [
      { id: 'm1', name: 'Mgr', username: 'mgr', password_hash: MGR_PASSWORD_HASH, status: 'active', role: 'manager' },
      { id: 'w1', name: 'Bob' },
    ],
    time_cards: [
      { id: 'tc1', worker_id: 'w1', action_type: 'HOURS', date: '2026-05-27', hours: 8, status: 'pending', transcription: 'I worked 8 hours', created_at: new Date().toISOString() },
    ],
  });
});

test('manager approves a pending time card', async ({ page }) => {
  await page.goto('/#/manager');
  await page.getByLabel(/username/i).fill('mgr');
  await page.getByLabel(/password/i).fill('test-pw');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByText('Bob')).toBeVisible();
  await page.getByRole('button', { name: /approve/i }).click();
  // After approve, card filtered out (status defaults to pending; reload shows empty)
  await expect(page.getByText(/nothing to show/i)).toBeVisible();
});
