// frontend/src/test/manager/ManagerWorkers.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkersView from '../../components/manager/WorkersView';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('time-reporting.manager', JSON.stringify({ id: 'm1', token: 't', name: 'Mgr', role: 'manager' }));
  vi.restoreAllMocks();
});

const WORKERS = [
  { id: 'w1', name: 'Alice', phone: '+1-555-0001', language: 'en', role: 'worker', status: 'active' },
  { id: 'w2', name: 'Bob',   phone: '+1-555-0002', language: 'fr', role: 'worker', status: 'disabled' },
];

describe('WorkersView', () => {
  it('lists workers', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => WORKERS });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('opens add-worker form on click', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => WORKERS });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add worker/i }));
    expect(screen.getByRole('heading', { name: /add worker/i })).toBeInTheDocument();
  });

  it('does not offer "manager" as a role choice in the form', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => WORKERS });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add worker/i }));
    // No <select name="role"> at all in the form
    expect(screen.queryByRole('combobox', { name: /role/i })).toBeNull();
  });

  it('submits POST to /api/manager/workers when adding', async () => {
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => WORKERS })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'w3' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [...WORKERS, { id: 'w3', name: 'Carol', phone: '+1', language: 'en', role: 'worker', status: 'active' }] });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add worker/i }));
    fireEvent.change(screen.getByLabelText(/name/i),  { target: { value: 'Carol' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+1' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toMatch(/\/api\/manager\/workers$/);
    expect(postCall[1].method).toBe('POST');
  });
});
