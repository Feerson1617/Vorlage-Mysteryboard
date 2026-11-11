import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { selectBuildTargets } from "./content-config.ts";
const licenses = [
  ["react", "LICENSE"],
  ["react-dom", "LICENSE"],
  ["scheduler", "LICENSE"],
  ["fflate", "LICENSE"],
  ["jsqr", "LICENSE"],
  ["qrcode", "license"],
  ["@noble/hashes", "LICENSE"],
  ["dijkstrajs", "LICENSE.md"],
];
export async function checkBuilds(targets = selectBuildTargets()) {
  let notices = "Third-party notices\n";
  for (const [pkg, file] of licenses) {
    const metadata = JSON.parse(
      await readFile(`node_modules/${pkg}/package.json`, "utf8"),
    );
    notices += `\n${pkg} ${metadata.version}\n${await readFile(`node_modules/${pkg}/${file}`, "utf8")}\n`;
  }
  for (const { key: mode, output, testOnly } of targets) {
    const source = await readFile(`dist/${mode}/index.html`, "utf8");
    const text = source.replace(
      "</html>",
      `<!--\n${notices.replaceAll("--", "- -")}\n-->\n</html>`,
    );
    const html = Buffer.from(text);
    if (html.length >= 10_000_000)
      throw new Error(
        `Die HTML-Datei (${mode}) ist mit ${html.length} Bytes zu groß. Erlaubt sind weniger als 10.000.000 Bytes.`,
      );
    if (
      /<(?:script|link|img)\b[^>]*(?:src|href)=["'](?:https?:|\/|\.\/)/i.test(
        text,
      )
    )
      throw new Error("Die HTML-Datei enthält externe Laufzeitressourcen.");
    const directory = testOnly ? "artifacts/tests" : "artifacts";
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/${output}`, html);
    console.log(
      `${mode}: ${html.length.toLocaleString("de-DE")} Bytes; eigenständiges HTML mit Lizenzhinweisen. ${html.length < 6_000_000 ? "Größenziel erfüllt." : "Über dem Ziel von 6 MB."}`,
    );
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await checkBuilds(selectBuildTargets(process.argv.slice(2)));
}
