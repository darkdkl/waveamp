import { SKIN_TOKEN_PROPERTIES, type SkinToken, type SkinTokenKind } from "../shared/skin";

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
