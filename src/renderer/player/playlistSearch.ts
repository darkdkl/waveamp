import {
  playlist,
  playlistList,
  playlistSearch,
  playlistSearchBtn,
  playlistSearchCount,
  playlistSearchInput,
  playlistSearchNext,
  playlistSearchPrev,
} from "./dom";
import { state, type Track } from "./state";
import { trackDisplayName } from "./format";
import { matchesWords, searchWords, stepIndex } from "./searchText";

let matches: number[] = [];
let current = -1;
let currentTrack: Track | null = null;

function isOpen(): boolean {
  return !playlistSearch.hidden;
}

function findMatches(): void {
  const words = searchWords(playlistSearchInput.value);
  matches = [];
  if (!isOpen() || words.length === 0) return;
  state.queue.forEach((track, index) => {
    if (matchesWords(trackDisplayName(track), words)) matches.push(index);
  });
}

function setCurrent(next: number): void {
  current = next;
  currentTrack = current >= 0 ? state.queue[matches[current]] : null;
}

function render(): void {
  const searching = isOpen() && searchWords(playlistSearchInput.value).length > 0;
  const found = new Set(matches);
  const currentIndex = current >= 0 ? matches[current] : -1;
  Array.from(playlistList.children).forEach((item, index) => {
    item.classList.toggle("is-dimmed", searching && !found.has(index));
    item.classList.toggle("is-current-match", index === currentIndex);
  });
  playlistSearchCount.textContent = !searching ? "" : matches.length ? `${current + 1} / ${matches.length}` : "0";
  playlistSearchPrev.disabled = matches.length === 0;
  playlistSearchNext.disabled = matches.length === 0;
}

function revealCurrent(): void {
  const item = current >= 0 ? (playlistList.children[matches[current]] as HTMLElement | undefined) : undefined;
  if (!item) return;
  const list = playlistList.getBoundingClientRect();
  const row = item.getBoundingClientRect();
  playlistList.scrollTop += row.top - list.top - (list.height - row.height) / 2;
}

function search(): void {
  findMatches();
  setCurrent(matches.length ? 0 : -1);
  render();
  revealCurrent();
}

function step(direction: 1 | -1): void {
  if (matches.length === 0) return;
  setCurrent(stepIndex(current, matches.length, direction));
  render();
  revealCurrent();
}

export function refreshPlaylistSearch(): void {
  if (!isOpen()) return;
  findMatches();
  const kept = currentTrack ? matches.findIndex((index) => state.queue[index] === currentTrack) : -1;
  setCurrent(kept >= 0 ? kept : matches.length ? 0 : -1);
  render();
}

export function selectPlaylistMatch(index: number): void {
  const position = matches.indexOf(index);
  if (position >= 0) setCurrent(position);
}

export function openPlaylistSearch(): void {
  if (!isOpen()) {
    playlistSearch.hidden = false;
    playlist.classList.add("is-searching");
    playlistSearchBtn.classList.add("is-current");
    playlistSearchBtn.setAttribute("aria-pressed", "true");
  }
  playlistSearchInput.ownerDocument.defaultView?.focus();
  playlistSearchInput.focus();
  playlistSearchInput.select();
  search();
}

export function closePlaylistSearch(): void {
  playlistSearch.hidden = true;
  playlist.classList.remove("is-searching");
  playlistSearchBtn.classList.remove("is-current");
  playlistSearchBtn.setAttribute("aria-pressed", "false");
  playlistSearchInput.value = "";
  matches = [];
  setCurrent(-1);
  render();
}

export function initPlaylistSearch(): void {
  playlistSearchBtn.addEventListener("click", () => (isOpen() ? closePlaylistSearch() : openPlaylistSearch()));
  playlistSearchInput.addEventListener("input", search);
  playlistSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePlaylistSearch();
    }
  });
  playlistSearch.addEventListener("submit", (e) => e.preventDefault());
  playlistSearchPrev.addEventListener("click", () => step(-1));
  playlistSearchNext.addEventListener("click", () => step(1));
}
