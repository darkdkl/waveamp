import { hotkeys } from "../hotkeys";
import { accentColor as accentColorTheme } from "../theme";
import { TITLE_SCROLL_DEFAULT, TITLE_SCROLL_SPEED_DEFAULT, type TitleScrollMode } from "../../shared/titleScroll";
import type {
  AccentColor,
  DockLayout,
  EqBandCount,
  EqCustomPreset,
  WheelDirection,
  HotkeyConfig,
  ProxyConfig,
  SavedTrack,
  Station,
  TrackTags,
  VizMode,
  VizResponse,
  WindowControlsSide,
} from "../../shared/types";

export type PlaybackMode = "local" | "radio";
export type RadioView = "search" | "favorites" | "add" | "saved";

export interface Track {
  name: string;
  file: File | null;
  path: string | null;
  tags?: TrackTags;
  duration?: number | null;
  start?: number;
  end?: number | null;
  alac?: boolean;
  unplayable?: boolean;
}

export const state = {
  queue: [] as Track[],
  currentIndex: -1,
  localPlayRequested: false,
  skipDirection: 1 as 1 | -1,
  isSeeking: false,
  restoring: true,

  playbackMode: "local" as PlaybackMode,
  currentStation: null as Station | null,
  favoriteStations: [] as Station[],
  radioResults: [] as Station[],
  radioView: "search" as RadioView,
  radioTrackTitleEnabled: true,
  playerClockEnabled: false,
  stereoRadio: false,
  stereoTracks: false,
  stereoStrength: 50,
  stereoPseudo: true,
  windowControlsSide: (hotkeys.isMac ? "left" : "right") as WindowControlsSide,
  separateWindows: false,
  separateActive: false,
  dockLayout: {} as DockLayout,
  presetAutoSwitch: true,
  presetHardCuts: false,
  presetFolder: "",
  nowPlayingTitle: null as string | null,
  savedTracks: [] as SavedTrack[],

  playlistOpen: false,
  eqOpen: false,
  radioOpen: false,
  uiScale: 1,

  eqEnabled: true,
  eqBandCount: 10 as EqBandCount,
  chordsOpen: false,
  chordsCapo: 0,
  chordsSimplify: false,
  eqWheel: null as WheelDirection | null,
  bandGains: new Array(10).fill(0) as number[],
  preampDb: 0,
  eqPreset: "flat",
  customEq: { bandGains: new Array(10).fill(0), preampDb: 0 } as EqCustomPreset,
  fineCustomEq: null as EqCustomPreset | null,

  vizMode: "spectrum" as VizMode,
  vizResponse: "smooth" as VizResponse,
  coverArtEnabled: true,
  coverArt: null as string | null,
  titleScroll: TITLE_SCROLL_DEFAULT as TitleScrollMode,
  titleScrollSpeed: TITLE_SCROLL_SPEED_DEFAULT,

  proxy: { enabled: false, type: "http", host: "", port: "", username: "", password: "" } as ProxyConfig,
  loggingEnabled: false,
  autoUpdateEnabled: true,
  skippedUpdateVersion: "",
  trayIconEnabled: false,
  closeMinimizesToTrayEnabled: false,
  accentColor: { ...accentColorTheme.DEFAULT } as AccentColor,

  hotkeyConfig: hotkeys.defaults() as HotkeyConfig,
  globalHotkeyFailures: [] as string[],
};
