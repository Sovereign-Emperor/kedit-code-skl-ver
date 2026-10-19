import test from 'node:test'
import assert from 'node:assert/strict'
import { ANIMATIONS, EMPHASIS_ANIMATIONS, EXIT_ANIMATIONS } from '../src/engine/animations.js'
import { COMPOSITIONS, createLyric } from '../src/compositions/library.js'
import { drawCompositionFrame } from '../src/engine/renderer.js'
import { FORMATS, validateComposition } from '../src/engine/schema.js'

test('the example compositions meet the supported schema', () => {
  for (const composition of COMPOSITIONS) assert.equal(validateComposition(composition), null)
})

test('the animation registry includes all of the requested reusable motion families', () => {
  for (const preset of ['fade', 'zoom', 'slam', 'punch-in', 'slide', 'bounce', 'blur-reveal', 'glitch', 'tracking-reveal', 'word-by-word', 'character-by-character', 'typewriter', 'mask-reveal', 'split-text', 'kinetic-emphasis', 'directional-wipe', 'rapid-cut']) {
    assert.ok(ANIMATIONS[preset], `Missing preset: ${preset}`)
  }
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

test('the frame renderer draws overlapping timestamped text on a canvas context', () => {
  let textDrawn = 0
  const context = {
    clearRect() {}, fillRect() {}, save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() {},
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
    clearRect() {}, fillRect() {}, save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() {},
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
  assert.equal(validateComposition({ ...COMPOSITIONS[0], events: [lyric] }), null)
})

test('composition validation rejects malformed highlight and effect gain data', () => {
  const invalid = structuredClone(COMPOSITIONS[0])
  invalid.events[0].highlight = 'EMPIRE'
  invalid.events[0].soundEffectGain = 3
  const messages = validateComposition(invalid, { returnErrors: true }).map(error => error.message)
  assert.ok(messages.some(message => /highlights must be an array/.test(message)))
  assert.ok(messages.some(message => /sound effect gain/.test(message)))
})
