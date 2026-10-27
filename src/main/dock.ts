import { app, screen, type BrowserWindow, type BrowserWindowConstructorOptions, type WebContents } from "electron";
import { areaOf, attachedGroup, clampToAreas, offsetFrom, reflowAfterResize, resizedRect, snapDelta, type Point, type Rect, type ResizeEdge, type Size } from "../shared/dock";
import type { DockLayout, DockName, DockUpdate, DockWindowState } from "../shared/types";

type Managed = "main" | DockName | "settings";

interface Entry {
  win: BrowserWindow;
  last: Rect;
  wanted: boolean;
  full: Rect | null;
}

interface Resize {
  name: DockName;
  edge: ResizeEdge;
  start: Rect;
  min: Size;
  area: Rect;
}

interface Drag {
  cursor: Point;
  origin: Map<Managed, Rect>;
  others: Rect[];
  areas: Rect[];
  timer: ReturnType<typeof setInterval>;
}

const DOCK_NAMES: DockName[] = ["eq", "chords", "panel"];
const STACK_ORDER: Managed[] = ["main", ...DOCK_NAMES];
const FOLLOWERS: (DockName | "settings")[] = [...DOCK_NAMES, "settings"];
const FRAME_PREFIX = "waveamp-";
const DRAG_INTERVAL_MS = 16;
const FALLBACK_HEIGHT = 200;

const startedOnWayland = process.platform === "linux" && !!process.env.WAYLAND_DISPLAY;
const entries = new Map<Managed, Entry>();
const limited = new WeakSet<BrowserWindow>();
let enabled = false;
let suspended = false;
let layout: DockLayout = {};
let sizes: Partial<DockUpdate> = {};
let zoomFactor = 1;
let drag: Drag | null = null;
let resizing: Resize | null = null;
let closing = false;
let handlers: DockHandlers = { layout: () => {}, close: () => {}, size: () => {} };

export interface DockHandlers {
  layout: (layout: DockLayout) => void;
  close: (name: DockName) => void;
  size: (name: DockName, size: Size) => void;
}

export function preferX11ForDocking(separateWindows: boolean): void {
  const chosenByUser = process.argv.some((arg) => arg.startsWith("--ozone-platform"));
  if (startedOnWayland && separateWindows && process.env.DISPLAY && !chosenByUser) {
    app.commandLine.appendSwitch("ozone-platform", "x11");
  }
}

export function canPositionWindows(): boolean {
  return !startedOnWayland || app.commandLine.getSwitchValue("ozone-platform") === "x11";
}

function dockName(frameName: string): DockName | null {
  const name = frameName.startsWith(FRAME_PREFIX) ? frameName.slice(FRAME_PREFIX.length) : "";
  return (DOCK_NAMES as string[]).includes(name) ? (name as DockName) : null;
}

function alive(entry: Entry | undefined): entry is Entry {
  return !!entry && !entry.win.isDestroyed();
}

