import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { configureWebViewAuth } from './utils/webViewDetection';
import './index.css';
import './styles/mobile-optimizations.css';
import './styles/custom-utilities.css';

configureWebViewAuth();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
);
