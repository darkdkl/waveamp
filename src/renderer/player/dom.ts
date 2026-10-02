function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export const audio = byId<HTMLAudioElement>("audio");
audio.crossOrigin = "anonymous";
export const player = byId("player");
export const fileInput = byId<HTMLInputElement>("fileInput");
export const folderInput = byId<HTMLInputElement>("folderInput");

export const windowControls = byId("windowControls");
export const minimizeBtn = byId<HTMLButtonElement>("minimizeBtn");
export const closeBtn = byId<HTMLButtonElement>("closeBtn");

export const playerDisplay = document.querySelector(".player__display") as HTMLElement;
export const trackTitle = byId("trackTitle");
export const saveTrackBtn = byId<HTMLButtonElement>("saveTrackBtn");
export const timeDisplay = byId("time");
export const durTime = byId("durTime");
export const liveTag = byId("liveTag");
export const playStateIcon = byId("playState");
export const vizCanvas = byId<HTMLCanvasElement>("vizCanvas");
export const seek = byId<HTMLInputElement>("seek");
export const volume = byId<HTMLInputElement>("volume");

export const playBtn = byId<HTMLButtonElement>("playBtn");
export const pauseBtn = byId<HTMLButtonElement>("pauseBtn");
export const stopBtn = byId<HTMLButtonElement>("stopBtn");
export const prevBtn = byId<HTMLButtonElement>("prevBtn");
export const nextBtn = byId<HTMLButtonElement>("nextBtn");

export const playlistBtn = byId<HTMLButtonElement>("playlistBtn");
export const playlist = byId("playlist");
export const playlistList = byId<HTMLUListElement>("playlistList");
export const playlistListFrame = byId("playlistListFrame");
export const playlistEmpty = byId("playlistEmpty");
export const playlistClearBtn = byId<HTMLButtonElement>("playlistClearBtn");
export const playlistResizeHandle = byId("playlistResizeHandle");
export const playlistAddWrap = byId("playlistAddWrap");
export const playlistAddBtn = byId<HTMLButtonElement>("playlistAddBtn");
export const playlistAddMenu = byId("playlistAddMenu");
export const addFilesMenuItem = byId<HTMLButtonElement>("addFilesMenuItem");
export const addFolderMenuItem = byId<HTMLButtonElement>("addFolderMenuItem");

export const settingsBtn = byId<HTMLButtonElement>("settingsBtn");

export const eqBtn = byId<HTMLButtonElement>("eqBtn");
export const eq = byId("eq");
export const eqToggleBtn = byId<HTMLButtonElement>("eqToggleBtn");
export const eqResetBtn = byId<HTMLButtonElement>("eqResetBtn");
export const eqPresetSelect = byId<HTMLSelectElement>("eqPresetSelect");
export const eqPreamp = byId("eqPreamp");
export const eqBandGroup = byId("eqBandGroup");

export const radioBtn = byId<HTMLButtonElement>("radioBtn");
export const radio = byId("radio");
export const radioTabSearch = byId<HTMLButtonElement>("radioTabSearch");
export const radioTabFavorites = byId<HTMLButtonElement>("radioTabFavorites");
export const radioTabAdd = byId<HTMLButtonElement>("radioTabAdd");
export const radioTabSaved = byId<HTMLButtonElement>("radioTabSaved");
export const radioSavedCount = byId("radioSavedCount");
export const radioSavedView = byId("radioSavedView");
export const radioSavedFrame = byId("radioSavedFrame");
export const radioSavedList = byId<HTMLUListElement>("radioSavedList");
export const radioSavedEmpty = byId("radioSavedEmpty");
export const radioSavedMenuWrap = byId("radioSavedMenuWrap");
export const radioSavedMenuBtn = byId<HTMLButtonElement>("radioSavedMenuBtn");
export const radioSavedMenu = byId("radioSavedMenu");
export const savedCopyAllBtn = byId<HTMLButtonElement>("savedCopyAllBtn");
export const savedClearBtn = byId<HTMLButtonElement>("savedClearBtn");
export const radioSearchView = byId("radioSearchView");
export const radioFavoritesView = byId("radioFavoritesView");
export const radioAddView = byId("radioAddView");
export const radioAddFrame = byId<HTMLFormElement>("radioAddFrame");
export const radioAddTitle = byId("radioAddTitle");
export const radioAddName = byId<HTMLInputElement>("radioAddName");
export const radioAddUrl = byId<HTMLInputElement>("radioAddUrl");
export const radioAddError = byId("radioAddError");
export const radioAddCancel = byId<HTMLButtonElement>("radioAddCancel");
export const radioAddSubmit = byId<HTMLButtonElement>("radioAddSubmit");
export const radioFavCount = byId("radioFavCount");
export const radioCountrySelect = byId<HTMLSelectElement>("radioCountrySelect");
export const radioStateSelect = byId<HTMLSelectElement>("radioStateSelect");
export const radioTagSelect = byId<HTMLSelectElement>("radioTagSelect");
export const radioSearchForm = byId<HTMLFormElement>("radioSearchForm");
export const radioSearchInput = byId<HTMLInputElement>("radioSearchInput");
export const radioFavoritesList = byId<HTMLUListElement>("radioFavoritesList");
export const radioFavoritesFrame = byId("radioFavoritesFrame");
export const radioResultsList = byId<HTMLUListElement>("radioResultsList");
export const radioResultsFrame = byId("radioResultsFrame");
export const radioEmpty = byId("radioEmpty");
export const radioFavEmpty = byId("radioFavEmpty");
export const radioResizeHandle = byId("radioResizeHandle");
