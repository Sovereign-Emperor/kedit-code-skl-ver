import { ANIMATIONS, EMPHASIS_ANIMATIONS, EXIT_ANIMATIONS } from './animations.js'

export const FORMATS = {
  vertical: { label: '9:16 · Vertical', width: 1080, height: 1920 },
  landscape: { label: '16:9 · Landscape', width: 1920, height: 1080 },
  square: { label: '1:1 · Square', width: 1080, height: 1080 },
}

export const validateComposition = (composition, options = {}) => {
  const errors = []
  if (!composition || typeof composition !== 'object') errors.push('Composition must be a JSON object.')
  if (composition && typeof composition === 'object') {
    if (typeof composition.title !== 'string' || !composition.title.trim()) errors.push('Add a project title.')
    if (!FORMATS[composition.format]) errors.push('Choose a supported canvas format.')
    if (!Number.isFinite(composition.fps) || ![24, 30, 60].includes(composition.fps)) errors.push('Frame rate must be 24, 30, or 60 fps.')
    if (!Number.isFinite(composition.duration) || composition.duration < 0.5 || composition.duration > 300) errors.push('Duration must be between 0.5 and 300 seconds.')
    if (typeof composition.background !== 'string' || !/^#[\da-f]{6}$/i.test(composition.background)) errors.push('Background must be a six-digit hex color.')
    if (composition.audio !== undefined && typeof composition.audio !== 'string') errors.push('Audio must be a file name or an empty string.')
    if (!Array.isArray(composition.events)) errors.push('Events must be an array.')
    else {
      const ids = new Set()
      composition.events.forEach((event, index) => {
        const prefix = `Event ${index + 1}`
        if (!event || typeof event !== 'object') { errors.push(`${prefix} must be an object.`); return }
        if (typeof event.id !== 'string' || !event.id.trim() || ids.has(event.id)) errors.push(`${prefix} must have a unique, non-empty id.`)
        else ids.add(event.id)
        if (typeof event.text !== 'string' || event.text.length > 300) errors.push(`${prefix} text must be 300 characters or fewer.`)
        if (!Object.hasOwn(ANIMATIONS, event.animation)) errors.push(`${prefix} must use a supported motion preset.`)
        if (event.entrance && !Object.hasOwn(ANIMATIONS, event.entrance)) errors.push(`${prefix} has an unsupported entrance preset.`)
        if (event.emphasis && !Object.hasOwn(EMPHASIS_ANIMATIONS, event.emphasis)) errors.push(`${prefix} has an unsupported emphasis animation.`)
        if (event.exit && !Object.hasOwn(EXIT_ANIMATIONS, event.exit)) errors.push(`${prefix} has an unsupported exit animation.`)
        if (event.highlight !== undefined && (!Array.isArray(event.highlight) || event.highlight.some(word => typeof word !== 'string'))) errors.push(`${prefix} highlights must be an array of words.`)
        if (!Number.isFinite(event.start) || event.start < 0 || event.start >= composition.duration) errors.push(`${prefix} start time must be within the composition.`)
        if (!Number.isFinite(event.duration) || event.duration < 0.15 || event.start + event.duration > composition.duration + 0.001) errors.push(`${prefix} duration must be at least 0.15 seconds and fit within the composition.`)
        if (typeof event.color !== 'string' || !/^#[\da-f]{6}$/i.test(event.color)) errors.push(`${prefix} color must be a six-digit hex color.`)
        if (!Number.isFinite(event.fontSize) || event.fontSize < 18 || event.fontSize > 260) errors.push(`${prefix} font size must be between 18 and 260 pixels.`)
        if (event.position !== undefined && (!Number.isFinite(event.position) || event.position < 0 || event.position > 100)) errors.push(`${prefix} vertical position must be between 0 and 100 percent.`)
        if (!['center', 'left', 'right'].includes(event.align)) errors.push(`${prefix} alignment must be center, left, or right.`)
        if (event.soundEffect !== undefined && typeof event.soundEffect !== 'string') errors.push(`${prefix} sound effect must be a file name or empty string.`)
        if (event.soundEffectGain !== undefined && (!Number.isFinite(event.soundEffectGain) || event.soundEffectGain < 0 || event.soundEffectGain > 2)) errors.push(`${prefix} sound effect gain must be between 0 and 2.`)
      })
    }
  }
  return options.returnErrors ? errors.map(message => ({ message })) : errors.length ? new Error(errors[0]) : null
}
