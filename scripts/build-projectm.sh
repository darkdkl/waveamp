#!/usr/bin/env bash
set -euo pipefail

PROJECTM_VERSION="v4.1.8"
EMSDK_VERSION="6.0.11"
CMAKE_VERSION="4.4.4"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src/renderer/vendor/projectm"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) CMAKE_DIST="cmake-$CMAKE_VERSION-linux-x86_64"; CMAKE_BIN="bin" ;;
  Linux-aarch64) CMAKE_DIST="cmake-$CMAKE_VERSION-linux-aarch64"; CMAKE_BIN="bin" ;;
  Darwin-*) CMAKE_DIST="cmake-$CMAKE_VERSION-macos-universal"; CMAKE_BIN="CMake.app/Contents/bin" ;;
  *) echo "Unsupported platform: $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac

echo "Downloading CMake $CMAKE_VERSION"
curl -fsSL "https://github.com/Kitware/CMake/releases/download/v$CMAKE_VERSION/$CMAKE_DIST.tar.gz" | tar -xz -C "$WORK"
export PATH="$WORK/$CMAKE_DIST/$CMAKE_BIN:$PATH"

echo "Installing Emscripten $EMSDK_VERSION"
git clone --quiet --depth 1 https://github.com/emscripten-core/emsdk.git "$WORK/emsdk"
"$WORK/emsdk/emsdk" install "$EMSDK_VERSION" > /dev/null
"$WORK/emsdk/emsdk" activate "$EMSDK_VERSION" > /dev/null
source "$WORK/emsdk/emsdk_env.sh" > /dev/null 2>&1

echo "Building projectM $PROJECTM_VERSION"
git clone --quiet --depth 1 --branch "$PROJECTM_VERSION" --recurse-submodules --shallow-submodules \
  https://github.com/projectM-visualizer/projectm.git "$WORK/projectm"
emcmake cmake -S "$WORK/projectm" -B "$WORK/build" -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Release \
  -DENABLE_SYSTEM_PROJECTM_EVAL=OFF -DENABLE_PLAYLIST=OFF -DCMAKE_INSTALL_PREFIX="$WORK/install" > /dev/null
cmake --build "$WORK/build" -j"$(getconf _NPROCESSORS_ONLN)" > /dev/null
cmake --install "$WORK/build" > /dev/null

echo "Linking the WebAssembly module"
mkdir -p "$OUT"
em++ -O3 -fexceptions "$ROOT/native/projectm/glue.cpp" -I "$WORK/install/include" \
  "$WORK/install/lib/libprojectM-4.a" "$WORK/build/vendor/projectm-eval/projectm-eval/libprojectM_eval.a" \
  -o "$OUT/projectm.js" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createProjectM -sENVIRONMENT=web \
  -sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2 -sFULL_ES2=1 -sFULL_ES3=1 -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_FUNCTIONS=_pm_init,_pm_resize,_pm_load_preset,_pm_add_pcm,_pm_render,_pm_set_preset_duration,_pm_set_soft_cut_duration,_pm_set_hard_cuts,_pm_set_locked,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=HEAPF32,stringToNewUTF8,UTF8ToString
cp "$WORK/projectm/LICENSE.txt" "$OUT/LICENSE.txt"
echo "projectM $PROJECTM_VERSION, Emscripten $EMSDK_VERSION" > "$OUT/VERSION.txt"
ls -l "$OUT"
