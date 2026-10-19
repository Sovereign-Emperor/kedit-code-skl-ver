const common = {
  format: 'vertical',
  fps: 30,
  duration: 18,
  audio: '',
  background: '#09090f',
}

export const COMPOSITIONS = [
  {
    ...common,
    id: 'discipline',
    title: 'Built by discipline',
    events: [
      { id: 'discipline-1', start: 0.5, duration: 2.5, text: 'THE EMPIRE WITHIN', animation: 'slam', template: 'cinematic', highlight: ['EMPIRE'], color: '#f5f0e7', fontSize: 88, position: 47, align: 'center' },
      { id: 'discipline-2', start: 3.2, duration: 3.4, text: 'IS BUILT IN SILENCE', animation: 'tracking-reveal', template: 'minimal', highlight: ['SILENCE'], color: '#e7e1d7', fontSize: 84, position: 55, align: 'center' },
      { id: 'discipline-3', start: 7.1, duration: 3.5, text: 'CONSISTENCY OUTLASTS MOTIVATION', animation: 'word-by-word', template: 'editorial', highlight: ['CONSISTENCY'], color: '#f5f0e7', fontSize: 72, position: 50, align: 'center' },
      { id: 'discipline-4', start: 11.2, duration: 3.1, text: 'BECOME UNSTOPPABLE.', animation: 'punch-in', template: 'gold', highlight: ['UNSTOPPABLE.'], color: '#ffffff', fontSize: 94, position: 53, align: 'center' },
      { id: 'discipline-5', start: 14.8, duration: 2.4, text: 'SOVEREIGN EMPEROR', animation: 'fade', template: 'minimal', highlight: ['EMPEROR'], color: '#e5c268', fontSize: 56, position: 50, align: 'center' },
    ],
  },
  {
    ...common,
    id: 'own-your-time',
    title: 'Own your time',
    duration: 15,
    events: [
      { id: 'time-1', start: 0, duration: 3, text: 'YOUR TIME IS', animation: 'typewriter', template: 'editorial', highlight: [], color: '#f5f0e7', fontSize: 90, position: 48, align: 'center' },
      { id: 'time-2', start: 3.4, duration: 3.2, text: 'YOUR MOST PRECIOUS CURRENCY', animation: 'mask-reveal', template: 'cinematic', highlight: ['CURRENCY'], color: '#f5f0e7', fontSize: 70, position: 51, align: 'center' },
      { id: 'time-3', start: 7, duration: 3, text: 'INVEST IT WISELY', animation: 'zoom', template: 'gold', highlight: ['WISELY'], color: '#ffffff', fontSize: 90, position: 50, align: 'center' },
      { id: 'time-4', start: 10.5, duration: 3.5, text: 'THERE IS NO REWIND.', animation: 'split-text', template: 'minimal', highlight: ['NO'], color: '#f5f0e7', fontSize: 78, position: 53, align: 'center' },
    ],
  },
]

export const TEMPLATES = [
  { id: 'cinematic', name: 'Cinematic', animation: 'slam', color: '#f5f0e7', font: 'Arial', fontWeight: 800, letterSpacing: 0, sample: 'MAKE IT', description: 'Bold & dramatic' },
  { id: 'minimal', name: 'Minimal', animation: 'fade', color: '#f5f0e7', font: 'Arial', fontWeight: 500, letterSpacing: 1, sample: 'LESS,', description: 'Quiet confidence' },
  { id: 'editorial', name: 'Editorial', animation: 'tracking-reveal', color: '#e7e1d7', font: 'Georgia', fontWeight: 600, letterSpacing: 2, sample: 'THE WORD', description: 'Refined spacing' },
  { id: 'gold', name: 'Gilded', animation: 'punch-in', color: '#e5c268', font: 'Arial', fontWeight: 900, letterSpacing: 1, sample: 'RISE', description: 'Royal gold accent' },
  { id: 'signal', name: 'Signal', animation: 'glitch', color: '#f5f0e7', font: 'Arial', fontWeight: 800, letterSpacing: 0, sample: 'NO STATIC', description: 'Controlled distortion' },
  { id: 'kinetic', name: 'Kinetic', animation: 'word-by-word', color: '#f5f0e7', font: 'Arial', fontWeight: 900, letterSpacing: 0, sample: 'KEEP MOVING', description: 'Rhythmic reveals' },
  { id: 'typewriter', name: 'Typewriter', animation: 'typewriter', color: '#f5f0e7', font: 'Courier New', fontWeight: 600, letterSpacing: 0, sample: 'WRITE IT', description: 'Character by character' },
  { id: 'wipe', name: 'Wipe', animation: 'directional-wipe', color: '#f5f0e7', font: 'Arial', fontWeight: 800, letterSpacing: 0, sample: 'A NEW ERA', description: 'Clean masked reveal' },
]

export function createLyric(start = 0, duration = 2.5) {
  return {
    id: `lyric-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    start: Math.round(start * 100) / 100,
    duration,
    text: '',
    animation: 'slam',
    entrance: 'slam',
    emphasis: 'none',
    exit: 'fade',
    template: 'cinematic',
    fontWeight: 800,
    letterSpacing: 0,
    highlight: [],
    color: '#f5f0e7',
    font: 'Arial',
    fontSize: 88,
    position: 52,
    align: 'center',
  }
}
