import React from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanelApp } from './App';

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <React.StrictMode>
      <SidePanelApp />
    </React.StrictMode>,
  );
}
