(function () {
  const DEFAULT = { hue: 134, saturation: 96, tint: 0 };

  const PRESETS = [
    { nameKey: "accentPresetClassic", hue: 134, saturation: 96, tint: 0 },
    { nameKey: "accentPresetAmber", hue: 38, saturation: 95, tint: 0 },
    { nameKey: "accentPresetIce", hue: 195, saturation: 90, tint: 0 },
    { nameKey: "accentPresetViolet", hue: 270, saturation: 80, tint: 0 },
    { nameKey: "accentPresetRuby", hue: 352, saturation: 85, tint: 0 },
    { nameKey: "accentPresetMono", hue: 0, saturation: 0, tint: 0 },
    { nameKey: "accentPresetBlueBody", hue: 210, saturation: 85, tint: 50 },
    { nameKey: "accentPresetWarmBody", hue: 28, saturation: 90, tint: 45 },
  ];

  function clampInt(value, min, max, fallback) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function normalize(color) {
    const hue = Math.round(Number(color?.hue));
    return {
      hue: Number.isFinite(hue) ? ((hue % 360) + 360) % 360 : DEFAULT.hue,
      saturation: clampInt(color?.saturation, 0, 100, DEFAULT.saturation),
      tint: clampInt(color?.tint, 0, 100, 0),
    };
  }

  function apply(color) {
    const { hue, saturation, tint } = normalize(color);
    const root = document.documentElement.style;
    root.setProperty("--accent-h", String(hue));
    root.setProperty("--accent-s", `${saturation}%`);
    root.setProperty("--chrome-tint", `${tint}%`);
  }

  window.accentColor = { DEFAULT, PRESETS, normalize, apply };
})();
