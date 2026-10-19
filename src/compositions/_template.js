export default {
  id: 'my-lyrics',
  title: 'My Lyrics',
  format: 'vertical',
  fps: 30,
  duration: 20,
  audio: '',
  background: '#09090f',
  events: [
    {
      id: 'line-1',
      start: 0.75,
      duration: 2.4,
      text: 'EVERY EMPIRE STARTS SOMEWHERE',
      highlight: ['EMPIRE'],
      animation: 'slam',
      template: 'cinematic',
      color: '#f5f0e7',
      font: 'Arial',
      fontWeight: 800,
      letterSpacing: 0,
      fontSize: 88,
      x: 50, // Horizontal anchor: 0 = left edge, 50 = center, 100 = right edge.
      position: 52,
      motionDuration: 0.68, // Entrance travel time in seconds (0.05-3).
      align: 'center',
    },
  ],
}
