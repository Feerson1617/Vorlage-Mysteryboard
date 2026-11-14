// The CLI uses exactly the application's schema and semantic validators.
import { createServer, build } from "vite";
import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import { resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";
import { checkBuilds } from "./check-build.mjs";
import { packageScorm } from "./package-scorm.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const [command, input, output, scormOutput] = process.argv.slice(2);
let server, browser;
try {
  if (
    !["validate", "create", "build"].includes(command) ||
    !input ||
    (command !== "validate" && !output)
  )
    throw new Error(
      "Aufruf: npm run validate:mystery -- DATEI oder npm run create:mystery -- INHALT.json AUFGABE.mysteryboard oder npm run build:mystery -- AUFGABE.mysteryboard AUSGABE.html [AUSGABE-SCORM.zip]",
    );
  const inputPath = resolve(input),
    outputPath = output ? resolve(output) : null,
    scormPath = scormOutput ? resolve(scormOutput) : null;
  if ((await stat(inputPath)).size > 30_000_000)
    throw new Error("Die Eingabedatei überschreitet 30 MB.");
  const bytes = new Uint8Array(await readFile(inputPath));
  server = await createServer({
    configFile: false,
    root,
    logLevel: "error",
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: "custom",
  });
  const core = await server.ssrLoadModule("/src/core/documents.ts");
  let doc;
  if (bytes[0] === 137) doc = core.readDocument(bytes);
  else {
    if (bytes.length > core.MAX_DOCUMENT_BYTES)
      throw new Error("Die JSON-Datei überschreitet 20 MB.");
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    doc = value.format
      ? core.validateDocument(value)
      : core.taskDocument(value);
  }
  // Also verify every image with a real browser decoder, not just its header.
  const executablePath =
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.context().setOffline(true);
  for (const card of doc.content.cards)
    if (card.image)
      await page.evaluate(async (src) => {
        const img = new Image();
        img.src = src;
        await Promise.race([
          img.decode(),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("Bildprüfung nach 8 Sekunden abgebrochen.")),
              8000,
            ),
          ),
        ]);
        img.src = "";
      }, card.image);
  await browser.close();
  browser = null;
  if (command === "validate")
    console.log(
      `Gültig: ${doc.kind}, ${doc.content.id}, Version ${doc.content.version}, ${doc.content.cards.length} Karten. Schema, Referenzen, Prüfsumme und Bilddecoder geprüft.`,
    );
  else {
    if (doc.kind !== "task")
      throw new Error(
        "Erstellen/Build benötigt einen neutralen Aufgabeninhalt. Entwürfe zuerst im Lehrkräftemodus als Schülerversion exportieren.",
      );
    if (
      outputPath === inputPath ||
      scormPath === inputPath ||
      scormPath === outputPath
    )
      throw new Error("Eingabe und Ausgaben müssen verschiedene Dateien sein.");
    for (const path of [outputPath, scormPath].filter(Boolean))
      if (existsSync(path))
        throw new Error(
          `Ausgabedatei existiert bereits und wird nicht überschrieben: ${path}`,
        );
    if (command === "create") {
      if (!outputPath.endsWith(".mysteryboard"))
        throw new Error(
          "Die Aufgaben-Datei benötigt die Endung .mysteryboard.",
        );
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, core.encodeDocument(doc));
    } else {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]*\.html$/.test(basename(outputPath)))
        throw new Error(
          "Bitte einen einfachen HTML-Dateinamen mit .html wählen.",
        );
      if (scormPath && !scormPath.endsWith(".zip"))
        throw new Error("Das SCORM-Paket benötigt die Endung .zip.");
      process.chdir(root);
      await server.close();
      server = null;
      await build({
        mode: "universal",
        define: {
          __UNIVERSAL__: "true",
          // Keep arbitrary card text outside HTML syntax, including mixed-case
          // closing script tags. Decode and validate with the same core at launch.
          __INITIAL_DOCUMENT__: JSON.stringify(
            Buffer.from(core.encodeDocument(doc)).toString("base64"),
          ),
        },
        build: { outDir: "dist/authored-content" },
      });
      await checkBuilds([
        {
          key: "authored-content",
          output: basename(outputPath),
          testOnly: false,
          previewOnly: true,
        },
      ]);
      await mkdir(dirname(outputPath), { recursive: true });
      await copyFile(
        resolve(root, "artifacts/previews", basename(outputPath)),
        outputPath,
      );
      if (scormPath)
        await packageScorm(
          outputPath,
          scormPath,
          `MysteryBoard-${doc.content.id}-${doc.content.version}`,
          doc.content.title,
        );
    }
    console.log(
      `Erstellt: ${outputPath}${scormPath ? " und " + scormPath : ""}. Inhalte bleiben im Lehrkräftemodus bearbeitbar.`,
    );
  }
} catch (error) {
  console.error(`MysteryBoard: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
}
