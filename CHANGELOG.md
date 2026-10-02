# Changelog

All notable changes to WaveAMP are documented here. The project follows
[Semantic Versioning](https://semver.org/): new features bump the minor
version, fixes bump the patch version.

## [1.6.0] — 2026-10-02

### Added
- Radio: the display shows a clock instead of "--:--"
- Settings → Interface → "Clock in player mode": during playback the track
  time alternates with the clock

## [1.5.0] — 2026-10-02

### Added
- Radio: the display shows the track playing on the station; the bookmark next
  to it (or H) saves the track to the new "Saved tracks" list in the radio panel

## [1.4.1] — 2026-10-02

### Fixed
- Opening and closing the EQ, playlist and radio panels no longer stutters
  during playback on macOS: the spectrum is now drawn on a canvas instead of
  hundreds of page elements, and the window uses the system's own resize
  animation

## [1.4.0] — 2026-10-02

### Added
- Cover art: the album cover — embedded in the file, or `cover`, `folder`,
  `front` or `album` .jpg/.png next to it — shows dimmed behind the display;
  for radio it is the station's logo. Settings → Interface → "Cover art on
  display" turns it off. The system "Now Playing" shows the cover too

### Development
- TypeScript strict mode is on for the whole codebase

## [1.3.3] — 2026-10-02

### Fixed
- The player and Settings windows appear already in the saved look (color,
  language, scale, open panels) instead of flashing the defaults first
- The check for updates on launch now runs once the window is shown and the
  proxy is applied; on macOS its dialog is a standalone window, so it is no
  longer lost on the frameless player. Each step is written to the log
- The EQ On/Off button keeps the right text after switching the language
- The time display resets when the playlist is cleared
- Previous skips over unplayable tracks backwards instead of bouncing forward

### Development
- The source is now TypeScript, built with electron-vite (Vite); `npm run dev`
  starts the app with hot reload
- The player and the main process are split into focused modules, with all
  IPC handlers in one place
- 121 unit tests

## [1.3.2] — 2026-10-02

### Security
- Radio stream addresses are checked right before playback: only http and
  https links are opened, and favorites with any other scheme are dropped
  when the config is loaded

### Development
- Unit tests (Vitest) and a check that runs on every pull request
- Merging without a version bump no longer re-publishes the current release

## [1.3.1] — 2026-10-01

### Fixed
- Files that can't be played (broken, missing or in an unsupported format)
  are struck through in the playlist and skipped instead of stopping playback
- WMA, APE, MIDI, AIFF, AMR, WavPack and Musepack files are no longer added
  to the playlist, since they can't be played

## [1.3.0] — 2026-10-01

### Added
- Add a radio station by hand: the + button in the radio panel takes a name
  and a stream URL and saves the station straight to Favorites. Links to
  .pls and .m3u playlists are resolved to the stream address. Stations
  added this way can be edited with the ✎ button
- "Add radio station" hotkey action (unassigned by default, set it in
  Settings → Hotkeys)

## [1.2.0] — 2026-10-01

### Changed
- Updates are no longer downloaded and installed automatically (installing
  failed on the unsigned macOS build). On launch WaveAMP checks for a new
  version and offers Download (opens the release page), Later or Skip this
  version; Settings → System → Updates shows the same link
- The electron-updater dependency is gone

## [1.1.0] — 2026-10-01

### Changed
- The Settings window follows the UI scale, both its content and its size
- More compact default size; scale steps are 70–150% in 10% steps

## [1.0.0] — 2026-10-01

First public release.

### Player
- Local playback with a resizable playlist, drag & drop and auto-advance
- "Artist — Title" and durations from file tags (ID3, FLAC/Vorbis, MP4 and
  more); repairs legacy cp1251 and mis-decoded UTF-8 tags
- 10-band equalizer with preamp, 18 presets with automatic preamp headroom and
  a remembered Custom preset
- Visualizer modes in the LCD — LED spectrum, L/R needle meters, oscilloscope —
  with smooth or peak response

### Internet radio
- Station search via the Radio Browser API with country, region and genre
  filters, and favorites
- HTTP / SOCKS5 proxy support

### Desktop integration
- Media keys and system Now Playing
- Configurable hotkeys, optional global hotkeys
- Tray icon and close-to-tray
- Automatic updates from GitHub Releases

### Interface
- Color schemes with hue, saturation and body color
- English and Russian, adjustable UI scale, state restored on launch

[1.2.0]: https://github.com/darkdkl/waveamp/releases/tag/v1.2.0
[1.1.0]: https://github.com/darkdkl/waveamp/releases/tag/v1.1.0
[1.0.0]: https://github.com/darkdkl/waveamp/releases/tag/v1.0.0
