import React from 'react';
import ReactDOM from 'react-dom/client';
import { LazyMotion, domAnimation } from 'framer-motion';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { configureWebViewAuth } from './utils/webViewDetection';
import './index.css';
import './styles/mobile-optimizations.css';
import './styles/custom-utilities.css';

configureWebViewAuth();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <LazyMotion features={domAnimation} strict>
      <App />
    </LazyMotion>
  </ErrorBoundary>,
);
