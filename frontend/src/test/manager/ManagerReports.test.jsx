// frontend/src/test/manager/ManagerReports.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportsView from '../../components/manager/ReportsView';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('time-reporting.manager', JSON.stringify({ id: 'm1', token: 't', name: 'Mgr', role: 'manager' }));
  vi.restoreAllMocks();
});

const SUMMARY = {
  byWorker:   [{ name: 'Alice', hours: 16 }, { name: 'Bob', hours: 8 }],
  byWorksite: [{ name: 'Simons', hours: 24 }],
  total: 24,
  flaggedCount: 0,
  count: 3,
};

describe('ReportsView', () => {
  it('renders summary tables and totals', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => SUMMARY });
    render(<ReportsView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText(/16\.00h/)).toBeInTheDocument();
    expect(screen.getByText('Simons')).toBeInTheDocument();
    expect(screen.getByText(/24\.00 total hours/)).toBeInTheDocument();
  });

  it('refetches when date range changes', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => SUMMARY });
    render(<ReportsView />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/start/i), { target: { value: '2026-01-01' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('triggers CSV download via fetch + URL.createObjectURL', async () => {
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => SUMMARY })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['id,worker\n']) });
    const createObjUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    render(<ReportsView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() => expect(createObjUrl).toHaveBeenCalled());
    const csvCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/reports/csv'));
    expect(csvCall).toBeTruthy();
  });
});
