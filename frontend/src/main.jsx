import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import { installWindowHandlers } from './lib/errorReporter'

installWindowHandlers()

// Register the app-shell service worker in production builds only (avoids caching
// surprises during local `vite dev`).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* SW is best-effort */ })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <InstallPrompt />
    </ErrorBoundary>
  </StrictMode>,
)