function boundsOf(win: BrowserWindow): Rect {
  const { x, y, width, height } = win.getBounds();
  return { x, y, width, height };
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function workAreas(): Rect[] {
  return screen.getAllDisplays().map((display) => display.workArea);
}

function visibleRects(): Partial<Record<Managed, Rect>> {
  const rects: Partial<Record<Managed, Rect>> = {};
  for (const [name, entry] of entries) {
    if (alive(entry) && !entry.full && (name === "main" || entry.win.isVisible())) rects[name] = entry.last;
  }
  return rects;
}

function applyBounds(name: Managed, rect: Rect): void {
  const entry = entries.get(name);
  if (!alive(entry)) return;
  const next = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  if (sameRect(next, boundsOf(entry.win))) {
    entry.last = next;
    return;
  }
  entry.last = next;
  entry.win.setBounds(next);
}

function recordLayout(): void {
  const main = entries.get("main");
  if (!enabled || !alive(main)) return;
  for (const name of FOLLOWERS) {
    const entry = entries.get(name);
    if (alive(entry) && entry.win.isVisible()) layout[name] = offsetFrom(main.last, entry.full ?? entry.last);
  }
  handlers.layout({ ...layout });
}

function moveGroup(group: Managed[], skip: Managed, dx: number, dy: number): void {
  for (const name of group) {
    const entry = entries.get(name);
    if (name === skip || !alive(entry)) continue;
    applyBounds(name, { ...entry.last, x: entry.last.x + dx, y: entry.last.y + dy });
  }
}

function resizeInGroup(name: Managed, previous: Rect, next: Rect): void {
  const rects = { ...visibleRects(), [name]: previous };
  const group = attachedGroup(rects, name);
  const moved = reflowAfterResize(rects, name, next, group);
  for (const other of group) {
    const rect = moved[other];
    if (other !== name && rect && !sameRect(rect, rects[other] as Rect)) applyBounds(other, rect);
  }
}

function onBoundsChanged(name: Managed): void {
  const entry = entries.get(name);
  if (!alive(entry)) return;
  const current = boundsOf(entry.win);
  const previous = entry.last;
  if (sameRect(current, previous)) return;
  entry.last = current;
  const resized = current.width !== previous.width || current.height !== previous.height;
  if (name === "chords" && resized && !entry.full) handlers.size(name, { width: current.width, height: current.height });
  if (!enabled || drag || suspended || entry.full || !entry.win.isVisible()) return;
  if (current.width === previous.width && current.height === previous.height) {
    if (name === "main") {
      const group = attachedGroup({ ...visibleRects(), main: previous }, "main");
      moveGroup(group, "main", current.x - previous.x, current.y - previous.y);
    }
  } else {
    resizeInGroup(name, previous, current);
  }
  recordLayout();
}

function track(name: Managed, win: BrowserWindow, wanted: boolean): Entry {
  const entry: Entry = { win, last: boundsOf(win), wanted, full: null };
  entries.set(name, entry);
  win.on("move", () => onBoundsChanged(name));
  win.on("resize", () => onBoundsChanged(name));
  win.on("closed", () => {
    if (entries.get(name) === entry) entries.delete(name);
  });
  return entry;
}

function shownFollowers(): (DockName | "settings")[] {
  return enabled ? FOLLOWERS : ["chords"];
}

function suspend(): void {
  suspended = true;
  for (const name of shownFollowers()) {
    const entry = entries.get(name);
    if (alive(entry) && entry.win.isVisible()) entry.win.hide();
  }
}

function showFollower(name: DockName | "settings"): void {
  const entry = entries.get(name);
  if (!alive(entry) || !entry.wanted || entry.win.isVisible()) return;
  applyBounds(name, placement(name, entry.last.width, entry.last.height));
  entry.win.showInactive();
}

function resume(afterFullScreen = false): void {
  const main = entries.get("main");
  if (!alive(main) || !main.win.isVisible() || main.win.isMinimized() || (!afterFullScreen && main.win.isFullScreen())) return;
  suspended = false;
  shownFollowers().forEach(showFollower);
  recordLayout();
}

export function trackMainWindow(win: BrowserWindow, dockHandlers: DockHandlers): void {
  handlers = dockHandlers;
  track("main", win, true);
  suspended = !win.isVisible();
  win.on("minimize", suspend);
  win.on("hide", suspend);
  win.on("enter-full-screen", suspend);
  win.on("restore", () => resume());
  win.on("show", () => resume());
  win.on("leave-full-screen", () => setImmediate(() => resume(true)));
  win.on("close", () => {
    closing = true;
  });
  app.on("before-quit", () => {
    closing = true;
  });
  win.webContents.setWindowOpenHandler((details) => {
    const options = details.url === "about:blank" ? dockWindowOptions(details.frameName, win) : null;
    return options ? { action: "allow", overrideBrowserWindowOptions: options } : { action: "deny" };
  });
  win.webContents.on("did-create-window", (child, details) => registerDockWindow(details.frameName, child));
}

function nativeFrameControls(name: DockName): boolean {
  return name === "chords" && !enabled && !canPositionWindows();
}

function dockWindowOptions(frameName: string, parent: BrowserWindow): BrowserWindowConstructorOptions | null {
  const name = dockName(frameName);
  if (!name || (!enabled && name !== "chords")) return null;
  const size = sizes[name];
  const native = nativeFrameControls(name);
  return {
    parent,
    show: false,
    frame: false,
    resizable: native,
    minimizable: false,
    maximizable: native,
    fullscreenable: false,
    skipTaskbar: true,
    useContentSize: true,
    width: Math.round(size?.width ?? parent.getBounds().width),
    height: Math.round(size?.height ?? FALLBACK_HEIGHT),
    backgroundColor: "#16181c",
    title: "WaveAMP",
    webPreferences: { zoomFactor },
  };
}

function registerDockWindow(frameName: string, win: BrowserWindow): void {
  const name = dockName(frameName);
  if (!name) {
    win.destroy();
    return;
  }
  const previous = entries.get(name);
  if (alive(previous) && previous.win !== win) previous.win.destroy();
  track(name, win, false);
  win.on("close", (event) => {
    if (closing || (!enabled && name !== "chords")) return;
    event.preventDefault();
    handlers.close(name);
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  const state = sizes[name];
  if (state) applyState(name, state);
}

function defaultRect(name: Managed, width: number, height: number): Rect {
  const main = entries.get("main") as Entry;
  if (name === "settings") return { x: main.last.x + main.last.width, y: main.last.y, width, height };
  const rects = visibleRects();
  const group = attachedGroup(rects, "main");
  const above = STACK_ORDER.slice(0, STACK_ORDER.indexOf(name)).reverse();
  const anchorName = above.find((other) => other === "main" || group.includes(other)) ?? "main";
  const anchor = rects[anchorName] ?? main.last;
  const moved = reflowAfterResize(rects, anchorName, { ...anchor, height: anchor.height + height }, group);
  for (const other of group) {
    const rect = moved[other];
    if (other !== anchorName && rect && !sameRect(rect, rects[other] as Rect)) applyBounds(other, rect);
  }
  return { x: anchor.x, y: anchor.y + anchor.height, width, height };
}

function placement(name: Managed, width: number, height: number): Rect {
  const main = entries.get("main") as Entry;
  if (!enabled) return clampToAreas({ x: main.last.x + main.last.width, y: main.last.y, width, height }, workAreas());
  const saved = name === "main" ? undefined : layout[name];
  const rect = saved ? { x: main.last.x + saved.x, y: main.last.y + saved.y, width, height } : defaultRect(name, width, height);
  return clampToAreas(rect, workAreas());
}

function applyState(name: DockName, state: DockWindowState): void {
  const entry = entries.get(name);
  if (!alive(entry) || !alive(entries.get("main"))) return;
  entry.wanted = state.visible;
  const width = Math.round(state.width);
  const height = Math.round(state.height);
  if (entry.full) {
    if (state.visible) return;
    const back = entry.full;
    entry.full = null;
    applyBounds(name, back);
  }
  if (!entry.win.isVisible()) {
    if (nativeFrameControls(name) && !limited.has(entry.win)) {
      limited.add(entry.win);
      entry.win.setMinimumSize(width, height);
    }
    entry.last = { ...entry.last, width, height };
    if (!state.visible || suspended) return;
    showFollower(name);
    recordLayout();
    return;
  }
  if (!state.visible) {
    recordLayout();
    entry.win.hide();
    return;
  }
  if (width === entry.last.width && height === entry.last.height) return;
  const previous = entry.last;
  const next = { ...previous, width, height };
  if (enabled) resizeInGroup(name, previous, next);
  applyBounds(name, next);
  recordLayout();
}

export function dockSettingsWindow(win: BrowserWindow): void {
  const entry = track("settings", win, true);
  if (!enabled || suspended || !alive(entries.get("main"))) return;
  applyBounds("settings", placement("settings", entry.last.width, entry.last.height));
}

function sanitizeLayout(raw: DockLayout | null | undefined): DockLayout {
  const result: DockLayout = {};
  for (const name of FOLLOWERS) {
    const offset = raw?.[name];
    if (offset && Number.isFinite(offset.x) && Number.isFinite(offset.y)) {
      result[name] = { x: Math.round(offset.x), y: Math.round(offset.y) };
    }
  }
  return result;
}

export function setSeparateWindows(on: boolean, saved: DockLayout | null | undefined): boolean {
  stopDockDrag();
  enabled = on && canPositionWindows();
  layout = sanitizeLayout(saved);
  const main = entries.get("main");
  suspended = !alive(main) || !main.win.isVisible() || main.win.isMinimized() || main.win.isFullScreen();
  return enabled;
}

function validState(state: Partial<DockWindowState> | undefined): state is DockWindowState {
  return !!state && typeof state.visible === "boolean" && Number(state.width) > 0 && Number(state.height) > 0;
}

export function updateDock(update: Partial<DockUpdate> | null | undefined): void {
  for (const name of DOCK_NAMES) {
    const state = update?.[name];
    if (!validState(state)) continue;
    sizes[name] = state;
    if (enabled || name === "chords") applyState(name, state);
  }
}

export function setDockZoom(factor: number): void {
  if (!(factor > 0)) return;
  zoomFactor = factor;
  for (const name of DOCK_NAMES) {
    const entry = entries.get(name);
    if (alive(entry)) entry.win.webContents.setZoomFactor(factor);
  }
}

export function dockNameOf(sender: WebContents): Managed | null {
  for (const [name, entry] of entries) {
    if (alive(entry) && entry.win.webContents === sender) return name;
  }
  return null;
}

export function isManagedName(value: unknown): value is Managed {
  return value === "main" || value === "settings" || (DOCK_NAMES as unknown[]).includes(value);
}

function dragTick(): void {
  if (!drag) return;
  const cursor = screen.getCursorScreenPoint();
  const delta = { x: cursor.x - drag.cursor.x, y: cursor.y - drag.cursor.y };
  const moving = [...drag.origin].map(([name, origin]) => {
    const entry = entries.get(name);
    return { name, rect: alive(entry) ? { ...origin, width: entry.last.width, height: entry.last.height } : origin };
  });
  const snapped = snapDelta(moving.map(({ rect }) => rect), delta, drag.others, drag.areas);
  for (const { name, rect } of moving) {
    applyBounds(name, { ...rect, x: rect.x + snapped.x, y: rect.y + snapped.y });
  }
}

const MAX_DRAG_LEAD = 32;

export function startDockDrag(name: Managed, moved: Point = { x: 0, y: 0 }): void {
  stopDockDrag();
  const entry = entries.get(name);
  if (!(enabled || name === "chords" || name === "main") || !alive(entry) || !entry.win.isVisible() || entry.full) return;
  const rects = visibleRects();
  const moving = name === "main" ? attachedGroup(rects, "main") : [name];
  const origin = new Map<Managed, Rect>(moving.map((member) => [member, rects[member] as Rect]));
  const others = (Object.keys(rects) as Managed[]).filter((member) => !moving.includes(member)).map((member) => rects[member] as Rect);
  const cursor = screen.getCursorScreenPoint();
  const lead = (value: number) => Math.max(-MAX_DRAG_LEAD, Math.min(MAX_DRAG_LEAD, value));
  drag = {
    cursor: { x: cursor.x - lead(moved.x), y: cursor.y - lead(moved.y) },
    origin,
    others,
    areas: workAreas(),
    timer: setInterval(dragTick, DRAG_INTERVAL_MS),
  };
}

export function stopDockDrag(): void {
  if (!drag) return;
  dragTick();
  clearInterval(drag.timer);
  drag = null;
  recordLayout();
}

export function startDockResize(name: Managed, edge: ResizeEdge, min: Size): void {
  stopDockResize();
  const entry = entries.get(name);
  if (name !== "chords" || !alive(entry) || !entry.win.isVisible() || entry.full) return;
  const area = areaOf(entry.last, workAreas()) ?? entry.last;
  resizing = { name, edge, start: entry.last, min, area };
}

export function resizeDock(delta: Point): void {
  if (!resizing) return;
  const { name } = resizing;
  const entry = entries.get(name);
  if (!alive(entry)) {
    resizing = null;
    return;
  }
  const next = resizedRect(resizing.start, resizing.edge, delta, resizing.min, resizing.area);
  const previous = entry.last;
  if (sameRect(previous, next)) return;
  if (enabled) resizeInGroup(name, previous, next);
  applyBounds(name, next);
  handlers.size(name, { width: next.width, height: next.height });
}

export function stopDockResize(): void {
  if (!resizing) return;
  resizing = null;
  recordLayout();
}

export function toggleDockFull(name: Managed): void {
  const entry = entries.get(name);
  if (name !== "chords" || !alive(entry) || !entry.win.isVisible()) return;
  stopDockDrag();
  stopDockResize();
  if (entry.full) {
    const back = entry.full;
    entry.full = null;
    applyBounds(name, back);
    return;
  }
  const area = areaOf(entry.last, workAreas());
  if (!area) return;
  entry.full = entry.last;
  applyBounds(name, area);
}
