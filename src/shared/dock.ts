export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const SNAP_DISTANCE = 10;
const TOUCH_TOLERANCE = 1;

const right = (r: Rect): number => r.x + r.width;
const bottom = (r: Rect): number => r.y + r.height;
const overlap = (a1: number, a2: number, b1: number, b2: number): number => Math.min(a2, b2) - Math.max(a1, b1);

export function touching(a: Rect, b: Rect, tolerance = TOUCH_TOLERANCE): boolean {
  const vertical = overlap(a.y, bottom(a), b.y, bottom(b)) > 0;
  const horizontal = overlap(a.x, right(a), b.x, right(b)) > 0;
  const sideBySide = Math.abs(right(a) - b.x) <= tolerance || Math.abs(a.x - right(b)) <= tolerance;
  const stacked = Math.abs(bottom(a) - b.y) <= tolerance || Math.abs(a.y - bottom(b)) <= tolerance;
  return (vertical && sideBySide) || (horizontal && stacked);
}

export function attachedGroup<K extends string>(rects: Partial<Record<K, Rect>>, root: NoInfer<K>, tolerance = TOUCH_TOLERANCE): K[] {
  if (!rects[root]) return [];
  const names = Object.keys(rects) as K[];
  const group: K[] = [root];
  for (let i = 0; i < group.length; i++) {
    const current = rects[group[i]] as Rect;
    for (const name of names) {
      if (group.includes(name)) continue;
      if (touching(current, rects[name] as Rect, tolerance)) group.push(name);
    }
  }
  return group;
}

function closest(best: number | null, candidate: number, threshold: number): number | null {
  if (Math.abs(candidate) > threshold) return best;
  return best === null || Math.abs(candidate) < Math.abs(best) ? candidate : best;
}

export function snapDelta(moving: Rect[], delta: Point, others: Rect[], areas: Rect[], threshold = SNAP_DISTANCE): Point {
  let snapX: number | null = null;
  let snapY: number | null = null;
  for (const m of moving) {
    const left = m.x + delta.x;
    const top = m.y + delta.y;
    const mRight = left + m.width;
    const mBottom = top + m.height;
    for (const o of others) {
      if (overlap(top, mBottom, o.y, bottom(o)) > -threshold) {
        for (const c of [right(o) - left, o.x - mRight, o.x - left, right(o) - mRight]) snapX = closest(snapX, c, threshold);
      }
      if (overlap(left, mRight, o.x, right(o)) > -threshold) {
        for (const c of [bottom(o) - top, o.y - mBottom, o.y - top, bottom(o) - mBottom]) snapY = closest(snapY, c, threshold);
      }
    }
    for (const a of areas) {
      for (const c of [a.x - left, right(a) - mRight]) snapX = closest(snapX, c, threshold);
      for (const c of [a.y - top, bottom(a) - mBottom]) snapY = closest(snapY, c, threshold);
    }
  }
  return { x: delta.x + (snapX ?? 0), y: delta.y + (snapY ?? 0) };
}

export function reflowAfterResize<K extends string>(
  rects: Partial<Record<K, Rect>>,
  name: NoInfer<K>,
  next: Rect,
  group: NoInfer<K>[],
  tolerance = TOUCH_TOLERANCE
): Partial<Record<K, Rect>> {
  const previous = rects[name];
  const result: Partial<Record<K, Rect>> = { ...rects, [name]: next };
  if (!previous) return result;
  const dx = right(next) - right(previous);
  const dy = bottom(next) - bottom(previous);
  for (const other of group) {
    const rect = rects[other];
    if (other === name || !rect) continue;
    const shiftX = rect.x >= right(previous) - tolerance ? dx : 0;
    const shiftY = rect.y >= bottom(previous) - tolerance ? dy : 0;
    if (shiftX || shiftY) result[other] = { ...rect, x: rect.x + shiftX, y: rect.y + shiftY };
  }
  return result;
}

function intersection(a: Rect, b: Rect): number {
  return Math.max(0, overlap(a.x, right(a), b.x, right(b))) * Math.max(0, overlap(a.y, bottom(a), b.y, bottom(b)));
}

export function clampToAreas(rect: Rect, areas: Rect[]): Rect {
  if (!areas.length) return rect;
  let area = areas[0];
  let best = -1;
  for (const candidate of areas) {
    const shared = intersection(rect, candidate);
    if (shared > best) {
      best = shared;
      area = candidate;
    }
  }
  const x = Math.max(area.x, Math.min(rect.x, right(area) - rect.width));
  const y = Math.max(area.y, Math.min(rect.y, bottom(area) - rect.height));
  return { ...rect, x, y };
}

export function offsetFrom(origin: Rect, rect: Rect): Point {
  return { x: rect.x - origin.x, y: rect.y - origin.y };
}
