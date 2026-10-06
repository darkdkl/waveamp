import { protocol } from "electron";
import { writeLog } from "../logging";
import { openAlacFile, parseRange, wavLayout, wavStream } from "./wavStream";

export const ALAC_SCHEME = "waveamp-alac";

export function registerAlacScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ALAC_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
  ]);
}

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

async function handleAlacRequest(request: Request): Promise<Response> {
  const filePath = decodeURIComponent(new URL(request.url).pathname.slice(1));
  let opened;
  try {
    opened = await openAlacFile(filePath);
  } catch (err) {
    writeLog("warn", "alac", `Could not open "${filePath}": ${(err as Error).message}`);
    return new Response(null, { status: 404, headers: CORS_HEADERS });
  }
  if (!opened) return new Response(null, { status: 415, headers: CORS_HEADERS });

  const { track, source, close } = opened;
  const total = wavLayout(track).totalBytes;
  const rangeHeader = request.headers.get("Range");
  const range = parseRange(rangeHeader, total);
  if (!range) {
    close();
    return new Response(null, { status: 416, headers: { ...CORS_HEADERS, "Content-Range": `bytes */${total}` } });
  }
  let frameErrorLogged = false;
  const body = wavStream(track, source, range.first, range.last, close, (err) => {
    if (frameErrorLogged) return;
    frameErrorLogged = true;
    writeLog("warn", "alac", `Could not decode a frame of "${filePath}": ${err.message}`);
  });
  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    "Content-Type": "audio/wav",
    "Accept-Ranges": "bytes",
    "Content-Length": String(range.last - range.first + 1),
  };
  if (rangeHeader) headers["Content-Range"] = `bytes ${range.first}-${range.last}/${total}`;
  return new Response(body, { status: rangeHeader ? 206 : 200, headers });
}

export function handleAlacProtocol(): void {
  protocol.handle(ALAC_SCHEME, handleAlacRequest);
}
