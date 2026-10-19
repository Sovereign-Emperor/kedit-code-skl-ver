import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createTimelineController } from './engine/timeline.js'
import { arrangeEventsIntoLanes, calculateTimelineEdit } from './engine/timeline-editing.js'
import { drawCompositionFrame } from './engine/renderer.js'
import { ANIMATIONS, ANIMATION_CATEGORIES, EMPHASIS_ANIMATIONS, EXIT_ANIMATIONS, TRANSITIONS } from './engine/animations.js'
import { FORMATS, validateComposition } from './engine/schema.js'
import { captureKeyframeValues, getKeyframeValue, KEYFRAME_EASES, KEYFRAME_PROPERTIES, upsertKeyframe } from './engine/keyframes.js'
import { COMPOSITIONS, TEMPLATES, createLyric } from './compositions/library.js'

const STORE_KEY = 'kedit-studio-composition-v1'
const LIBRARY_KEY = 'kedit-studio-library-v1'
const ACTIVE_LIBRARY_KEY = 'kedit-studio-active-library-v1'
const formatTime = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}.${String(Math.floor((value % 1) * 10))}`
const clone = value => JSON.parse(JSON.stringify(value))

function readSavedLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]')
    if (!Array.isArray(saved)) throw new Error('Composition library must be a list.')
    return saved.filter(item => {
      const valid = item && typeof item.id === 'string' && typeof item.title === 'string' && !validateComposition(item.composition)
      if (!valid) console.error('Ignoring an invalid saved library composition:', item?.title ?? item)
      return valid
    })
  } catch (error) {
    console.error('Saved composition library could not be loaded:', error)
    return []
  }
}

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
    expand: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" /><path d="m3 3 6 6m12-6-6 6M3 21l6-6m12 6-6-6" /></>,
    frame: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18m10-18v18M3 7h18M3 17h18" /></>,
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
  const [savedCompositions, setSavedCompositions] = useState(readSavedLibrary)
  const [activeLibraryId, setActiveLibraryId] = useState(() => {
    try {
      const storedId = localStorage.getItem(ACTIVE_LIBRARY_KEY) || ''
      return savedCompositions.some(item => item.id === storedId) ? storedId : ''
    }
    catch (error) { console.error('Active composition could not be restored:', error); return '' }
  })
  const [saveDialog, setSaveDialog] = useState(null)
  const [markerDialog, setMarkerDialog] = useState(null)
  const [composition, setCompositionState] = useState(() => {
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
  const timeRef = useRef(time)
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
  const [previewOnly, setPreviewOnly] = useState(false)
  const [previewFullscreen, setPreviewFullscreen] = useState(false)
  const [safeGuides, setSafeGuides] = useState(false)
  const audioRef = useRef(null)
  const canvasRef = useRef(null)
  const previewSurfaceRef = useRef(null)
  const previewOpenButtonRef = useRef(null)
  const previewCloseButtonRef = useRef(null)
  const controllerRef = useRef(null)
  const importRef = useRef(null)
  const soundEffectsRef = useRef([])
  const soundEffectAudioRefs = useRef(new Map())
  const timelineDragRef = useRef(null)
  const timelineDragMovedRef = useRef(false)
  const playingRef = useRef(false)
  const previousTimeRef = useRef(0)
  const compositionRef = useRef(composition)
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const historyGroupRef = useRef(null)
  const historyGroupTimeRef = useRef(0)
  compositionRef.current = composition
  timeRef.current = time
  const selected = composition.events.find(event => event.id === selectedId) ?? composition.events[0]
  const sortedEvents = useMemo(() => [...composition.events].sort((a, b) => a.start - b.start), [composition.events])
  const lyricLanes = useMemo(() => arrangeEventsIntoLanes(sortedEvents), [sortedEvents])
  const issues = useMemo(() => validateComposition(composition, { returnErrors: true }), [composition])
  const fps = composition.fps

  const setComposition = (nextValue, historyGroup = null) => {
    const previous = compositionRef.current
    const next = typeof nextValue === 'function' ? nextValue(previous) : nextValue
    if (next === previous || JSON.stringify(next) === JSON.stringify(previous)) return
    const groupContinues = historyGroup && historyGroupRef.current === historyGroup
      && (historyGroup.startsWith('timeline:') || Date.now() - historyGroupTimeRef.current < 600)
    if (!groupContinues) {
      undoStackRef.current.push(previous)
      if (undoStackRef.current.length > 100) undoStackRef.current.shift()
      redoStackRef.current = []
    }
    historyGroupRef.current = historyGroup
    historyGroupTimeRef.current = Date.now()
    compositionRef.current = next
    setCompositionState(next)
  }

  const clearHistory = () => {
    undoStackRef.current = []
    redoStackRef.current = []
    historyGroupRef.current = null
    historyGroupTimeRef.current = 0
  }

  const replaceComposition = nextComposition => {
    clearHistory()
    compositionRef.current = nextComposition
    setCompositionState(nextComposition)
  }

  const undo = () => {
    const previous = undoStackRef.current.pop()
    if (!previous) return
    redoStackRef.current.push(compositionRef.current)
    historyGroupRef.current = null
    historyGroupTimeRef.current = 0
    compositionRef.current = previous
    setCompositionState(previous)
  }

  const redo = () => {
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current.push(compositionRef.current)
    historyGroupRef.current = null
    historyGroupTimeRef.current = 0
    compositionRef.current = next
    setCompositionState(next)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(composition)) }
      catch (error) { console.error('Could not save composition locally:', error); setNotice('Local save failed. Export a backup JSON.') }
    }, 180)
    return () => clearTimeout(timer)
  }, [composition])

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(savedCompositions))
      if (activeLibraryId) localStorage.setItem(ACTIVE_LIBRARY_KEY, activeLibraryId)
      else localStorage.removeItem(ACTIVE_LIBRARY_KEY)
    } catch (error) {
      console.error('Could not save the composition library:', error)
      setNotice('Composition library save failed. Export a JSON backup.')
    }
  }, [savedCompositions, activeLibraryId])

  useEffect(() => {
    if (!activeLibraryId) return
    const timer = setTimeout(() => setSavedCompositions(current => {
      const entry = current.find(item => item.id === activeLibraryId)
      if (!entry || JSON.stringify(entry.composition) === JSON.stringify(composition)) return current
      return current.map(item => item.id === activeLibraryId ? { ...item, title: composition.title, composition: clone(composition) } : item)
    }), 180)
    return () => clearTimeout(timer)
  }, [composition, activeLibraryId])

  useEffect(() => {
    if (readyExport) {
      fetch(`/api/render/${readyExport.id}`, { method: 'DELETE' }).catch(error => console.error('Could not clean up the previous MP4:', error))
    }
    setReadyExport(null)
    setRenderState(current => current.status === 'complete' ? { status: 'idle', progress: 0, error: '' } : current)
  }, [composition])

  const update = useCallback((patch) => setComposition(current => ({
    ...current,
    ...patch,
    ...(patch.duration !== undefined && current.markers
      ? { markers: current.markers.filter(marker => marker.time <= patch.duration) }
      : {}),
  })), [])
  const updateEvent = (id, patch) => setComposition(current => ({
    ...current,
    events: current.events.map(event => {
      if (event.id !== id) return event
      const updated = { ...event, ...patch }
      if (patch.duration !== undefined && updated.keyframes) updated.keyframes = updated.keyframes.filter(keyframe => keyframe.time <= updated.duration)
      return updated
    }),
  }), `event:${id}:${Object.keys(patch).sort().join(',')}`)

  useEffect(() => {
    const move = event => {
      const drag = timelineDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const deltaPixels = event.clientX - drag.clientX
      if (Math.abs(deltaPixels) > 1) timelineDragMovedRef.current = true
      if (!timelineDragMovedRef.current) return
      const delta = deltaPixels / drag.width * composition.duration
      const patch = calculateTimelineEdit(drag, drag.mode, delta, composition.duration, fps)
      const nextStart = patch.start ?? drag.lastStart
      const nextDuration = patch.duration ?? drag.lastDuration
      if (nextStart === drag.lastStart && nextDuration === drag.lastDuration) return
      drag.lastStart = nextStart
      drag.lastDuration = nextDuration
      setComposition(current => ({
        ...current,
        events: current.events.map(item => {
          if (item.id !== drag.eventId) return item
          const updated = { ...item, ...patch }
          if (drag.mode === 'trim-left' && drag.keyframes) {
            const offset = (patch.start ?? drag.start) - drag.start
            updated.keyframes = drag.keyframes
              .filter(keyframe => keyframe.time >= offset && keyframe.time <= offset + (patch.duration ?? drag.duration))
              .map(keyframe => ({ ...keyframe, time: keyframe.time - offset }))
          } else if (drag.mode === 'trim-right' && drag.keyframes) {
            updated.keyframes = drag.keyframes.filter(keyframe => keyframe.time <= (patch.duration ?? drag.duration))
          }
          return updated
        }),
      }), `timeline:${drag.eventId}:${drag.mode}`)
    }
    const stop = event => {
      if (!timelineDragRef.current || timelineDragRef.current.pointerId !== event.pointerId) return
      timelineDragRef.current = null
      historyGroupRef.current = null
      historyGroupTimeRef.current = 0
      if (timelineDragMovedRef.current) setTimeout(() => { timelineDragMovedRef.current = false }, 0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [composition.duration, fps])

  const onTimelinePointerDown = event => {
    const block = event.target.closest('[data-timeline-event]')
    if (!block || event.button !== 0) return
    const item = composition.events.find(candidate => candidate.id === block.dataset.timelineEvent)
    const track = block.closest('.track-lanes')
    if (!item || !track) return
    event.preventDefault()
    setSelectedId(item.id)
    const handle = event.target.closest('[data-trim]')
    timelineDragMovedRef.current = false
    timelineDragRef.current = {
      eventId: item.id,
      start: item.start,
      duration: item.duration,
      keyframes: item.keyframes ? clone(item.keyframes) : undefined,
      lastStart: item.start,
      lastDuration: item.duration,
      clientX: event.clientX,
      width: track.getBoundingClientRect().width,
      pointerId: event.pointerId,
      mode: handle?.dataset.trim === 'left' ? 'trim-left' : handle?.dataset.trim === 'right' ? 'trim-right' : 'move',
    }
  }

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
  const togglePreviewFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement === previewSurfaceRef.current) await document.exitFullscreen()
      else if (!previewSurfaceRef.current?.requestFullscreen) throw new Error('Fullscreen viewing is not supported in this browser.')
      else await previewSurfaceRef.current.requestFullscreen()
    } catch (error) {
      setNotice(`Could not change fullscreen mode: ${error.message}`)
    }
  }, [])
  const closePreviewOnly = useCallback(() => {
    if (document.fullscreenElement === previewSurfaceRef.current) {
      document.exitFullscreen().catch(error => setNotice(`Could not exit fullscreen: ${error.message}`))
    }
    setPreviewOnly(false)
  }, [])

  useEffect(() => {
    const syncFullscreenState = () => setPreviewFullscreen(document.fullscreenElement === previewSurfaceRef.current)
    document.addEventListener('fullscreenchange', syncFullscreenState)
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [])

  useEffect(() => {
    if (!previewOnly) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    previewCloseButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => previewOpenButtonRef.current?.focus())
    }
  }, [previewOnly])

  useEffect(() => {
    if (!previewOnly) return undefined
    const onKeyDown = event => {
      if (event.target instanceof HTMLElement && event.target.closest('input:not([type="range"]), textarea, select, [contenteditable="true"]')) return
      if (event.code === 'Space') {
        event.preventDefault()
        controllerRef.current?.toggle().catch(error => setNotice(`Playback error: ${error.message}`))
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const nextTime = Math.max(0, Math.min(compositionRef.current.duration, timeRef.current + (event.key === 'ArrowLeft' ? -1 : 1) / compositionRef.current.fps))
        controllerRef.current?.seek(nextTime)
        setTime(nextTime)
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        togglePreviewFullscreen()
      } else if (event.key === 'Escape') {
        if (document.fullscreenElement === previewSurfaceRef.current) {
          event.preventDefault()
          document.exitFullscreen().catch(error => setNotice(`Could not exit fullscreen: ${error.message}`))
        } else closePreviewOnly()
      } else if (event.key === 'Tab') {
        const focusable = [...previewSurfaceRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewOnly, closePreviewOnly, togglePreviewFullscreen])

  useEffect(() => {
    const onKeyDown = event => {
      if (previewOnly) return
      if (event.target instanceof HTMLElement && event.target.closest('input:not([type="range"]), textarea, select, [contenteditable="true"]')) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewOnly])

  const addEvent = () => {
    const start = Math.min(Math.max(0, time), Math.max(0, composition.duration - 0.5))
    const event = createLyric(start, Math.min(2.5, composition.duration - start))
    setComposition(current => ({ ...current, events: [...current.events, event] }))
    setSelectedId(event.id)
    setInspectorTab('content')
    setView('editor')
  }
  const addMarker = () => {
    if ((composition.markers || []).length >= 200) { setNotice('A composition can have up to 200 timeline markers.'); return }
    setMarkerDialog({ label: `Marker ${(composition.markers || []).length + 1}`, time: Math.round(time * fps) / fps })
  }
  const saveMarker = label => {
    const name = label.trim().slice(0, 40)
    if (!name) { setNotice('Enter a name for the timeline marker.'); return }
    const marker = { id: `marker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: name, time: markerDialog.time }
    setComposition(current => ({ ...current, markers: [...(current.markers || []), marker].sort((a, b) => a.time - b.time) }))
    setNotice(`Added marker “${name}” at ${formatTime(marker.time)}.`)
    setMarkerDialog(null)
  }
  const removeMarker = id => setComposition(current => ({ ...current, markers: (current.markers || []).filter(marker => marker.id !== id) }))
  const saveComposition = (title, asCopy = false) => {
    const name = title.trim()
    if (!name) { setNotice('Enter a name for this composition.'); return }
    const existing = !asCopy && savedCompositions.find(item => item.id === activeLibraryId)
    const duplicateName = savedCompositions.find(item => item.title.toLowerCase() === name.toLowerCase() && item.id !== existing?.id)
    if (duplicateName) { setNotice('A saved composition already uses that name. Choose a different name.'); return }
    if (existing) {
      const nextComposition = { ...composition, title: name }
      setComposition(nextComposition)
      setSavedCompositions(current => current.map(item => item.id === existing.id ? { ...item, title: name, composition: clone(nextComposition) } : item))
      setNotice(`Saved “${name}”.`)
    } else {
      const id = `saved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const nextComposition = { ...composition, title: name }
      setSavedCompositions(current => [...current, { id, title: name, composition: clone(nextComposition) }])
      setComposition(nextComposition)
      setActiveLibraryId(id)
      setNotice(`Added “${name}” to your library.`)
    }
    setSaveDialog(null)
    setCompositionPickerOpen(false)
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
    replaceComposition(clone(found))
    setSelectedId(found.events[0]?.id ?? null)
    setActiveLibraryId('')
    clearSoundEffects()
    setAudioFile(null)
    setAudioUrl('')
    setTime(0)
    setInspectorTab('content')
    setView('editor')
    setCompositionPickerOpen(false)
  }
  const chooseSavedComposition = entry => {
    if (validateComposition(entry.composition)) { setNotice('This saved composition is invalid. Export a JSON backup before removing it.'); return }
    controllerRef.current?.pause()
    replaceComposition(clone(entry.composition))
    setSelectedId(entry.composition.events[0]?.id ?? null)
    setActiveLibraryId(entry.id)
    clearSoundEffects()
    setAudioFile(null)
    setAudioUrl('')
    setTime(0)
    setInspectorTab('content')
    setView('editor')
    setCompositionPickerOpen(false)
  }
  const deleteSavedComposition = id => {
    const entry = savedCompositions.find(item => item.id === id)
    if (!entry || !window.confirm(`Remove “${entry.title}” from your saved library? This cannot be undone.`)) return
    setSavedCompositions(current => current.filter(item => item.id !== id))
    if (activeLibraryId === id) setActiveLibraryId('')
    setNotice(`Removed “${entry.title}” from the library.`)
  }
  const newComposition = () => {
    const fresh = { id: `my-edit-${Date.now()}`, title: 'Untitled edit', format: 'vertical', fps: 30, duration: 20, audio: '', background: '#09090f', events: [] }
    controllerRef.current?.pause()
    clearSoundEffects()
    replaceComposition(fresh)
    setSelectedId(null)
    setActiveLibraryId('')
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
      updateEvent(selected.id, {
        template: template.id, animation: template.animation, entrance: template.animation,
        color: template.color, font: template.font, fontWeight: template.fontWeight, letterSpacing: template.letterSpacing,
        ...(template.fontSize ? { fontSize: template.fontSize } : {}),
        ...(template.emphasis ? { emphasis: template.emphasis } : {}),
      })
      return
    }
    if (template && !selectedId) {
      const start = Math.min(time, Math.max(0, composition.duration - 0.5))
      const event = {
        ...createLyric(start, Math.min(2.5, composition.duration - start)),
        template: template.id, animation: template.animation, entrance: template.animation,
        color: template.color, font: template.font, fontWeight: template.fontWeight, letterSpacing: template.letterSpacing,
        fontSize: template.fontSize ?? 88, emphasis: template.emphasis ?? 'none',
      }
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
      controllerRef.current?.pause()
      clearSoundEffects()
      replaceComposition(imported)
      setSelectedId(imported.events[0]?.id ?? null)
      setActiveLibraryId('')
      setAudioFile(null)
      setAudioUrl('')
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
    <div className={`studio${previewOnly ? ' preview-focused' : ''}`}>
      <aside className="sidebar" inert={previewOnly ? '' : undefined} aria-hidden={previewOnly}>
        <a className="brand" href="#" aria-label="KEDIT Studio home"><span className="brand-mark"><Icon name="spark" size={21} /></span><span>KEDIT<span className="brand-light">STUDIO</span></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <button className={`nav-item ${view === 'editor' ? 'active' : ''}`} title="Editor" onClick={() => setView('editor')}><Icon name="layers" /> Editor</button>
        <button className={`nav-item ${view === 'templates' ? 'active' : ''}`} title="Motion templates" onClick={() => setView('templates')}><Icon name="spark" /> Templates</button>
        <div className="side-divider" />
        <div className="workspace-label">EXAMPLE COMPOSITIONS</div>
        <div className="project-list">{COMPOSITIONS.map(item => <button className={`project-item ${composition.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => chooseComposition(item.id)}><span className="project-dot" />{item.title}</button>)}</div>
        {savedCompositions.length > 0 && <>
          <div className="workspace-label saved-library-label">SAVED LIBRARY</div>
          <div className="project-list sidebar-saved-list">{savedCompositions.map(item => <div className="sidebar-saved-item" key={item.id}>
            <button className={`project-item ${activeLibraryId === item.id ? 'selected' : ''}`} onClick={() => chooseSavedComposition(item)}><span className="project-dot" />{item.title}</button>
            <button className="saved-composition-delete" aria-label={`Remove ${item.title} from library`} title="Remove from library" onClick={() => deleteSavedComposition(item.id)}><Icon name="trash" size={13} /></button>
          </div>)}</div>
        </>}
        <button className="new-project" onClick={() => activeLibraryId ? saveComposition(composition.title) : setSaveDialog({ copy: false, title: composition.title })}><Icon name="check" size={15} />{activeLibraryId ? 'Save changes' : 'Save to library'}</button>
        <button className="new-project" onClick={() => setSaveDialog({ copy: true, title: `${composition.title} copy` })}><Icon name="plus" size={15} />Save as copy</button>
        <button className="new-project" onClick={newComposition}><Icon name="plus" size={16} /> New composition</button>
        <div className="sidebar-bottom"><span className="status-dot" /> All changes saved locally</div>
      </aside>

      <main className="main" inert={previewOnly ? '' : undefined} aria-hidden={previewOnly}>
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><Icon name="right" size={14} /><strong>{composition.title || 'Untitled edit'}</strong><span className="draft-pill">DRAFT</span></div>
          <div className="composition-picker-wrap">
            <button className="composition-picker-button" aria-expanded={compositionPickerOpen} onClick={() => setCompositionPickerOpen(value => !value)}>
              <Icon name="layers" size={15} /><span>{composition.title || 'Untitled edit'}</span><Icon name="right" size={13} />
            </button>
            {compositionPickerOpen && <div className="composition-picker">
              <span className="eyebrow">EXAMPLE COMPOSITIONS</span>
              {COMPOSITIONS.map(item => <button key={item.id} className={composition.id === item.id ? 'current' : ''} onClick={() => chooseComposition(item.id)}><span className="project-dot" />{item.title}</button>)}
              <span className="eyebrow picker-section-label">SAVED LIBRARY · {savedCompositions.length}</span>
              {savedCompositions.map(item => <div className={`saved-composition ${item.id === activeLibraryId ? 'current' : ''}`} key={item.id}>
                <button className="saved-composition-open" onClick={() => chooseSavedComposition(item)}><span className="project-dot" />{item.title}</button>
                <button className="saved-composition-delete" aria-label={`Remove ${item.title} from library`} title="Remove from library" onClick={() => deleteSavedComposition(item.id)}><Icon name="trash" size={14} /></button>
              </div>)}
              <button className="picker-action" onClick={() => {
                if (activeLibraryId) saveComposition(composition.title)
                else setSaveDialog({ copy: false, title: composition.title })
              }}><Icon name="check" size={14} />{activeLibraryId ? 'Save changes' : 'Save to library'}</button>
              <button className="picker-action" onClick={() => setSaveDialog({ copy: true, title: `${composition.title} copy` })}><Icon name="plus" size={14} />Save as a copy</button>
              <button className="picker-action" onClick={exportComposition}><Icon name="export" size={14} />Export JSON backup</button>
              <button className="picker-new" onClick={newComposition}><Icon name="plus" size={14} /> New composition</button>
            </div>}
          </div>
          <div className="top-actions">
              <div className="history-actions" aria-label="Edit history">
                <button className="button-secondary history-button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!undoStackRef.current.length} onClick={undo}>↶</button>
                <button className="button-secondary history-button" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!redoStackRef.current.length} onClick={redo}>↷</button>
              </div>
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
                <div className={`stage stage-${composition.format}${safeGuides ? ' stage-guides' : ''}`}>
                  <CanvasPreview composition={composition} time={time} onCanvas={onCanvas} />
                  <div className="stage-top"><span><i /> LIVE PREVIEW</span><span>{FORMATS[composition.format].width} × {FORMATS[composition.format].height}</span></div>
                  {safeGuides && <div className="stage-guides-overlay" aria-hidden="true"><span className="guide-safe-frame" /><span className="guide-center-vertical" /><span className="guide-center-horizontal" /></div>}
                  <div className="stage-actions">
                    <button className={`stage-tool-button${safeGuides ? ' active' : ''}`} aria-label={safeGuides ? 'Hide safe area guides' : 'Show safe area guides'} aria-pressed={safeGuides} title="Safe area guides" onClick={() => setSafeGuides(value => !value)}><Icon name="frame" size={15} /></button>
                    <button ref={previewOpenButtonRef} className="stage-tool-button" aria-label="Open preview-only view" title="Preview only" onClick={() => setPreviewOnly(true)}><Icon name="expand" size={15} /><span>Preview only</span></button>
                  </div>
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
            fps={fps}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            mobileOpen={mobileInspectorOpen}
            onClose={() => setMobileInspectorOpen(false)}
          />
          {mobileInspectorOpen && <button className="inspector-backdrop" aria-label="Close editing tools" onClick={() => setMobileInspectorOpen(false)} />}
        </div>

        <section className="timeline-panel">
          <div className="timeline-heading"><div><h2>Timeline</h2><span>{composition.events.length} events <i>·</i> {formatTime(composition.duration)} <i>·</i> {(composition.markers || []).length} markers</span></div><div className="timeline-actions"><button className="tiny-button" onClick={addMarker}><Icon name="frame" size={13} /> Marker</button><button className="tiny-button" onClick={() => update({ duration: Math.min(300, Math.round((composition.duration + 5) * 10) / 10) })}><Icon name="plus" size={14} /> 5 sec</button><button className="tiny-button" onClick={addEvent}><Icon name="plus" size={14} /> Add lyric</button></div></div>
          <div className="timeline-scroller" onPointerDown={onTimelinePointerDown}>
            <div className="ruler"><span className="ruler-label">00:00</span><div className="ruler-track">{Array.from({ length: Math.min(11, Math.floor(composition.duration / 2) + 1) }, (_, i) => <span key={i} style={{ left: `${(i * 2 / composition.duration) * 100}%` }}>{formatTime(i * 2)}</span>)}{(composition.markers || []).map(marker => <div className="timeline-marker" key={marker.id} style={{ left: `${marker.time / composition.duration * 100}%` }}><button className="timeline-marker-jump" title={`${marker.label} · ${formatTime(marker.time)}`} aria-label={`Jump to marker ${marker.label} at ${formatTime(marker.time)}`} onClick={() => seek(marker.time)}><i /><span>{marker.label}</span></button><button className="timeline-marker-remove" aria-label={`Remove marker ${marker.label}`} title="Remove marker" onClick={() => removeMarker(marker.id)}>×</button></div>)}</div></div>
            {lyricLanes.map((lane, laneIndex) => <div className="timeline-track" key={`lyrics-${laneIndex}`}>
              <div className="track-label"><span className="track-badge">T</span><strong>LYRIC {laneIndex + 1}</strong></div>
              <div className="track-lanes">
                {lane.map((event, index) => <TimelineEvent key={event.id} event={event} index={index} selected={event.id === selectedId} duration={composition.duration} onSelect={() => {
                  if (timelineDragMovedRef.current) { timelineDragMovedRef.current = false; return }
                  setSelectedId(event.id)
                  seek(event.start)
                }} />)}
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
        {saveDialog && <div className="save-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSaveDialog(null) }}>
          <form className="save-dialog" onSubmit={event => { event.preventDefault(); saveComposition(saveDialog.title, saveDialog.copy) }}>
            <span className="eyebrow">{saveDialog.copy ? 'SAVE A COPY' : 'SAVE TO LIBRARY'}</span>
            <h2>{saveDialog.copy ? 'Create a named copy' : 'Save this composition'}</h2>
            <p>Keep this edit in your local composition library. You can reopen it from the project picker.</p>
            <label className="field-label">COMPOSITION NAME<input autoFocus maxLength={80} required value={saveDialog.title} onChange={event => setSaveDialog(current => ({ ...current, title: event.target.value }))} /></label>
            <div className="save-dialog-actions"><button type="button" className="button-secondary" onClick={() => setSaveDialog(null)}>Cancel</button><button type="submit" className="button-primary"><Icon name="check" size={15} />{saveDialog.copy ? 'Save copy' : 'Save composition'}</button></div>
          </form>
        </div>}
        {markerDialog && <div className="save-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setMarkerDialog(null) }}>
          <form className="save-dialog marker-dialog" onSubmit={event => { event.preventDefault(); saveMarker(markerDialog.label) }}>
            <span className="eyebrow">TIMELINE MARKER · {formatTime(markerDialog.time)}</span>
            <h2>Name this marker</h2>
            <p>Markers help you remember moments in the soundtrack. They do not change playback or detect beats.</p>
            <label className="field-label">MARKER NAME<input autoFocus maxLength={40} required value={markerDialog.label} onChange={event => setMarkerDialog(current => ({ ...current, label: event.target.value }))} /></label>
            <div className="save-dialog-actions"><button type="button" className="button-secondary" onClick={() => setMarkerDialog(null)}>Cancel</button><button type="submit" className="button-primary"><Icon name="check" size={15} />Add marker</button></div>
          </form>
        </div>}
      </main>
      {previewOnly && <section
        className={`preview-focus${previewFullscreen ? ' preview-focus-fullscreen' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Preview-only viewer"
        ref={previewSurfaceRef}
      >
        <header className="preview-focus-header">
          <div className="preview-focus-project">
            <span className="eyebrow">KEDIT STUDIO · PREVIEW</span>
            <strong>{composition.title || 'Untitled edit'}</strong>
            <span>{FORMATS[composition.format].width} × {FORMATS[composition.format].height} · {fps} FPS</span>
          </div>
          <div className="preview-focus-actions">
            <button className={`focus-tool-button${safeGuides ? ' active' : ''}`} aria-label={safeGuides ? 'Hide safe area guides' : 'Show safe area guides'} aria-pressed={safeGuides} onClick={() => setSafeGuides(value => !value)}><Icon name="frame" size={16} /><span>Guides</span></button>
            <button className="focus-tool-button" aria-label={previewFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={togglePreviewFullscreen}><Icon name="expand" size={16} /><span>{previewFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button>
            <button ref={previewCloseButtonRef} className="focus-close-button" aria-label="Close preview-only view" onClick={closePreviewOnly}><Icon name="close" size={18} /><span>Close</span></button>
          </div>
        </header>
        <div className="focus-stage-wrap">
          <div className={`stage focus-stage stage-${composition.format}${safeGuides ? ' stage-guides' : ''}`}>
            <CanvasPreview composition={composition} time={time} onCanvas={() => {}} />
            {safeGuides && <div className="stage-guides-overlay" aria-hidden="true"><span className="guide-safe-frame" /><span className="guide-center-vertical" /><span className="guide-center-horizontal" /></div>}
          </div>
        </div>
        <div className="focus-transport">
          <div className="focus-transport-controls">
            <button className="transport-icon" aria-label="Jump to beginning" onClick={() => seek(0)}>↤</button>
            <button className="transport-icon focus-frame-step" aria-label="Previous frame" title="Previous frame (←)" onClick={() => seek(Math.max(0, time - 1 / fps))}>|◀</button>
            <button className="play-button" aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={togglePlayback}><Icon name={playing ? 'pause' : 'play'} size={17} /></button>
            <button className="transport-icon focus-frame-step" aria-label="Next frame" title="Next frame (→)" onClick={() => seek(Math.min(composition.duration, time + 1 / fps))}>▶|</button>
            <button className="transport-icon" aria-label="Jump to end" onClick={() => seek(composition.duration)}>↦</button>
          </div>
          <span className="focus-timecode">{formatTime(time)} <span>/ {formatTime(composition.duration)}</span></span>
          <input className="transport-scrub" aria-label="Seek preview" type="range" min="0" max={composition.duration} step={1 / fps} value={Math.min(time, composition.duration)} onChange={event => seek(Number(event.target.value))} />
        </div>
        <footer className="preview-focus-hints"><span><kbd>Space</kbd> Play / pause</span><span><kbd>←</kbd><kbd>→</kbd> Step frame</span><span><kbd>F</kbd> Fullscreen</span><span><kbd>Esc</kbd> Exit / close</span></footer>
      </section>}
    </div>
  )
}

function TemplateGallery({ onChoose }) {
  return <div className="template-gallery">{TEMPLATES.map(item => <button key={item.id} className="template-card" onClick={() => onChoose(item.id)}><div className={`template-swatch swatch-${item.id}`}><span>{item.sample}</span><i>{item.name}</i></div><strong>{item.name}</strong><span>{ANIMATIONS[item.animation].label} · {item.description}</span></button>)}</div>
}

function TimelineEvent({ event, index, selected, duration, onSelect }) {
  const name = event.text || 'Untitled lyric'
  const transition = TRANSITIONS[event.transitionIn || 'cut']
  return <div
    className={`timeline-event-block color-${index % 5} ${selected ? 'event-selected' : ''}`}
    data-timeline-event={event.id}
    data-transition={event.transitionIn || 'cut'}
    style={{ left: `${event.start / duration * 100}%`, width: `${Math.max(2, event.duration / duration * 100)}%` }}
    title={`${formatTime(event.start)} · ${name} · Drag to move, drag either edge to trim`}
  >
    <button className="timeline-event" onClick={onSelect} aria-label={`Select ${name}, starts at ${formatTime(event.start)}, duration ${event.duration} seconds`}>
      <span className="event-time">{formatTime(event.start)} · {event.duration.toFixed(2)}s</span>
      <strong>{name}</strong>
      <small>{ANIMATIONS[event.entrance || event.animation]?.label ?? event.animation}{transition?.movement !== 'cut' ? ` · ${transition.label}` : ''}</small>
    </button>
    <button className="trim-handle trim-left" data-trim="left" aria-label={`Trim start of ${name}`} title="Drag to trim start" />
    <button className="trim-handle trim-right" data-trim="right" aria-label={`Trim end of ${name}`} title="Drag to trim end" />
  </div>
}

function Inspector({ composition, selected, selectedId, onUpdate, onUpdateEvent, onDelete, onAdd, onTemplate, onSoundEffect, onRemoveSoundEffect, soundEffectAvailable, activeTab, onTabChange, mobileOpen, onClose, time, fps, onSeek }) {
  const tabs = [['content', 'Text'], ['motion', 'Motion'], ['style', 'Style'], ['audio', 'Audio'], ['project', 'Project']]
  const updateSelected = patch => selected && onUpdateEvent(selected.id, patch)
  const keyframeTime = selected
    ? Math.round(Math.max(0, Math.min(selected.duration, time - selected.start)) * fps) / fps
    : 0
  const activeKeyframe = selected?.keyframes?.find(keyframe => Math.abs(keyframe.time - keyframeTime) < 0.5 / fps)
  const addKeyframe = () => {
    if (!selected) return
    const keyframe = { time: keyframeTime, easing: 'ease-in-out', ...captureKeyframeValues(selected, keyframeTime) }
    updateSelected({ keyframes: upsertKeyframe(selected, keyframe, 0.5 / fps) })
  }
  const updateKeyframe = patch => {
    if (!selected) return
    const keyframe = { ...(activeKeyframe || { time: keyframeTime, easing: 'ease-in-out' }), ...patch, time: keyframeTime }
    updateSelected({ keyframes: upsertKeyframe(selected, keyframe, 0.5 / fps) })
  }
  const removeKeyframe = () => {
    if (selected && activeKeyframe) updateSelected({ keyframes: selected.keyframes.filter(keyframe => keyframe !== activeKeyframe) })
  }
  const keyframeControls = [
    { property: 'x', label: 'HORIZONTAL', min: 0, max: 100, step: 1, unit: '%' },
    { property: 'position', label: 'VERTICAL', min: 0, max: 100, step: 1, unit: '%' },
    { property: 'scale', label: 'SCALE', min: 0.1, max: 3, step: 0.05, unit: '×' },
    { property: 'rotation', label: 'ROTATION', min: -180, max: 180, step: 1, unit: '°' },
    { property: 'opacity', label: 'OPACITY', min: 0, max: 1, step: 0.01, unit: '%' },
    { property: 'blur', label: 'BLUR', min: 0, max: 40, step: 1, unit: 'px' },
    { property: 'letterSpacing', label: 'TRACKING', min: 0, max: 24, step: 0.5, unit: 'px' },
  ]
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
        <div className="tool-section-title"><span>TRANSITION INTO THIS LYRIC</span><small>Blend or move from the preceding event</small></div>
        <label className="field-label">TRANSITION PRESET<select value={selected.transitionIn || 'cut'} onChange={event => updateSelected({ transitionIn: event.target.value })}>{Object.entries(TRANSITIONS).map(([id, transition]) => <option key={id} value={id}>{transition.label}</option>)}</select></label>
        {(selected.transitionIn || 'cut') !== 'cut' && <label className="field-label">TRANSITION DURATION <div className="range-field"><input type="range" min=".05" max="2" step=".05" value={selected.transitionDuration ?? .45} onChange={event => updateSelected({ transitionDuration: Number(event.target.value) })} /><span>{(selected.transitionDuration ?? .45).toFixed(2)}s</span></div></label>}
        <div className="tool-section-title"><span>ANIMATION STACK</span><small>Layer a subtle accent and exit</small></div>
        <div className="field-row"><label className="field-label">EMPHASIS<select value={selected.emphasis || 'none'} onChange={event => updateSelected({ emphasis: event.target.value })}>{Object.entries(EMPHASIS_ANIMATIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="field-label">EXIT<select value={selected.exit || 'fade'} onChange={event => updateSelected({ exit: event.target.value })}>{Object.entries(EXIT_ANIMATIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
        <p className="inspector-hint">Entrance, emphasis, and exit are independent, so you can combine presets into a custom motion stack.</p>
        <div className="tool-section-title keyframe-section-title"><span>MANUAL KEYFRAMES</span><small>Animate this lyric at exact frames</small></div>
        <div className="keyframe-toolbar">
          <span>{formatTime(selected.start + keyframeTime)} · local {keyframeTime.toFixed(2)}s</span>
          <button className="tiny-button" onClick={addKeyframe} disabled={(selected.keyframes || []).length >= 100 && !activeKeyframe}>◇ {activeKeyframe ? 'Update key' : 'Add key'}</button>
          {activeKeyframe && <button className="keyframe-delete" aria-label="Delete keyframe at playhead" title="Delete keyframe" onClick={removeKeyframe}>×</button>}
        </div>
        {(selected.keyframes || []).length > 0 && <div className="keyframe-list" aria-label="Lyric keyframes">
          {selected.keyframes.map(keyframe => <button key={`${keyframe.time}`} className={`keyframe-chip${activeKeyframe === keyframe ? ' active' : ''}`} onClick={() => onSeek(selected.start + keyframe.time)} title={`Seek to keyframe at ${keyframe.time.toFixed(2)} seconds`}>◇ {keyframe.time.toFixed(2)}s</button>)}
        </div>}
        <label className="field-label">SEGMENT EASING<select disabled={!activeKeyframe} value={activeKeyframe?.easing || 'ease-in-out'} onChange={event => updateKeyframe({ easing: event.target.value })}>{KEYFRAME_EASES.map(easing => <option key={easing} value={easing}>{easing.replaceAll('-', ' ')}</option>)}</select></label>
        <label className="field-label">ANIMATED COLOR<div className="color-input"><input type="color" disabled={!activeKeyframe} value={getKeyframeValue(selected, 'color', keyframeTime)} onChange={event => updateKeyframe({ color: event.target.value })} /><span>{getKeyframeValue(selected, 'color', keyframeTime).toUpperCase()}</span></div></label>
        <div className="keyframe-control-grid">
          {keyframeControls.map(control => {
            const value = selected ? getKeyframeValue(selected, control.property, keyframeTime) : 0
            const display = control.property === 'opacity' ? `${Math.round(value * 100)}%` : `${Number(value.toFixed(2))}${control.unit}`
            return <label className="field-label keyframe-control" key={control.property}>{control.label}<div className="range-field"><input type="range" min={control.min} max={control.max} step={control.step} value={value} disabled={!activeKeyframe} onChange={event => updateKeyframe({ [control.property]: Number(event.target.value) })} /><span>{display}</span></div></label>
          })}
        </div>
        <p className="inspector-hint">Move the playhead inside this lyric, add a key, then adjust its properties. Keyframes interpolate smoothly in preview and export.</p>
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
