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
                // Group Leaflet map libs
                if (id.includes('leaflet') || id.includes('react-leaflet')) {
                  return 'vendor-leaflet';
                }
                // Group Recharts and D3 data viz
                if (id.includes('recharts') || id.includes('d3')) {
                  return 'vendor-charts';
                }
                // Keep core react, motion, lucide, supabase in single core vendor to prevent dependency order/context issues
                return 'vendor';
              }
            }
          }
        },
        chunkSizeWarningLimit: 1200
      }
    };
});
