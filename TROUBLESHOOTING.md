# Troubleshooting

## Export is unavailable or the server reports a missing FFmpeg binary

Run `npm.cmd install` from the project folder and restart `npm.cmd run dev`. The project uses the installed `ffmpeg-static` binary; a separate FFmpeg installation or PATH change is not required.

## The export fails with an FFmpeg audio/decoder error

The chosen audio file must be a readable MP3, WAV, M4A, or AAC file. Some protected, damaged, or uncommon codecs cannot be decoded. Try a standard MP3 or PCM WAV export of the soundtrack. The error panel includes FFmpeg's diagnostic output.

An edit can contain up to eight separately uploaded sound effects, each up to 25 MB. Effects are placed at their lyric event's start time, mixed with the soundtrack, and must be uploaded again after reloading a saved composition.

## There is no sound in the preview

Press Play to start browser audio (browsers block autoplay), check the system volume, and confirm the selected file is a supported audio file. The preview uses the soundtrack as its clock; it does not detect beats or alter the animation based on sound.

## MP4 rendering is slow or disk space is low

KEDIT renders each frame at the selected output resolution, then encodes the image sequence with FFmpeg. On an 8 GB laptop, start with a 10–30 second edit at 24 or 30 fps and close memory-heavy applications. Frame images are written to the Windows temporary directory during export and deleted after success or failure. Allow temporary disk space for the image sequence and final MP4.

## My changes disappeared

Autosave uses the current browser's local storage and is not shared across browsers or Windows accounts. Before clearing browser data, use **Save JSON** to export a portable composition backup and **Import** to restore it.

## The dev server is already in use

Stop the other Vite process or run `npm.cmd run dev -- --port 5174`, then open the URL Vite prints. Keep the same process running while exporting so its local rendering API stays available.
