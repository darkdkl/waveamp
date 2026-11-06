import { SKIN_TOKEN_PROPERTIES, skinEntries, type SkinAssets, type SkinImageSlot, type SkinToken } from "../shared/skin";

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
] as string[];
const ASSET_CLASSES = ["skin-button-image", "skin-knob-image"];

export const SKIN_FONT_FAMILY = "WaveAMP Skin Display";

function cssUrl(url: string): string {
  return `url("${url}")`;
}

export function applySkinAssets(assets: SkinAssets, docs: Document[]): void {
  const [doc] = docs;
  const style = doc.documentElement.style;
  for (const property of ASSET_PROPERTIES) style.removeProperty(property);
  const classes = doc.body.classList;
  classes.remove(...ASSET_CLASSES);

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
  for (const element of docs.flatMap((each) => Array.from(each.querySelectorAll<HTMLElement>("[data-icon]")))) {
    const url = assets.icons[element.dataset.icon as keyof SkinAssets["icons"]];
    if (url) element.style.setProperty("--skin-icon", cssUrl(url));
    else element.style.removeProperty("--skin-icon");
    element.classList.toggle("has-skin-icon", !!url);
  }
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
