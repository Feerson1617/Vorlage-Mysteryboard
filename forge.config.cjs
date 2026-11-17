const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
module.exports = {
  packagerConfig: {
    name: "MysteryBoard Studio",
    executableName: "MysteryBoard Studio",
    appBundleId: "de.mysteryboard.studio",
    appCategoryType: "public.app-category.education",
    asar: true,
    prune: true,
    ignore: (path) => {
      if (!path) return false;
      return (
        !/^\/(package\.json|studio(?:\/|$))/.test(path) ||
        /^\/studio\/(ui|player)(?:\/|$)/.test(path) ||
        /^\/studio\/dist\/player(?:\/|$)/.test(path) ||
        path.endsWith(".ts")
      );
    },
    osxSign: false,
    osxNotarize: false,
  },
  hooks: {
    postPackage: async (_config, result) => {
      if (result.platform === "darwin") {
        for (const path of result.outputPaths) {
          const app = join(path, "MysteryBoard Studio.app");
          execFileSync(
            "codesign",
            [
              "--force",
              "--deep",
              "--sign",
              "-",
              "--preserve-metadata=entitlements",
              app,
            ],
            { stdio: "inherit" },
          );
          execFileSync("codesign", ["--verify", "--deep", "--strict", app], {
            stdio: "inherit",
          });
        }
      }
    },
  },
  makers: [
    { name: "@electron-forge/maker-zip", platforms: ["darwin", "linux"] },
    {
      name: "@electron-forge/maker-dmg",
      config: { name: "MysteryBoard Studio", format: "ULFO", overwrite: true },
      platforms: ["darwin"],
    },
  ],
};
