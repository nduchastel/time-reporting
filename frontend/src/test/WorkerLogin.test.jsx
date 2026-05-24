// frontend/src/test/WorkerLogin.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkerLogin from '../components/WorkerLogin';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('WorkerLogin', () => {
  it('stores session after successful login', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ token: 't', worker: { id: 'w1', name: 'Bob', language: 'en' } }),
    });
    const onLoggedIn = vi.fn();
    render(<WorkerLogin onLoggedIn={onLoggedIn} />);
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+1-555-0100' } });
    fireEvent.change(screen.getByLabelText(/pin/i),   { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem('time-reporting.worker'))).toMatchObject({ id: 'w1' });
  });

  it('shows error on invalid credentials', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: 'INVALID_CREDENTIALS', message: 'nope' }),
    });
    render(<WorkerLogin onLoggedIn={() => {}} />);
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText(/pin/i),   { target: { value: '0000' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/wrong phone or pin/i)).toBeInTheDocument();
  });
});
