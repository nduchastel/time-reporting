import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import WorksitesView from '../../components/manager/WorksitesView';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('time-reporting.manager', JSON.stringify({ id: 'm1', token: 't', name: 'Mgr', role: 'manager' }));
  vi.restoreAllMocks();
});

const SITES = [
  { id: 's1', name: 'Active Site', address: '1 Main', client: 'Acme', status: 'active' },
  { id: 's2', name: 'Old Site', address: '', client: '', status: 'archived' },
];

describe('WorksitesView', () => {
  it('lists worksites incl. archived', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => SITES });
    render(<WorksitesView />);
    await waitFor(() => expect(screen.getByText('Active Site')).toBeInTheDocument());
    expect(screen.getByText('Old Site')).toBeInTheDocument();
  });

  it('creates a worksite via POST /api/manager/worksites', async () => {
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => SITES })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 's3' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => SITES });
    render(<WorksitesView />);
    await waitFor(() => expect(screen.getByText('Active Site')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add worksite/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Site' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const post = fetchMock.mock.calls[1];
    expect(post[0]).toMatch(/\/api\/manager\/worksites$/);
    expect(post[1].method).toBe('POST');
  });

  it('archives an active worksite (PATCH status=archived)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => SITES })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 's1', status: 'archived' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => SITES });
    render(<WorksitesView />);
    await waitFor(() => expect(screen.getByText('Active Site')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^archive$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const patch = fetchMock.mock.calls[1];
    expect(patch[0]).toMatch(/\/api\/manager\/worksites\/s1$/);
    expect(patch[1].method).toBe('PATCH');
    expect(JSON.parse(patch[1].body)).toEqual({ status: 'archived' });
  });
});
