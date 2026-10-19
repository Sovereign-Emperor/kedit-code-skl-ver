import { gsap } from 'gsap'

export function createTimelineController({ duration, audio, onUpdate, onPlaybackChange }) {
  const clock = { time: 0 }
  const timeline = gsap.timeline({ paused: true, onUpdate: () => onUpdate(clock.time) })
  timeline.to(clock, { time: duration, duration, ease: 'none' })
  let playing = false
  let previousTick = 0

  const tick = () => {
    if (!playing) return
    if (audio) {
      if (!audio.paused && Number.isFinite(audio.currentTime)) {
        timeline.time(Math.min(duration, audio.currentTime), false)
        if (audio.currentTime >= duration) pause()
      } else if (audio.ended) pause()
    } else {
      const now = performance.now()
      if (previousTick) timeline.time(Math.min(duration, timeline.time() + (now - previousTick) / 1000), false)
      previousTick = now
      if (timeline.time() >= duration) pause()
    }
  }
  const pause = () => {
    if (!playing) return
    playing = false
    gsap.ticker.remove(tick)
    audio?.pause()
    previousTick = 0
    onPlaybackChange(false)
  }
  const play = async () => {
    if (timeline.time() >= duration) timeline.time(0)
    if (audio) {
      audio.currentTime = Number.isFinite(audio.duration) ? Math.min(timeline.time(), audio.duration) : timeline.time()
      await audio.play()
    }
    if (playing) return
    playing = true
    previousTick = 0
    gsap.ticker.add(tick)
    onPlaybackChange(true)
  }
  return {
    seek(value) {
      const time = Math.max(0, Math.min(duration, value))
      timeline.time(time)
      if (audio && Number.isFinite(audio.duration)) audio.currentTime = Math.min(time, audio.duration)
    },
    async toggle() { if (playing) pause(); else await play() },
    pause,
    destroy() { pause(); timeline.kill() },
  }
}
