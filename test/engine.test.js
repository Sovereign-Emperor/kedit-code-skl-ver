import test from 'node:test'
import assert from 'node:assert/strict'
import { ANIMATIONS, EMPHASIS_ANIMATIONS, EXIT_ANIMATIONS, TRANSITIONS } from '../src/engine/animations.js'
import { COMPOSITIONS, createLyric, TEMPLATES } from '../src/compositions/library.js'
import { drawCompositionFrame } from '../src/engine/renderer.js'
import { FORMATS, validateComposition } from '../src/engine/schema.js'
import { arrangeEventsIntoLanes, calculateTimelineEdit } from '../src/engine/timeline-editing.js'
import { getKeyframeValue, upsertKeyframe } from '../src/engine/keyframes.js'

test('the example compositions meet the supported schema', () => {
  for (const composition of COMPOSITIONS) assert.equal(validateComposition(composition), null)
})

test('the built-in composition and typography libraries contain distinct usable options', () => {
  assert.ok(COMPOSITIONS.length >= 7)
  assert.ok(TEMPLATES.length >= 13)
  assert.equal(new Set(COMPOSITIONS.map(composition => composition.id)).size, COMPOSITIONS.length)
  assert.equal(new Set(TEMPLATES.map(template => template.id)).size, TEMPLATES.length)
  for (const template of TEMPLATES) {
    assert.ok(ANIMATIONS[template.animation], `${template.name} references an unsupported animation`)
    assert.match(template.color, /^#[\da-f]{6}$/i, `${template.name} needs a valid color`)
  }
  for (const composition of COMPOSITIONS) {
    for (const event of composition.events) {
      assert.ok(TEMPLATES.some(template => template.id === event.template), `${event.id} references a missing template`)
    }
  }
})

test('the animation registry includes all of the requested reusable motion families', () => {
  for (const preset of ['fade', 'zoom', 'slam', 'punch-in', 'slide', 'bounce', 'blur-reveal', 'glitch', 'tracking-reveal', 'word-by-word', 'character-by-character', 'typewriter', 'mask-reveal', 'split-text', 'kinetic-emphasis', 'directional-wipe', 'rapid-cut']) {
    assert.ok(ANIMATIONS[preset], `Missing preset: ${preset}`)
  }
})

test('the transition registry exposes usable cuts, blends, wipes, pushes, zooms, and glitch transitions', () => {
  assert.deepEqual(Object.keys(TRANSITIONS), ['cut', 'dissolve', 'wipe-left', 'wipe-right', 'push-left', 'push-right', 'zoom-through', 'glitch'])
})

test('supported output formats use the required pixel sizes', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(FORMATS).map(([key, value]) => [key, [value.width, value.height]])),
    { vertical: [1080, 1920], landscape: [1920, 1080], square: [1080, 1080] },
  )
})

test('composition validation rejects an event that overruns the edit', () => {
  const invalid = structuredClone(COMPOSITIONS[0])
  invalid.events[0].start = invalid.duration - 0.1
  assert.match(validateComposition(invalid).message, /duration/)
})

test('keyframe values interpolate with selectable easing and upsert on frame boundaries', () => {
  const event = {
    ...createLyric(2, 4),
    x: 20,
    keyframes: [
      { time: 1, x: 80, scale: 2, color: '#000000', easing: 'ease-in-out' },
      { time: 3, x: 40, scale: 1, color: '#ffffff', easing: 'linear' },
    ],
  }
  assert.equal(getKeyframeValue(event, 'x', 0), 20)
  assert.equal(getKeyframeValue(event, 'x', 1), 80)
  assert.equal(getKeyframeValue(event, 'x', 2), 60)
  assert.equal(getKeyframeValue(event, 'scale', 2), 1.5)
  assert.equal(getKeyframeValue(event, 'color', 2), '#808080')
  const changed = upsertKeyframe(event, { time: 1.01, x: 70 }, 1 / 30)
  assert.equal(changed.length, 2)
  assert.equal(changed[0].x, 70)
})

test('composition validation bounds timeline markers and animated keyframe properties', () => {
  const invalid = structuredClone(COMPOSITIONS[0])
  invalid.markers = [{ id: 'm1', label: 'Out of range', time: invalid.duration + 1 }]
  invalid.events[0].keyframes = [
    { time: 0.5, scale: 8, easing: 'spring', color: 'blue' },
    { time: 0.4, opacity: 0.5, unknown: 1 },
  ]
  const messages = validateComposition(invalid, { returnErrors: true }).map(error => error.message)
  assert.ok(messages.some(message => /time must be within the composition/.test(message)))
  assert.ok(messages.some(message => /unsupported easing/.test(message)))
  assert.ok(messages.some(message => /scale is outside/.test(message)))
  assert.ok(messages.some(message => /color must be a six-digit hex/.test(message)))
  assert.ok(messages.some(message => /unique, ordered/.test(message)))
  assert.ok(messages.some(message => /unsupported property unknown/.test(message)))
})

