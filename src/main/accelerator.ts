const ACCELERATOR_KEYS: Record<string, string> = {
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  Comma: ",", Period: ".", Slash: "/", Backslash: "\\", Semicolon: ";", Quote: "'",
  BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`",
};

export function comboToAccelerator(combo: string, platform: NodeJS.Platform = process.platform): string | null {
  const parts = combo.split("+");
  const code = parts.pop();
  const mods = parts.map((mod) =>
    ({ Ctrl: "Control", Alt: "Alt", Shift: "Shift", Meta: platform === "darwin" ? "Command" : "Super" })[mod]
  );
  let key = ACCELERATOR_KEYS[code];
  if (!key && /^Key[A-Z]$/.test(code)) key = code.slice(3);
  if (!key && /^Digit\d$/.test(code)) key = code.slice(5);
  if (!key && /^Numpad\d$/.test(code)) key = "num" + code.slice(6);
  if (!key && /^(F\d{1,2}|Space|Home|End|PageUp|PageDown|Insert|Delete|Tab|Enter|Escape|Backspace)$/.test(code)) key = code;
  return key && !mods.includes(undefined) ? [...mods, key].join("+") : null;
}
