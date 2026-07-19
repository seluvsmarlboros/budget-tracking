import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { ErrorBoundary } from './App';
import { StateProvider } from './contexts/StateContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StateProvider>
        <App />
      </StateProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
