import { ANIMATIONS, TRANSITIONS, resolveEase } from './animations.js'
import { getKeyframeValue } from './keyframes.js'

const clamp = value => Math.max(0, Math.min(1, value))
const rgb = color => color
const isHighlight = (word, words) => words.some(highlight => word.replace(/[^\p{L}\p{N}'-]/gu, '').toLowerCase() === highlight.toLowerCase())

function wrapText(ctx, text, maxWidth) {
  const rows = []
  for (const rawLine of text.split('\n')) {
    const words = rawLine.split(/(\s+)/).filter(Boolean)
    let row = ''
    for (const word of words) {
      if (!row && /^\s+$/.test(word)) continue
      const next = row + word
      if (row && ctx.measureText(next).width > maxWidth) {
        rows.push(row.trimEnd())
        row = word.trimStart()
      } else row = next
    }
    rows.push(row.trimEnd())
  }
  return rows.filter(line => line.length > 0).slice(0, 8)
}

function drawStyledLine(ctx, line, x, y, highlight, baseColor, accent, tracking = 0) {
  ctx.textAlign = 'left'
  const parts = line.split(/(\s+)/).filter(Boolean)
  let cursor = x
  for (const part of parts) {
    const color = isHighlight(part, highlight) ? accent : baseColor
    ctx.fillStyle = color
    if (tracking > 0) {
      for (const character of part) {
        ctx.fillText(character, cursor, y)
        cursor += ctx.measureText(character).width + tracking
      }
    } else {
      ctx.fillText(part, cursor, y)
      cursor += ctx.measureText(part).width
    }
  }
}

function drawEvent(ctx, composition, event, time, width, height, events, index) {
  const elapsed = time - event.start
  const next = events[index + 1]
  const nextTransition = next && TRANSITIONS[next.transitionIn || 'cut']
  const nextDuration = next?.transitionDuration ?? 0.45
  const outgoing = next && nextTransition && nextTransition.movement !== 'cut'
    && next.start <= event.start + event.duration + 1 / composition.fps
    && time >= next.start && time < next.start + nextDuration
  const transition = TRANSITIONS[event.transitionIn || 'cut']
  const transitionDuration = event.transitionDuration ?? 0.45
  const incoming = transition && transition.movement !== 'cut'
    && time >= event.start && time < event.start + transitionDuration
  if (elapsed < 0 || (elapsed >= event.duration && !outgoing)) return
  const entranceName = event.entrance || event.animation
  const preset = Object.hasOwn(ANIMATIONS, entranceName) ? ANIMATIONS[entranceName] : ANIMATIONS.fade
  const progress = clamp(elapsed / Math.min(event.motionDuration ?? 0.68, event.duration * 0.38))
  const ease = resolveEase(preset.ease)
  const entrance = ease(progress)
  const exitWindow = Math.min(0.22, event.duration * 0.15)
  const exitProgress = clamp((elapsed - (event.duration - exitWindow)) / exitWindow)
  const exitStyle = event.exit ?? 'fade'
  const keyX = getKeyframeValue(event, 'x', elapsed)
  const keyPosition = getKeyframeValue(event, 'position', elapsed)
  const keyScale = getKeyframeValue(event, 'scale', elapsed)
  const keyRotation = getKeyframeValue(event, 'rotation', elapsed)
  const keyOpacity = getKeyframeValue(event, 'opacity', elapsed)
  const keyBlur = getKeyframeValue(event, 'blur', elapsed)
  const keyLetterSpacing = getKeyframeValue(event, 'letterSpacing', elapsed)
  const keyColor = getKeyframeValue(event, 'color', elapsed)
  const opacity = Math.min(1, entrance * 1.15) * (exitStyle === 'fade' ? 1 - exitProgress : 1) * keyOpacity
  const scale = width / 1080
  const fontSize = Math.min(event.fontSize * scale, width * 0.22)
  const position = keyPosition
  const movement = preset.movement
  let alpha = opacity
  let yOffset = (1 - entrance) * fontSize * 0.32
  let xOffset = movement === 'slide' ? (1 - entrance) * width * 0.16 : 0
  let zoom = 1
  let blur = keyBlur
  let tracking = (movement === 'tracking' ? (1 - entrance) * fontSize * 0.32 : 0) + keyLetterSpacing
  let revealMode = ''
  const transitionProgress = incoming ? clamp((time - event.start) / transitionDuration) : 1
  const outgoingProgress = outgoing ? clamp((time - next.start) / nextDuration) : 0
  const transitionMovement = incoming ? transition.movement : ''
  const outgoingMovement = outgoing ? nextTransition.movement : ''
  if (incoming) {
    if (transitionMovement === 'dissolve' || transitionMovement === 'glitch') alpha *= transitionProgress
    if (transitionMovement === 'push-left') xOffset += (1 - transitionProgress) * width * 0.18
    if (transitionMovement === 'push-right') xOffset -= (1 - transitionProgress) * width * 0.18
    if (transitionMovement === 'zoom-through') zoom *= 0.68 + transitionProgress * 0.32
    if (transitionMovement === 'glitch' && transitionProgress < 0.8 && Math.floor(time * 30) % 2 === 0) xOffset += fontSize * 0.08
  }
  if (outgoing) {
    alpha *= 1 - outgoingProgress
    if (outgoingMovement === 'push-left') xOffset -= outgoingProgress * width * 0.18
    if (outgoingMovement === 'push-right') xOffset += outgoingProgress * width * 0.18
    if (outgoingMovement === 'zoom-through') zoom *= 1 + outgoingProgress * 0.35
    if (outgoingMovement === 'glitch' && Math.floor(time * 30) % 2 === 0) xOffset -= fontSize * 0.08
  }
  if (movement === 'zoom') zoom = 1.16 - entrance * 0.16
  if (movement === 'slam') { zoom = 1.85 - entrance * 0.85; yOffset = (1 - entrance) * -fontSize * 0.4 }
  if (movement === 'punch') zoom = 1.38 - entrance * 0.38
  if (movement === 'bounce') yOffset = (1 - ease(progress)) * fontSize * 0.45
  if (movement === 'blur') blur = (1 - entrance) * fontSize * 0.13
  if (movement === 'glitch') {
    const pulse = progress < 0.32 && Math.floor(elapsed * 24) % 3 === 0
    if (pulse) xOffset = (Math.floor(elapsed * 80) % 2 ? 1 : -1) * fontSize * 0.12
  }
  if (movement === 'characters' || movement === 'typewriter') revealMode = 'characters'
  if (movement === 'words') revealMode = 'words'
  if (movement === 'mask') revealMode = 'mask'
  if (movement === 'split') yOffset = (1 - entrance) * fontSize * 0.65
  if (movement === 'emphasis') { zoom = 0.72 + entrance * 0.28; yOffset = (1 - entrance) * fontSize * 0.2 }
  if (movement === 'wipe') revealMode = 'mask'
  if (movement === 'rapid') alpha *= Math.floor(elapsed * 12) % 4 === 0 ? 0.5 : 1
  const emphasisPhase = clamp((elapsed / event.duration - 0.48) / 0.18)
  const emphasisPulse = Math.sin(Math.PI * emphasisPhase)
  if (event.emphasis === 'pulse') zoom *= 1 + emphasisPulse * 0.075
  if (event.emphasis === 'glitch' && emphasisPhase > 0 && emphasisPhase < 1 && Math.floor(elapsed * 28) % 3 === 0) xOffset += fontSize * 0.09
  if (exitStyle === 'zoom-out') zoom *= 1 + exitProgress * 0.24
  if (exitStyle === 'slide-out') xOffset += exitProgress * width * 0.16
  if (exitStyle === 'glitch-out' && exitProgress > 0) xOffset += (Math.floor(elapsed * 60) % 2 ? 1 : -1) * exitProgress * fontSize * 0.12
  const reveal = revealMode === 'characters' ? clamp(elapsed / Math.max(0.12, event.duration * 0.7))
    : revealMode === 'words' ? clamp(elapsed / Math.max(0.12, event.duration * 0.62))
      : revealMode === 'mask' || movement === 'split' ? entrance : 1

  ctx.save()
  ctx.globalAlpha = clamp(alpha)
  ctx.translate(width * keyX / 100 + xOffset, height * position / 100 + yOffset)
  ctx.rotate(keyRotation * Math.PI / 180)
  ctx.scale(zoom * keyScale, zoom * keyScale)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `${event.fontWeight || 800} ${fontSize}px "${event.font || 'Arial'}", sans-serif`
  ctx.filter = blur ? `blur(${blur}px)` : 'none'
  ctx.shadowColor = `${keyColor}99`
  ctx.shadowBlur = fontSize * (0.16 + (event.emphasis === 'glow' ? emphasisPulse * 0.24 : 0))
  const maxWidth = width * (event.align === 'center' ? 0.84 : 0.74)
  const lines = wrapText(ctx, event.text, maxWidth)
  const lineHeight = fontSize * 1.1
  const lineY = -((lines.length - 1) * lineHeight) / 2
  const words = (event.highlight || []).filter(Boolean)
  const blockTop = lineY - fontSize * 0.7
  const blockHeight = fontSize * (lines.length * 1.1 + 0.4)

  if (revealMode === 'mask' || movement === 'split') {
    ctx.beginPath()
    ctx.rect(-width / 2, blockTop, width, blockHeight * reveal)
    ctx.clip()
  }
  if (incoming && (transitionMovement === 'wipe-left' || transitionMovement === 'wipe-right')) {
    ctx.beginPath()
    const revealWidth = width * transitionProgress
    ctx.rect(transitionMovement === 'wipe-left' ? -width / 2 : width / 2 - revealWidth, blockTop, revealWidth, blockHeight)
    ctx.clip()
  }
  if (movement === 'tracking' || movement === 'characters' || movement === 'typewriter') ctx.textAlign = 'center'

  lines.forEach((line, index) => {
    ctx.save()
    if (movement === 'split') ctx.translate((index % 2 ? 1 : -1) * (1 - entrance) * fontSize * 2, 0)
    let visibleLine = line
    if (revealMode === 'characters') visibleLine = line.slice(0, Math.ceil(line.length * reveal))
    if (revealMode === 'words') visibleLine = line.split(/(\s+)/).filter(Boolean).reduce((shown, part) => {
      if (/^\s+$/.test(part)) return shown + (shown.trim() ? part : '')
      const wordCount = shown.trim().split(/\s+/).filter(Boolean).length
      return wordCount < Math.ceil(line.trim().split(/\s+/).filter(Boolean).length * reveal) ? `${shown}${part}` : shown
    }, '')
    if (!visibleLine) { ctx.restore(); return }
    if (event.align === 'center' || movement === 'tracking' || movement === 'characters' || movement === 'typewriter') {
      ctx.textAlign = 'center'
      if (movement === 'tracking') {
        const chars = Array.from(visibleLine)
        const totalWidth = chars.reduce((sum, char) => sum + ctx.measureText(char).width + tracking, -tracking)
        let cursor = -totalWidth / 2
        ctx.fillStyle = rgb(keyColor)
        for (const char of chars) {
          ctx.fillText(char, cursor + ctx.measureText(char).width / 2, lineY + index * lineHeight)
          cursor += ctx.measureText(char).width + tracking
        }
      } else {
        const widthOfLine = ctx.measureText(visibleLine).width
        drawStyledLine(ctx, visibleLine, -widthOfLine / 2, lineY + index * lineHeight, words, keyColor, composition.accent || '#e5c268', tracking)
      }
    } else {
      ctx.textAlign = event.align
      const measure = ctx.measureText(visibleLine).width
      const startX = event.align === 'left'
        ? (event.x === undefined ? -width * 0.38 : 0)
        : (event.x === undefined ? width * 0.38 - measure : -measure)
      drawStyledLine(ctx, visibleLine, startX, lineY + index * lineHeight, words, keyColor, composition.accent || '#e5c268', tracking)
    }
    ctx.restore()
  })
  ctx.restore()
}

export function drawCompositionFrame(ctx, composition, time, dimensions) {
  const { width, height } = dimensions
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = composition.background || '#09090f'
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(width * 0.52, height * 0.44, 0, width * 0.52, height * 0.44, width * 0.92)
  glow.addColorStop(0, 'rgba(114, 82, 46, 0.16)')
  glow.addColorStop(0.45, 'rgba(57, 42, 79, 0.09)')
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  const vignette = ctx.createLinearGradient(0, 0, 0, height)
  vignette.addColorStop(0, 'rgba(0,0,0,.2)')
  vignette.addColorStop(0.5, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,.32)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)

  const events = [...composition.events].sort((a, b) => a.start - b.start)
  events.forEach((event, index) => drawEvent(ctx, composition, event, time, width, height, events, index))
}
