export type Lang = "ru" | "en";
export type VizMode = "spectrum" | "meters" | "scope";
export type VizResponse = "smooth" | "peak";
export type ProxyType = "http" | "socks5";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? DeepPartial<U>[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface Station {
  stationuuid: string;
  name: string;
  url: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  state: string;
  bitrate: number;
  codec: string;
  custom?: boolean;
  sourceUrl?: string;
}

export interface NowPlayingUpdate {
  url: string;
  title: string | null;
}

export interface SavedTrack {
  title: string;
  station: string;
  savedAt: number;
}

export interface CountedOption {
  name: string;
  count: number;
}

export interface CountryOption extends CountedOption {
  code: string;
}

export interface StationSearchParams {
  name?: string;
  country?: string;
  state?: string;
  tag?: string;
  limit?: number;
}

export interface TrackTags {
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
}

export interface AccentColor {
  hue: number;
  saturation: number;
  tint: number;
}

export interface HotkeyConfig {
  local: Record<string, string>;
  global: Record<string, string>;
  globalEnabled: boolean;
}

export interface GlobalHotkeyRequest {
  enabled: boolean;
  bindings: Record<string, string>;
}

export interface ProxyConfig {
  enabled: boolean;
  type: ProxyType;
  host: string;
  port: string;
  username: string;
  password: string;
}

export interface EqCustomPreset {
  bandGains: number[];
  preampDb: number;
}

export interface AppConfig {
  version: number;
  playlist: {
    tracks: { name: string; path: string }[];
    currentIndex: number;
  };
  eq: {
    bandGains: number[];
    preampDb: number;
    enabled: boolean;
    preset: string;
    custom: EqCustomPreset;
  };
  radio: {
    favorites: Station[];
  };
  settings: {
    lang: Lang;
    scale: number;
    accentColor: AccentColor;
    vizResponse: VizResponse;
    coverArtEnabled: boolean;
    radioTrackTitleEnabled: boolean;
    playerClockEnabled: boolean;
    hotkeys: HotkeyConfig;
    volume: number;
    loggingEnabled: boolean;
    proxy: ProxyConfig;
    autoUpdateEnabled: boolean;
    skippedUpdateVersion: string;
    showTrayIcon: boolean;
    closeMinimizesToTray: boolean;
  };
  ui: {
    playlistOpen: boolean;
    eqOpen: boolean;
    radioOpen: boolean;
    vizMode: VizMode;
  };
}

export type StoredConfig = DeepPartial<AppConfig>;

export interface SettingsState {
  lang: Lang;
  scale: number;
  zoomFactor: number;
  accentColor: AccentColor;
  vizResponse: VizResponse;
  coverArtEnabled: boolean;
  radioTrackTitleEnabled: boolean;
  playerClockEnabled: boolean;
  hotkeys: HotkeyConfig;
  globalHotkeyFailures: string[];
  proxy: ProxyConfig;
  loggingEnabled: boolean;
  autoUpdateEnabled: boolean;
  showTrayIcon: boolean;
  closeMinimizesToTray: boolean;
}

export type SettingsAction =
  | { type: "setLanguage"; value: Lang }
  | { type: "setScale"; value: number }
  | { type: "setAccentColor"; value: AccentColor }
  | { type: "setVizResponse"; value: VizResponse }
  | { type: "setCoverArtEnabled"; value: boolean }
  | { type: "setRadioTrackTitleEnabled"; value: boolean }
  | { type: "setPlayerClockEnabled"; value: boolean }
  | { type: "setHotkeys"; value: HotkeyConfig }
  | { type: "setProxyConfig"; value: ProxyConfig }
  | { type: "setLoggingEnabled"; value: boolean }
  | { type: "setAutoUpdateEnabled"; value: boolean }
  | { type: "setTrayIconEnabled"; value: boolean }
  | { type: "setCloseMinimizesToTrayEnabled"; value: boolean };

export type SettingsActionValue<T extends SettingsAction["type"]> = Extract<SettingsAction, { type: T }>["value"];

export type ResolveStreamResult = { ok: true; url: string } | { ok: false; error: "invalid" | "playlist" };

export type UpdateCheckResult =
  | { ok: true; upToDate: boolean; version: string; url: string }
  | { ok: false; message: string };

export type LogLevel = "info" | "warn" | "error";

export type MediaKeyAction = "playpause" | "next" | "previous" | "stop";
