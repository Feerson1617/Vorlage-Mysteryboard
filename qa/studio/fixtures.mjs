import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
export const canonical = (v) =>
  Array.isArray(v)
    ? "[" + v.map(canonical).join(",") + "]"
    : v && typeof v === "object"
      ? "{" +
        Object.keys(v)
          .sort()
          .filter((k) => v[k] !== undefined)
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",") +
        "}"
      : JSON.stringify(v);
export async function fixtures(out) {
  await mkdir(out, { recursive: true });
  const base = JSON.parse(
    await readFile(
      "examples/universal/unterricht-entwurf.mysteryboard",
      "utf8",
    ),
  );
  const paths = [];
  for (const n of [5, 16, 20, 60]) {
    const d = structuredClone(base);
    d.content.id = "studio-test-" + n;
    d.content.version = "1.0.0";
    d.content.title = `Studio – ${n} Beobachtungen`;
    d.content.numbering = "by-group";
    d.content.cards = Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      title: `Originalkarte ${i + 1}`,
      text: `Beobachtung ${i + 1}: 1912 prüft Müller die Küste. 1,5 °C und 2,1 mg/l.\n\n600 Millionen Liter; Grüße und Größen bleiben erhalten.`,
      group: i < n - 2 ? "required" : "extension",
      source: "Eigener neutraler Testtext 2026.",
    }));
    d.content.cards[0].image = base.content.cards[0].image;
    d.content.cards[0].imageAlt = "Neutrales Diagramm mit Legende";
    d.content.cards[1].table = {
      headers: ["Jahr", "Wert"],
      rows: [
        ["1912", "1,5 °C"],
        ["2026", "2,1 mg/l"],
      ],
    };
    d.content.initial = {
      cards: d.content.cards.map((c, i) => ({
        id: c.id,
        x: i * 480,
        y: 0,
        color: 0,
      })),
      edges: [],
      categories: Array(6).fill(""),
    };
    d.author = { initials: "ST", status: "reviewed", hiddenCards: [] };
    delete d.content.help;
    d.contentHash = createHash("sha256")
      .update(canonical(d.content))
      .digest("hex");
    const path = out + `/Studio-${n}.mysteryboard`;
    await writeFile(path, canonical(d));
    paths.push({ n, path, document: d });
  }
  return paths;
}
