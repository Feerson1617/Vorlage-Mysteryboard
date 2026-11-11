import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import smallData from "../src/content/small.json";
import largeData from "../src/content/large.json";
import {
  cardNumber,
  initialWork,
  MAX_TEAM_NAME,
  teamName,
  validateMystery,
  validateWork,
  withTeam,
  type Mystery,
} from "../src/core/model";
import { fromQr, packWork, toQr, unpackWork } from "../src/core/codec";
import { embedWork, restorePng } from "../src/core/png";
import { emptyHistory, historyReducer } from "../src/core/history";
import { validPng } from "./fixtures/png";

const small = validateMystery(smallData);
const large = validateMystery(largeData);
function grouped(): Mystery {
  return {
    id: "neutral-group-fixture",
    version: "1.0.0",
    title: "Unabhängiges Mystery",
    cardGroups: {
      core: { label: "Pflicht", prefix: "" },
      extra: { label: "Vertiefung", prefix: "Z" },
    },
    cards: Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      title: `Information ${i + 1}`,
      text: "Ein eigenständiger Hinweis.",
      group: [2, 5].includes(i + 1) ? "extra" : "core",
    })),
    initial: {
      cards: Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        x: i * 350,
        y: 0,
        color: 0,
      })),
      edges: [],
      categories: Array(6).fill(""),
    },
  };
}
function originalBlock(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let pos = 8; pos < png.length;) {
    const size = view.getUint32(pos);
    const type = new TextDecoder().decode(png.subarray(pos + 4, pos + 8));
    if (type === "mySt") return png.subarray(pos + 8, pos + 8 + size);
    pos += size + 12;
  }
  throw new Error("Fixture has no work chunk");
}

describe("universeller Teamzustand und kontrollierte Formatkompatibilität", () => {
  for (const [m, name] of [
    [small, "Start-ID-1000000.png"],
    [large, "60-90-Gruppenstand.png"],
  ] as const)
    it(`bestehende ${m.cards.length}-Karten-Originaldatei bleibt ohne Team im bytegleichen Format 1`, () => {
      const png = new Uint8Array(readFileSync(`tests/fixtures/review/${name}`));
      const work = restorePng(png, m);
      expect(work.schema).toBe(1);
      expect(work).not.toHaveProperty("team");
      expect(teamName(work)).toBe("");
      expect(packWork(work)).toEqual(originalBlock(png));
      expect(restorePng(embedWork(validPng(), work), m)).toEqual(work);
    });
  it("Teamformat 2 erhält Namen und vollständigen Zustand in PNG und QR", () => {
    const m = validateMystery(grouped());
    const work = withTeam(initialWork(m), "  Änne, Léa & Gruppe 7 🌱  ");
    expect(work.schema).toBe(2);
    expect(teamName(work)).toBe("Änne, Léa & Gruppe 7 🌱");
    const packed = packWork(work),
      qr = toQr(packed)!;
    expect(packed[3]).toBe(2);
    expect(qr).toMatch(/^MB2:/);
    expect(fromQr(qr, m)).toEqual(work);
    expect(restorePng(embedWork(validPng(), work), m)).toEqual(work);
    expect(validateWork({ ...work, ignored: "not admitted" }, m)).toEqual(work);
  });
  it("leerer Name und Löschen einer Teamangabe erhalten ursprüngliche Form und QR-Kapazität", () => {
    const work = initialWork(small);
    expect(withTeam(work, " ")).toEqual(work);
    const cleared = withTeam(withTeam(work, "Team A"), "");
    expect(cleared).toEqual(work);
    expect(packWork(cleared)).toEqual(packWork(work));
    expect(toQr(packWork(cleared))).toMatch(/^MB1:/);
    expect(teamName(null)).toBe("");
  });
  it("Teamänderung und Löschen sind in derselben begrenzten History rückgängig/wiederholbar", () => {
    const base = initialWork(small),
      named = withTeam(base, "Team B");
    let h = historyReducer(emptyHistory, { type: "load", work: base });
    h = historyReducer(h, { type: "edit", work: named });
    expect(h.present).toEqual(named);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toEqual(base);
    h = historyReducer(h, { type: "redo" });
    expect(h.present).toEqual(named);
    h = historyReducer(h, { type: "edit", work: withTeam(named, "") });
    expect(h.present).toEqual(base);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toEqual(named);
  });
  it("maximale Teamlänge bleibt vollständig; überlange oder steuerzeichenhaltige Werte werden abgelehnt", () => {
    const base = initialWork(small);
    const max = withTeam(base, "Ä".repeat(MAX_TEAM_NAME));
    expect(validateWork(max, small)).toEqual(max);
    for (const name of [
      "x".repeat(MAX_TEAM_NAME + 1),
      "Anna\nBen",
      "A\0B",
      "A\u0085B",
    ]) {
      expect(() => withTeam(base, name)).toThrow(/Teamname/);
      expect(() =>
        validateWork({ ...base, schema: 2, team: name }, small),
      ).toThrow();
      expect(() => packWork({ ...base, schema: 2, team: name })).toThrow();
    }
  });
  it("Schema 1 mit Team sowie Schema 2 ohne gültigen Teamwert werden nicht stillschweigend normalisiert", () => {
    const base = initialWork(small);
    for (const malformed of [
      { ...base, team: "A" },
      { ...base, schema: 2 },
      { ...base, schema: 2, team: "" },
      { ...base, schema: 2, team: 7 },
    ]) {
      expect(() => validateWork(malformed, small)).toThrow();
      expect(() => packWork(malformed as any)).toThrow();
    }
  });
  it("QR-Präfix, Envelope und kompakte Schema-Version müssen übereinstimmen", () => {
    const m = validateMystery(grouped());
    for (const work of [initialWork(m), withTeam(initialWork(m), "Team C")]) {
      const packed = packWork(work),
        version = packed[3];
      const opposite = version === 1 ? 2 : 1;
      const qr = toQr(packed)!;
      expect(() => fromQr(`MB${opposite}:` + qr.slice(4), m)).toThrow(
        /Speicherformat/,
      );
      packed[3] = opposite;
      expect(() => unpackWork(packed, m)).toThrow();
    }
  });
  it("beide Speicherformate trennen Mystery-Identität, Inhaltsversion und Karten-IDs strikt", () => {
    const m = validateMystery(grouped());
    for (const work of [initialWork(m), withTeam(initialWork(m), "Team D")]) {
      const bytes = packWork(work);
      expect(() => unpackWork(bytes, { ...m, id: "anderes-mystery" })).toThrow(
        /anderen Mystery/,
      );
      expect(() => unpackWork(bytes, { ...m, version: "2.0.0" })).toThrow(
        /Mystery-Version/,
      );
      const wrongCards = {
        ...m,
        cards: m.cards.map((c) => ({ ...c, id: c.id + 10 })),
      };
      expect(() => unpackWork(bytes, wrongCards)).toThrow(/Arbeitsstand/);
    }
  });
});

