import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './design/Header.css';
import './design/app-shell.css';
import './design/screens.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
