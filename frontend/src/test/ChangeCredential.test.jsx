import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ChangeCredential from '../components/ChangeCredential';

beforeEach(() => { vi.restoreAllMocks(); });

describe('ChangeCredential', () => {
  it('renders a forced full-screen prompt and submits a PIN change', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const onSuccess = vi.fn();
    render(<ChangeCredential kind="pin" token="t" forced onSuccess={onSuccess} />);
    expect(screen.getByText(/replace your temporary pin/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Current PIN'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: '5678' } });
    fireEvent.change(screen.getByLabelText('Confirm new PIN'), { target: { value: '5678' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/change-credential$/);
  });

  it('rejects a mismatched confirmation without hitting the API', async () => {
    const fetchMock = vi.spyOn(window, 'fetch');
    render(<ChangeCredential kind="pin" token="t" forced onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Current PIN'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: '5678' } });
    fireEvent.change(screen.getByLabelText('Confirm new PIN'), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/don.t match/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a wrong-current-secret error (and does not log out)', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: false, status: 401, json: async () => ({ error: 'INVALID_CREDENTIALS', message: 'Current secret is incorrect' }),
    });
    render(<ChangeCredential kind="pin" token="t" forced onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Current PIN'), { target: { value: '0000' } });
    fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: '5678' } });
    fireEvent.change(screen.getByLabelText('Confirm new PIN'), { target: { value: '5678' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/current pin is incorrect/i)).toBeInTheDocument();
  });
});
