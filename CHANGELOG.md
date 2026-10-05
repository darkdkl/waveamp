# Changelog

All notable changes to WaveAMP are documented here. The project follows
[Semantic Versioning](https://semver.org/): new features bump the minor
version, fixes bump the patch version.

## [1.15.1] — 2026-10-05

### Fixed
- The radio filters list every country and region alphabetically in a
  scrollable list
- The playlist and radio lists can't be made shorter than four stations

## [1.15.0] — 2026-10-05

### Added
- A new built-in visualizer preset, Fire: flames that rise higher where the
  music is louder — low notes on the left, high notes on the right — with
  sparks and a flare on the beat

## [1.14.0] — 2026-10-05

### Changed
- The presets mode always starts with the LED Spectrum preset

## [1.13.3] — 2026-10-04

### Changed
- Test builds report a -test version everywhere, so they can't be mistaken for
  a release, and offer the release of the same version as an update

## [1.13.2] — 2026-10-04

### Changed
- The Starship preset runs smoothly in full screen, with a steel ship, grey
  rocks and distant stars behind the nebula; the engine flame follows the bass

## [1.13.1] — 2026-10-04

### Changed
- The spectrum and the VU meters are less sensitive and no longer pin on loud
  tracks

## [1.13.0] — 2026-10-03

### Added
- New built-in visualizer presets: Starship, a neon ship flying into a nebula
  past meteors and speeding up on the beat, and Logo, the WaveAMP sliders
  moving with the bass, mids and treble over a glowing waveform

### Changed
- A new app icon and title mark: the three sliders now form a play sign
- The LED Spectrum preset moves more smoothly

## [1.12.0] — 2026-10-03

### Added
- A Slow visualizer response in Settings; the former Smooth response is now
  called Medium

### Changed
- All visualizers show the sound before the equalizer and the preamp

## [1.11.0] — 2026-10-03

### Changed
- The built-in visualizer presets are now WaveAMP's own. Any folder of
  MilkDrop presets (`.milk`) can still be added in Settings; the README links
  a large free collection

## [1.10.0] — 2026-10-03

### Added
- Visualizer presets in full screen: the ⤢ button, F or a double click on the
  picture; Esc, F or a double click leave it. The cursor and the preset bar
  hide after a few seconds without mouse movement

## [1.9.0] — 2026-10-03

### Added
- Visualizer presets: the fourth visualizer mode opens the display into a
  large picture powered by projectM, compatible with MilkDrop presets — a
  built-in selection plus your own folder and automatic changes

### Changed
- "Saved tracks" in the radio panel is now "Track titles" (tooltip "Saved track
  titles"): it keeps titles, not the tracks themselves

## [1.8.0] — 2026-10-03

### Added
- The Settings window has a handle at the bottom, like the lists in the player
  window, to drag its height

### Changed
- The Settings window keeps a fixed width; only its height can be changed

## [1.7.0] — 2026-10-03

### Added
- The display shows whether playback is playing, paused or stopped, next to
  the track length or LIVE; the Play or Pause button lights up accordingly
- The Settings button stays pressed while Settings is open and closes it when
  clicked again
- Settings → Interface → "Window buttons": left or right. Defaults to the left
  on macOS and to the right on Windows and Linux

### Changed
- The clock on the display is slightly dimmer than the track time

### Fixed
- The mark before the player name in the title bar sat below the text; it now
  matches the height of the letters

## [1.6.1] — 2026-10-02

### Fixed
- Hotkeys work again after clicking the volume or seek slider
- Play with an empty playlist opens the file picker, like Space
- A station whose logo fails to load shows its letter instead of an empty box
- Radio on pause or while connecting: LIVE dims and the last track title and
  the bookmark are hidden, so an outdated track can't be saved

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
