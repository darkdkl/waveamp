# WaveAMP

**English** | [Русский](README.ru.md)

A retro-style desktop audio player with internet radio, in the spirit of
classic Winamp: dark chrome, a glowing LCD and a real 10-band equalizer.
Runs on macOS, Windows and Linux.

<p align="center">
  <img src="docs/header.png" alt="WaveAMP in its eight built-in color schemes" width="100%" />
</p>

<p align="center">
  <img src="docs/presets.png" alt="Visualizer presets in the display" width="400" />
  <img src="docs/radio.png" alt="Radio: the station's current track and saved track titles" width="400" />
</p>

<p align="center">
  <img src="docs/player.png" alt="Equalizer and playlist with cover art" width="400" />
  <img src="docs/settings.png" alt="Settings" width="373" />
</p>

## Features

- **Player** — play, pause, stop, seeking and volume; add local files with a
  button or drag & drop
- **Playlist** — resizable, plays through to the next track automatically
- **Tags** — "Artist — Title" and duration from file tags (ID3, FLAC/Vorbis,
  MP4 and more); legacy Cyrillic (cp1251) and mis-decoded UTF-8 tags are
  repaired
- **Cover art** — the album cover (embedded in the file or `cover.jpg` /
  `folder.jpg` next to it) or the radio station's logo shows dimmed behind the
  display and in the system "Now Playing"; can be turned off in Settings
- **Equalizer** — 10 bands (60 Hz–16 kHz) plus preamp, real audio processing
  through the Web Audio API. 18 presets based on the classic Winamp presets,
  with automatic preamp headroom, and a Custom preset that remembers your own
  settings
- **Visualizer** — modes in the LCD, switched by clicking it: LED
  spectrum, L/R needle meters and an oscilloscope. Smooth or peak response.
  Shows the actual signal, independent of the volume
- **Visualizer presets** — the fourth mode opens the display into a large
  picture powered by [projectM](https://github.com/projectM-visualizer/projectm),
  compatible with MilkDrop presets (`.milk`): WaveAMP's own built-in presets plus
  any folder of `.milk` files, automatic changes, full screen

  <img src="docs/presets.gif" alt="Visualizer presets changing" width="420" />

- **Internet radio** — station search through the
  [Radio Browser API](https://www.radio-browser.info/) with country, region
  and genre filters, plus favorites. Stations can also be added by hand from a
  stream URL or a .pls/.m3u link. The equalizer and visualizer work on radio
  streams too
- **Saved track titles** — the display shows the track playing on the station;
  save the titles you like to a list and copy them
- **Clock** on the display for radio, and optionally alternating with the track
  time during playback
- **Color scheme** — presets plus hue, saturation and body color sliders
- **Hotkeys** — configurable shortcuts that work on any keyboard layout, with
  optional global hotkeys
- **Media keys and system Now Playing** (macOS Control Center, Windows media
  overlay)
- **Tray icon** with an optional close-to-tray mode
- **HTTP / SOCKS5 proxy** for the radio
- **Update check** — tells you when a new version is out, with a link to its
  download page
- **English and Russian interface**, adjustable UI scale; your playlist,
  equalizer, favorites and layout are restored on the next launch

## Download

Installers are on the [Releases](https://github.com/darkdkl/waveamp/releases/latest)
page; every update of `main` is built and published automatically.

| System | File |
|---|---|
| macOS 13+ (Apple Silicon) | `WaveAMP-<version>-arm64.dmg` |
| Windows 10/11 (x64) | `WaveAMP-Setup-<version>.exe` |
| Linux (x64) | `WaveAMP-<version>.AppImage` |
| Linux (ARM64) | `WaveAMP-<version>-arm64.AppImage` |

The builds aren't signed with a developer certificate, so the system warns
about an unknown publisher on first launch:

- **macOS**: drag WaveAMP to Applications, then clear the quarantine flag macOS
  puts on downloaded files — run in Terminal:

  ```bash
  xattr -cr /Applications/WaveAMP.app
  ```

  Without it macOS may say the app "is damaged" or "can't be verified".
  Alternatively, try to open the app, then go to System Settings → Privacy &
  Security → "Open Anyway".
- **Windows**: "More info" → "Run anyway" in the SmartScreen dialog
- **Linux**: `chmod +x WaveAMP-*.AppImage` before running

## Building from source

TypeScript without UI frameworks, built with [electron-vite](https://electron-vite.org/)
(Vite) and tested with Vitest. Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

`npm run dev` starts the app with hot reload; `npm start` runs a production build.

Checks:

```bash
npm run typecheck
npm test
```

Installers:

```bash
npm run build:mac
npm run build:linux
npm run build:win
```

## Feedback

Bug reports and ideas are welcome in [Issues](https://github.com/darkdkl/waveamp/issues) —
see [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## Third-party libraries

- [Electron](https://www.electronjs.org/) — desktop shell (MIT; Chromium and its
  components under their own licenses)
- [music-metadata](https://github.com/Borewit/music-metadata) — audio file tags
  (MIT)
- [projectM](https://github.com/projectM-visualizer/projectm) — the visualizer
  presets engine, compiled to WebAssembly (LGPL-2.1)

The full list with license texts is generated into `THIRD_PARTY_LICENSES.txt`
before every run and build (`npm run licenses`), shipped next to the app and
opened from Settings → System → About.

## License

Copyright © 2026 Dark.Dmake

WaveAMP is free software: you can redistribute it and/or modify it under the
terms of the [GNU General Public License](LICENSE), version 3 or (at your
option) any later version. It comes with no warranty — see the license text.

## Trademarks

Winamp is a trademark of its respective owner. WaveAMP is an independent
project, not affiliated with or endorsed by the owner of Winamp; Winamp is
mentioned here only to describe the player's style and the origin of the
equalizer presets. MilkDrop is mentioned only to name the visualizer preset
format (`.milk`) that projectM supports.

## Acknowledgements

Internet radio in WaveAMP is powered by [Radio Browser](https://www.radio-browser.info/) —
a free, non-commercial station database kept running by volunteers who host
its API mirrors at their own expense. Thank you for making it exist and keeping
it open.

The visualizer presets run on [projectM](https://github.com/projectM-visualizer/projectm) —
the open-source reimplementation of MilkDrop that its team has been developing
for years. Thank you to the projectM developers and to Ryan Geiss for the
original MilkDrop. For thousands more presets, download the
["Cream of the Crop"](https://github.com/projectM-visualizer/presets-cream-of-the-crop)
collection curated by ISOSCELES and choose its folder in Settings → Interface →
Visualization.
