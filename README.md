# KEDIT Studio

KEDIT Studio is a code-friendly editor for manually timed lyric typography and motion graphics. Edit lyric cards directly in the app or edit a JavaScript composition in `src/compositions/library.js`; arrange exact timestamps, overlaps, colors, highlighted words, and reusable animation templates; then render a real H.264 MP4 with your soundtrack.

Music is only a playback reference and export audio track. **There is no beat detection, waveform analysis, or audio-reactive animation.**

## Install and start (Windows)

1. Install [Node.js 20 LTS](https://nodejs.org/) if it is not already installed.
2. Open PowerShell in this project directory and run:

   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```

3. Open the local address printed by Vite, usually `http://127.0.0.1:5173`.

`ffmpeg-static` installs a local FFmpeg binary with the npm dependencies. You do not need to install FFmpeg separately or add it to Windows PATH. The rendering API runs in the Vite development server, so start the app with `npm.cmd run dev` when exporting. MP4 export uses H.264 video and AAC audio, writes temporary image frames to your system temp folder, and removes those files after the export completes. Short lyric edits and 30 fps are a good fit for an 8 GB laptop.

## Make a lyric edit

1. Choose **New composition** or open one of the example edits in the left sidebar.
2. Choose a canvas: vertical 9:16 (1080 × 1920), landscape 16:9 (1920 × 1080), or square 1:1 (1080 × 1080). Select 24, 30, or 60 fps.
3. Select **Choose audio**, then choose your MP3, WAV, M4A, or AAC soundtrack. The player uses the audio clock while it plays.
4. Choose **Add lyric** or select a timeline event. Enter the lyric, set its start and duration in seconds, choose a motion preset or typography template, and adjust font, color, position, and highlighted words. Configure entrance, emphasis, and exit independently. Optionally add a sound effect to an event; it plays at that event's timestamp in preview and is mixed into the MP4. Enter multiple highlighted words separated by commas.
5. Drag the preview playhead or click a timeline event to seek. Overlapping cards play together; timing is always set by you.
6. Press **Export MP4** and wait for frame rendering and FFmpeg encoding to finish. The finished `.mp4` is downloaded by your browser. Export without a soundtrack is also supported.

The browser saves the current composition in local storage. Use **Save JSON** to keep a portable backup or **Import** to restore one on this computer.

## Editing workspace

The inspector is split into **Text**, **Motion**, **Style**, **Audio**, and **Project** tools so controls stay grouped by task. On narrow screens, use the compact tool dock to open these controls as a bottom sheet; use the composition picker in the header to switch edits. The timeline automatically separates overlapping lyrics into readable lanes and shows the music bed and event sound effects on their own tracks. Scroll the timeline horizontally to inspect longer edits.

Motion controls let you choose entrance, emphasis, and exit independently, then tune entrance speed. Style controls include reusable typography presets, font family and weight, highlighting, letter spacing, and horizontal/vertical placement. These settings work in preview and MP4 export.

## Code-first compositions

`src/compositions/_template.js` is a ready-to-edit JavaScript composition. Edit its values, then import it in `src/compositions/library.js` and add it to `COMPOSITIONS` to show it in the sidebar:

```js
{
  id: 'my-lyrics',
  title: 'My Lyrics',
  format: 'vertical', // vertical | landscape | square
  fps: 30,            // 24 | 30 | 60
  duration: 20,
  audio: 'my-song.mp3', // choose the actual local file in the editor
  background: '#09090f',
  events: [
    {
      id: 'line-1',
      start: 0.75,
      duration: 2.4,
      text: 'EVERY EMPIRE STARTS SOMEWHERE',
      highlight: ['EMPIRE'],
      animation: 'slam',
      entrance: 'slam',
      emphasis: 'pulse',
      exit: 'fade',
      soundEffect: 'impact.wav',
      soundEffectGain: 0.8,
      template: 'cinematic',
      color: '#f5f0e7',
      font: 'Arial',
      fontWeight: 800,
      letterSpacing: 0,
      fontSize: 88,
      x: 50, // Horizontal anchor: 0 = left edge, 50 = center, 100 = right edge.
      position: 52, // Vertical anchor as a percentage of the canvas height.
      motionDuration: 0.68, // Entrance travel time in seconds (0.05-3).
      align: 'center',
    },
  ],
}
```

An event's `start` and `duration` are seconds from the start of the edit. Events may overlap. `animation` is a convenient alias for `entrance`; optional `emphasis`, `exit`, and `soundEffect` metadata let you describe the remaining motion/audio fields. After refreshing, select your new edit in the sidebar or composition picker. Soundtrack and effect file paths in JavaScript are labels only: choose the actual local files in the editor. Sound effects must be uploaded again after reloading or importing a composition.

The entrance, emphasis, and exit preset registries are in [`src/engine/animations.js`](./src/engine/animations.js); reusable compositions and styles are in [`src/compositions/library.js`](./src/compositions/library.js); drawing and the timestamp-based preview clock are in [`src/engine/renderer.js`](./src/engine/renderer.js) and [`src/engine/timeline.js`](./src/engine/timeline.js). Add a preset to the registry and renderer to make it available in the editor.

## Checks

```powershell
npm.cmd test
npm.cmd run build
```

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for export and audio setup help.
