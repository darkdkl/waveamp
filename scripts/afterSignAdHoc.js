const { execFileSync } = require("node:child_process");
const path = require("node:path");

// A fully unsigned macOS build can't connect through LAN proxies; an ad-hoc signature fixes it.
module.exports = async function afterSignAdHoc(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--deep", "--force", "--sign", "-", appPath]);
};