test('the frame renderer draws overlapping timestamped text on a canvas context', () => {
  let textDrawn = 0
  const context = {
    clearRect() {}, fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, beginPath() {}, rect() {}, clip() {},
    fillText() { textDrawn += 1 }, measureText(text) { return { width: text.length * 20 } },
    createRadialGradient() { return { addColorStop() {} } },
    createLinearGradient() { return { addColorStop() {} } },
  }
  const composition = structuredClone(COMPOSITIONS[0])
  drawCompositionFrame(context, composition, 4, FORMATS.vertical)
  assert.ok(textDrawn > 0)
})

test('the renderer accepts every registered entrance preset and separate emphasis/exit styles', () => {
  const context = {
    clearRect() {}, fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, beginPath() {}, rect() {}, clip() {},
    fillText() {}, measureText(text) { return { width: text.length * 12 } },
    createRadialGradient() { return { addColorStop() {} } },
    createLinearGradient() { return { addColorStop() {} } },
  }
  for (const animation of Object.keys(ANIMATIONS)) {
    const event = { ...createLyric(0), text: 'EMPIRE RISE', animation, entrance: animation, emphasis: 'glow', exit: 'zoom-out' }
    drawCompositionFrame(context, { ...COMPOSITIONS[0], events: [event] }, 0.4, FORMATS.vertical)
  }
  for (const exit of Object.keys(EXIT_ANIMATIONS)) {
    const event = { ...createLyric(0), text: 'FORWARD', exit }
    drawCompositionFrame(context, { ...COMPOSITIONS[0], events: [event] }, 2.45, FORMATS.vertical)
  }
  for (const emphasis of Object.keys(EMPHASIS_ANIMATIONS)) {
    const event = { ...createLyric(0), text: 'FOCUS', emphasis }
    drawCompositionFrame(context, { ...COMPOSITIONS[0], events: [event] }, 1.5, FORMATS.vertical)
  }
})

test('new lyric cards clamp to the remaining edit duration', () => {
  const lyric = createLyric(17.5, 0.5)
  assert.equal(lyric.start, 17.5)
  assert.equal(lyric.duration, 0.5)
  assert.equal(lyric.x, 50)
  assert.equal(lyric.motionDuration, 0.68)
  assert.equal(validateComposition({ ...COMPOSITIONS[0], events: [lyric] }), null)
})

test('custom horizontal placement and entrance timing render at their configured values', () => {
  const translations = []
  const context = {
    clearRect() {}, fillRect() {}, save() {}, restore() {}, scale() {}, rotate() {}, beginPath() {}, rect() {}, clip() {},
    translate(x, y) { translations.push([x, y]) },
    fillText() {}, measureText(text) { return { width: text.length * 12 } },
    createRadialGradient() { return { addColorStop() {} } },
    createLinearGradient() { return { addColorStop() {} } },
  }
  const event = { ...createLyric(0), text: 'CUSTOM POSITION', animation: 'fade', x: 25, motionDuration: 0.2 }
  drawCompositionFrame(context, { ...COMPOSITIONS[0], events: [event] }, 0.1, FORMATS.vertical)
  assert.ok(translations.some(([x]) => x === 270))
})

test('renderer applies manually keyed transform, opacity, blur, and position values', () => {
  const transforms = []
  const context = {
    globalAlpha: 1,
    filter: 'none',
    clearRect() {}, fillRect() {}, save() {}, restore() {},
    translate(x, y) { transforms.push(['translate', x, y]) },
    rotate(value) { transforms.push(['rotate', value]) },
    scale(x, y) { transforms.push(['scale', x, y]) },
    beginPath() {}, rect() {}, clip() {}, fillText() {},
    measureText(text) { return { width: text.length * 12 } },
    createRadialGradient() { return { addColorStop() {} } },
    createLinearGradient() { return { addColorStop() {} } },
  }
  const event = {
    ...createLyric(0, 2),
    text: 'KEYFRAME TEST',
    animation: 'fade',
    entrance: 'fade',
    motionDuration: 0.05,
    keyframes: [{ time: 0, x: 25, position: 30, scale: 2, rotation: 90, opacity: 0.5, blur: 4, letterSpacing: 2 }],
  }
  drawCompositionFrame(context, { ...COMPOSITIONS[0], events: [event] }, 0.2, FORMATS.vertical)
  assert.ok(transforms.some(([kind, x]) => kind === 'translate' && x === 270))
  assert.ok(transforms.some(([kind, value]) => kind === 'rotate' && value === Math.PI / 2))
  assert.ok(transforms.some(([kind, x]) => kind === 'scale' && x === 2))
  assert.equal(context.globalAlpha, 0.5)
  assert.equal(context.filter, 'blur(4px)')
})

