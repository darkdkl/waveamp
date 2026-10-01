function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function playlistKind(url) {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith(".pls")) return "pls";
  if (path.endsWith(".m3u")) return "m3u";
  return null;
}

function parsePlaylistStreamUrl(text, kind, baseUrl) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim());
  const isPls = kind === "pls" || /^\[playlist\]$/i.test(lines[0] || "");
  for (const line of lines) {
    let candidate = null;
    if (isPls) {
      const match = /^File\d+\s*=\s*(.+)$/i.exec(line);
      if (match) candidate = match[1].trim();
    } else if (line && !line.startsWith("#")) {
      candidate = line;
    }
    if (!candidate) continue;
    try {
      const resolved = new URL(candidate, baseUrl).href;
      if (isHttpUrl(resolved)) return resolved;
    } catch {}
  }
  return null;
}

module.exports = { isHttpUrl, playlistKind, parsePlaylistStreamUrl };
