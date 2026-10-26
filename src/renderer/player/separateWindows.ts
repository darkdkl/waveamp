import { chordsGripLeft, chordsGripRight, chordsHeader, chordsLcd, chordsSection, dropzone, eq, player, playlist, radio, windowEdgeResize, windowGripResize } from "./dom";
import { state } from "./state";
import { persistConfig } from "./config";
import { addPlayerDocument, removePlayerDocument } from "./documents";
import { attachDropTarget } from "./playlist";
import type { DockName, DockUpdate, DockWindowState } from "../../shared/types";

const INTERACTIVE = "button, select, input, textarea, a, label, [role='switch'], [contenteditable='true'], .playlist__add-menu";
const SECTION_HEADERS = ".eq__header, .chords-section__header, .playlist__header, .radio__header";

interface DockWindow {
  win: Window;
  root: HTMLElement;
}

type Size = { width: number; height: number };

const windows = new Map<DockName, DockWindow>();
const panelDropzone = dropzone.cloneNode(true) as HTMLElement;
panelDropzone.removeAttribute("id");
let mirror: MutationObserver | null = null;
let queue: Promise<void> = Promise.resolve();
let floating: DockWindow | null = null;
let canPosition = true;

function mirrorInto(doc: Document): void {
  const source = document.documentElement.style;
  const target = doc.documentElement.style;
  Array.from(target).forEach((name) => {
    if (!source.getPropertyValue(name)) target.removeProperty(name);
  });
  Array.from(source).forEach((name) => target.setProperty(name, source.getPropertyValue(name), source.getPropertyPriority(name)));
  doc.documentElement.lang = document.documentElement.lang;
  doc.body.className = document.body.className;
  doc.body.classList.remove("is-separated");
  doc.body.classList.add("is-detached");
  doc.body.classList.toggle("is-floating", doc === floating?.win.document);
  doc.body.classList.toggle("cannot-position", !canPosition);
}

function mirrorAll(): void {
  windows.forEach(({ win }) => mirrorInto(win.document));
  if (floating) mirrorInto(floating.win.document);
}

function startMirror(): void {
  if (mirror) return;
  mirror = new MutationObserver(mirrorAll);
  mirror.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "lang"] });
  mirror.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

function stopMirror(): void {
  if (windows.size || floating) return;
  mirror?.disconnect();
  mirror = null;
}

function dragAllowed(name: "main" | DockName): boolean {
  return state.separateActive || (name === "chords" && !!floating && canPosition);
}

function enableDrag(root: HTMLElement, name: "main" | DockName, isHandle: (target: Element) => boolean): void {
  root.addEventListener("pointerdown", (e) => {
    if (!dragAllowed(name) || e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest(INTERACTIVE) || !isHandle(target)) return;
    root.setPointerCapture(e.pointerId);
    window.electronAPI?.dockDragStart?.(name);
  });
  const end = () => {
    if (dragAllowed(name)) window.electronAPI?.dockDragEnd?.();
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("lostpointercapture", end);
}

function stylesLoaded(doc: Document): Promise<void> {
  const links = Array.from(doc.head.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']")).filter((link) => !link.sheet);
  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
}

async function openWindow(name: DockName, nodes: HTMLElement[]): Promise<DockWindow | null> {
  const win = window.open("about:blank", `waveamp-${name}`);
  if (!win) return null;
  const doc = win.document;
  doc.title = document.title;
  document.head.querySelectorAll("link[rel='stylesheet'], style").forEach((node) => doc.head.append(node.cloneNode(true)));
  const root = document.createElement("main");
  root.className = "player player--detached";
  root.append(...nodes);
  doc.body.append(root);
  mirrorInto(doc);
  addPlayerDocument(doc);
  enableDrag(root, name, (target) => target === root || !!target.closest(SECTION_HEADERS));
  root.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button")) e.preventDefault();
  });
  await stylesLoaded(doc);
  return { win, root };
}

