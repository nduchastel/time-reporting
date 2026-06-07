// frontend/src/components/InstallPrompt.jsx
// "Install app" affordance. On Android/desktop Chrome we capture the
// beforeinstallprompt event and offer a one-tap install. iOS Safari has no such
// event, so we show "Add to Home Screen" instructions instead. Dismissals are
// remembered so we don't nag.
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'time-reporting.installDismissed';

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}
function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    const onBeforeInstall = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); };

  if (dismissed || isStandalone()) return null;

  // Android / desktop: native install available.
  if (deferred) {
    const install = async () => {
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* ignore */ }
      setDeferred(null);
      dismiss();
    };
    return (
      <Banner onClose={dismiss}>
        <span>Install Time Reporting for quick access.</span>
        <button onClick={install} className="bg-blue-600 text-white px-3 py-1 rounded font-semibold">Install</button>
      </Banner>
    );
  }

  // iOS Safari: guide the user through Add to Home Screen.
  if (isIos()) {
    return (
      <Banner onClose={dismiss}>
        {showIosHelp ? (
          <span>Tap the <strong>Share</strong> icon, then <strong>“Add to Home Screen”</strong>.</span>
        ) : (
          <>
            <span>Add Time Reporting to your home screen.</span>
            <button onClick={() => setShowIosHelp(true)} className="bg-blue-600 text-white px-3 py-1 rounded font-semibold">How?</button>
          </>
        )}
      </Banner>
    );
  }

  return null;
}

function Banner({ children, onClose }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t shadow-lg p-3 flex items-center gap-3 text-sm">
      {children}
      <button onClick={onClose} aria-label="Dismiss install prompt" className="ml-auto text-gray-500">✕</button>
    </div>
  );
}
