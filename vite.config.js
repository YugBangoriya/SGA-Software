// vite.config.js — COMPLETE CONFIGURATION FOR SGA PWA
// Paste this into your existing vite.config.js, merging with any current settings

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ─── Service Worker Strategy ───────────────────────────────────────────
      strategies: 'injectManifest',          // We control the SW file ourselves
      srcDir: 'src',
      filename: 'sw.js',                     // Our custom service worker at src/sw.js
      injectRegister: 'auto',
      registerType: 'prompt',                // Show "Update available" prompt — never silently replace

      // ─── Dev options ──────────────────────────────────────────────────────
      devOptions: {
        enabled: true,                       // Enable SW in dev for testing
        type: 'module',
        navigateFallback: 'index.html',
      },

      // ─── Manifest ─────────────────────────────────────────────────────────
      manifest: {
        name: 'Shree Ganesh Automobile',
        short_name: 'SGA',
        description: 'Business Management Software — CNG Kit Installation',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#661F1F',
        background_color: '#CDCBC9',
        lang: 'en',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'New Invoice',
            short_name: 'Invoice',
            description: 'Create a new invoice',
            url: '/invoices/new',
            icons: [{ src: '/icons/shortcut-invoice.png', sizes: '96x96' }],
          },
          {
            name: 'New Customer',
            short_name: 'Customer',
            description: 'Add a new customer',
            url: '/customers/new',
            icons: [{ src: '/icons/shortcut-customer.png', sizes: '96x96' }],
          },
        ],
      },

      // ─── Assets to precache (app shell) ───────────────────────────────────
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],

  // ─── Build optimizations ────────────────────────────────────────────────
  build: {
    target: 'es2015',
    rollupOptions: {
      output: {
        // ── Code splitting: heavy modules load on demand ──────────────────
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor-react';
          if (id.includes('node_modules/firebase')) return 'vendor-firebase';
          if (id.includes('node_modules/zustand') || id.includes('node_modules/react-hook-form') || id.includes('node_modules/zod') || id.includes('node_modules/lucide-react')) return 'vendor-ui';
          if (id.includes('node_modules/@react-pdf')) return 'chunk-pdf';
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) return 'chunk-i18n';
          if (id.includes('src/pages/messaging')) return 'chunk-messaging';
          if (id.includes('src/pages/reporting')) return 'chunk-reports';
          if (id.includes('src/pages/settings')) return 'chunk-settings';
        },
      },
    },
    // Warn if any chunk exceeds 500KB
    chunkSizeWarningLimit: 500,
  },

  // ─── Optimized deps ─────────────────────────────────────────────────────
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      '@react-pdf/renderer',
    ],
  },

  resolve: {
    alias: {
      '@': '/src',
    },
  },

});