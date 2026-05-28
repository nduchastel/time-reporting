// frontend/src/test/manager/ManagerLogin.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManagerLogin from '../../components/manager/ManagerLogin';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('ManagerLogin', () => {
  it('stores manager session on success', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ token: 't', user: { id: 'm1', name: 'Mgr', role: 'manager' } }),
    });
    const cb = vi.fn();
    render(<ManagerLogin onLoggedIn={cb} />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'mgr1' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(cb).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem('time-reporting.manager'))).toMatchObject({ id: 'm1', role: 'manager' });
  });

  it('shows error on 401', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'INVALID_CREDENTIALS', message: 'no' }) });
    render(<ManagerLogin onLoggedIn={() => {}} />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'm' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/wrong username or password/i)).toBeInTheDocument();
  });

  it('shows generic error on other failures', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'X', message: 'oops' }) });
    render(<ManagerLogin onLoggedIn={() => {}} />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'm' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/login failed/i)).toBeInTheDocument();
  });
});
