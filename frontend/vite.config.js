import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // El frontend llama a rutas relativas (/api, /auth); en desarrollo
      // Vite las redirige al backend local. En producción, backend y
      // frontend se sirven bajo el mismo origen y esto no hace falta.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
