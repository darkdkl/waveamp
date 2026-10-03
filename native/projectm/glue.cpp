#include <emscripten.h>
#include <emscripten/html5.h>

extern "C" {
#include <projectM-4/projectM.h>
}

static projectm_handle pm = nullptr;
static EMSCRIPTEN_WEBGL_CONTEXT_HANDLE context = 0;

static void onSwitchRequested(bool isHardCut, void*) {
  EM_ASM({ if (Module.onPresetSwitchRequested) Module.onPresetSwitchRequested($0 !== 0); }, isHardCut ? 1 : 0);
}

static void onSwitchFailed(const char*, const char* message, void*) {
  EM_ASM({ if (Module.onPresetFailed) Module.onPresetFailed(UTF8ToString($0)); }, message);
}

extern "C" {

EMSCRIPTEN_KEEPALIVE int pm_init(const char* canvasSelector, int width, int height) {
  EmscriptenWebGLContextAttributes attributes;
  emscripten_webgl_init_context_attributes(&attributes);
  attributes.majorVersion = 2;
  attributes.minorVersion = 0;
  attributes.alpha = false;
  attributes.depth = false;
  attributes.antialias = false;
  context = emscripten_webgl_create_context(canvasSelector, &attributes);
  if (context <= 0) return -1;
  emscripten_webgl_make_context_current(context);
  emscripten_webgl_enable_extension(context, "OES_texture_float");
  emscripten_webgl_enable_extension(context, "OES_texture_float_linear");
  emscripten_webgl_enable_extension(context, "EXT_color_buffer_float");
  pm = projectm_create();
  if (!pm) return -2;
  projectm_set_window_size(pm, width, height);
  projectm_set_preset_switch_requested_event_callback(pm, onSwitchRequested, nullptr);
  projectm_set_preset_switch_failed_event_callback(pm, onSwitchFailed, nullptr);
  return 0;
}

EMSCRIPTEN_KEEPALIVE void pm_resize(int width, int height) {
  if (pm) projectm_set_window_size(pm, width, height);
}

EMSCRIPTEN_KEEPALIVE void pm_load_preset(const char* data, int smooth) {
  if (pm) projectm_load_preset_data(pm, data, smooth != 0);
}

EMSCRIPTEN_KEEPALIVE void pm_add_pcm(const float* samples, int frames) {
  if (pm) projectm_pcm_add_float(pm, samples, frames, PROJECTM_STEREO);
}

EMSCRIPTEN_KEEPALIVE void pm_render() {
  if (!pm) return;
  emscripten_webgl_make_context_current(context);
  projectm_opengl_render_frame(pm);
}

EMSCRIPTEN_KEEPALIVE void pm_set_preset_duration(double seconds) {
  if (pm) projectm_set_preset_duration(pm, seconds);
}

EMSCRIPTEN_KEEPALIVE void pm_set_soft_cut_duration(double seconds) {
  if (pm) projectm_set_soft_cut_duration(pm, seconds);
}

EMSCRIPTEN_KEEPALIVE void pm_set_hard_cuts(int enabled) {
  if (pm) projectm_set_hard_cut_enabled(pm, enabled != 0);
}

EMSCRIPTEN_KEEPALIVE void pm_set_locked(int locked) {
  if (pm) projectm_set_preset_locked(pm, locked != 0);
}

}
