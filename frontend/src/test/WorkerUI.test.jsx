// src/test/WorkerUI.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkerUI from '../components/WorkerUI';

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
});
