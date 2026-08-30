import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      // The service worker is being retired. It cached the app shell and then
      // kept serving it, so deployed fixes did not reach anyone still running
      // an older worker — including, repeatedly, a password reset that was
      // fixed in production while the browser kept executing the broken build.
      // Switching to autoUpdate did not help those already stuck, because the
      // new worker has to be adopted by the old one first.
      //
      // selfDestroying ships a worker whose only job is to unregister itself
      // and delete every cache. Browsers revalidate sw.js on navigation, so it
      // reaches clients that are stuck. Offline support is worth little on a
      // site whose entire purpose is live market data, and it is not worth a
      // class of bug where users silently run last week's code.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'robots.txt'],
      minify: false,
      manifest: {
        name: 'UnifiedMarket - Stock Tracker',
        short_name: 'UnifiedMarket',
        description: 'Track stocks, earnings, dividends, and market sentiment with AI-powered insights',
        theme_color: '#10b981',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        mode: 'development',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.twelvedata\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'stock-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300 // 5 minutes
              }
            }
          },
          {
            urlPattern: /^https:\/\/finnhub\.io\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'news-api-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 120 // 2 minutes
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("recharts")) return "recharts";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@tanstack/react-query")) return "query";
          return "vendor";
        },
      },
    },
  },
}));
