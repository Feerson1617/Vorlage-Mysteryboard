import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
// Include the licenses of the locked production graph, including parser transitives.
export async function documentImportLicenses() {
  const lock = JSON.parse(
    await readFile(resolve(root, "package-lock.json"), "utf8"),
  );
  let result =
    "\nDocument import dependencies (locally bundled; no external service)\n";
  for (const [path, pkg] of Object.entries(lock.packages)) {
    if (!path.startsWith("node_modules/") || pkg.dev || pkg.optional) continue;
    try {
      const metadata = JSON.parse(
        await readFile(resolve(root, path, "package.json"), "utf8"),
      );
      const files = (await readdir(resolve(root, path)))
        .sort()
        .filter((n) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(n));
      result += `\n${metadata.name} ${metadata.version}; ${JSON.stringify(metadata.license ?? pkg.license ?? "see license")}\n`;
      for (const file of files)
        result += (await readFile(resolve(root, path, file), "utf8")) + "\n";
    } catch (error) {
      if (!pkg.optional) throw error;
    }
  }
  for (const folder of ["cmaps", "standard_fonts", "wasm"])
    for (const file of (
      await readdir(resolve(root, "node_modules/pdfjs-dist", folder))
    ).sort())
      if (file.startsWith("LICENSE"))
        result +=
          "\npdfjs-dist/" +
          folder +
          "/" +
          file +
          "\n" +
          (await readFile(
            resolve(root, "node_modules/pdfjs-dist", folder, file),
            "utf8",
          )) +
          "\n";
  return result
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}
