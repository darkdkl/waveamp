export const NO_DRAG = [
  "button",
  "select",
  "input",
  "textarea",
  "a",
  "label",
  "[role='switch']",
  "[contenteditable='true']",
  ".player__display",
  ".player__seek",
  ".volume",
  ".eq__slider-wrap",
  ".chords__lcd",
  ".playlist__list-frame",
  ".playlist__add-menu",
  ".playlist__resize-handle",
  ".radio__list-frame",
  ".radio__search",
  ".radio__resize-handle",
  ".window-grip",
  ".window-edge",
  ".dropzone",
].join(", ");

export const DRAG_THRESHOLD = 4;

export interface DragNode {
  matches(selector: string): boolean;
}

export function startsDrag(path: DragNode[]): boolean {
  return path.length > 0 && !path.some((node) => node.matches(NO_DRAG));
}

export function dragMoved(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD;
}
