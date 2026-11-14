// Creates the documented synthetic paper original and its technical reference.
// This is not an OCR or external-AI transcription. Optional fixture regeneration:
// node scripts/create-paper-fixture.mjs NEW_OUTPUT_DIRECTORY
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = process.argv[2] && resolve(process.argv[2]);
assert(
  output && !existsSync(output),
  "Neuen, noch nicht vorhandenen Ausgabeordner angeben.",
);
await mkdir(output, { recursive: true });
const original = JSON.parse(
  await readFile(
    join(root, "examples/ki-papierprobe/original-karten.json"),
    "utf8",
  ),
);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let browser, server;
try {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1100, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.context().setOffline(true);
  for (const [name, color] of [
    ["oxygen-original", "#2166ac"],
    ["oxygen-alternative", "#8c6d1f"],
  ]) {
    const { labels, values, unit } = original.diagramData;
    const points = values
      .map((v, i) => `${135 + i * 210},${300 - v * 24}`)
      .join(" ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420"><rect width="900" height="420" fill="white"/><g font-family="Arial,sans-serif" fill="#202820"><text x="35" y="36" font-size="25">Gelöster Sauerstoff – synthetische Prüfdaten</text><text x="820" y="90" text-anchor="end" font-size="22">${esc(unit)}</text>${[0, 2, 4, 6, 8, 10].map((v) => `<line x1="115" y1="${300 - v * 24}" x2="820" y2="${300 - v * 24}" stroke="#c4c9c5"/><text x="82" y="${307 - v * 24}" text-anchor="end" font-size="22">${v}</text>`).join("")}<polyline points="${points}" fill="none" stroke="${color}" stroke-width="5"/>${values.map((v, i) => `<circle cx="${135 + i * 210}" cy="${300 - v * 24}" r="7" fill="${color}"/><text x="${135 + i * 210}" y="${282 - v * 24}" text-anchor="middle" font-size="23">${String(v).replace(".", ",")}</text><text x="${135 + i * 210}" y="342" text-anchor="middle" font-size="21">${labels[i]}</text>`).join("")}<text x="35" y="393" font-size="20">Ein oberflächennaher Messpunkt; keine Messung des gesamten Teichs.</text></g></svg>`;
    await writeFile(join(output, name + ".svg"), svg);
    await page.setContent(svg);
    await page.locator("svg").screenshot({ path: join(output, name + ".png") });
  }
  const image = await readFile(join(output, "oxygen-original.png"));
  const cardHtml = (c) =>
    `<article><h2>${c.kind === "Vertiefungskarte" ? "V" : ""}${c.number} · ${esc(c.title)}</h2><p>${esc(c.text)}</p>${c.table ? `<table><caption>${esc(c.table.caption)}</caption><thead><tr>${c.table.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${c.table.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : ""}${c.diagram ? `<img alt="${esc(c.imageAlt)}" src="data:image/png;base64,${image.toString("base64")}">` : ""}<p class="source">Quelle: ${esc(c.source)}</p></article>`;
  const html = `<!doctype html><html lang="de"><meta charset="utf-8"><title>${esc(original.title)} – Papieroriginal</title><style>@page{size:A4 portrait;margin:15mm}*{box-sizing:border-box}body{font:11pt/1.45 Arial,sans-serif;color:#1d3025;margin:0}.cover{break-after:page}h1{font-size:24pt}h2{font-size:14pt;margin:0 0 4mm}p{margin:3mm 0}article{height:126mm;border:1px solid #697c70;padding:5mm;break-inside:avoid;margin-bottom:5mm}article:nth-of-type(2n){break-after:page}img{width:100%;height:auto;max-height:65mm;object-fit:contain}table{border-collapse:collapse;width:100%;font-size:10pt}th,td{border:1px solid #8a968e;padding:2mm;text-align:left}caption{text-align:left;font-weight:bold}.source{font-size:8.5pt;overflow-wrap:anywhere}code{font:inherit}</style><body><section class="cover"><h1>${esc(original.title)}</h1><h2>Leitfrage</h2><p>${esc(original.question)}</p><p>${esc(original.notice)}</p><h2>Arbeit mit den Karten</h2><p>Neun Pflichtkarten und eine freiwillige Vertiefungskarte V10. Die Nummern helfen beim Wiederfinden und geben keine Lösungskette vor. Prüft Datenlücken und alternative Erklärungen.</p><h2>Dokumentation</h2><p>${esc(original.source)}</p><p>${esc(original.rights)}</p><p>Diese druckbare Vorlage ist das Ausgangsmaterial einer späteren Übertragungsprobe. Die separat enthaltene digitale Referenz wurde kontrolliert aus den dokumentierten Originalfeldern erzeugt. Eine erfolgreiche Übertragung durch eine unabhängige fremde KI wird damit nicht behauptet.</p></section>${original.cards.map(cardHtml).join("")}</body></html>`;
  await writeFile(join(output, "Papieroriginal.html"), html);
  await page.setContent(html);
  await page.pdf({
    path: join(output, "Papieroriginal.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  const raw = {
    id: "mystery-parkteich-papierprobe",
    version: "1.0.0",
    title: original.title,
    subtitle: original.question,
    cardGroups: {
      required: { label: "Pflichtkarte", prefix: "" },
      extension: { label: "Vertiefungskarte", prefix: "V" },
    },
    startLayout: { mode: "ordered", columns: 5 },
    help: {
      method:
        "Vergleicht Beobachtungen und Messwerte. Welche Erklärung ist belegt, welche nur vermutet?",
    },
    cards: original.cards.map((c) => ({
      id: c.number,
      title: c.title,
      text: c.text,
      group: c.kind === "Vertiefungskarte" ? "extension" : "required",
      source: c.source,
      ...(c.table ? { table: c.table } : {}),
      ...(c.diagram
        ? {
            image: "data:image/png;base64," + image.toString("base64"),
            imageAlt: c.imageAlt,
          }
        : {}),
    })),
  };
  server = await createServer({
    configFile: false,
    root,
    logLevel: "error",
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: "custom",
  });
  const core = await server.ssrLoadModule("/src/core/documents.ts");
  const author = await server.ssrLoadModule("/src/core/authoring.ts");
  const task = core.taskDocument(raw);
  await writeFile(
    join(output, "inhalt.json"),
    JSON.stringify(raw, null, 2) + "\n",
  );
  await writeFile(
    join(output, "Parkteich-Aufgabe-v1.mysteryboard"),
    core.encodeDocument(task),
  );
  await writeFile(
    join(output, "Parkteich-Lehrkraftentwurf-v1.mysteryboard"),
    core.encodeDocument(author.draftFromContent(task.content, "RC")),
  );
  await writeFile(
    join(output, "ERWARTETE-INHALTSSTRUKTUR.json"),
    JSON.stringify(
      {
        fixtureId: original.fixtureId,
        origin:
          "Controlled reference created from authored synthetic paper source; no external AI run",
        contentId: task.content.id,
        version: task.content.version,
        contentHash: task.contentHash,
        cards: task.content.cards.map((c) => ({
          id: c.id,
          displayNumber: (c.group === "extension" ? "V" : "") + c.id,
          title: c.title,
          text: c.text,
          source: c.source,
          group: c.group,
          ...(c.table ? { table: c.table } : {}),
          ...(c.image ? { imageSha256: sha(image), imageAlt: c.imageAlt } : {}),
        })),
        diagramValues: original.diagramData,
        foreignAiTrial: "OPEN",
      },
      null,
      2,
    ) + "\n",
  );
  const files = [
    "Papieroriginal.html",
    "Papieroriginal.pdf",
    "oxygen-original.svg",
    "oxygen-original.png",
    "oxygen-alternative.svg",
    "oxygen-alternative.png",
    "inhalt.json",
    "Parkteich-Aufgabe-v1.mysteryboard",
    "Parkteich-Lehrkraftentwurf-v1.mysteryboard",
    "ERWARTETE-INHALTSSTRUKTUR.json",
  ];
  await writeFile(
    join(output, "GENERATED-SHA256SUMS.txt"),
    (
      await Promise.all(
        files.map(
          async (f) => sha(await readFile(join(output, f))) + "  " + f + "\n",
        ),
      )
    ).join(""),
  );
  console.log(
    JSON.stringify(
      {
        status: "created",
        cards: 10,
        extensionCards: 1,
        originalPdf: "Papieroriginal.pdf",
        externalAiTested: false,
        output,
      },
      null,
      2,
    ),
  );
} finally {
  await server?.close();
  await browser?.close();
}
