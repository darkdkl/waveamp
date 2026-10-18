import { execFile } from "node:child_process";

const TIMEOUT_MS = 2000;

function run(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: TIMEOUT_MS }, (err, stdout) => resolve(err ? null : stdout.trim()));
  });
}

export function parseMacSwipeDirection(output: string | null): boolean {
  return output !== "0";
}

export function parseGsettingsBool(output: string | null): boolean | null {
  if (output === "true") return true;
  if (output === "false") return false;
  return null;
}

export async function systemNaturalScroll(): Promise<boolean> {
  if (process.platform === "darwin") {
    return parseMacSwipeDirection(await run("defaults", ["read", "-g", "com.apple.swipescrolldirection"]));
  }
  if (process.platform === "linux") {
    return parseGsettingsBool(await run("gsettings", ["get", "org.gnome.desktop.peripherals.mouse", "natural-scroll"])) ?? false;
  }
  return false;
}
