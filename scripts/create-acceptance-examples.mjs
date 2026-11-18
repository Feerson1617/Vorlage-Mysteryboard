// Create an explicitly documented, neutral family of editable example documents.
import { createServer } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const out = resolve(root, "examples/abnahme");
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root,
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const core = await server.ssrLoadModule("/src/core/documents.ts");
  const author = await server.ssrLoadModule("/src/core/authoring.ts");
  const model = await server.ssrLoadModule("/src/core/model.ts");
  const source = JSON.parse(
    await readFile("examples/universal/content.json", "utf8"),
  );
  source.id = "beispiel-abnahme-2026";
  source.title = "Beobachtungen und Messwerte – neutrales Abnahmebeispiel";
  source.cards[3].table = {
    caption: "Beispielhafte Messreihe",
    headers: ["Zeit", "Messwert"],
    rows: [
      ["Tag 1", "12"],
      ["Tag 2", "17"],
    ],
  };
  const task = core.taskDocument(source),
    draft = author.draftFromContent(task.content, "AB");
  const work = model.withTeam(
    model.initialWork(task.content),
    "Gruppe Abnahme",
  );
  work.cards[0].x += 160;
  work.cards[0].y += 90;
  work.cards[1].color = 2;
  work.cards[2].color = 1;
  work.categories[2] = "Eigene Beobachtung";
  work.categories[1] = "Eigene Erklärung";
  work.edges = [
    { id: 1, from: 1, to: 2, direction: 1, label: "kann beeinflussen" },
    { id: 2, from: 3, to: 4, direction: 1, label: "steht im Zusammenhang" },
  ];
  const student = core.studentDocument(task.content, work);
  let edited = structuredClone(draft.content);
  edited.cards[2].text =
    "Überarbeiteter Kartentext: Die Beobachtung wurde präzisiert.";
  edited.cards[0].image = edited.cards[2].image;
  edited.cards[0].imageAlt = "Ersetztes breites Diagramm";
  edited.cards.push({
    id: 13,
    title: "Neu ergänzte Pflichtkarte",
    text: "Diese Information wurde in der neuen Version ergänzt.",
    group: "required",
  });
  edited.initial.cards.push({ id: 13, x: 0, y: 0, color: 0 });
  let revision = author.reviseDraft(draft, edited);
  revision = author.reviseDraft(
    revision,
    author.retainCards(
      revision.content,
      revision.content.cards.filter((c) => c.id !== 6).map((c) => c.id),
    ),
  );
  const updated = author.publishDraft(revision);
  const files = [
    ["MysteryBoard-Beispiel-Schuelerversion.mysteryboard", task],
    ["MysteryBoard-Beispiel-Lehrkraftentwurf.mysteryboard", draft],
    ["MysteryBoard-Beispiel-Schuelerstand.mysteryboard", student],
    ["MysteryBoard-Beispiel-Ueberarbeitet.mysteryboard", updated],
  ];
  for (const [name, doc] of files)
    await writeFile(resolve(out, name), core.encodeDocument(doc));
  console.log(
    JSON.stringify(
      {
        initialVersion: task.content.version,
        revisionVersion: updated.content.version,
        id: task.content.id,
        table: task.content.cards[3].table,
        initialHash: task.contentHash,
        revisionHash: updated.contentHash,
        files: files.map(([name]) => name),
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
