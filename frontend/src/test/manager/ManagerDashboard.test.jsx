// frontend/src/test/manager/ManagerDashboard.test.jsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManagerDashboard from '../../components/manager/ManagerDashboard';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('time-reporting.manager', JSON.stringify({ id: 'm1', token: 't', name: 'M', role: 'manager' }));
  vi.restoreAllMocks();
});

describe('ManagerDashboard', () => {
  it('lists pending cards and approves one', async () => {
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'tc1', action_type: 'HOURS', status: 'pending', date: '2026-05-23', hours: 8, workers: { name: 'Bob' }, created_at: new Date().toISOString(), transcription: 'x' }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tc1', status: 'approved' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) });
    render(<ManagerDashboard />);
    await waitFor(() => expect(screen.getByText(/Bob/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });
});
