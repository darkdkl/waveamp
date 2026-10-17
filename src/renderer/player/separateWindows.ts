import { dropzone, eq, player, playlist, radio, windowEdgeResize, windowGripResize } from "./dom";
import { state } from "./state";
import { persistConfig } from "./config";
import { addPlayerDocument, removePlayerDocument } from "./documents";
import { attachDropTarget } from "./playlist";
import type { DockName } from "../../shared/types";

const INTERACTIVE = "button, select, input, textarea, a, label, [role='switch'], [contenteditable='true'], .playlist__add-menu";
const SECTION_HEADERS = ".eq__header, .playlist__header, .radio__header";

interface DockWindow {
  win: Window;
  root: HTMLElement;
}

const windows = new Map<DockName, DockWindow>();
const panelDropzone = dropzone.cloneNode(true) as HTMLElement;
panelDropzone.removeAttribute("id");
let mirror: MutationObserver | null = null;
let queue: Promise<void> = Promise.resolve();

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
}

function mirrorAll(): void {
  windows.forEach(({ win }) => mirrorInto(win.document));
}

function enableDrag(root: HTMLElement, name: "main" | DockName, isHandle: (target: Element) => boolean): void {
  root.addEventListener("pointerdown", (e) => {
    if (!state.separateActive || e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest(INTERACTIVE) || !isHandle(target)) return;
    root.setPointerCapture(e.pointerId);
    window.electronAPI?.dockDragStart?.(name);
  });
  const end = () => {
    if (state.separateActive) window.electronAPI?.dockDragEnd?.();
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
    [playlist, state.playlistOpen],
    [radio, state.radioOpen],
  ] as const) {
    if (!open) section.style.maxHeight = "0px";
    else section.style.maxHeight = state.separateActive ? "none" : section.scrollHeight + "px";
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
  const api = window.electronAPI;
  if (!api?.dockSetSeparate || !(await api.dockSetSeparate(true, state.dockLayout))) return;
  api.dockZoom?.(state.uiScale);
  const eqWindow = await openWindow("eq", [eq]);
  const panelWindow = await openWindow("panel", [playlist, radio, panelDropzone]);
  if (!eqWindow || !panelWindow) {
    await api.dockSetSeparate(false, state.dockLayout);
    player.insertBefore(eq, dropzone);
    player.insertBefore(playlist, dropzone);
    player.insertBefore(radio, dropzone);
    [eqWindow, panelWindow].forEach((entry) => entry?.win.close());
    return;
  }
  windows.set("eq", eqWindow);
  windows.set("panel", panelWindow);
  attachDropTarget(panelWindow.root);
  panelWindow.win.document.body.append(windowEdgeResize, windowGripResize);
  state.separateActive = true;
  document.body.classList.add("is-separated");
  mirrorAll();
  mirror = new MutationObserver(mirrorAll);
  mirror.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "lang"] });
  mirror.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  setSectionHeights();
}

async function join(): Promise<void> {
  await window.electronAPI?.dockSetSeparate?.(false, state.dockLayout);
  mirror?.disconnect();
  mirror = null;
  player.insertBefore(eq, dropzone);
  player.insertBefore(playlist, dropzone);
  player.insertBefore(radio, dropzone);
  document.body.append(windowEdgeResize, windowGripResize);
  closeWindows();
  state.separateActive = false;
  document.body.classList.remove("is-separated");
  setSectionHeights();
}

export function applySeparateWindows(): Promise<void> {
  queue = queue.then(async () => {
    if (state.separateWindows && !state.separateActive) await separate();
    else if (!state.separateWindows && state.separateActive) await join();
  });
  return queue;
}

export function syncDockWindows(mainHeight: number, width: number, scale: number): void {
  const eqWindow = windows.get("eq");
  const panelWindow = windows.get("panel");
  if (!state.separateActive || !eqWindow || !panelWindow) return;
  eqWindow.root.style.minHeight = mainHeight + "px";
  const eqHeight = eqWindow.root.offsetHeight;
  window.electronAPI?.dockUpdate?.({
    eq: { visible: state.eqOpen, width, height: eqHeight > mainHeight ? Math.ceil(eqHeight * scale) : Math.round(mainHeight * scale) },
    panel: { visible: state.playlistOpen || state.radioOpen, width, height: Math.ceil(panelWindow.root.offsetHeight * scale) },
  });
}

export function initSeparateWindows(): void {
  enableDrag(player, "main", (target) => target === player || !!target.closest(".player__titlebar"));
  window.electronAPI?.onDockLayout?.((layout) => {
    state.dockLayout = layout;
    persistConfig();
  });
}
