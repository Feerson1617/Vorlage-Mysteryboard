import { describe, it, expect } from "vitest";
import { zlibSync } from "fflate";
import smallData from "../src/content/small.json";
import largeData from "../src/content/large.json";
import { initialWork, validateMystery, validateWork } from "../src/core/model";
import {
  fromQr,
  packWork,
  QR_LIMIT,
  toQr,
  unpackWork,
} from "../src/core/codec";
import { crc32, embedWork, restorePng } from "../src/core/png";
const small = validateMystery(smallData),
  large = validateMystery(largeData);
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(data.length + 12),
    v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  v.setUint32(out.length - 4, crc32(out.subarray(4, out.length - 4)));
  return out;
}
function png() {
  const header = new Uint8Array(13),
    v = new DataView(header.buffer);
  v.setUint32(0, 1);
  v.setUint32(4, 1);
  header.set([8, 6, 0, 0, 0], 8);
  return Uint8Array.from([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...chunk("IHDR", header),
    ...chunk("IDAT", zlibSync(new Uint8Array([0, 255, 255, 255, 255]))),
    ...chunk("IEND", new Uint8Array()),
  ]);
}
describe("Original-PNG und versionierter Arbeitsstand", () => {
  for (const m of [small, large]) {
    it(`${m.cards.length} Karten: zehn vollständige PNG-Zyklen, anschließend bearbeitbar`, () => {
      const original = initialWork(m);
      original.categories = [
        "",
        "Beleg",
        "Widerspruch",
        "Noch offen",
        "Ergänzung",
        "Überprüfen",
      ];
      original.cards[0].x = -123.45;
      original.cards[0].y = 987.25;
      original.cards.reverse();
      let work = original;
      for (let i = 0; i < 10; i++) {
        work = restorePng(embedWork(png(), work), m);
        expect(work).toEqual(original);
      }
      work.cards[0].x += 17;
      work.cards[0].color = 4;
      work.edges[0].label = "Nachträglich geändert: ÄÖÜ ß € ± „ja“";
      work.edges[0].direction = 2;
      expect(restorePng(embedWork(png(), work), m)).toEqual(work);
      expect(work).not.toEqual(original);
    });
  }
  it("umfangreicher Datensatz hat 60 Karten, 90 Verbindungen und acht Bilder", () => {
    expect(large.cards).toHaveLength(60);
    expect(large.initial.edges).toHaveLength(90);
    expect(large.cards.filter((c) => c.image)).toHaveLength(8);
  });
  it("kleiner Arbeitsstand passt vollständig in QR, großer bleibt vollständig in PNG", () => {
    const a = initialWork(small),
      b = initialWork(large);
    const qr = toQr(packWork(a));
    expect(qr).not.toBeNull();
    expect(qr!.length).toBeLessThanOrEqual(QR_LIMIT);
    expect(fromQr(qr!, small)).toEqual(a);
    expect(toQr(packWork(b))).toBeNull();
    expect(restorePng(embedWork(png(), b), large)).toEqual(b);
    console.log(
      "Sicherungsgrößen",
      JSON.stringify({
        smallPacked: packWork(a).length,
        smallQr: qr!.length,
        largePacked: packWork(b).length,
        largeQrTheoretical: 4 + Math.ceil((packWork(b).length * 4) / 3),
        qrLimit: QR_LIMIT,
      }),
    );
  });
  it("erkennt falsches Mystery und falsche Version", () => {
    const bytes = packWork(initialWork(small));
    expect(() => unpackWork(bytes, large)).toThrow(/anderen Mystery/);
    expect(() => unpackWork(bytes, { ...small, version: "2" })).toThrow(
      /Version/,
    );
  });
  it("lehnt beschädigte PNG einschließlich Bilddaten ab", () => {
    const bytes = embedWork(png(), initialWork(small));
    bytes[45] ^= 1;
    expect(() => restorePng(bytes, small)).toThrow(/PNG/);
  });
  it("lehnt abgeschnittene PNG und angehängte Daten ab", () => {
    const bytes = embedWork(png(), initialWork(small));
    expect(() => restorePng(bytes.subarray(0, -5), small)).toThrow();
    expect(() => restorePng(Uint8Array.from([...bytes, 1]), small)).toThrow();
  });
  it("erkennt Bilder ohne Zustandsdaten", () => {
    expect(() => restorePng(png(), small)).toThrow(/keinen Arbeitsstand/);
  });
  it("erkennt doppelte Sicherungsblöcke", () => {
    const base = embedWork(png(), initialWork(small)),
      extra = chunk("mySt", packWork(initialWork(small)));
    const duplicate = Uint8Array.from([
      ...base.subarray(0, -12),
      ...extra,
      ...base.subarray(-12),
    ]);
    expect(() => restorePng(duplicate, small)).toThrow(/widersprüchliche/);
  });
  it("ersetzt einen bestehenden Sicherungsblock eindeutig", () => {
    const a = initialWork(small),
      b = initialWork(small);
    b.cards[0].x += 25;
    expect(restorePng(embedWork(embedWork(png(), a), b), small)).toEqual(b);
  });
  it("erkennt Manipulation der Zustandsprüfsumme", () => {
    const bytes = packWork(initialWork(small));
    bytes[15] ^= 1;
    expect(() => unpackWork(bytes, small)).toThrow(/beschädigt/);
  });
  it("begrenzt dekomprimierte Daten vor Speicherzuweisung", () => {
    const bytes = packWork(initialWork(small));
    new DataView(bytes.buffer).setUint32(4, 0xffffffff);
    expect(() => unpackWork(bytes, small)).toThrow();
  });
  it("lehnt unvollständige Codes und fremde URLs ab", () => {
    const qr = toQr(packWork(initialWork(small)))!;
    expect(() => fromQr(qr.slice(0, -20), small)).toThrow();
    expect(() => fromQr("https://example.com", small)).toThrow();
    expect(() => fromQr("MB1:" + "a".repeat(QR_LIMIT), small)).toThrow();
  });
  it.each([
    "missing",
    "duplicate",
    "position",
    "color",
    "edge",
    "label",
    "direction",
    "categories",
    "schema",
  ])("lehnt ungültige Daten ab: %s", (kind) => {
    const work = initialWork(small);
    switch (kind) {
      case "missing":
        work.cards.pop();
        break;
      case "duplicate":
        work.cards[1].id = work.cards[0].id;
        break;
      case "position":
        work.cards[0].x = Infinity;
        break;
      case "color":
        work.cards[0].color = 100;
        break;
      case "edge":
        work.edges[0].to = 999;
        break;
      case "label":
        work.edges[0].label = "x".repeat(501);
        break;
      case "direction":
        Object.assign(work.edges[0], { direction: 4 });
        break;
      case "categories":
        work.categories.pop();
        break;
      case "schema":
        Object.assign(work, { schema: 2 });
        break;
    }
    expect(() => validateWork(work, small)).toThrow();
    expect(() => unpackWork(packWork(work), small)).toThrow();
  });
});
