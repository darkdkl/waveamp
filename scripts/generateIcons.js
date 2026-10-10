const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const ASSETS = path.join(__dirname, "..", "assets");
const PNG_SIZE = 1024;
const ICNS_ENTRIES = [
  ["icp4", 16],
  ["icp5", 32],
  ["icp6", 64],
  ["ic07", 128],
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024],
  ["ic11", 32],
  ["ic12", 64],
  ["ic13", 256],
  ["ic14", 512],
];

async function rasterize(win, svgFile, size) {
  const svg = fs.readFileSync(path.join(ASSETS, svgFile));
  const source = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  const dataUrl = await win.webContents.executeJavaScript(`(async () => {
    const image = new Image();
    image.src = ${JSON.stringify(source)};
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = ${size};
    canvas.getContext("2d").drawImage(image, 0, 0, ${size}, ${size});
    return canvas.toDataURL("image/png");
  })()`);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

function chunk(type, data) {
  const header = Buffer.alloc(8);
  header.write(type, 0, "ascii");
  header.writeUInt32BE(data.length + 8, 4);
  return Buffer.concat([header, data]);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL("about:blank");
  fs.writeFileSync(path.join(ASSETS, "icon.png"), await rasterize(win, "icon.svg", PNG_SIZE));
  const entries = [];
  for (const [type, size] of ICNS_ENTRIES) entries.push(chunk(type, await rasterize(win, "icon-macos.svg", size)));
  fs.writeFileSync(path.join(ASSETS, "icon.icns"), chunk("icns", Buffer.concat(entries)));
  console.log("Wrote assets/icon.png and assets/icon.icns");
  app.quit();
});
