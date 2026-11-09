import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
// One application for every mobile role. The bundle ID is permanent once the
// app is published: changing it later creates a different store application.
const appId = "ru.skladkontur.app",
  appName = "Склад Контур",
  platform = process.argv[2] ?? "android";
if (!["android", "ios"].includes(platform))
  throw Error("Usage: prepare.mjs android|ios");
const knownRoles = ["tenant", "worker", "manager", "admin"];
const roles = (process.env.WAREHOUSE_MOBILE_ROLES ?? "tenant,worker")
  .split(",")
  .map((role) => role.trim())
  .filter(Boolean);
if (
  !roles.length ||
  roles.some((role) => !knownRoles.includes(role)) ||
  new Set(roles).size !== roles.length
)
  throw Error(
    `WAREHOUSE_MOBILE_ROLES must list distinct roles from: ${knownRoles.join(", ")}`,
  );
const api = new URL(process.env.VITE_WAREHOUSE_API_BASE_URL ?? "");
if (
  api.protocol !== "https:" ||
  api.username ||
  api.password ||
  api.search ||
  api.hash ||
  api.pathname !== "/"
)
  throw Error("Set VITE_WAREHOUSE_API_BASE_URL to the HTTPS CRM origin");
const target = path.join(root, ".local/mobile/app");
const { version, dependencies } = JSON.parse(
  fs.readFileSync(path.join(root, "apps/mobile/package.json"), "utf8"),
);
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw Error("A stable mobile version is required");
const [major, minor, patch] = version.split(".").map(Number),
  versionCode = major * 10000 + minor * 100 + patch;
fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(
  path.join(target, "package.json"),
  // Capacitor registers native plugins from this manifest's dependencies.
  JSON.stringify(
    { name: "wirehouse-mobile", version, private: true, dependencies },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(target, "capacitor.config.json"),
  JSON.stringify(
    {
      appId,
      appName,
      webDir: "www",
      // Android 15 draws apps under the system bars; keep the WebView inside
      // them. iOS draws under the notch and styles/mobile-app.css pads it.
      android: { adjustMarginsForEdgeToEdge: "auto" },
    },
    null,
    2,
  ),
);
const nodeModules = path.join(target, "node_modules");
if (!fs.existsSync(nodeModules))
  fs.symlinkSync(
    path.join(root, "node_modules"),
    nodeModules,
    process.platform === "win32" ? "junction" : "dir",
  );
const vite = path.join(root, "node_modules/vite/bin/vite.js");
execFileSync(
  process.execPath,
  [vite, "build", "--outDir", path.join(target, "www"), "--emptyOutDir"],
  {
    cwd: path.join(root, "apps/web"),
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_WAREHOUSE_MOBILE_ROLES: roles.join(","),
      VITE_WAREHOUSE_API_BASE_URL: api.origin,
    },
  },
);
const cap = path.join(root, "node_modules/@capacitor/cli/bin/capacitor");
if (!fs.existsSync(path.join(target, platform)))
  execFileSync(process.execPath, [cap, "add", platform], {
    cwd: target,
    stdio: "inherit",
  });
execFileSync(process.execPath, [cap, "sync", platform], {
  cwd: target,
  stdio: "inherit",
});
const nativeVersionFile =
  platform === "android"
    ? path.join(target, "android/app/build.gradle")
    : path.join(target, "ios/App/App.xcodeproj/project.pbxproj");
let nativeVersion = fs.readFileSync(nativeVersionFile, "utf8");
nativeVersion =
  platform === "android"
    ? nativeVersion
        .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
        .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)
    : nativeVersion
        .replace(
          /CURRENT_PROJECT_VERSION = [^;]+;/g,
          `CURRENT_PROJECT_VERSION = ${versionCode};`,
        )
        .replace(
          /MARKETING_VERSION = [^;]+;/g,
          `MARKETING_VERSION = ${version};`,
        );
fs.writeFileSync(nativeVersionFile, nativeVersion);
if (platform === "ios") {
  // iOS terminates an app that opens the camera without a usage description.
  const plistFile = path.join(target, "ios/App/App/Info.plist");
  let plist = fs.readFileSync(plistFile, "utf8");
  for (const [key, text] of [
    [
      "NSCameraUsageDescription",
      "Камера нужна, чтобы сфотографировать работу, прибор учета или документ.",
    ],
    [
      "NSPhotoLibraryUsageDescription",
      "Доступ к фото нужен, чтобы приложить снимок к заявке или показанию.",
    ],
  ])
    if (!plist.includes(`<key>${key}</key>`))
      plist = plist.replace(
        /<\/dict>\s*<\/plist>\s*$/,
        `\t<key>${key}</key>\n\t<string>${text}</string>\n</dict>\n</plist>\n`,
      );
  fs.writeFileSync(plistFile, plist);
}
fs.writeFileSync(
  path.join(target, "build-manifest.json"),
  JSON.stringify(
    {
      platform,
      appId,
      roles,
      apiOrigin: api.origin,
      version,
      builtAt: new Date().toISOString(),
      boundary:
        "Prepared native source; no assertion of device, push or store validation",
    },
    null,
    2,
  ),
);
console.log(`Prepared ${platform} (${roles.join(", ")}): ${target}`);