test('composition validation rejects malformed highlight and effect gain data', () => {
  const invalid = structuredClone(COMPOSITIONS[0])
  invalid.events[0].highlight = 'EMPIRE'
  invalid.events[0].soundEffectGain = 3
  const messages = validateComposition(invalid, { returnErrors: true }).map(error => error.message)
  assert.ok(messages.some(message => /highlights must be an array/.test(message)))
  assert.ok(messages.some(message => /sound effect gain/.test(message)))
})

test('composition validation bounds custom horizontal placement and motion duration', () => {
  const invalid = structuredClone(COMPOSITIONS[0])
  invalid.events[0].x = 105
  invalid.events[0].motionDuration = 4
  const messages = validateComposition(invalid, { returnErrors: true }).map(error => error.message)
  assert.ok(messages.some(message => /horizontal position/.test(message)))
  assert.ok(messages.some(message => /motion duration/.test(message)))
})

test('every transition preset renders overlapping outgoing and incoming lyric cards', () => {
  let clipCount = 0
  let drawCount = 0
  const context = {
    clearRect() {}, fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, beginPath() {}, rect() {}, clip() { clipCount += 1 },
    fillText() { drawCount += 1 }, measureText(text) { return { width: text.length * 12 } },
    createRadialGradient() { return { addColorStop() {} } },
    createLinearGradient() { return { addColorStop() {} } },
  }
  for (const transition of Object.keys(TRANSITIONS)) {
    drawCount = 0
    const outgoing = { ...createLyric(0, 2), text: 'OUTGOING', transitionIn: 'cut' }
    const incoming = { ...createLyric(1, 2), text: 'INCOMING', transitionIn: transition, transitionDuration: 0.5 }
    drawCompositionFrame(context, { ...COMPOSITIONS[0], duration: 3, events: [outgoing, incoming] }, 1.25, FORMATS.vertical)
    assert.ok(drawCount > 0, `${transition} did not render any text`)
  }
  assert.ok(clipCount >= 2, 'Wipe presets should clip the reveal area')
})

test('composition validation rejects unsupported transitions and invalid transition lengths', () => {
  const invalid = structuredClone(COMPOSITIONS[0])
  invalid.events[0].transitionIn = 'spin'
  invalid.events[0].transitionDuration = 4
  const messages = validateComposition(invalid, { returnErrors: true }).map(error => error.message)
  assert.ok(messages.some(message => /unsupported transition/.test(message)))
  assert.ok(messages.some(message => /transition duration/.test(message)))
})

test('timeline editing moves and trims events on frame boundaries within the composition', () => {
  const event = { start: 1, duration: 2 }
  assert.deepEqual(calculateTimelineEdit(event, 'move', 1.11, 10, 30), { start: 2.1 })
  assert.deepEqual(calculateTimelineEdit(event, 'move', -5, 10, 30), { start: 0 })
  assert.deepEqual(calculateTimelineEdit(event, 'trim-left', 0.5, 10, 30), { start: 1.5, duration: 1.5 })
  assert.deepEqual(calculateTimelineEdit(event, 'trim-right', 0.5, 10, 30), { duration: 2.5 })
  assert.deepEqual(calculateTimelineEdit(event, 'trim-right', 20, 10, 30), { duration: 9 })
})

test('timeline lane arrangement separates overlaps and packs non-overlapping events', () => {
  const first = { id: 'first', start: 0, duration: 2 }
  const overlap = { id: 'overlap', start: 1, duration: 2 }
  const adjacent = { id: 'adjacent', start: 2, duration: 1 }
  const later = { id: 'later', start: 3, duration: 1 }
  assert.deepEqual(arrangeEventsIntoLanes([later, overlap, first, adjacent]).map(lane => lane.map(event => event.id)), [
    ['first', 'adjacent', 'later'],
    ['overlap'],
  ])
})
