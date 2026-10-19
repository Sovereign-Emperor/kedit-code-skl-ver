import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createTimelineController } from './engine/timeline.js'
import { drawCompositionFrame } from './engine/renderer.js'
import { ANIMATIONS, ANIMATION_CATEGORIES, EMPHASIS_ANIMATIONS, EXIT_ANIMATIONS } from './engine/animations.js'
import { FORMATS, validateComposition } from './engine/schema.js'
import { COMPOSITIONS, TEMPLATES, createLyric } from './compositions/library.js'

const STORE_KEY = 'kedit-studio-composition-v1'
const formatTime = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}.${String(Math.floor((value % 1) * 10))}`
const clone = value => JSON.parse(JSON.stringify(value))

function Icon({ name, size = 18 }) {
  const paths = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
    play: <path d="m8 5 12 7-12 7V5Z" />,
    pause: <><path d="M8 5h3v14H8zM15 5h3v14h-3z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    export: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 17v4h14v-4" /></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M4 18v3h16v-3" /></>,
    left: <><path d="m15 18-6-6 6-6" /></>,
    right: <><path d="m9 18 6-6-6-6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1 1.1.9-1.2 2.1-1.4-.5a8 8 0 0 1-1.6.9l-.3 1.5h-2.4l-.3-1.5a8 8 0 0 1-1.6-.9l-1.4.5-1.2-2.1 1.1-.9a8 8 0 0 1 0-1.9l-1.1-.9 1.2-2.1 1.4.5a8 8 0 0 1 1.6-.9l.3-1.5h2.4l.3 1.5a8 8 0 0 1 1.6.9l1.4-.5 1.2 2.1-1.1.9a8 8 0 0 1-.1 1.9Z" transform="translate(-1 -1)" /></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function CanvasPreview({ composition, time, onCanvas }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const frame = FORMATS[composition.format]
    canvas.width = frame.width
    canvas.height = frame.height
    const ctx = canvas.getContext('2d')
    drawCompositionFrame(ctx, composition, time, { width: canvas.width, height: canvas.height })
    onCanvas(canvas)
  }, [composition, time, onCanvas])
  return <canvas className="preview-canvas" ref={ref} aria-label={`Composition preview at ${formatTime(time)}`} />
}

function App() {
  const [composition, setComposition] = useState(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY)
      if (!stored) return clone(COMPOSITIONS[0])
      const parsed = JSON.parse(stored)
      const error = validateComposition(parsed)
      if (error) throw error
      return parsed
    } catch (error) {
      console.error('Saved composition could not be loaded:', error)
      return clone(COMPOSITIONS[0])
    }
  })
  const [selectedId, setSelectedId] = useState(composition.events[0]?.id ?? null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [notice, setNotice] = useState('')
  const [renderState, setRenderState] = useState({ status: 'idle', progress: 0, error: '' })
  const [readyExport, setReadyExport] = useState(null)
  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [soundEffects, setSoundEffects] = useState([])
  const [view, setView] = useState('editor')
  const [inspectorTab, setInspectorTab] = useState('content')
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false)
  const [compositionPickerOpen, setCompositionPickerOpen] = useState(false)
  const audioRef = useRef(null)
  const canvasRef = useRef(null)
  const controllerRef = useRef(null)
  const importRef = useRef(null)
  const soundEffectsRef = useRef([])
  const soundEffectAudioRefs = useRef(new Map())
  const playingRef = useRef(false)
  const previousTimeRef = useRef(0)
  const compositionRef = useRef(composition)
  compositionRef.current = composition
  const selected = composition.events.find(event => event.id === selectedId) ?? composition.events[0]
  const sortedEvents = useMemo(() => [...composition.events].sort((a, b) => a.start - b.start), [composition.events])
  const lyricLanes = useMemo(() => {
    const lanes = []
    for (const event of sortedEvents) {
      const lane = lanes.find(items => items.at(-1).start + items.at(-1).duration <= event.start)
      if (lane) lane.push(event)
      else lanes.push([event])
    }
    return lanes
  }, [sortedEvents])
  const issues = useMemo(() => validateComposition(composition, { returnErrors: true }), [composition])
  const fps = composition.fps

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(composition)) }
    catch (error) { console.error('Could not save composition locally:', error); setNotice('Local save failed. Export a backup JSON.') }
  }, [composition])

  useEffect(() => {
    if (readyExport) {
      fetch(`/api/render/${readyExport.id}`, { method: 'DELETE' }).catch(error => console.error('Could not clean up the previous MP4:', error))
    }
    setReadyExport(null)
    setRenderState(current => current.status === 'complete' ? { status: 'idle', progress: 0, error: '' } : current)
  }, [composition])

  const update = useCallback((patch) => setComposition(current => ({ ...current, ...patch })), [])
  const updateEvent = (id, patch) => setComposition(current => ({
    ...current,
    events: current.events.map(event => event.id === id ? { ...event, ...patch } : event),
  }))

  useEffect(() => {
    const controller = createTimelineController({
      duration: composition.duration,
      audio: audioRef.current,
      onUpdate: value => {
        if (playingRef.current && value >= previousTimeRef.current) {
          for (const effect of soundEffectsRef.current) {
            if (effect.start >= previousTimeRef.current && effect.start <= value && (value > previousTimeRef.current || effect.start === 0)) {
              const player = soundEffectAudioRefs.current.get(effect.eventId)
              if (player) {
                player.currentTime = 0
                player.play().catch(error => setNotice(`Sound effect playback error: ${error.message}`))
              }
            }
          }
        }
        previousTimeRef.current = value
        setTime(value)
      },
      onPlaybackChange: value => {
        playingRef.current = value
        if (!value) for (const player of soundEffectAudioRefs.current.values()) player.pause()
        setPlaying(value)
      },
    })
    controllerRef.current = controller
    controller.seek(Math.min(time, composition.duration))
    return () => controller.destroy()
    // The playhead controller is rebuilt only when duration or audio changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composition.duration, audioUrl])

  useEffect(() => {
    const file = audioFile
    return () => { if (file && audioUrl) URL.revokeObjectURL(audioUrl) }
  }, [audioFile, audioUrl])

  useEffect(() => {
    soundEffectsRef.current = composition.events.flatMap(event => {
      const uploaded = soundEffects.find(item => item.eventId === event.id)
      return uploaded ? [{ ...uploaded, start: event.start }] : []
    })
  }, [composition.events, soundEffects])

  useEffect(() => () => soundEffectsRef.current.forEach(item => URL.revokeObjectURL(item.url)), [])

  const onCanvas = useCallback(canvas => { canvasRef.current = canvas }, [])
  const seek = value => {
    controllerRef.current?.seek(value)
    setTime(value)
  }
  const togglePlayback = async () => {
    try { await controllerRef.current?.toggle() }
    catch (error) { setNotice(`Playback error: ${error.message}`) }
  }
  const addEvent = () => {
    const start = Math.min(Math.max(0, time), Math.max(0, composition.duration - 0.5))
    const event = createLyric(start, Math.min(2.5, composition.duration - start))
    setComposition(current => ({ ...current, events: [...current.events, event] }))
    setSelectedId(event.id)
    setInspectorTab('content')
    setView('editor')
  }
  const removeEvent = id => {
    removeSoundEffect(id)
    setComposition(current => ({ ...current, events: current.events.filter(event => event.id !== id) }))
    setSelectedId(composition.events.find(event => event.id !== id)?.id ?? null)
  }
  const chooseComposition = id => {
    const found = COMPOSITIONS.find(item => item.id === id)
    if (!found) return
    controllerRef.current?.pause()
    setComposition(clone(found))
    setSelectedId(found.events[0]?.id ?? null)
    clearSoundEffects()
    setAudioFile(null)
    setAudioUrl('')
    setTime(0)
    setInspectorTab('content')
    setView('editor')
    setCompositionPickerOpen(false)
  }
  const newComposition = () => {
    const fresh = { id: `my-edit-${Date.now()}`, title: 'Untitled edit', format: 'vertical', fps: 30, duration: 20, audio: '', background: '#09090f', events: [] }
    controllerRef.current?.pause()
    clearSoundEffects()
    setComposition(fresh)
    setSelectedId(null)
    setAudioFile(null)
    setAudioUrl('')
    setTime(0)
    setInspectorTab('content')
    setView('editor')
    setCompositionPickerOpen(false)
  }
  const chooseTemplate = id => {
    const template = TEMPLATES.find(item => item.id === id)
    if (template && selected && selectedId) {
      updateEvent(selected.id, { template: template.id, animation: template.animation, entrance: template.animation, color: template.color, font: template.font, fontWeight: template.fontWeight, letterSpacing: template.letterSpacing })
      return
    }
    if (template && !selectedId) {
      const start = Math.min(time, Math.max(0, composition.duration - 0.5))
      const event = { ...createLyric(start, Math.min(2.5, composition.duration - start)), template: template.id, animation: template.animation, entrance: template.animation, color: template.color, font: template.font, fontWeight: template.fontWeight, letterSpacing: template.letterSpacing }
      setComposition(current => ({ ...current, events: [...current.events, event] }))
      setSelectedId(event.id)
      setView('editor')
    }
  }
  const setAudio = file => {
    if (!file) return
    if (!file.type.startsWith('audio/')) { setNotice('Choose an audio file such as MP3, WAV, M4A, or AAC.'); return }
    if (file.size > 500 * 1024 * 1024) { setNotice('Audio file is too large. The current limit is 500 MB.'); return }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    const url = URL.createObjectURL(file)
    setAudioFile(file)
    setAudioUrl(url)
    update({ audio: file.name })
    setNotice(`Soundtrack added: ${file.name}`)
  }
  const setSoundEffect = (eventId, file) => {
    if (!file) return
    if (!file.type.startsWith('audio/')) { setNotice('Choose an audio file for the sound effect.'); return }
    if (file.size > 25 * 1024 * 1024) { setNotice('Sound effect files must be 25 MB or smaller.'); return }
    const existing = soundEffects.find(item => item.eventId === eventId)
    if (!existing && soundEffects.length >= 8) { setNotice('A composition can use up to eight sound effects.'); return }
    if (existing) {
      soundEffectAudioRefs.current.get(eventId)?.pause()
      URL.revokeObjectURL(existing.url)
    }
    const effect = { eventId, file, url: URL.createObjectURL(file) }
    setSoundEffects(current => [...current.filter(item => item.eventId !== eventId), effect])
    soundEffectsRef.current = [...soundEffectsRef.current.filter(item => item.eventId !== eventId), { ...effect, start: composition.events.find(event => event.id === eventId)?.start ?? 0 }]
    updateEvent(eventId, { soundEffect: file.name })
    setNotice(`Sound effect added: ${file.name}`)
  }
  const removeSoundEffect = eventId => {
    const existing = soundEffects.find(item => item.eventId === eventId)
    soundEffectAudioRefs.current.get(eventId)?.pause()
    if (existing) URL.revokeObjectURL(existing.url)
    setSoundEffects(current => current.filter(item => item.eventId !== eventId))
    soundEffectsRef.current = soundEffectsRef.current.filter(item => item.eventId !== eventId)
    updateEvent(eventId, { soundEffect: '' })
  }
  const clearSoundEffects = () => {
    for (const player of soundEffectAudioRefs.current.values()) player.pause()
    soundEffects.forEach(item => URL.revokeObjectURL(item.url))
    setSoundEffects([])
    soundEffectsRef.current = []
    soundEffectAudioRefs.current.clear()
  }
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const exportComposition = () => {
    downloadBlob(new Blob([JSON.stringify(composition, null, 2)], { type: 'application/json' }), `${composition.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'composition'}.json`)
    setNotice('Composition JSON saved.')
  }
  const importComposition = async file => {
    if (!file) return
    try {
      const imported = JSON.parse(await file.text())
      const error = validateComposition(imported)
      if (error) throw error
      clearSoundEffects()
      setComposition(imported)
      setSelectedId(imported.events[0]?.id ?? null)
      setTime(0)
      setNotice('Composition imported.')
    } catch (error) { setNotice(`Could not import composition: ${error.message}`) }
  }

  const exportMp4 = async () => {
    const frame = FORMATS[composition.format]
    const error = validateComposition(composition)
    if (error) { setNotice(`Fix composition first: ${error.message}`); return }
    if (!canvasRef.current) { setNotice('Preview is still preparing. Try export again in a moment.'); return }
    setReadyExport(null)
    setRenderState({ status: 'rendering', progress: 0, error: '' })
    setNotice('Preparing frames for export…')
    let jobId
    let keepRenderedFile = false
    try {
      const start = await fetch('/api/render/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fps, duration: composition.duration, width: frame.width, height: frame.height,
          hasAudio: Boolean(audioFile), filename: composition.title,
          soundEffects: soundEffects.flatMap(effect => {
            const event = composition.events.find(item => item.id === effect.eventId)
            return event ? [{ start: event.start, gain: event.soundEffectGain ?? 0.8 }] : []
          }),
        }),
      })
      const startData = await start.json()
      if (!start.ok) throw new Error(startData.error || 'The render server could not start.')
      jobId = startData.id
      if (audioFile) {
        const response = await fetch(`/api/render/${jobId}/audio`, { method: 'POST', body: audioFile })
        if (!response.ok) throw new Error((await response.json()).error || 'Audio upload failed.')
      }
      const renderEffects = soundEffects.flatMap(effect => {
        const event = composition.events.find(item => item.id === effect.eventId)
        return event ? [{ eventId: effect.eventId, file: effect.file }] : []
      })
      for (const [index, effect] of renderEffects.entries()) {
        const response = await fetch(`/api/render/${jobId}/effect/${index}`, { method: 'POST', body: effect.file })
        if (!response.ok) throw new Error((await response.json()).error || `Sound effect ${index + 1} upload failed.`)
      }
      const total = Math.ceil(composition.duration * fps)
      const renderCanvas = document.createElement('canvas')
      renderCanvas.width = frame.width
      renderCanvas.height = frame.height
      const renderCtx = renderCanvas.getContext('2d', { alpha: false })
      for (let index = 0; index < total; index += 1) {
        drawCompositionFrame(renderCtx, composition, index / fps, { width: frame.width, height: frame.height })
        const jpeg = await new Promise((resolve, reject) => renderCanvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode an output frame.')), 'image/jpeg', 0.9))
        const response = await fetch(`/api/render/${jobId}/frame/${index}`, { method: 'POST', body: jpeg })
        if (!response.ok) throw new Error((await response.json()).error || `Frame ${index + 1} could not be uploaded.`)
        if (index % Math.max(1, Math.floor(fps / 2)) === 0 || index === total - 1) {
          setRenderState({ status: 'rendering', progress: Math.round((index + 1) / total * 78), error: '' })
        }
      }
      const finish = await fetch(`/api/render/${jobId}/finish`, { method: 'POST' })
      if (!finish.ok) throw new Error((await finish.json()).error || 'FFmpeg could not start encoding.')
      setRenderState({ status: 'encoding', progress: 80, error: '' })
      let job
      do {
        await new Promise(resolve => setTimeout(resolve, 800))
        const response = await fetch(`/api/render/${jobId}/status`)
        job = await response.json()
        if (!response.ok) throw new Error(job.error || 'Could not check export progress.')
        setRenderState({ status: job.status, progress: Math.min(99, 80 + Math.round(job.progress * 0.19)), error: '' })
      } while (job.status === 'encoding')
      if (job.status !== 'complete') throw new Error(job.error || 'FFmpeg did not produce an MP4.')
      if (compositionRef.current !== composition) throw new Error('The composition changed during export. Render again to export the latest version.')
      setReadyExport({ id: jobId, filename: `${composition.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'kedit-export'}.mp4` })
      keepRenderedFile = true
      setRenderState({ status: 'complete', progress: 100, error: '' })
      setNotice('MP4 is ready. Select Download MP4 to save it.')
    } catch (error) {
      setRenderState({ status: 'error', progress: 0, error: error.message })
      setNotice(error.message)
    } finally {
      if (jobId && !keepRenderedFile) fetch(`/api/render/${jobId}`, { method: 'DELETE' }).catch(error => console.error('Could not clean up export files:', error))
    }
  }

  return (
    <div className="studio">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="KEDIT Studio home"><span className="brand-mark"><Icon name="spark" size={21} /></span><span>KEDIT<span className="brand-light">STUDIO</span></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <button className={`nav-item ${view === 'editor' ? 'active' : ''}`} title="Editor" onClick={() => setView('editor')}><Icon name="layers" /> Editor</button>
        <button className={`nav-item ${view === 'templates' ? 'active' : ''}`} title="Motion templates" onClick={() => setView('templates')}><Icon name="spark" /> Templates</button>
        <div className="side-divider" />
        <div className="workspace-label">COMPOSITIONS</div>
        <div className="project-list">{COMPOSITIONS.map(item => <button className={`project-item ${composition.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => chooseComposition(item.id)}><span className="project-dot" />{item.title}</button>)}</div>
        <button className="new-project" onClick={newComposition}><Icon name="plus" size={16} /> New composition</button>
        <div className="sidebar-bottom"><span className="status-dot" /> All changes saved locally</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><Icon name="right" size={14} /><strong>{composition.title || 'Untitled edit'}</strong><span className="draft-pill">DRAFT</span></div>
          <div className="composition-picker-wrap">
            <button className="composition-picker-button" aria-expanded={compositionPickerOpen} onClick={() => setCompositionPickerOpen(value => !value)}>
              <Icon name="layers" size={15} /><span>{composition.title || 'Untitled edit'}</span><Icon name="right" size={13} />
            </button>
            {compositionPickerOpen && <div className="composition-picker">
              <span className="eyebrow">YOUR COMPOSITIONS</span>
              {COMPOSITIONS.map(item => <button key={item.id} className={composition.id === item.id ? 'current' : ''} onClick={() => chooseComposition(item.id)}><span className="project-dot" />{item.title}</button>)}
              <button className="picker-new" onClick={newComposition}><Icon name="plus" size={14} /> New composition</button>
            </div>}
          </div>
          <div className="top-actions">
            <button className="button-secondary hide-small" onClick={() => importRef.current?.click()}><Icon name="upload" size={15} /> Import</button>
            <button className="button-secondary hide-small" onClick={exportComposition}>Save JSON</button>
            {readyExport ? <a className="button-primary" href={`/api/render/${readyExport.id}/file`} download={readyExport.filename} onClick={() => {
              const exportId = readyExport.id
              setNotice('MP4 download started.')
              setTimeout(() => {
                setReadyExport(current => current?.id === exportId ? null : current)
                setRenderState(current => current.status === 'complete' ? { status: 'idle', progress: 0, error: '' } : current)
              }, 3000)
            }}><Icon name="export" size={16} />Download MP4</a>
              : <button className="button-primary" onClick={exportMp4} disabled={renderState.status === 'rendering' || renderState.status === 'encoding'}><Icon name="export" size={16} />{renderState.status === 'rendering' || renderState.status === 'encoding' ? 'Rendering…' : 'Export MP4'}</button>}
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={event => { importComposition(event.target.files?.[0]); event.target.value = '' }} />
          </div>
        </header>

        <div className="editor-layout">
          <section className="center-column">
            <div className="section-heading">
              <div><h1>{view === 'templates' ? 'Motion templates' : 'Composition preview'}</h1><p>{view === 'templates' ? 'A starting point for your next lyric.' : 'Compose to the music. Every moment is yours to time.'}</p></div>
              <div className="quick-settings">
                <label className="select-shell"><span>CANVAS</span><select aria-label="Canvas format" value={composition.format} onChange={event => update({ format: event.target.value })}>{Object.entries(FORMATS).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select></label>
                <label className="select-shell"><span>FRAME RATE</span><select aria-label="Frame rate" value={fps} onChange={event => update({ fps: Number(event.target.value) })}><option value="24">24 FPS</option><option value="30">30 FPS</option><option value="60">60 FPS</option></select></label>
              </div>
            </div>

            {view === 'templates' ? <TemplateGallery onChoose={id => { chooseTemplate(id); setView('editor') }} /> : (
              <div className="stage-wrap">
                <div className={`stage stage-${composition.format}`}>
                  <CanvasPreview composition={composition} time={time} onCanvas={onCanvas} />
                  <div className="stage-top"><span><i /> LIVE PREVIEW</span><span>{FORMATS[composition.format].width} × {FORMATS[composition.format].height}</span></div>
                  <div className="stage-grid" aria-hidden="true"><span /><span /><span /></div>
                </div>
                <div className="transport">
                  <div className="transport-left"><button className="transport-icon" aria-label="Jump to beginning" onClick={() => seek(0)}>↤</button><button className="play-button" aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={togglePlayback}><Icon name={playing ? 'pause' : 'play'} size={16} /></button><button className="transport-icon" aria-label="Jump to end" onClick={() => seek(composition.duration)}>↦</button></div>
                  <span className="transport-time">{formatTime(time)} <span>/ {formatTime(composition.duration)}</span></span>
                  <input className="transport-scrub" aria-label="Seek preview" type="range" min="0" max={composition.duration} step={1 / fps} value={Math.min(time, composition.duration)} onChange={event => seek(Number(event.target.value))} />
                  <span className="transport-fps">{fps} FPS</span>
                </div>
              </div>
            )}

            <div className="soundtrack-row">
              <div className="soundtrack-icon"><Icon name="music" /></div>
              <div className="soundtrack-copy"><strong>{composition.audio || 'Add a soundtrack'}</strong><span>{audioUrl ? 'Loaded for synchronized preview and MP4 export' : composition.audio ? 'Choose the local file again to use this soundtrack' : 'MP3 · WAV · M4A · AAC'}</span></div>
              {audioUrl && <audio className="audio-element" ref={audioRef} src={audioUrl} preload="auto" onEnded={() => controllerRef.current?.pause()} />}
              {soundEffects.map(effect => <audio className="audio-element" key={effect.eventId} ref={element => {
                if (element) soundEffectAudioRefs.current.set(effect.eventId, element)
                else soundEffectAudioRefs.current.delete(effect.eventId)
              }} src={effect.url} preload="auto" />)}
              <label className="button-secondary add-audio"><Icon name="plus" size={15} />{audioUrl ? 'Replace audio' : 'Choose audio'}<input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac" onChange={event => setAudio(event.target.files?.[0])} /></label>
            </div>

            <nav className="mobile-tools" aria-label="Editing tools">
              {[['content', 'Lyrics'], ['motion', 'Motion'], ['style', 'Style'], ['audio', 'Audio'], ['project', 'Project']].map(([tab, label]) => <button key={tab} onClick={() => { setInspectorTab(tab); setMobileInspectorOpen(true) }}><Icon name={tab === 'motion' ? 'spark' : tab === 'project' ? 'settings' : tab === 'audio' ? 'music' : tab === 'style' ? 'layers' : 'check'} size={16} />{label}</button>)}
              <button onClick={() => { setView(view === 'templates' ? 'editor' : 'templates'); setMobileInspectorOpen(false) }}><Icon name="spark" size={16} />Presets</button>
            </nav>

            {renderState.status !== 'idle' && <div className={`render-progress ${renderState.status === 'error' ? 'has-error' : ''}`} role="status"><div className="render-progress-top"><span>{renderState.status === 'complete' ? 'MP4 ready' : renderState.status === 'error' ? 'Export failed' : renderState.status === 'encoding' ? 'Encoding MP4 with FFmpeg…' : 'Rendering composition frames…'}</span><span>{renderState.status === 'error' ? '' : `${renderState.progress}%`}</span></div><div className="progress-track"><span style={{ width: `${renderState.progress}%` }} /></div>{renderState.error && <p>{renderState.error}</p>}</div>}
          </section>

          <Inspector
            composition={composition}
            selected={selected}
            selectedId={selectedId}
            onUpdate={update}
            onUpdateEvent={updateEvent}
            onSelect={setSelectedId}
            onDelete={removeEvent}
            onAdd={addEvent}
            onTemplate={chooseTemplate}
            onSoundEffect={setSoundEffect}
            onRemoveSoundEffect={removeSoundEffect}
            soundEffectAvailable={selected ? soundEffects.some(item => item.eventId === selected.id) : false}
            onSeek={seek}
            time={time}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            mobileOpen={mobileInspectorOpen}
            onClose={() => setMobileInspectorOpen(false)}
          />
          {mobileInspectorOpen && <button className="inspector-backdrop" aria-label="Close editing tools" onClick={() => setMobileInspectorOpen(false)} />}
        </div>

        <section className="timeline-panel">
          <div className="timeline-heading"><div><h2>Timeline</h2><span>{composition.events.length} events <i>·</i> {formatTime(composition.duration)}</span></div><div className="timeline-actions"><button className="tiny-button" onClick={() => update({ duration: Math.min(300, Math.round((composition.duration + 5) * 10) / 10) })}><Icon name="plus" size={14} /> 5 sec</button><button className="tiny-button" onClick={addEvent}><Icon name="plus" size={14} /> Add lyric</button></div></div>
          <div className="timeline-scroller">
            <div className="ruler"><span className="ruler-label">00:00</span><div className="ruler-track">{Array.from({ length: Math.min(11, Math.floor(composition.duration / 2) + 1) }, (_, i) => <span key={i} style={{ left: `${(i * 2 / composition.duration) * 100}%` }}>{formatTime(i * 2)}</span>)}</div></div>
            {lyricLanes.map((lane, laneIndex) => <div className="timeline-track" key={`lyrics-${laneIndex}`}>
              <div className="track-label"><span className="track-badge">T</span><strong>LYRIC {laneIndex + 1}</strong></div>
              <div className="track-lanes">
                {lane.map((event, index) => <button key={event.id} className={`timeline-event color-${index % 5} ${event.id === selectedId ? 'event-selected' : ''}`} style={{ left: `${event.start / composition.duration * 100}%`, width: `${Math.max(2, event.duration / composition.duration * 100)}%` }} title={`${formatTime(event.start)} · ${event.text}`} onClick={() => { setSelectedId(event.id); seek(event.start) }}><span className="event-time">{formatTime(event.start)}</span><strong>{event.text || 'New lyric'}</strong><small>{ANIMATIONS[event.entrance || event.animation]?.label ?? event.animation}</small></button>)}
                <div className="playhead" style={{ left: `${time / composition.duration * 100}%` }}><i /></div>
              </div>
            </div>)}
            {(audioUrl || composition.audio) && <div className="timeline-track audio-track">
              <div className="track-label"><span className="track-badge audio-badge">♪</span><strong>MUSIC</strong></div>
              <div className="track-lanes"><div className={`audio-clip ${audioUrl ? 'audio-loaded' : ''}`} style={{ width: `${Math.min(100, (audioRef.current?.duration || composition.duration) / composition.duration * 100)}%` }}><span>{audioUrl ? audioFile?.name : `${composition.audio} · reselect to load`}</span></div><div className="playhead" style={{ left: `${time / composition.duration * 100}%` }}><i /></div></div>
            </div>}
            {composition.events.some(event => event.soundEffect) && <div className="timeline-track effects-track">
              <div className="track-label"><span className="track-badge effect-badge">S</span><strong>SFX</strong></div>
              <div className="track-lanes">
                {composition.events.filter(event => event.soundEffect).map((event, index) => <button key={event.id} className={`effect-clip color-${index % 5} ${event.id === selectedId ? 'event-selected' : ''}`} style={{ left: `${event.start / composition.duration * 100}%`, width: `${Math.max(2, Math.min(8, event.duration / composition.duration * 100))}%` }} title={`${formatTime(event.start)} · ${event.soundEffect}`} onClick={() => { setSelectedId(event.id); seek(event.start) }}>{event.soundEffect}</button>)}
                <div className="playhead" style={{ left: `${time / composition.duration * 100}%` }}><i /></div>
              </div>
            </div>}
          </div>
        </section>
        {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><Icon name="close" size={14} /></button></div>}
        {issues.length > 0 && <div className="validation-note" role="alert">{issues[0].message}</div>}
      </main>
    </div>
  )
}

