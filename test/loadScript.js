import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadScript(file, globals = {}) {
  const context = vm.createContext({ window: {}, ...globals });
  const code = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  vm.runInContext(code, context, { filename: file });
  return context;
}

export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
