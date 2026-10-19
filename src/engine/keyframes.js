export const KEYFRAME_PROPERTIES = ['x', 'position', 'scale', 'rotation', 'opacity', 'blur', 'letterSpacing']
export const KEYFRAME_COLOR_PROPERTIES = ['color']
export const ALL_KEYFRAME_PROPERTIES = [...KEYFRAME_PROPERTIES, ...KEYFRAME_COLOR_PROPERTIES]
export const KEYFRAME_EASES = ['linear', 'ease-in', 'ease-out', 'ease-in-out']

const BASE_VALUES = {
  scale: 1,
  rotation: 0,
  opacity: 1,
  blur: 0,
  letterSpacing: 0,
}

function easeProgress(progress, easing) {
  if (easing === 'ease-in') return progress * progress
  if (easing === 'ease-out') return 1 - (1 - progress) ** 2
  if (easing === 'ease-in-out') return progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2
  return progress
}

function interpolateColor(from, to, progress) {
  const start = Number.parseInt(from.slice(1), 16)
  const end = Number.parseInt(to.slice(1), 16)
  const channels = [16, 8, 0].map(shift => {
    const a = (start >> shift) & 255
    const b = (end >> shift) & 255
    return Math.round(a + (b - a) * progress).toString(16).padStart(2, '0')
  })
  return `#${channels.join('')}`
}

export function getKeyframeValue(event, property, time) {
  const colorProperty = KEYFRAME_COLOR_PROPERTIES.includes(property)
  const baseValue = colorProperty ? event[property]
    : property === 'x' ? event.x ?? 50
      : property === 'position' ? event.position ?? 52
        : BASE_VALUES[property]
  const keyframes = [...(event.keyframes || [])]
    .filter(keyframe => Number.isFinite(keyframe.time)
      && (colorProperty ? typeof keyframe[property] === 'string' && /^#[\da-f]{6}$/i.test(keyframe[property]) : Number.isFinite(keyframe[property])))
    .sort((a, b) => a.time - b.time)
  let previous = { time: 0, [property]: baseValue, easing: 'linear' }
  for (const next of keyframes) {
    if (time < next.time) {
      const span = next.time - previous.time
      if (span <= 0) return next[property]
      const progress = Math.max(0, Math.min(1, (time - previous.time) / span))
      const eased = easeProgress(progress, previous.easing)
      return colorProperty ? interpolateColor(previous[property], next[property], eased)
        : previous[property] + (next[property] - previous[property]) * eased
    }
    previous = next
  }
  return previous[property]
}

export function captureKeyframeValues(event, time) {
  return Object.fromEntries(ALL_KEYFRAME_PROPERTIES.map(property => [property, getKeyframeValue(event, property, time)]))
}

export function upsertKeyframe(event, keyframe, frameTolerance = 1 / 60) {
  if (!Number.isFinite(keyframe.time) || keyframe.time < 0 || keyframe.time > event.duration) {
    throw new Error('Keyframe time must be within its lyric event.')
  }
  const frames = (event.keyframes || []).filter(item => Math.abs(item.time - keyframe.time) > frameTolerance)
  const cleanValues = Object.fromEntries(Object.entries(keyframe).filter(([property, value]) => (
    property === 'time' || property === 'easing'
      || KEYFRAME_PROPERTIES.includes(property) && Number.isFinite(value)
      || KEYFRAME_COLOR_PROPERTIES.includes(property) && typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
  )))
  return [...frames, { ...cleanValues }].sort((a, b) => a.time - b.time)
}