function TemplateGallery({ onChoose }) {
  return <div className="template-gallery">{TEMPLATES.map(item => <button key={item.id} className="template-card" onClick={() => onChoose(item.id)}><div className={`template-swatch swatch-${item.id}`}><span>{item.sample}</span><i>{item.name}</i></div><strong>{item.name}</strong><span>{ANIMATIONS[item.animation].label} · {item.description}</span></button>)}</div>
}

function Inspector({ composition, selected, selectedId, onUpdate, onUpdateEvent, onDelete, onAdd, onTemplate, onSoundEffect, onRemoveSoundEffect, soundEffectAvailable, activeTab, onTabChange, mobileOpen, onClose }) {
  const tabs = [['content', 'Text'], ['motion', 'Motion'], ['style', 'Style'], ['audio', 'Audio'], ['project', 'Project']]
  const updateSelected = patch => selected && onUpdateEvent(selected.id, patch)
  const hasSelection = selected && selectedId
  return <aside className={`inspector ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Editing controls">
    <div className="inspector-header">
      <div><span className="eyebrow">{hasSelection ? 'SELECTED LYRIC' : 'COMPOSITION TOOLS'}</span><h2>{hasSelection ? (selected.text || 'Untitled lyric') : 'Project settings'}</h2></div>
      <div className="inspector-header-actions">
        {activeTab === 'content' && <button className="inspector-more" aria-label="Add lyric event" onClick={onAdd}><Icon name="plus" size={18} /></button>}
        <button className="inspector-close" aria-label="Close editing controls" onClick={onClose}><Icon name="close" size={17} /></button>
      </div>
    </div>
    <div className="inspector-tabs" role="tablist" aria-label="Editing tool categories">
      {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'tab-active' : ''} onClick={() => onTabChange(id)}>{label}</button>)}
    </div>

    {activeTab === 'content' && <div className="inspector-body">
      {hasSelection ? <>
        <div className="inspector-intro"><span className="track-badge">T</span><span>Lyric layer <b>·</b> {selected.start.toFixed(2)}s to {(selected.start + selected.duration).toFixed(2)}s</span></div>
        <label className="field-label">LYRIC TEXT<textarea value={selected.text} maxLength={300} rows="4" onChange={event => updateSelected({ text: event.target.value })} placeholder="Write or paste your lyric…" /></label>
        <div className="field-row"><label className="field-label">START <div className="unit-input"><input type="number" min="0" max={composition.duration} step=".01" value={selected.start} onChange={event => updateSelected({ start: Number(event.target.value) })} /><span>SEC</span></div></label><label className="field-label">DURATION <div className="unit-input"><input type="number" min=".15" max={composition.duration} step=".05" value={selected.duration} onChange={event => updateSelected({ duration: Number(event.target.value) })} /><span>SEC</span></div></label></div>
        <div className="inspector-hint">Timing is manual. Drag the playhead to audition the exact moment.</div>
        <div className="inspector-footer"><span className="selection-status">Autosaved locally</span><button className="delete-event" onClick={() => onDelete(selected.id)}><Icon name="trash" size={15} /> Delete lyric</button></div>
      </> : <>
        <p className="inspector-hint">Select a lyric block in the timeline to edit its words and timing, or start a new lyric at the playhead.</p>
        <button className="button-primary full-width" onClick={onAdd}><Icon name="plus" size={16} /> Add lyric at playhead</button>
      </>}
    </div>}

    {activeTab === 'motion' && <div className="inspector-body">
      {hasSelection ? <>
        <div className="tool-section-title"><span>ENTRANCE PRESET</span><small>Choose how the line arrives</small></div>
        <label className="field-label">ANIMATION<select value={selected.entrance || selected.animation} onChange={event => updateSelected({ animation: event.target.value, entrance: event.target.value })}>{ANIMATION_CATEGORIES.map(group => <optgroup key={group.label} label={group.label}>{group.items.map(id => <option key={id} value={id}>{ANIMATIONS[id].label}</option>)}</optgroup>)}</select></label>
        <label className="field-label">ENTRANCE SPEED <div className="range-field"><input type="range" min=".15" max="1.5" step=".05" value={selected.motionDuration ?? .68} onChange={event => updateSelected({ motionDuration: Number(event.target.value) })} /><span>{(selected.motionDuration ?? .68).toFixed(2)}s</span></div></label>
        <div className="tool-section-title"><span>ANIMATION STACK</span><small>Layer a subtle accent and exit</small></div>
        <div className="field-row"><label className="field-label">EMPHASIS<select value={selected.emphasis || 'none'} onChange={event => updateSelected({ emphasis: event.target.value })}>{Object.entries(EMPHASIS_ANIMATIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="field-label">EXIT<select value={selected.exit || 'fade'} onChange={event => updateSelected({ exit: event.target.value })}>{Object.entries(EXIT_ANIMATIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
        <p className="inspector-hint">Entrance, emphasis, and exit are independent, so you can combine presets into a custom motion stack.</p>
      </> : <p className="inspector-hint">Choose a lyric block to build a custom entrance, emphasis, and exit stack.</p>}
    </div>}

    {activeTab === 'style' && <div className="inspector-body">
      {hasSelection ? <>
        <div className="tool-section-title"><span>STYLE PRESETS</span><small>Apply a reusable type treatment</small></div>
        <div className="template-select-grid">{TEMPLATES.map(item => <button key={item.id} className={`template-chip ${selected.template === item.id ? 'chosen' : ''}`} onClick={() => onTemplate(item.id)} title={item.description}><span className={`chip-preview chip-${item.id}`}>Ag</span>{item.name}</button>)}</div>
        <div className="field-row"><label className="field-label">FONT FAMILY<select value={selected.font || 'Arial'} onChange={event => updateSelected({ font: event.target.value })}><option>Arial</option><option>Georgia</option><option>Courier New</option><option>Impact</option><option>Trebuchet MS</option></select></label><label className="field-label">WEIGHT<select value={selected.fontWeight || 800} onChange={event => updateSelected({ fontWeight: Number(event.target.value) })}><option value="400">Regular</option><option value="600">Semibold</option><option value="800">Bold</option><option value="900">Black</option></select></label></div>
        <div className="field-row"><label className="field-label">FONT SIZE <div className="unit-input"><input type="number" min="18" max="260" value={selected.fontSize} onChange={event => updateSelected({ fontSize: Number(event.target.value) })} /><span>PX</span></div></label><label className="field-label">ALIGNMENT<select value={selected.align} onChange={event => updateSelected({ align: event.target.value })}><option value="center">Center</option><option value="left">Left</option><option value="right">Right</option></select></label></div>
        <label className="field-label">TEXT COLOR<div className="color-input"><input type="color" value={selected.color} onChange={event => updateSelected({ color: event.target.value })} /><span>{selected.color.toUpperCase()}</span></div></label>
        <label className="field-label">HIGHLIGHT WORDS<input value={(selected.highlight || []).join(', ')} placeholder="e.g. empire, rise" onChange={event => updateSelected({ highlight: event.target.value.split(',').map(word => word.trim()).filter(Boolean) })} /></label>
        <div className="field-row"><label className="field-label">HORIZONTAL POSITION <div className="range-field"><input type="range" min="5" max="95" step="1" value={selected.x ?? 50} onChange={event => updateSelected({ x: Number(event.target.value) })} /><span>{selected.x ?? 50}%</span></div></label><label className="field-label">VERTICAL POSITION <div className="range-field"><input type="range" min="5" max="95" step="1" value={selected.position ?? 52} onChange={event => updateSelected({ position: Number(event.target.value) })} /><span>{selected.position ?? 52}%</span></div></label></div>
        <label className="field-label">LETTER SPACING <div className="range-field"><input type="range" min="0" max="12" step=".5" value={selected.letterSpacing ?? 0} onChange={event => updateSelected({ letterSpacing: Number(event.target.value) })} /><span>{selected.letterSpacing ?? 0}px</span></div></label>
      </> : <p className="inspector-hint">Choose a lyric block to apply typography templates and customize its layout.</p>}
    </div>}

    {activeTab === 'audio' && <div className="inspector-body">
      {hasSelection ? <>
        <div className="tool-section-title"><span>EVENT SOUND EFFECT</span><small>Timed to this lyric's start</small></div>
        <div className="sound-effect-field"><span>{selected.soundEffect ? `${selected.soundEffect}${soundEffectAvailable ? '' : ' · re-add after reload'}` : 'No sound effect assigned'}</span><label className="sound-effect-upload"><Icon name="upload" size={13} />{selected.soundEffect ? 'Replace' : 'Add'}<input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac" onChange={event => { onSoundEffect(selected.id, event.target.files?.[0]); event.target.value = '' }} /></label>{selected.soundEffect && <button className="sound-effect-remove" onClick={() => onRemoveSoundEffect(selected.id)} aria-label="Remove sound effect"><Icon name="close" size={13} /></button>}</div>
        <label className="field-label">EFFECT LEVEL <div className="range-field"><input type="range" min="0" max="2" step=".05" value={selected.soundEffectGain ?? .8} onChange={event => updateSelected({ soundEffectGain: Number(event.target.value) })} /><span>{Math.round((selected.soundEffectGain ?? .8) * 100)}%</span></div></label>
        <p className="inspector-hint">Effect clips appear on the SFX timeline lane and are mixed into the exported MP4. Files need to be reselected after reload.</p>
      </> : <p className="inspector-hint">Select a lyric block to attach an optional sound effect at its exact timestamp.</p>}
    </div>}

    {activeTab === 'project' && <div className="inspector-body comp-settings">
      <div className="tool-section-title"><span>COMPOSITION</span><small>Global canvas and render settings</small></div>
      <label className="field-label">PROJECT TITLE<input value={composition.title} maxLength={80} onChange={event => onUpdate({ title: event.target.value })} /></label>
      <div className="field-row"><label className="field-label">CANVAS<select value={composition.format} onChange={event => onUpdate({ format: event.target.value })}>{Object.entries(FORMATS).map(([id, format]) => <option key={id} value={id}>{format.label}</option>)}</select></label><label className="field-label">FRAME RATE<select value={composition.fps} onChange={event => onUpdate({ fps: Number(event.target.value) })}><option value="24">24 FPS</option><option value="30">30 FPS</option><option value="60">60 FPS</option></select></label></div>
      <label className="field-label">TOTAL DURATION<div className="unit-input"><input type="number" min=".5" max="300" step=".5" value={composition.duration} onChange={event => onUpdate({ duration: Number(event.target.value) })} /><span>SEC</span></div></label>
      <label className="field-label">BACKGROUND COLOR<div className="color-input"><input type="color" value={composition.background} onChange={event => onUpdate({ background: event.target.value })} /><span>{composition.background.toUpperCase()}</span></div></label>
      {!hasSelection && <button className="button-primary full-width" onClick={onAdd}><Icon name="plus" size={16} /> Add lyric at playhead</button>}
    </div>}
  </aside>
}

export default App
