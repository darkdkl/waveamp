export interface ProjectMModule {
  HEAPF32: Float32Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  stringToNewUTF8(text: string): number;
  _pm_init(canvasSelector: number, width: number, height: number): number;
  _pm_resize(width: number, height: number): void;
  _pm_load_preset(data: number, smooth: number): void;
  _pm_add_pcm(samples: number, frames: number): void;
  _pm_render(): void;
  _pm_set_preset_duration(seconds: number): void;
  _pm_set_soft_cut_duration(seconds: number): void;
  _pm_set_hard_cuts(enabled: number): void;
  _pm_set_locked(locked: number): void;
  onPresetSwitchRequested?: (isHardCut: boolean) => void;
  onPresetFailed?: (message: string) => void;
}

export default function createProjectM(options?: { locateFile?: (path: string) => string }): Promise<ProjectMModule>;
