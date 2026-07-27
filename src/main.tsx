// ============================================================
// ABBI DeskLive — Root Entry Point (SEC-001 FIXED)
// ============================================================
// PERUBAHAN: Import env-override.ts DIHAPUS.
// File env-override.ts sudah dihapus — tidak ada lagi
// pemaksaan mode LIVE otomatis.
// API_MODE ditentukan oleh VITE_API_MODE di .env saja.
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { ThemeProvider } from '@theme/ThemeProvider';
import { routeTree } from './routeTree.gen';
import './index.css';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// FIX: Cari 'app' kalau 'root' nggak ada
const rootElement = document.getElementById('root') || document.getElementById('app');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>
);