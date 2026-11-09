import {
  SKIN_BUTTON_STATES,
  SKIN_TOKEN_PROPERTIES,
  skinEntries,
  type SkinAssets,
  type SkinButton,
  type SkinButtonState,
  type SkinImageSlot,
  type SkinToken,
} from "../shared/skin";

export function applySkinTokens(tokens: SkinToken[], doc: Document = document): void {
  const style = doc.documentElement.style;
  for (const property of SKIN_TOKEN_PROPERTIES) style.removeProperty(property);
  for (const token of tokens) style.setProperty(token.property, token.value);
}

const BUTTON_FACE = "--skin-button-image";
const BUTTON_STATE_PROPERTIES: Record<SkinButtonState, string> = {
  hover: "--skin-button-hover-image",
  pressed: "--skin-button-pressed-image",
  on: "--skin-button-on-image",
};
const BUTTON_FACE_PROPERTIES = [BUTTON_FACE, ...Object.values(BUTTON_STATE_PROPERTIES), "--skin-button-slice", "--skin-button-width"];
const BUTTON_IMAGE_PROPERTIES: Partial<Record<SkinImageSlot, string>> = {
  button: BUTTON_FACE,
  buttonHover: BUTTON_STATE_PROPERTIES.hover,
  buttonPressed: BUTTON_STATE_PROPERTIES.pressed,
  buttonOn: BUTTON_STATE_PROPERTIES.on,
};
const LAYER_PROPERTIES: Partial<Record<SkinImageSlot, string>> = {
  body: "--skin-body-layer",
  display: "--skin-display-layer",
};
const ASSET_PROPERTIES = [...BUTTON_FACE_PROPERTIES, ...Object.values(LAYER_PROPERTIES), "--skin-knob-image"] as string[];
const ASSET_CLASSES = ["skin-button-image", "skin-knob-image"];
const SOURCE_PREFIX = "--skin-source-";

export const SKIN_FONT_FAMILY = "WaveAMP Skin Display";

function cssUrl(url: string): string {
  return `url("${url}")`;
}

function source(index: number): string {
  return `var(${SOURCE_PREFIX}${index})`;
}

export function applySkinAssets(assets: SkinAssets, docs: Document[]): void {
  const [doc] = docs;
  const style = doc.documentElement.style;
  const sources = Array.from(style).filter((property) => property.startsWith(SOURCE_PREFIX));
  for (const property of [...ASSET_PROPERTIES, ...sources]) style.removeProperty(property);
  const classes = doc.body.classList;
  classes.remove(...ASSET_CLASSES);

  assets.sources.forEach((url, index) => style.setProperty(`${SOURCE_PREFIX}${index}`, cssUrl(url)));
  for (const [slot, image] of skinEntries(assets.images)) {
    const layer = LAYER_PROPERTIES[slot];
    if (layer) style.setProperty(layer, `${source(image.source)} ${image.repeat ? "top left / auto repeat" : "center / cover no-repeat"}`);
    const button = BUTTON_IMAGE_PROPERTIES[slot];
    if (button) style.setProperty(button, source(image.source));
  }
  const button = assets.images.button;
  if (button) {
    style.setProperty("--skin-button-slice", String(button.slice));
    style.setProperty("--skin-button-width", `${button.width}px`);
    classes.add("skin-button-image");
  }
  if (assets.images.knob) {
    style.setProperty("--skin-knob-image", source(assets.images.knob.source));
    classes.add("skin-knob-image");
  }
  for (const element of docs.flatMap((each) => Array.from(each.querySelectorAll<HTMLElement>("[data-icon]")))) {
    const url = assets.icons[element.dataset.icon as keyof SkinAssets["icons"]];
    if (url) element.style.setProperty("--skin-icon", cssUrl(url));
    else element.style.removeProperty("--skin-icon");
    element.classList.toggle("has-skin-icon", !!url);
  }
  for (const element of docs.flatMap((each) => Array.from(each.querySelectorAll<HTMLElement>(".btn[data-icon]")))) {
    applyButtonFace(element, assets.buttons[element.dataset.icon as keyof SkinAssets["buttons"]]);
  }
}

function applyButtonFace(element: HTMLElement, face: SkinButton | undefined): void {
  for (const property of BUTTON_FACE_PROPERTIES) element.style.removeProperty(property);
  element.classList.toggle("has-skin-button", !!face);
  if (!face) return;
  element.style.setProperty(BUTTON_FACE, source(face.normal.source));
  for (const state of SKIN_BUTTON_STATES) {
    const index = face[state];
    element.style.setProperty(BUTTON_STATE_PROPERTIES[state], index === undefined ? `var(${BUTTON_FACE})` : source(index));
  }
  element.style.setProperty("--skin-button-slice", String(face.normal.slice));
  element.style.setProperty("--skin-button-width", `${face.normal.width}px`);
}

export async function installSkinFont(doc: Document, font: Uint8Array<ArrayBuffer> | null): Promise<void> {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  const face = font && view ? new view.FontFace(SKIN_FONT_FAMILY, font) : null;
  try {
    await face?.load();
  } finally {
    doc.fonts.forEach((old) => {
      if (old !== face && old.family.replace(/"/g, "") === SKIN_FONT_FAMILY) doc.fonts.delete(old);
    });
    if (face?.status === "loaded") doc.fonts.add(face);
  }
}
