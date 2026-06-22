import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initAnalytics } from './utils/analytics'

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    // PWA: el service worker solo se registra en producción.
    navigator.serviceWorker.register("/sw.js");
  } else {
    // En desarrollo un SW cacheado mezcla chunks viejos y nuevos tras editar
    // archivos (rompe el HMR y causa "Expected first argument to doc()" por
    // instancias duplicadas de módulos). Lo desregistramos y limpiamos caches.
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
  }
}

initAnalytics();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
