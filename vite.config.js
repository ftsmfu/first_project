import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    hmr: {
      port: 5173,
    },
  },
  optimizeDeps: {
    exclude: ['@mediapipe/face_mesh'],
  },
})
