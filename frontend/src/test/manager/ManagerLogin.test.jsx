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
});
