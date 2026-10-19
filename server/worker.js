import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { createRenderApi } from './render-api.js'

const require = createRequire(import.meta.url)
const ffmpegPath = require('ffmpeg-static')
const apiKey = process.env.RENDER_API_KEY
if (!apiKey) throw new Error('RENDER_API_KEY must be set before starting the render worker.')

const port = Number(process.env.PORT || 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.')

const allowedOrigins = (process.env.RENDER_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)
const publicUrl = process.env.RENDER_PUBLIC_URL?.replace(/\/+$/, '')
const parsedPublicUrl = publicUrl ? new URL(publicUrl) : null
if (!parsedPublicUrl || parsedPublicUrl.protocol !== 'https:' || parsedPublicUrl.origin !== publicUrl) {
  throw new Error('RENDER_PUBLIC_URL must be the worker’s public HTTPS origin.')
}
if (allowedOrigins.length === 0 || allowedOrigins.some(origin => {
  const parsedOrigin = new URL(origin)
  return parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== origin
})) {
  throw new Error('RENDER_ALLOWED_ORIGINS must contain at least one HTTPS editor origin.')
}
const renderApi = createRenderApi(ffmpegPath, { apiKey, allowedOrigins, publicUrl })
const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    response.end('ok')
    return
  }
  renderApi(request, response, () => {
    response.statusCode = 404
    response.end('Not found')
  })
})

server.on('error', error => {
  console.error('Render worker server failed:', error)
  process.exitCode = 1
})
server.listen(port, '0.0.0.0', () => console.log(`KEDIT render worker listening on port ${port}`))
