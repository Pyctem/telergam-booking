import React from 'react';
import ReactDOM from 'react-dom/client';
import { init } from '@telegram-apps/sdk-react';
import { App } from './App';
import './theme.css';

try {
  init();
} catch (err) {
  // Outside a real Telegram client (e.g. a plain browser during local dev),
  // init() throws LaunchParamsRetrieveError synchronously — it can't find
  // launch params in the URL, performance entries, or localStorage. Every
  // other Telegram SDK call in this app is already guarded by .isAvailable()
  // checks (see useTelegramTheme/useMainButton/useBackButton) and degrades
  // gracefully on its own; without this try/catch, the uncaught throw here
  // would stop this module before React ever mounts, leaving a blank page.
  console.warn('Telegram SDK init() failed — running outside Telegram?', err);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
