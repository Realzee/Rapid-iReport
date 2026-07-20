import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        target: 'esnext',
        minify: 'esbuild',
        cssMinify: true,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                // Group React core
                if (id.includes('react') || id.includes('scheduler')) {
                  return 'vendor-react';
                }
                // Group Leaflet map libs
                if (id.includes('leaflet') || id.includes('react-leaflet')) {
                  return 'vendor-leaflet';
                }
                // Group Recharts and D3 data viz
                if (id.includes('recharts') || id.includes('d3')) {
                  return 'vendor-charts';
                }
                // Group Icons
                if (id.includes('lucide-react')) {
                  return 'vendor-lucide';
                }
                // Group Supabase client
                if (id.includes('supabase') || id.includes('websocket')) {
                  return 'vendor-supabase';
                }
                // Group Motion animations
                if (id.includes('motion')) {
                  return 'vendor-motion';
                }
                // General fallback vendor
                return 'vendor';
              }
            }
          }
        },
        chunkSizeWarningLimit: 1200
      }
    };
});