function setSectionHeights(): void {
  for (const [section, open] of [
    [eq, state.eqOpen],
    [chordsSection, state.chordsOpen],
    [playlist, state.playlistOpen],
    [radio, state.radioOpen],
  ] as const) {
    if (!open) section.style.maxHeight = "0px";
    else section.style.maxHeight = section.ownerDocument !== document ? "none" : section.scrollHeight + "px";
  }
}

function closeWindows(): void {
  windows.forEach(({ win }) => {
    removePlayerDocument(win.document);
    win.close();
  });
  windows.clear();
}

async function separate(): Promise<void> {
  dockFloatingBack();
  const api = window.electronAPI;
  if (!api?.dockSetSeparate || !(await api.dockSetSeparate(true, state.dockLayout))) return;
  api.dockZoom?.(state.uiScale);
  const eqWindow = await openWindow("eq", [eq]);
  const chordsWindow = await openWindow("chords", [chordsSection]);
  const panelWindow = await openWindow("panel", [playlist, radio, panelDropzone]);
  if (!eqWindow || !chordsWindow || !panelWindow) {
    await api.dockSetSeparate(false, state.dockLayout);
    player.insertBefore(eq, dropzone);
    player.insertBefore(chordsSection, dropzone);
    player.insertBefore(playlist, dropzone);
    player.insertBefore(radio, dropzone);
    [eqWindow, chordsWindow, panelWindow].forEach((entry) => entry?.win.close());
    return;
  }
  windows.set("eq", eqWindow);
  windows.set("chords", chordsWindow);
  windows.set("panel", panelWindow);
  attachDropTarget(panelWindow.root);
  panelWindow.win.document.body.append(windowEdgeResize, windowGripResize);
  state.separateActive = true;
  document.body.classList.add("is-separated");
  mirrorAll();
  startMirror();
  setSectionHeights();
}

async function join(): Promise<void> {
  await window.electronAPI?.dockSetSeparate?.(false, state.dockLayout);
  player.insertBefore(eq, dropzone);
  player.insertBefore(chordsSection, dropzone);
  player.insertBefore(playlist, dropzone);
  player.insertBefore(radio, dropzone);
  document.body.append(windowEdgeResize, windowGripResize);
  closeWindows();
  stopMirror();
  state.separateActive = false;
  document.body.classList.remove("is-separated");
  setSectionHeights();
}

function dockFloatingBack(): void {
  if (!floating) return;
  const { win } = floating;
  floating = null;
  state.chordsFloating = false;
  state.chordsFloatingSize = null;
  player.insertBefore(chordsSection, playlist.parentElement === player ? playlist : dropzone);
  removePlayerDocument(win.document);
  win.close();
  stopMirror();
  setSectionHeights();
}

export function popOutChords(): Promise<void> {
  queue = queue.then(async () => {
    const api = window.electronAPI;
    if (state.separateActive || floating || !state.chordsOpen || !api?.dockUpdate) return;
    canPosition = (await api.dockCanPosition?.()) ?? false;
    api.dockZoom?.(state.uiScale);
    const entry = await openWindow("chords", [chordsSection]);
    if (!entry) {
      player.insertBefore(chordsSection, playlist);
      return;
    }
    floating = entry;
    state.chordsFloating = true;
    state.chordsFloatingSize = null;
    mirrorInto(entry.win.document);
    startMirror();
    setSectionHeights();
  });
  return queue;
}

export function returnChords(): Promise<void> {
  queue = queue.then(dockFloatingBack);
  return queue;
}

function chordsNaturalSize(root: HTMLElement): Size {
  const base = parseFloat(getComputedStyle(chordsLcd).getPropertyValue("--chords-lcd-height")) || chordsLcd.offsetHeight;
  return { width: player.offsetWidth, height: root.offsetHeight - chordsLcd.offsetHeight + base };
}

