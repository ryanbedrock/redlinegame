import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { notifyPlatformLoaded } from './platformBridge';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

notifyPlatformLoaded();

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
