export const ANIMATIONS = {
  fade: { label: 'Soft fade', ease: 'power2.out', movement: 'fade' },
  zoom: { label: 'Slow zoom', ease: 'power2.out', movement: 'zoom' },
  slam: { label: 'Cinematic slam', ease: 'back.out(1.7)', movement: 'slam' },
  'punch-in': { label: 'Punch in', ease: 'back.out(2.8)', movement: 'punch' },
  slide: { label: 'Side slide', ease: 'expo.out', movement: 'slide' },
  bounce: { label: 'Gentle bounce', ease: 'bounce.out', movement: 'bounce' },
  'blur-reveal': { label: 'Blur reveal', ease: 'power3.out', movement: 'blur' },
  glitch: { label: 'Signal glitch', ease: 'power1.out', movement: 'glitch' },
  'tracking-reveal': { label: 'Tracking reveal', ease: 'power2.out', movement: 'tracking' },
  'word-by-word': { label: 'Word by word', ease: 'power2.out', movement: 'words' },
  'character-by-character': { label: 'Character build', ease: 'power2.out', movement: 'characters' },
  typewriter: { label: 'Typewriter', ease: 'none', movement: 'typewriter' },
  'mask-reveal': { label: 'Mask reveal', ease: 'power3.out', movement: 'mask' },
  'split-text': { label: 'Split lines', ease: 'power3.out', movement: 'split' },
  'kinetic-emphasis': { label: 'Kinetic emphasis', ease: 'back.out(2)', movement: 'emphasis' },
  'directional-wipe': { label: 'Directional wipe', ease: 'power3.inOut', movement: 'wipe' },
  'rapid-cut': { label: 'Rapid cut', ease: 'none', movement: 'rapid' },
}

export const ANIMATION_CATEGORIES = [
  { label: 'CINEMATIC', items: ['fade', 'zoom', 'slam', 'punch-in', 'slide', 'bounce', 'blur-reveal'] },
  { label: 'TYPOGRAPHY', items: ['tracking-reveal', 'word-by-word', 'character-by-character', 'typewriter', 'mask-reveal', 'split-text'] },
  { label: 'ENERGY', items: ['glitch', 'kinetic-emphasis', 'directional-wipe', 'rapid-cut'] },
]

export const EMPHASIS_ANIMATIONS = {
  none: 'None',
  pulse: 'Kinetic pulse',
  glow: 'Accent glow',
  glitch: 'Glitch accent',
}

export const EXIT_ANIMATIONS = {
  none: 'None',
  fade: 'Soft fade',
  'zoom-out': 'Zoom away',
  'slide-out': 'Slide away',
  'glitch-out': 'Glitch out',
}

export const TRANSITIONS = {
  cut: { label: 'Hard cut', movement: 'cut' },
  dissolve: { label: 'Cross dissolve', movement: 'dissolve' },
  'wipe-left': { label: 'Wipe from left', movement: 'wipe-left' },
  'wipe-right': { label: 'Wipe from right', movement: 'wipe-right' },
  'push-left': { label: 'Push left', movement: 'push-left' },
  'push-right': { label: 'Push right', movement: 'push-right' },
  'zoom-through': { label: 'Zoom through', movement: 'zoom-through' },
  glitch: { label: 'Glitch cut', movement: 'glitch' },
}

export const resolveEase = name => gsap.parseEase(name) || gsap.parseEase('power2.out')
import { gsap } from 'gsap'
