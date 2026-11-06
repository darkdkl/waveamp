# Skins

**English** | [Русский](skins.ru.md)

A skin changes how WaveAMP looks: colors, textures, button faces, slider
knobs, icons and the display font. The layout stays the same — sizes,
positions and proportions of the player belong to the program, so every skin
works with the equalizer, the playlist, the radio, the chords, separate
windows and any interface scale.

## Where skins live

Settings → Interface → Skin lists the built-in skin and every skin in the
skins folder; **Open skins folder** opens it. A skin in that folder is either

- a **folder** with `skin.json` and its files — handy while you make a skin;
- a **`.waveskin` file** — the same files packed into a zip, with `skin.json`
  at the top of the archive or inside one folder. Just put the file into the
  skins folder, there is nothing to unpack.

The list follows the folder by itself. While a skin is selected, saving any of
its files applies the change at once, so you can keep the player open next to
your editor. If the selected skin can't be read any more — a broken
`skin.json` or a removed skin — the player switches to the built-in skin; pick
the skin again once it is fixed. With logging on (Settings → System → Logging)
the reason goes to the log.

Every folder and every `.waveskin` is a separate skin, even if two of them
carry the same name.

## The color sliders

A skin sets the base, the color sliders in Settings fine-tune it on top:

- picking a skin moves the sliders to the skin's `accent`, and **Reset**
  goes back to it;
- **Hue** and **Saturation** color the display and the highlights, switched-on
  buttons included;
- **Body color** mixes the hue into the body, buttons, text and knobs colors
  of the skin;
- images are drawn as they are — the sliders don't recolor them; icons take
  the color of the button they are on.

## skin.json

```json
{
  "format": 1,
  "name": "Carbon",
  "author": "Your Name",
  "version": "1.0",
  "accent": { "hue": 134, "saturation": 96, "tint": 0 },
  "colors": { "chrome": "#2a2e35", "button": "#363b43", "outline": "#000" },
  "effects": { "popupShadow": { "x": 0, "y": 6, "blur": 16, "color": "#00000066" } },
  "visualizer": { "peak": "#e06060" },
  "images": {
    "body": "img/body.png",
    "button": { "src": "img/button.png", "slice": 12, "width": 6 }
  },
  "icons": { "play": "icons/play.svg" },
  "fonts": { "display": "fonts/display.woff2" }
}
```

`format` must be `1` and `name` is required; everything else is optional.
Whatever a skin leaves out comes from the built-in skin, and unknown keys are
ignored, so a skin keeps working with newer versions of WaveAMP.

| Key | Meaning |
|---|---|
| `name`, `author`, `version` | shown in the skin list, up to 60 characters each |
| `accent.hue` | 0–359, the hue of the display and highlights |
| `accent.saturation` | 0–100 |
| `accent.tint` | 0–100, how much of the hue goes into the body (the Body color slider) |

### Values

A skin holds plain data, and the player builds the CSS from it itself:

- **a color** is a hex string: `#rgb`, `#rrggbb`, or with transparency `#rgba`
  and `#rrggbbaa`, where `00` is transparent and `ff` opaque. Anything else,
  like `rgb()` or color names, is skipped;
- **a shadow** is an object with `x`, `y`, `blur` and `spread` in pixels and a
  `color`, for example `{ "x": 0, "y": 6, "blur": 16, "color": "#00000066" }`.
  A number left out is `0`; `x`, `y` and `spread` stay within ±32, `blur`
  within 0–64. `false` removes the shadow. Whether a shadow falls inside is
  up to its key;
- **a gradient** (only `coverShade`) is a list of 2 to 8 stops from left to
  right, with `at` in percent:
  `[{ "color": "#060a08d9", "at": 0 }, { "color": "#060a0873", "at": 100 }]`.

A value that doesn't fit is skipped, and its key goes to the log when logging
is on; the rest of the skin still works.

### colors

| Key | Where it shows | Default |
|---|---|---|
| `chrome` | top of the body gradient, the Settings window | `#2a2e35` |
| `chromeDark` | bottom of the body gradient, window background, menus | `#16181c` |
| `chromeEdge` | the outer border of the body (hidden in the desktop window) | `#3f434c` |
| `button` | buttons | `#363b43` |
| `buttonHover` | a hovered button | `#454b55` |
| `buttonActive` | a pressed or switched-on button | `#21252b` |
| `well` | slider tracks, scroll bar tracks, switches | `#0d0f12` |
| `well2` | the lighter side of slider tracks, hovered switches | `#1c1f24` |
| `text` | text | `#dfe3e8` |
| `text2` | playlist and station names | `#c7ccd2` |
| `textMuted` | section titles, labels, numbers | `#9aa0a8` |
| `knob` | slider knobs, scroll bar thumbs and switches, light side | `#eef1f4` |
| `knobShade` | the same, dark side | `#b9bfc7` |
| `knobHover` | a hovered scroll bar thumb | `#fff` |
| `outline` | thin borders around controls, lists and the display | `#000` |
| `separator` | lines under the title bar and the controls | `#ffffff0f` |
| `rowHover` | a hovered row in the playlist and the radio | `#ffffff0f` |
| `menuHover` | a hovered menu item | `#ffffff14` |
| `divider` | menu separators, the line after the preamp | `#ffffff14` |
| `listBackground` | the background of lists and Settings cards | `#0000002e` |
| `selectedText` | the selected item in a drop-down list | `#fff` |
| `danger` | the hovered ✕ that removes a track | `#e06060` |
| `dangerBackground` | behind that ✕ | `#e0606026` |
| `closeHover` | the hovered close button of a window | `#b03a3a` |
| `errorText` | error messages in forms | `#e77474` |
| `warning` | hotkey conflicts in Settings | `#e8b25c` |
| `warningEdge` | the border of such a hotkey | `#c98a2e` |
| `stageBackground` | the full-size visualizer picture | `#000` |
| `stageEdge` | its edge and button borders | `#00000099` |
| `stageBar` | the shade under its button bar | `#000000b3` |
| `stageText` | the preset name and the lock icon on it | `#e3ebe3` |
| `stageButton` | its buttons | `#14181cb3` |
| `stageButtonText` | the icons on its buttons | `#dfe6df` |