describe("deklarative, unabhängige Kartenkennzeichnung", () => {
  it("beliebige explizite Zuordnung und anderes Präfix benötigen keine Kartennummerngrenze", () => {
    const m = validateMystery(grouped());
    expect(m.cards.map((c) => cardNumber(m, c.id))).toEqual([
      "1",
      "Z2",
      "3",
      "4",
      "Z5",
    ]);
    m.cards.reverse();
    expect(cardNumber(m, 2)).toBe("Z2");
    expect(cardNumber(m, 3)).toBe("3");
    expect(m.cards.every((c) => typeof c.id === "number")).toBe(true);
  });
  it("bestehende kleine und große Inhalte behalten ohne Gruppen ihre Nummern", () => {
    expect(cardNumber(small, 12)).toBe("12");
    expect(cardNumber(large, 60)).toBe("60");
    expect(initialWork(small).schema).toBe(1);
  });
  it("unbekannte, geerbte und ungültige Gruppen werden abgelehnt", () => {
    for (const group of ["unknown", "toString", "constructor", ""]) {
      const m = grouped();
      m.cards[0].group = group;
      expect(() => validateMystery(m)).toThrow();
    }
    const inherited = grouped();
    inherited.cardGroups = Object.create({
      core: { label: "Pflicht", prefix: "" },
      extra: { label: "Vertiefung", prefix: "Z" },
    });
    expect(() => validateMystery(inherited)).toThrow();
  });
  it("Präfixe sind kurz, sichtbar und dürfen keine kollidierenden Kennungen erzeugen", () => {
    for (const prefix of ["Vier", " ", "V\n", "\u200b"]) {
      const m = grouped();
      m.cardGroups!.extra.prefix = prefix;
      expect(() => validateMystery(m)).toThrow(/Kennzeichnung/);
    }
    const m: Mystery = structuredClone(small);
    m.cardGroups = { duplicate: { label: "Zusatz", prefix: "1" } };
    m.cards.find((c) => c.id === 2)!.group = "duplicate"; // "12" collides with card 12.
    expect(() => validateMystery(m)).toThrow(/nicht eindeutig/);
  });
});
