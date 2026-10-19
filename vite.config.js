import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import { createRenderApi } from './server/render-api.js'

const require = createRequire(import.meta.url)
const ffmpegPath = require('ffmpeg-static')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'kedit-local-render-api',
      configureServer(server) {
        server.middlewares.use(createRenderApi(ffmpegPath))
      },
      configurePreviewServer(server) {
        server.middlewares.use(createRenderApi(ffmpegPath))
      },
    },
  ],
})
