import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import { initTheme } from './theme.js';
import './styles/index.css';

initTheme();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
