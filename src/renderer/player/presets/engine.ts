import createProjectM, { type ProjectMModule } from "../../vendor/projectm/projectm.js";
import wasmUrl from "../../vendor/projectm/projectm.wasm?url";
import { interleaveStereo } from "./pcm";

const PCM_FRAMES = 1024;

export class PresetEngine {
  private readonly pcm = new Float32Array(PCM_FRAMES * 2);

  private constructor(
    private readonly module: ProjectMModule,
    private readonly pcmPointer: number
  ) {}

  static async create(canvasSelector: string, width: number, height: number): Promise<PresetEngine> {
    const module = await createProjectM({ locateFile: () => wasmUrl });
    const selector = module.stringToNewUTF8(canvasSelector);
    const result = module._pm_init(selector, width, height);
    module._free(selector);
    if (result !== 0) throw new Error(`projectM init failed (${result})`);
    return new PresetEngine(module, module._malloc(PCM_FRAMES * 2 * Float32Array.BYTES_PER_ELEMENT));
  }

  onSwitchRequested(callback: (isHardCut: boolean) => void): void {
    this.module.onPresetSwitchRequested = callback;
  }

  onFailed(callback: (message: string) => void): void {
    this.module.onPresetFailed = callback;
  }

  load(text: string, smooth: boolean): void {
    const pointer = this.module.stringToNewUTF8(text);
    this.module._pm_load_preset(pointer, smooth ? 1 : 0);
    this.module._free(pointer);
  }

  addPcm(left: Float32Array, right: Float32Array): void {
    const frames = interleaveStereo(left, right, this.pcm, PCM_FRAMES);
    this.module.HEAPF32.set(this.pcm.subarray(0, frames * 2), this.pcmPointer / Float32Array.BYTES_PER_ELEMENT);
    this.module._pm_add_pcm(this.pcmPointer, frames);
  }

  render(): void {
    this.module._pm_render();
  }

  resize(width: number, height: number): void {
    this.module._pm_resize(width, height);
  }

  setPresetDuration(seconds: number): void {
    this.module._pm_set_preset_duration(seconds);
  }

  setSoftCutDuration(seconds: number): void {
    this.module._pm_set_soft_cut_duration(seconds);
  }

  setHardCuts(enabled: boolean): void {
    this.module._pm_set_hard_cuts(enabled ? 1 : 0);
  }

  setLocked(locked: boolean): void {
    this.module._pm_set_locked(locked ? 1 : 0);
  }
}
