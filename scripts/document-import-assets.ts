import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { zipSync } from "fflate";
// Trusted package resources, bundled into the lazy import worker, never fetched.
export function documentImportAssets() {
  const id = "\0mysteryboard-import-assets";
  return {
    name: "mysteryboard-import-assets",
    resolveId(source: string) {
      if (source === "virtual:document-import-assets") return id;
    },
    load(source: string) {
      if (source !== id) return;
      const entries: Record<string, Uint8Array> = {};
      for (const folder of ["cmaps", "standard_fonts", "wasm"])
        for (const file of readdirSync(
          resolve("node_modules/pdfjs-dist", folder),
        ).sort()) {
          if (
            file.endsWith(".bcmap") ||
            file.endsWith(".pfb") ||
            file.endsWith(".ttf") ||
            ["openjpeg.wasm", "jbig2.wasm", "qcms_bg.wasm"].includes(file)
          )
            entries[file] = readFileSync(
              resolve("node_modules/pdfjs-dist", folder, file),
            );
        }
      return (
        "export default " +
        JSON.stringify(
          Buffer.from(
            zipSync(entries, {
              level: 9,
              mtime: new Date(2000, 0, 1, 0, 0, 0),
            }),
          ).toString("base64"),
        )
      );
    },
  };
}
