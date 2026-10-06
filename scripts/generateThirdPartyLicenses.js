const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "THIRD_PARTY_LICENSES.txt");
const LICENSE_FILE_RE = /^(licen[sc]e|copying)([.-].*)?$/i;

const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

function authorName(author) {
  if (!author) return null;
  return typeof author === "string" ? author.replace(/\s*[<(].*$/, "") : author.name || null;
}

function repositoryUrl(repository) {
  const url = typeof repository === "string" ? repository : repository?.url;
  if (!url) return null;
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) return `https://github.com/${url}`;
  return url.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
}

function licenseText(dir, pkg) {
  const file = fs.readdirSync(dir).find((name) => LICENSE_FILE_RE.test(name));
  if (file) return fs.readFileSync(path.join(dir, file), "utf8").trim();
  if (pkg.license === "MIT") {
    return `Copyright (c) ${authorName(pkg.author) || `the ${pkg.name} authors`}\n\n${MIT_TEXT}`;
  }
  return `(No license file is shipped with this package; declared license: ${pkg.license || "unknown"}.)`;
}

const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
const dirs = Object.entries(lock.packages)
  .filter(([key, entry]) => key.startsWith("node_modules/") && !entry.dev)
  .map(([key]) => key);
dirs.push("node_modules/electron");

const seen = new Set();
const entries = dirs
  .map((key) => {
    const dir = path.join(ROOT, key);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    return { dir, pkg };
  })
  .filter(({ pkg }) => {
    const id = `${pkg.name}@${pkg.version}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  })
  .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));

const sections = entries.map(({ dir, pkg }) =>
  [
    `${pkg.name} ${pkg.version}`,
    `License: ${pkg.license || "see below"}`,
    repositoryUrl(pkg.repository) && `Source: ${repositoryUrl(pkg.repository)}`,
    "",
    licenseText(dir, pkg),
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n")
);

const projectmDir = path.join(ROOT, "src", "renderer", "vendor", "projectm");
const projectmVersion = fs.readFileSync(path.join(projectmDir, "VERSION.txt"), "utf8").trim();
sections.push(
  [
    `projectM (${projectmVersion})`,
    "License: LGPL-2.1",
    "Source: https://github.com/projectM-visualizer/projectm",
    "Built into the visualizer as WebAssembly by scripts/build-projectm.sh.",
    "",
    fs.readFileSync(path.join(projectmDir, "LICENSE.txt"), "utf8").trim(),
  ].join("\n")
);

sections.push(
  [
    "Apple Lossless Audio Codec (ALAC)",
    "Copyright (c) 2011 Apple Inc.",
    "License: Apache-2.0",
    "Source: https://github.com/macosforge/alac",
    "The ALAC decoder in src/main/alac follows Apple's reference decoder.",
    "",
    fs.readFileSync(path.join(ROOT, "src", "main", "alac", "LICENSE.txt"), "utf8").trim(),
  ].join("\n")
);

const header = `WaveAMP — third-party software notices
======================================

WaveAMP itself is free software under the GNU General Public License,
version 3 or later — see LICENSE. It includes the open-source packages
listed below, each distributed under its own license. Chromium and the
other components bundled with Electron are listed in
LICENSES.chromium.html, next to this file in the installed application.

${entries.length} packages, plus projectM and the ALAC decoder.`;

fs.writeFileSync(OUTPUT, [header, ...sections].join(`\n\n${"-".repeat(78)}\n\n`) + "\n");
console.log(`Wrote ${path.relative(ROOT, OUTPUT)} (${entries.length} packages)`);
