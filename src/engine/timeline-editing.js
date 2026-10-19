export function arrangeEventsIntoLanes(events) {
  const lanes = []
  for (const event of [...events].sort((a, b) => a.start - b.start)) {
    const lane = lanes.find(items => items.at(-1).start + items.at(-1).duration <= event.start)
    if (lane) lane.push(event)
    else lanes.push([event])
  }
  return lanes
}

export function calculateTimelineEdit(event, mode, deltaSeconds, compositionDuration, fps) {
  const snap = value => Math.round(value * fps) / fps
  if (mode === 'move') {
    return { start: Math.max(0, Math.min(compositionDuration - event.duration, snap(event.start + deltaSeconds))) }
  }
  if (mode === 'trim-left') {
    const end = event.start + event.duration
    const start = Math.max(0, Math.min(end - 0.15, snap(event.start + deltaSeconds)))
    return { start, duration: end - start }
  }
  if (mode === 'trim-right') {
    const duration = Math.max(0.15, Math.min(compositionDuration - event.start, snap(event.duration + deltaSeconds)))
    return { duration }
  }
  throw new Error(`Unsupported timeline edit mode: ${mode}`)
}
