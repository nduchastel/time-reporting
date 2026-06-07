import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import InstallPrompt from '../components/InstallPrompt';

const setUA = (value) => Object.defineProperty(navigator, 'userAgent', { value, configurable: true });

beforeEach(() => { localStorage.clear(); setUA('jsdom'); });

describe('InstallPrompt', () => {
  it('offers a native install after beforeinstallprompt fires', async () => {
    render(<InstallPrompt />);
    const e = new Event('beforeinstallprompt');
    e.prompt = vi.fn();
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    act(() => { window.dispatchEvent(e); });
    expect(await screen.findByRole('button', { name: /^install$/i })).toBeInTheDocument();
  });

  it('shows iOS Add-to-Home-Screen instructions on iOS', () => {
    setUA('iPhone');
    render(<InstallPrompt />);
    fireEvent.click(screen.getByRole('button', { name: /how\?/i }));
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });

  it('stays hidden once dismissed', () => {
    setUA('iPhone');
    localStorage.setItem('time-reporting.installDismissed', '1');
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });
});
