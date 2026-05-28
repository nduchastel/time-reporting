// src/test/WorkerUI.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkerUI from '../components/WorkerUI';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('time-reporting.worker', JSON.stringify({ id: 'w1', token: 't' }));
  vi.restoreAllMocks();
});

describe('WorkerUI', () => {
  it('should render 4 navigation dots', () => {
    render(<WorkerUI />);

    // Should have 4 dots for navigation
    const dots = screen.getAllByRole('button', { name: /go to/i });
    expect(dots).toHaveLength(4);
  });

  it('should show first action type by default', () => {
    render(<WorkerUI />);

    // Should show Check IN by default
    expect(screen.getByText(/check in/i)).toBeInTheDocument();
  });

  it('should show record button', () => {
    render(<WorkerUI />);

    const recordButton = screen.getByRole('button', { name: /tap to record/i });
    expect(recordButton).toBeInTheDocument();
  });

  it('opens history modal when history button clicked', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
    render(<WorkerUI />);
    fireEvent.click(screen.getByRole('button', { name: /view history/i }));
    expect(await screen.findByText(/recent submissions/i)).toBeInTheDocument();
  });

  it('cycles to next action when navigation dot clicked', () => {
    render(<WorkerUI />);
    fireEvent.click(screen.getByRole('button', { name: /go to check out/i }));
    expect(screen.getByRole('heading', { name: /check out/i })).toBeInTheDocument();
  });
});
