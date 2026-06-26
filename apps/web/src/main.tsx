import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './wireframe.css';
import './paper-atlas.css';
import './paper-atlas-phase3.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
