import {
  SKIN_ICON_SLOTS,
  SKIN_TOKEN_PROPERTIES,
  skinEntries,
  type SkinAssets,
  type SkinFont,
  type SkinImageSlot,
  type SkinToken,
  type SkinTokenKind,
} from "../shared/skin";

const CHECKED_PROPERTY: Record<SkinTokenKind, string> = {
  color: "color",
  shadow: "box-shadow",
  image: "background-image",
};

export function splitSkinTokens(tokens: SkinToken[]): { valid: SkinToken[]; invalid: SkinToken[] } {
  const valid: SkinToken[] = [];
  const invalid: SkinToken[] = [];
  for (const token of tokens) {
    (CSS.supports(CHECKED_PROPERTY[token.kind], token.value) ? valid : invalid).push(token);
  }
  return { valid, invalid };
}

export function applySkinTokens(tokens: SkinToken[], doc: Document = document): void {
  const style = doc.documentElement.style;
  for (const property of SKIN_TOKEN_PROPERTIES) style.removeProperty(property);
  for (const token of tokens) style.setProperty(token.property, token.value);
}

const BUTTON_IMAGE_PROPERTIES: Partial<Record<SkinImageSlot, string>> = {
  button: "--skin-button-image",
  buttonHover: "--skin-button-hover-image",
  buttonPressed: "--skin-button-pressed-image",
  buttonOn: "--skin-button-on-image",
};
const LAYER_PROPERTIES: Partial<Record<SkinImageSlot, string>> = {
  body: "--skin-body-layer",
  display: "--skin-display-layer",
};
const ASSET_PROPERTIES = [
  ...Object.values(BUTTON_IMAGE_PROPERTIES),
  ...Object.values(LAYER_PROPERTIES),
  "--skin-button-slice",
  "--skin-button-width",
  "--skin-knob-image",
  "--skin-display-font",
  ...SKIN_ICON_SLOTS.map((slot) => `--skin-icon-${slot}`),
] as string[];
const ASSET_CLASS_RE = /^skin-(button-image|knob-image|icon-.+)$/;

export const SKIN_FONT_FAMILY = "WaveAMP Skin Display";
const DISPLAY_FONT_FALLBACK = '"DejaVu Sans Mono", "Courier New", monospace';

function cssUrl(url: string): string {
  return `url("${url}")`;
}

export function applySkinAssets(assets: SkinAssets, hasFont: boolean, doc: Document = document): void {
  const style = doc.documentElement.style;
  for (const property of ASSET_PROPERTIES) style.removeProperty(property);
  const classes = doc.body.classList;
  Array.from(classes)
    .filter((name) => ASSET_CLASS_RE.test(name))
    .forEach((name) => classes.remove(name));

  for (const [slot, image] of skinEntries(assets.images)) {
    const layer = LAYER_PROPERTIES[slot];
    if (layer) style.setProperty(layer, `${cssUrl(image.url)} ${image.repeat ? "top left / auto repeat" : "center / cover no-repeat"}`);
    const button = BUTTON_IMAGE_PROPERTIES[slot];
    if (button) style.setProperty(button, cssUrl(image.url));
  }
  const button = assets.images.button;
  if (button) {
    style.setProperty("--skin-button-slice", String(button.slice));
    style.setProperty("--skin-button-width", `${button.width}px`);
    classes.add("skin-button-image");
  }
  if (assets.images.knob) {
    style.setProperty("--skin-knob-image", cssUrl(assets.images.knob.url));
    classes.add("skin-knob-image");
  }
  for (const [slot, url] of skinEntries(assets.icons)) {
    style.setProperty(`--skin-icon-${slot}`, cssUrl(url));
    classes.add(`skin-icon-${slot}`);
  }
  if (hasFont) style.setProperty("--skin-display-font", `"${SKIN_FONT_FAMILY}", ${DISPLAY_FONT_FALLBACK}`);
}

export function installSkinFont(doc: Document, font: SkinFont | null): Promise<void> {
  doc.fonts.forEach((face) => {
    if (face.family.replace(/"/g, "") === SKIN_FONT_FAMILY) doc.fonts.delete(face);
  });
  if (!font) return Promise.resolve();
  const bytes = Uint8Array.from(atob(font.data), (char) => char.charCodeAt(0));
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (!view) return Promise.resolve();
  const face = new view.FontFace(SKIN_FONT_FAMILY, bytes.buffer);
  doc.fonts.add(face);
  return face.load().then(() => undefined);
}
