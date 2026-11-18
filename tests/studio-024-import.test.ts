import { expect, it } from "vitest";
import {
  analyzePdf,
  changeRegions,
  paintedSegments,
  type PdfGraphic,
  type PdfPage,
} from "../src/core/document-import/pdf-layout";
import { reviewWord } from "../src/core/document-import/docx-review";
const box = { x: 20, y: 20, width: 250, height: 250 };
const frame = [
  { x1: 20, y1: 20, x2: 270, y2: 20 },
  { x1: 270, y1: 20, x2: 270, y2: 270 },
  { x1: 20, y1: 270, x2: 270, y2: 270 },
  { x1: 20, y1: 20, x2: 20, y2: 270 },
];
const page: PdfPage = {
  width: 400,
  height: 400,
  items: [
    {
      x: 35,
      y: 35,
      width: 150,
      height: 12,
      baseline: 47,
      text: "Quelle: Messung 1987",
    },
  ],
};
it("preserves adjacent tiles as one composed card, including source and legends", () => {
  const graphics = [
    { x: 40, y: 120, width: 60, height: 100, raster: true },
    { x: 100, y: 120, width: 60, height: 100, raster: true },
  ];
  const result = analyzePdf([{ ...page, graphics }], [frame]);
  expect(result.layout.regions).toHaveLength(1);
  expect(result.layout.regions[0].wholeCardImage).toBe(true);
  expect(result.layout.regions[0].mediaBounds).toEqual([box]);
});
it("retains separate photos, flags vector fragments outside a card and keeps them available after a manual crop is removed", () => {
  const graphics = [
    { x: 40, y: 120, width: 60, height: 100, raster: true },
    { x: 150, y: 120, width: 60, height: 100, raster: true },
    { x: 310, y: 100, width: 16, height: 32, raster: false },
  ];
  const result = analyzePdf([{ ...page, graphics }], [frame]);
  expect(result.layout.regions[0].mediaBounds).toEqual(graphics.slice(0, 2));
  expect(result.layout.unassignedGraphics).toHaveLength(1);
  const manual = {
    ...result.layout.regions[0],
    id: 2,
    cardId: 2,
    manualImage: true as const,
  };
  expect(
    changeRegions(result.layout, [...result.layout.regions, manual]).sections,
  ).toEqual([]);
  expect(changeRegions(result.layout, []).unassignedGraphics).toEqual(
    result.layout.unassignedGraphics,
  );
});
it("reports a bounded operator list and limits saved graphics states without raising resource ceilings", () => {
  for (const ops of [
    [Array(100001).fill(10), []],
    [Array(257).fill(10), []],
  ] as const) {
    const reasons = new Set<string>();
    paintedSegments(
      { fnArray: ops[0], argsArray: [...ops[1]] },
      [1, 0, 0, 1, 0, 0],
      [],
      reasons,
    );
    expect([...reasons].join(" ")).toContain("begrenzt");
  }
});
it("places repeated inline masks in their own transformed boxes", () => {
  const out: PdfGraphic[] = [];
  paintedSegments(
    { fnArray: [89], argsArray: [[{}, 20, 0, 0, 30, [50, 40, 120, 80]]] },
    [1, 0, 0, 1, 0, 0],
    out,
  );
  expect(out).toEqual([
    { x: 50, y: 40, width: 20, height: 30, raster: true },
    { x: 120, y: 80, width: 20, height: 30, raster: true },
  ]);
});
it("reports Word structures from package XML before Mammoth, including external pictures, independent of XML prefixes", () => {
  const encode = (s: string) => new TextEncoder().encode(s);
  const result = reviewWord({
    "word/document.xml": encode(
      "<d:document><d:txbxContent/><d:anchor/><a:relIds/><a:grpSp/><m:oMath/><d:tbl><d:tbl><d:gridSpan/></d:tbl></d:tbl></d:document>",
    ),
    "word/header1.xml": encode("<d:hdr><d:t>Quelle</d:t></d:hdr>"),
    "word/_rels/document.xml.rels": encode(
      '<Relationships><Relationship Type="test/image" TargetMode="External" Target="https://example.invalid/photo.jpg"/></Relationships>',
    ),
  });
  for (const token of [
    "Textfeld",
    "Frei positioniertes",
    "SmartArt",
    "Gruppierte Form",
    "Formel",
    "Verschachtelte Tabelle",
    "Verbundene Tabellenzelle",
    "Kopf- oder Fußzeile",
    "Extern verknüpft",
  ])
    expect(result.some((f) => f.message.includes(token))).toBe(true);
  expect(result.filter((f) => f.status === "missing")).toHaveLength(3);
});
