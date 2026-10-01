import { hotkeys } from "../hotkeys";
import { accentColor as accentColorTheme } from "../theme";
import { EQ_BANDS } from "./eqPresets";
import type {
  AccentColor,
  EqCustomPreset,
  HotkeyConfig,
  ProxyConfig,
  Station,
  TrackTags,
  VizMode,
  VizResponse,
} from "../../shared/types";

export type PlaybackMode = "local" | "radio";
export type RadioView = "search" | "favorites" | "add";

export interface Track {
  name: string;
  file: File | null;
  path: string | null;
  tags?: TrackTags;
  duration?: number | null;
  unplayable?: boolean;
}

export const state = {
  queue: [] as Track[],
  currentIndex: -1,
  localPlayRequested: false,
  isSeeking: false,

  playbackMode: "local" as PlaybackMode,
  currentStation: null as Station | null,
  favoriteStations: [] as Station[],
  radioResults: [] as Station[],
  radioView: "search" as RadioView,

  playlistOpen: false,
  eqOpen: false,
  radioOpen: false,
  uiScale: 1,

  eqEnabled: true,
  bandGains: new Array(EQ_BANDS.length).fill(0) as number[],
  preampDb: 0,
  eqPreset: "flat",
  customEq: { bandGains: new Array(EQ_BANDS.length).fill(0), preampDb: 0 } as EqCustomPreset,

  vizMode: "spectrum" as VizMode,
  vizResponse: "smooth" as VizResponse,

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
