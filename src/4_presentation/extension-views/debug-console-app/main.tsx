import React from 'react';
import { createRoot } from 'react-dom/client';
import { DebugConsoleApp } from './App';

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <React.StrictMode>
      <DebugConsoleApp />
    </React.StrictMode>,
  );
}
