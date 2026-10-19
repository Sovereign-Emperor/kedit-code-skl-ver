import { spawn } from 'node:child_process'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MAX_AUDIO_BYTES = 500 * 1024 * 1024
const MAX_FRAME_BYTES = 30 * 1024 * 1024
const MAX_SOUND_EFFECT_BYTES = 25 * 1024 * 1024
const jobs = new Map()

function respond(response, status, body) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function readJson(request, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', chunk => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('Request is too large.'))
        request.destroy()
      } else chunks.push(chunk)
    })
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch { reject(new Error('Request must contain valid JSON.')) }
    })
    request.on('error', reject)
  })
}

async function saveRequest(request, filepath, maxBytes) {
  let size = 0
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length
      if (size > maxBytes) callback(new Error('Uploaded file exceeds the size limit.'))
      else callback(null, chunk)
    },
  })
  await pipeline(request, limiter, createWriteStream(filepath, { flags: 'wx' }))
  return size
}

function safeTitle(value) {
  const title = typeof value === 'string' ? value.replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 60) : ''
  return title || 'kedit-export'
}

function bearerToken(request) {
  const match = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? ''
}

function tokensMatch(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

async function removeJob(id) {
  const job = jobs.get(id)
  if (!job) return
  jobs.delete(id)
  await rm(job.directory, { recursive: true, force: true })
}

function startEncoding(job) {
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', String(job.fps), '-start_number', '0',
    '-i', join(job.directory, 'frame_%06d.jpg'),
  ]
  if (job.hasAudio) args.push('-i', join(job.directory, 'audio.bin'))
  for (let index = 0; index < job.soundEffects.length; index += 1) args.push('-i', join(job.directory, `effect_${String(index).padStart(2, '0')}.bin`))
  args.push('-map', '0:v:0')
  if (job.hasAudio || job.soundEffects.length) {
    const filters = []
    const tracks = []
    let inputIndex = 1
    if (job.hasAudio) {
      filters.push('[1:a:0]aresample=48000,apad[track0]')
      tracks.push('[track0]')
      inputIndex += 1
    }
    for (const [index, effect] of job.soundEffects.entries()) {
      const delay = Math.round(effect.start * 1000)
      filters.push(`[${inputIndex + index}:a:0]aresample=48000,adelay=${delay}:all=1,volume=${effect.gain},apad[track${tracks.length}]`)
      tracks.push(`[track${tracks.length}]`)
    }
    if (tracks.length > 1) filters.push(`${tracks.join('')}amix=inputs=${tracks.length}:duration=longest:normalize=0:dropout_transition=0,alimiter=limit=0.95[renderedAudio]`)
    else filters.push(`${tracks[0]}anull[renderedAudio]`)
    filters.push(`[renderedAudio]atrim=duration=${job.duration}[audioOut]`)
    args.push('-filter_complex', filters.join(';'), '-map', '[audioOut]')
  }
  else args.push('-an')
  args.push(
    '-frames:v', String(job.frameCount),
    '-t', String(job.duration),
    '-vf', `scale=${job.width}:${job.height}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '21',
    '-r', String(job.fps),
  )
  if (job.hasAudio || job.soundEffects.length) args.push('-c:a', 'aac', '-b:a', '192k')
  args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', join(job.directory, 'render.mp4'))

  job.status = 'encoding'
  const child = spawn(job.ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  job.process = child
  let stderr = ''
  let stdout = ''
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-8000) })
  child.stdout.on('data', chunk => {
    stdout += chunk.toString()
    const lines = stdout.split(/\r?\n/)
    stdout = lines.pop() ?? ''
    for (const line of lines) {
      const [key, value] = line.split('=')
      if (key === 'out_time_us' && Number.isFinite(Number(value))) job.progress = Math.min(1, Number(value) / 1_000_000 / job.duration)
      if (key === 'progress' && value === 'end') job.progress = 1
    }
  })
  child.on('error', error => { job.status = 'error'; job.error = `Could not launch FFmpeg: ${error.message}` })
  child.on('close', async code => {
    if (job.status === 'error') return
    if (code !== 0) {
      job.status = 'error'
      job.error = `FFmpeg exited with code ${code}. ${stderr.trim().slice(-1800) || 'Check that the selected soundtrack is a supported audio format.'}`
      return
    }
    try {
      await stat(join(job.directory, 'render.mp4'))
      job.status = 'complete'
      job.progress = 1
    } catch (error) {
      job.status = 'error'
      job.error = `FFmpeg finished without producing an MP4: ${error.message}`
    }
  })
}

export function createRenderApi(ffmpegPath, { apiKey, allowedOrigins = [], publicUrl } = {}) {
  if (!ffmpegPath) throw new Error('The ffmpeg-static binary is missing. Reinstall dependencies with npm install.')
  return (request, response, next) => {
    const url = new URL(request.url || '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/render/')) return next()
    const origin = request.headers.origin
    if (origin && allowedOrigins.length) {
      if (!allowedOrigins.includes(origin)) {
        respond(response, 403, { error: 'This website is not allowed to access the render service.' })
        return
      }
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    }
    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      response.end()
      return
    }
    const handle = async () => {
      if (request.method === 'POST' && url.pathname === '/api/render/start') {
        if (apiKey && !tokensMatch(bearerToken(request), apiKey)) {
          respond(response, 401, { error: 'Render service authorization failed.' })
          return
        }
        const config = await readJson(request)
        const { fps, duration, width, height, hasAudio } = config
        const soundEffects = config.soundEffects ?? []
        const supportedSize = (width === 1080 && height === 1920) || (width === 1920 && height === 1080) || (width === 1080 && height === 1080)
        if (![24, 30, 60].includes(fps) || !Number.isFinite(duration) || duration < 0.5 || duration > 300
          || !supportedSize
          || typeof hasAudio !== 'boolean'
          || !Array.isArray(soundEffects) || soundEffects.length > 8
          || soundEffects.some(effect => !effect || !Number.isFinite(effect.start) || effect.start < 0 || effect.start >= duration
            || !Number.isFinite(effect.gain) || effect.gain < 0 || effect.gain > 2)) {
          respond(response, 400, { error: 'Invalid export settings. Check frame rate, duration, format, and soundtrack.' })
          return
        }
        const id = randomUUID()
        const directory = await mkdtemp(join(tmpdir(), 'kedit-render-'))
        const job = {
          id, directory, ffmpegPath, fps, duration, width, height, hasAudio,
          soundEffects, uploadedEffects: new Set(),
          accessToken: randomBytes(32).toString('base64url'),
          frameCount: Math.ceil(duration * fps), title: safeTitle(config.filename),
          nextFrame: 0, progress: 0, status: 'uploading', error: '', process: null,
        }
        jobs.set(id, job)
        const cleanupTimer = setTimeout(() => removeJob(id).catch(error => console.error('Stale render cleanup failed:', error)), 2 * 60 * 60 * 1000)
        cleanupTimer.unref?.()
        const protocol = request.headers['x-forwarded-proto'] || 'http'
        const host = request.headers.host || 'localhost'
        respond(response, 201, {
          id,
          frames: job.frameCount,
          accessToken: job.accessToken,
          workerUrl: publicUrl || `${protocol}://${host}`,
        })
        return
      }

      const match = url.pathname.match(/^\/api\/render\/([a-f0-9-]{36})(?:\/(audio|frame\/(\d+)|effect\/(\d+)|finish|status|file))?$/)
      if (!match) { respond(response, 404, { error: 'Render endpoint not found.' }); return }
      const [, id, action, frameIndex, effectIndex] = match
      const job = jobs.get(id)
      if (!job) { respond(response, 404, { error: 'Render session expired or was already cleaned up. Start a new export.' }); return }
      if (!tokensMatch(bearerToken(request), job.accessToken)) {
        respond(response, 401, { error: 'Render session authorization failed. Start a new export.' })
        return
      }

      if (request.method === 'POST' && action === 'audio') {
        if (!job.hasAudio) { respond(response, 400, { error: 'This export was started without a soundtrack.' }); return }
        try {
          const size = await saveRequest(request, join(job.directory, 'audio.bin'), MAX_AUDIO_BYTES)
          if (size === 0) { respond(response, 400, { error: 'The soundtrack upload is empty.' }); return }
          respond(response, 200, { uploaded: true })
        } catch (error) { respond(response, 400, { error: `Soundtrack upload failed: ${error.message}` }) }
        return
      }

      if (request.method === 'POST' && action?.startsWith('frame/')) {
        const index = Number(frameIndex)
        if (job.status !== 'uploading' || index !== job.nextFrame || index >= job.frameCount) {
          respond(response, 400, { error: 'Frame sequence is invalid or the render has already started.' })
          return
        }
        try {
          const size = await saveRequest(request, join(job.directory, `frame_${String(index).padStart(6, '0')}.jpg`), MAX_FRAME_BYTES)
          if (!size) { respond(response, 400, { error: `Frame ${index} is empty.` }); return }
          job.nextFrame += 1
          respond(response, 201, { received: job.nextFrame })
        } catch (error) { respond(response, 400, { error: `Frame ${index} upload failed: ${error.message}` }) }
        return
      }

      if (request.method === 'POST' && action?.startsWith('effect/')) {
        const index = Number(effectIndex)
        if (job.status !== 'uploading' || index >= job.soundEffects.length || job.uploadedEffects.has(index)) {
          respond(response, 400, { error: 'Sound effect upload index is invalid or already used.' })
          return
        }
        try {
          const size = await saveRequest(request, join(job.directory, `effect_${String(index).padStart(2, '0')}.bin`), MAX_SOUND_EFFECT_BYTES)
          if (!size) { respond(response, 400, { error: `Sound effect ${index + 1} is empty.` }); return }
          job.uploadedEffects.add(index)
          respond(response, 201, { received: index + 1 })
        } catch (error) { respond(response, 400, { error: `Sound effect ${index + 1} upload failed: ${error.message}` }) }
        return
      }

      if (request.method === 'POST' && action === 'finish') {
        if (job.status !== 'uploading' || job.nextFrame !== job.frameCount
          || (job.hasAudio && !(await stat(join(job.directory, 'audio.bin')).catch(() => null)))
          || job.uploadedEffects.size !== job.soundEffects.length) {
          respond(response, 400, { error: 'The export is missing one or more frames or its soundtrack.' })
          return
        }
        startEncoding(job)
        respond(response, 202, { status: job.status })
        return
      }
      if (request.method === 'GET' && action === 'status') {
        respond(response, 200, { status: job.status, progress: job.progress, error: job.error })
        return
      }
      if (request.method === 'GET' && action === 'file') {
        if (job.status !== 'complete') { respond(response, 409, { error: 'The MP4 is not ready yet.' }); return }
        response.statusCode = 200
        response.setHeader('Content-Type', 'video/mp4')
        response.setHeader('Content-Disposition', `attachment; filename="${job.title}.mp4"`)
        response.setHeader('Content-Length', String((await stat(join(job.directory, 'render.mp4'))).size))
        try { await pipeline(createReadStream(join(job.directory, 'render.mp4')), response) }
        catch (error) {
          console.error('MP4 download failed:', error)
          if (!response.headersSent) respond(response, 500, { error: `Could not read MP4 output: ${error.message}` })
          else response.destroy(error)
        } finally { await removeJob(id) }
        return
      }
      if (request.method === 'DELETE') {
        job.process?.kill()
        await removeJob(id)
        response.statusCode = 204
        response.end()
        return
      }
      respond(response, 404, { error: 'Render endpoint not found.' })
    }
    handle().catch(error => {
      console.error('Local MP4 render error:', error)
      if (!response.headersSent) respond(response, 500, { error: `Local render failed: ${error.message}` })
    })
  }
}