function chordsWindowState(entry: DockWindow, scale: number): DockWindowState {
  const natural = chordsNaturalSize(entry.root);
  const size = (state.separateActive ? state.chordsDockedSize : state.chordsFloatingSize) ?? natural;
  return {
    visible: state.chordsOpen,
    width: Math.round(Math.max(size.width, natural.width) * scale),
    height: Math.round(Math.max(size.height, natural.height) * scale),
  };
}

function chordsEntry(): DockWindow | null {
  return floating ?? windows.get("chords") ?? null;
}

function startChordsResize(e: PointerEvent, edge: "left" | "right"): void {
  const api = window.electronAPI;
  const entry = chordsEntry();
  if (e.button !== 0 || !entry || !api?.dockResizeStart || !api.dockResize) return;
  e.preventDefault();
  e.stopPropagation();
  const grip = e.currentTarget as HTMLElement;
  grip.setPointerCapture(e.pointerId);
  grip.classList.add("is-active");
  const natural = chordsNaturalSize(entry.root);
  api.dockResizeStart("chords", edge, Math.round(natural.width * state.uiScale), Math.round(natural.height * state.uiScale));
  const startX = e.screenX;
  const startY = e.screenY;
  const move = (ev: PointerEvent) => api.dockResize?.(ev.screenX - startX, ev.screenY - startY);
  const end = () => {
    grip.removeEventListener("pointermove", move);
    grip.removeEventListener("pointerup", end);
    grip.removeEventListener("lostpointercapture", end);
    grip.classList.remove("is-active");
    api.dockResizeEnd?.();
    persistConfig();
  };
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("lostpointercapture", end);
}

function onChordsSize(size: Size): void {
  const css = { width: size.width / state.uiScale, height: size.height / state.uiScale };
  if (state.separateActive) state.chordsDockedSize = css;
  else if (floating) state.chordsFloatingSize = css;
}

export function applySeparateWindows(): Promise<void> {
  queue = queue.then(async () => {
    if (state.separateWindows && !state.separateActive) await separate();
    else if (!state.separateWindows && state.separateActive) await join();
  });
  return queue;
}

export function syncDockWindows(mainHeight: number, width: number, scale: number): void {
  if (floating) {
    window.electronAPI?.dockUpdate?.({ chords: chordsWindowState(floating, scale) } as DockUpdate);
    return;
  }
  const eqWindow = windows.get("eq");
  const chordsWindow = windows.get("chords");
  const panelWindow = windows.get("panel");
  if (!state.separateActive || !eqWindow || !chordsWindow || !panelWindow) return;
  eqWindow.root.style.minHeight = mainHeight + "px";
  const eqHeight = eqWindow.root.offsetHeight;
  window.electronAPI?.dockUpdate?.({
    eq: { visible: state.eqOpen, width, height: eqHeight > mainHeight ? Math.ceil(eqHeight * scale) : Math.round(mainHeight * scale) },
    chords: chordsWindowState(chordsWindow, scale),
    panel: { visible: state.playlistOpen || state.radioOpen, width, height: Math.ceil(panelWindow.root.offsetHeight * scale) },
  });
}

export function initSeparateWindows(): void {
  enableDrag(player, "main", (target) => target === player || !!target.closest(".player__titlebar"));
  window.electronAPI?.onDockLayout?.((layout) => {
    state.dockLayout = layout;
    persistConfig();
  });
  window.electronAPI?.onDockSize?.((name, size) => {
    if (name === "chords") onChordsSize(size);
  });
  chordsGripLeft.addEventListener("pointerdown", (e) => startChordsResize(e, "left"));
  chordsGripRight.addEventListener("pointerdown", (e) => startChordsResize(e, "right"));
  chordsHeader.addEventListener("dblclick", (e) => {
    if ((e.target as Element).closest(INTERACTIVE) || !chordsEntry()) return;
    window.electronAPI?.dockToggleFull?.("chords");
  });
}
