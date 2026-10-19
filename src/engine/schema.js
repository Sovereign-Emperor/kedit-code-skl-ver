import { ANIMATIONS, EMPHASIS_ANIMATIONS, EXIT_ANIMATIONS, TRANSITIONS } from './animations.js'
import { ALL_KEYFRAME_PROPERTIES, KEYFRAME_COLOR_PROPERTIES, KEYFRAME_EASES, KEYFRAME_PROPERTIES } from './keyframes.js'

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
    if (composition.markers !== undefined) {
      if (!Array.isArray(composition.markers) || composition.markers.length > 200) errors.push('Markers must be a list of up to 200 timeline markers.')
      else {
        const markerIds = new Set()
        composition.markers.forEach((marker, index) => {
          const prefix = `Marker ${index + 1}`
          if (!marker || typeof marker !== 'object') { errors.push(`${prefix} must be an object.`); return }
          if (typeof marker.id !== 'string' || !marker.id.trim() || markerIds.has(marker.id)) errors.push(`${prefix} must have a unique, non-empty id.`)
          else markerIds.add(marker.id)
          if (typeof marker.label !== 'string' || !marker.label.trim() || marker.label.length > 40) errors.push(`${prefix} label must be between 1 and 40 characters.`)
          if (!Number.isFinite(marker.time) || marker.time < 0 || marker.time > composition.duration) errors.push(`${prefix} time must be within the composition.`)
        })
      }
    }
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
        if (event.transitionIn && !Object.hasOwn(TRANSITIONS, event.transitionIn)) errors.push(`${prefix} has an unsupported transition.`)
        if (event.transitionDuration !== undefined && (!Number.isFinite(event.transitionDuration) || event.transitionDuration < 0.05 || event.transitionDuration > 2)) errors.push(`${prefix} transition duration must be between 0.05 and 2 seconds.`)
        if (event.highlight !== undefined && (!Array.isArray(event.highlight) || event.highlight.some(word => typeof word !== 'string'))) errors.push(`${prefix} highlights must be an array of words.`)
        if (!Number.isFinite(event.start) || event.start < 0 || event.start >= composition.duration) errors.push(`${prefix} start time must be within the composition.`)
        if (!Number.isFinite(event.duration) || event.duration < 0.15 || event.start + event.duration > composition.duration + 0.001) errors.push(`${prefix} duration must be at least 0.15 seconds and fit within the composition.`)
        if (typeof event.color !== 'string' || !/^#[\da-f]{6}$/i.test(event.color)) errors.push(`${prefix} color must be a six-digit hex color.`)
        if (!Number.isFinite(event.fontSize) || event.fontSize < 18 || event.fontSize > 260) errors.push(`${prefix} font size must be between 18 and 260 pixels.`)
        if (event.x !== undefined && (!Number.isFinite(event.x) || event.x < 0 || event.x > 100)) errors.push(`${prefix} horizontal position must be between 0 and 100 percent.`)
        if (event.position !== undefined && (!Number.isFinite(event.position) || event.position < 0 || event.position > 100)) errors.push(`${prefix} vertical position must be between 0 and 100 percent.`)
        if (event.motionDuration !== undefined && (!Number.isFinite(event.motionDuration) || event.motionDuration < 0.05 || event.motionDuration > 3)) errors.push(`${prefix} motion duration must be between 0.05 and 3 seconds.`)
        if (!['center', 'left', 'right'].includes(event.align)) errors.push(`${prefix} alignment must be center, left, or right.`)
        if (event.soundEffect !== undefined && typeof event.soundEffect !== 'string') errors.push(`${prefix} sound effect must be a file name or empty string.`)
        if (event.soundEffectGain !== undefined && (!Number.isFinite(event.soundEffectGain) || event.soundEffectGain < 0 || event.soundEffectGain > 2)) errors.push(`${prefix} sound effect gain must be between 0 and 2.`)
        if (event.keyframes !== undefined) {
          if (!Array.isArray(event.keyframes) || event.keyframes.length > 100) errors.push(`${prefix} can have up to 100 keyframes.`)
          else {
            let previousTime = -1
            event.keyframes.forEach((keyframe, keyframeIndex) => {
              const label = `${prefix} keyframe ${keyframeIndex + 1}`
              if (!keyframe || typeof keyframe !== 'object') { errors.push(`${label} must be an object.`); return }
              if (!Number.isFinite(keyframe.time) || keyframe.time < 0 || keyframe.time > event.duration || keyframe.time <= previousTime) errors.push(`${label} time must be unique, ordered, and within the event duration.`)
              else previousTime = keyframe.time
              if (keyframe.easing !== undefined && !KEYFRAME_EASES.includes(keyframe.easing)) errors.push(`${label} has an unsupported easing curve.`)
              for (const property of Object.keys(keyframe)) {
                if (property === 'time' || property === 'easing') continue
                if (!ALL_KEYFRAME_PROPERTIES.includes(property)) errors.push(`${label} uses unsupported property ${property}.`)
                else if (KEYFRAME_COLOR_PROPERTIES.includes(property) && (typeof keyframe[property] !== 'string' || !/^#[\da-f]{6}$/i.test(keyframe[property]))) errors.push(`${label} color must be a six-digit hex color.`)
                else if (KEYFRAME_PROPERTIES.includes(property) && !Number.isFinite(keyframe[property])) errors.push(`${label} ${property} must be a finite number.`)
              }
              const bounds = { x: [0, 100], position: [0, 100], scale: [0.05, 5], rotation: [-3600, 3600], opacity: [0, 1], blur: [0, 100], letterSpacing: [0, 50] }
              for (const property of KEYFRAME_PROPERTIES) {
                const value = keyframe[property]
                if (value !== undefined && Number.isFinite(value) && (value < bounds[property][0] || value > bounds[property][1])) errors.push(`${label} ${property} is outside its supported range.`)
              }
            })
          }
        }
      })
    }
  }
  return options.returnErrors ? errors.map(message => ({ message })) : errors.length ? new Error(errors[0]) : null
}
