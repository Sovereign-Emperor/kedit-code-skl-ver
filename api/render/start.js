export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Only POST is supported for starting an export.' })
    return
  }

  const workerUrl = process.env.RENDER_WORKER_URL?.replace(/\/+$/, '')
  const apiKey = process.env.RENDER_API_KEY
  if (!workerUrl || !apiKey) {
    response.status(503).json({ error: 'MP4 export is not configured. Set the render worker URL and API key.' })
    return
  }
  let parsedWorkerUrl
  try { parsedWorkerUrl = new URL(workerUrl) }
  catch {
    response.status(503).json({ error: 'RENDER_WORKER_URL must be a valid HTTPS origin.' })
    return
  }
  if (parsedWorkerUrl.protocol !== 'https:' || parsedWorkerUrl.origin !== workerUrl) {
    response.status(503).json({ error: 'RENDER_WORKER_URL must be a valid HTTPS origin without a path.' })
    return
  }

  try {
    const payload = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {})
    const workerResponse = await fetch(`${workerUrl}/api/render/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: payload,
      signal: AbortSignal.timeout(30_000),
    })
    const result = await workerResponse.json().catch(() => null)
    if (!result || typeof result !== 'object') {
      response.status(502).json({ error: 'The render worker returned an invalid response.' })
      return
    }
    response.status(workerResponse.status).json({
      ...result,
      ...(workerResponse.ok ? { workerUrl } : {}),
    })
  } catch (error) {
    console.error('Could not start a render worker job:', error)
    response.status(502).json({ error: `Could not reach the render worker: ${error.message}` })
  }
}
