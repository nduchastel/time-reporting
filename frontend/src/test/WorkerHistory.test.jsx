// frontend/src/test/WorkerHistory.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkerHistory from '../components/WorkerHistory';

beforeEach(() => {
  localStorage.setItem('time-reporting.worker', JSON.stringify({ id: 'w1', token: 't' }));
  vi.restoreAllMocks();
});

describe('WorkerHistory', () => {
  it('renders last entries from API', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ([
        { id: '1', action_type: 'HOURS', status: 'pending', date: '2026-05-23', hours: 8, worksites: { name: 'Simons' }, created_at: new Date().toISOString() },
      ]),
    });
    render(<WorkerHistory open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Simons/)).toBeInTheDocument());
    expect(screen.getByText(/HOURS/)).toBeInTheDocument();
    expect(screen.getByText(/pending/)).toBeInTheDocument();
  });
});
