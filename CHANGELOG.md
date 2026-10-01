# Changelog

All notable changes to WaveAMP are documented here. The project follows
[Semantic Versioning](https://semver.org/): new features bump the minor
version, fixes bump the patch version.

## [1.3.0] — 2026-10-01

### Added
- Add a radio station by hand: the + button in the radio panel takes a name
  and a stream URL and saves the station straight to Favorites. Links to
  .pls and .m3u playlists are resolved to the stream address. Stations
  added this way can be edited with the ✎ button

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
