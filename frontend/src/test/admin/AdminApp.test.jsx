import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AdminApp from '../../components/admin/AdminApp';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  window.location.hash = '#/admin';
});

const setSession = (extra) =>
  localStorage.setItem('time-reporting.manager', JSON.stringify({ id: 'a1', token: 't', name: 'Admin', role: 'admin', ...extra }));

describe('AdminApp guard', () => {
  it('denies a manager (non-admin)', () => {
    localStorage.setItem('time-reporting.manager', JSON.stringify({ id: 'm1', token: 't', name: 'Mgr', role: 'manager' }));
    render(<AdminApp />);
    expect(screen.getByText(/don.t have access/i)).toBeInTheDocument();
  });

  it('renders the Users portal for an admin', async () => {
    setSession();
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
    render(<AdminApp />);
    expect(await screen.findByRole('heading', { name: /users/i })).toBeInTheDocument();
  });

  it('forces a password change when must_change_credential is set', () => {
    setSession({ must_change_credential: true });
    render(<AdminApp />);
    expect(screen.getByRole('heading', { name: /change your password/i })).toBeInTheDocument();
  });
});
