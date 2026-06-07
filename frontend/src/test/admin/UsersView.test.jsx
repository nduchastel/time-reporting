import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import UsersView from '../../components/admin/UsersView';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('time-reporting.manager', JSON.stringify({ id: 'a1', token: 't', name: 'Admin', role: 'admin' }));
  vi.restoreAllMocks();
});

const USERS = [
  { id: 'a1', name: 'Admin', username: 'admin', role: 'admin', status: 'active', must_change_credential: false },
  { id: 'w1', name: 'Alice', phone: '+1-555-0001', role: 'worker', status: 'active', must_change_credential: true },
];

describe('UsersView', () => {
  it('lists users across roles', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => USERS });
    render(<UsersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('creates a worker via POST /api/admin/users', async () => {
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => USERS })           // initial load
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'w2' }) })  // POST
      .mockResolvedValueOnce({ ok: true, json: async () => USERS });          // reload
    render(<UsersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add user/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Carol' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+1-555-9' } });
    fireEvent.change(screen.getByLabelText(/temporary pin/i), { target: { value: '4321' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const post = fetchMock.mock.calls[1];
    expect(post[0]).toMatch(/\/api\/admin\/users$/);
    expect(post[1].method).toBe('POST');
    expect(JSON.parse(post[1].body)).toMatchObject({ role: 'worker', name: 'Carol', pin: '4321' });
  });

  it('switches form fields to username/password when role is manager', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => USERS });
    render(<UsersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add user/i }));
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'manager' } });
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText(/temporary password/i)).toBeInTheDocument();
  });
});