### effects

| Key | Where it shows | Default |
|---|---|---|
| `knobShadow` | under slider knobs and switches | `{ "y": 1, "blur": 2, "color": "#00000080" }` |
| `listInset` | the inner shadow of lists | `{ "y": 2, "blur": 6, "color": "#00000073" }` |
| `displayInset` | the inner shadow of the display and the chords screen | `{ "y": 2, "blur": 6, "color": "#00000099" }` |
| `popupShadow` | menus and the station form | `{ "y": 6, "blur": 16, "color": "#00000066" }` |
| `pickerShadow` | open drop-down lists | `{ "y": 10, "blur": 28, "color": "#00000099" }` |
| `coverShade` | the gradient that dims the album cover on the display | `#060a08d9` at 0, `#060a08b3` at 55, `#060a0873` at 100 |

### visualizer

The LED spectrum, the needle meters and the oscilloscope. By default they use
the display colors.

| Key | Meaning |
|---|---|
| `foreground` | lit spectrum segments, the needles, the wave |
| `dim` | the meter scales and their L / R labels |
| `off` | unlit spectrum segments |
| `glow` | the glow around lit segments |
| `peak` | the red zone of the needle meters, above 0 dB |

### images

PNG, WebP, JPEG or SVG, up to 2 MB each. A path is relative to `skin.json`
and has to stay inside the skin: no `..`, no absolute paths, no `\`.

| Slot | What it is |
|---|---|
| `body` | a texture over the body, under everything else |
| `display` | a texture over the display and the chords screen, under their text |
| `button` | the face of buttons |
| `buttonHover` | a hovered button (optional, `button` otherwise) |
| `buttonPressed` | a pressed button (optional) |
| `buttonOn` | a switched-on button, like an open equalizer (optional) |
| `knob` | slider knobs, stretched to the knob size (14 × 14 px) |

An image is a path, or an object:

| Field | Meaning |
|---|---|
| `src` | the path |
| `repeat` | `true` tiles the image, `false` stretches it over the area; textures tile by default |
| `slice` | for button faces: the width of the edges, in pixels of the image. The corners keep their shape, the edges and the middle stretch to the button size |
| `width` | for button faces: how wide the edges are on screen, in pixels; the same as `slice` by default. For an image drawn at double size use half of `slice` |

A button face replaces the button's own background and border, so draw the
border and the rounded corners into the image; keep the corners transparent
outside the rounding.

### icons

SVG or PNG, up to 256 KB each. An icon is a shape: the player uses its
outline (the alpha channel) and paints it with the button's color, so icons
follow the color sliders and the highlight of switched-on buttons. Draw them
in one color on a transparent background, square, like 24 × 24.

| Slot | Button |
|---|---|
| `previous`, `play`, `pause`, `stop`, `next` | the transport |
| `volume` | the speaker next to the volume slider |
| `eq`, `radio`, `playlist`, `chords` | the panel buttons |
| `settings` | the gear in the title bar |
| `reset` | the equalizer reset |
| `search` | search in the playlist and the radio |
| `folder` | Add to playlist |
| `add` | Add station |
| `favorites`, `saved` | the radio's favorites and saved titles |
| `filter` | the radio filters |
| `up`, `down` | previous and next match in the playlist search |
| `popout` | the chords window button |
| `more` | the menu of saved titles |

Buttons without an icon in the skin keep the built-in one.

### fonts

| Slot | Where it shows |
|---|---|
| `display` | the clock, the title and the info line of the display, the chords screen, the equalizer values, the search fields |

WOFF2, WOFF, TTF or OTF, up to 2 MB. Check that the font's license allows you
to share it in a skin.

## Limits

- `skin.json`: up to 64 KB;
- all images, icons and fonts of a skin: up to 8 MB together;
- a `.waveskin` file: up to 16 MB and 300 files.

Anything over a limit is skipped (and written to the log, when logging is on);
the rest of the skin still works.

## Packing a .waveskin

Put `skin.json` and the folders it refers to into a zip, either at the top or
inside one folder, and rename the archive to `name.waveskin`. Files like
`.DS_Store` and `__MACOSX` are ignored.
