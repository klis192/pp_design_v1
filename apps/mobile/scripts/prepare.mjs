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
// Push is enabled per platform only when the customer's credentials are given:
// WAREHOUSE_GOOGLE_SERVICES_JSON (Firebase app config for Android) and
// WAREHOUSE_IOS_PUSH=1 (Apple account with the Push Notifications capability).
const googleServices = process.env.WAREHOUSE_GOOGLE_SERVICES_JSON ?? "";
if (googleServices) {
  const clients = JSON.parse(fs.readFileSync(googleServices, "utf8")).client;
  if (
    !clients?.some(
      (c) => c.client_info?.android_client_info?.package_name === appId,
    )
  )
    throw Error(`${googleServices} has no Android app ${appId}`);
}
const pushPlatforms = [
  ...(googleServices ? ["android"] : []),
  ...(process.env.WAREHOUSE_IOS_PUSH === "1" ? ["ios"] : []),
];
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
      // iOS shows a notification banner even while the app is open.
      plugins: {
        PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
      },
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
      VITE_WAREHOUSE_PUSH: pushPlatforms.join(","),
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
// A project prepared earlier with push must not keep it when rebuilt without:
// a free Apple ID cannot sign the push entitlement.
if (platform === "android" && !pushPlatforms.includes("android"))
  fs.rmSync(path.join(target, "android/app/google-services.json"), {
    force: true,
  });
if (platform === "ios" && !pushPlatforms.includes("ios")) {
  fs.rmSync(path.join(target, "ios/App/App/App.entitlements"), { force: true });
  const projectFile = path.join(
    target,
    "ios/App/App.xcodeproj/project.pbxproj",
  );
  fs.writeFileSync(
    projectFile,
    fs
      .readFileSync(projectFile, "utf8")
      .replace(/\n\s*CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g, ""),
  );
}
if (platform === "android" && pushPlatforms.includes("android")) {
  // The Gradle template applies google-services only when this file exists.
  fs.copyFileSync(
    googleServices,
    path.join(target, "android/app/google-services.json"),
  );
  // Android 13+ asks for permission before showing notifications.
  const manifestFile = path.join(
    target,
    "android/app/src/main/AndroidManifest.xml",
  );
  const manifest = fs.readFileSync(manifestFile, "utf8");
  if (!manifest.includes("android.permission.POST_NOTIFICATIONS"))
    fs.writeFileSync(
      manifestFile,
      manifest.replace(
        /<\/manifest>\s*$/,
        '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n</manifest>\n',
      ),
    );
}
if (platform === "ios" && pushPlatforms.includes("ios")) {
  // Capacitor's push plugin receives the APNs token through these callbacks.
  const delegateFile = path.join(target, "ios/App/App/AppDelegate.swift");
  let delegate = fs.readFileSync(delegateFile, "utf8");
  if (!delegate.includes("didRegisterForRemoteNotificationsWithDeviceToken"))
    delegate = delegate.replace(
      /\n}\s*$/,
      `

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}
`,
    );
  fs.writeFileSync(delegateFile, delegate);
  // Xcode signs development builds with "development"; App Store and
  // TestFlight exports switch the entitlement to production.
  fs.writeFileSync(
    path.join(target, "ios/App/App/App.entitlements"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>development</string>
</dict>
</plist>
`,
  );
  const projectFile = path.join(
    target,
    "ios/App/App.xcodeproj/project.pbxproj",
  );
  const project = fs.readFileSync(projectFile, "utf8");
  if (!project.includes("CODE_SIGN_ENTITLEMENTS"))
    fs.writeFileSync(
      projectFile,
      project.replaceAll(
        "INFOPLIST_FILE = App/Info.plist;",
        "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tINFOPLIST_FILE = App/Info.plist;",
      ),
    );
}
fs.writeFileSync(
  path.join(target, "build-manifest.json"),
  JSON.stringify(
    {
      platform,
      appId,
      roles,
      push: pushPlatforms,
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
