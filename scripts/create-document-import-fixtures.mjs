// Genuine OOXML packages and Chromium PDFs with a separate, explicit source manifest.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { chromium } from "@playwright/test";
const out = resolve(process.argv[2] || "tests/fixtures/document-import");
if (existsSync(out)) throw new Error("Neuen Ausgabeordner wählen.");
await mkdir(out, { recursive: true });
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const A = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  extension: [3, 8, 12].includes(i + 1),
  title: `${[3, 8, 12].includes(i + 1) ? "Vertiefungskarte" : "Karte"} ${i + 1}: Beobachtung ${i + 1}`,
  paragraphs: [
    `Information ${i + 1}: Der Messwert beträgt ${i + 1},5 g bei 12,5 °C.`,
    `Vergleicht die Beobachtung ${i + 1} mit den anderen Karten und begründet mögliche Zusammenhänge.`,
  ],
  source: `Eigene synthetische Prüfdaten A${i + 1}; keine Feldmessung.`,
}));
const table = {
  headers: ["Zeit", "Temperatur (°C)", "Masse (g)"],
  rows: [
    ["08:00", "12,5", "3,50"],
    ["12:00", "17,0", "4,25"],
    ["16:00", "18,5", "4,00"],
  ],
};
const B = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  extension: i === 5,
  title: `${i === 5 ? "Vertiefungskarte" : "Karte"} ${i + 1}: Material ${i + 1}`,
  paragraphs: [
    `Material ${i + 1}: Vergleicht die dokumentierten Angaben. Alle Messwerte sind synthetische Prüfdaten.`,
  ],
  source: `Eigene technische Vorlage B${i + 1}.`,
  ...(i === 0
    ? { image: "bild-1.png" }
    : i === 1
      ? { image: "bild-2.jpeg" }
      : i === 2
        ? { table }
        : i === 3
          ? {
              bullets: [
                "Erste Beobachtung: 0,25 L.",
                "Zweite Beobachtung: 2,0 mg/L.",
              ],
            }
          : {}),
}));
const images = {
  "bild-1.png": await readFile("examples/ki-papierprobe/oxygen-original.png"),
  "bild-2.jpeg": await readFile("examples/universal/diagramm-2.jpeg"),
};
for (const [n, b] of Object.entries(images)) await writeFile(join(out, n), b);
const p = (value, style = "") =>
  `<w:p>${style ? `<w:pPr>${style}</w:pPr>` : ""}<w:r><w:t xml:space="preserve">${esc(value)}</w:t></w:r></w:p>`;
const drawing = (id) =>
  `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="4572000" cy="2133600"/><wp:docPr id="${id}" name="Bild ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Bild ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImage${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4572000" cy="2133600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
function word(cards, options = {}) {
  let imageNo = 0;
  const embeds = [];
  const body = cards
    .map((c) => {
      let s =
        p(c.title, '<w:pStyle w:val="Heading1"/>') +
        c.paragraphs.map((v) => p(v)).join("");
      if (c.bullets)
        s += c.bullets
          .map((v) =>
            p(v, '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
          )
          .join("");
      if (c.image) {
        imageNo++;
        embeds.push(c.image);
        s += drawing(imageNo);
      }
      if (c.table)
        s += `<w:tbl><w:tblPr/><w:tblGrid>${c.table.headers.map(() => '<w:gridCol w:w="2000"/>').join("")}</w:tblGrid>${[c.table.headers, ...c.table.rows].map((r, i) => `<w:tr>${i === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${r.map((v) => `<w:tc><w:tcPr/>${p(v)}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
      return s + p("Quelle: " + c.source);
    })
    .join("");
  const files = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}${options.extra ?? ""}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`,
    ),
    "word/styles.xml": strToU8(
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>',
    ),
    "word/numbering.xml": strToU8(
      '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>',
    ),
    "word/_rels/document.xml.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${embeds.map((n, i) => `<Relationship Id="rImage${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${n}"/>`).join("")}${options.rels ?? ""}</Relationships>`,
    ),
  };
  for (const n of embeds) files["word/media/" + n] = new Uint8Array(images[n]);
  if (options.files) Object.assign(files, options.files);
  return zipSync(files, { level: 9 });
}
await writeFile(join(out, "A-Word-12-Karten.docx"), word(A));
await writeFile(join(out, "B-Word-Medien-Tabelle.docx"), word(B));
const malicious = [
  {
    id: 1,
    title: "Karte 1: Unveränderte Zeichen",
    paragraphs: [
      "<script>window.__importXss = true</script> ist hier lediglich Kartentext.",
    ],
    source: "Eigener Sicherheitstest.",
  },
];
await writeFile(
  join(out, "F-Word-Text-und-externe-Verweise.docx"),
  word(malicious, {
    extra:
      '<w:p><w:hyperlink r:id="rExternal"><w:r><w:t>Ein externer Verweis als Text.</w:t></w:r></w:hyperlink></w:p>',
    rels: '<Relationship Id="rExternal" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://external.invalid/never-fetch" TargetMode="External"/>',
  }),
);
await writeFile(
  join(out, "F-Word-aktive-Inhalte.docx"),
  word(A, { files: { "word/vbaProject.bin": strToU8("blocked") } }),
);
await writeFile(
  join(out, "F-Word-komprimiert.docx"),
  word(A, { files: { "word/huge.xml": new Uint8Array(10_000_000) } }),
);
await writeFile(join(out, "F-Defekt.docx"), strToU8("Keine Word-Datei"));
await writeFile(
  join(out, "F-Altformat.doc"),
  new Uint8Array([208, 207, 17, 224, 161, 177, 26, 225]),
);
await writeFile(
  join(out, "F-Defekt.pdf"),
  strToU8("%PDF-1.7\nkein PDF-Inhalt"),
);
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 900 },
  });
  await page.context().setOffline(true);
  const bigImage = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 2000;
    const x = c.getContext("2d");
    x.fillStyle = "#287c43";
    x.fillRect(0, 0, 2000, 2000);
    return c.toDataURL("image/png");
  });
  images["pixel-4m.png"] = Buffer.from(bigImage.split(",")[1], "base64");
  await writeFile(
    join(out, "F-Word-Mediengrenze.docx"),
    word(
      Array.from({ length: 7 }, (_, i) => ({ ...A[i], image: "pixel-4m.png" })),
    ),
  );

  const style =
    "@page{size:A4;margin:15mm}body{font:12pt/1.4 Arial;color:#20362a}article{border:1px solid #64786a;padding:5mm;box-sizing:border-box;break-inside:avoid}h2{font-size:15pt}img{width:100%;height:auto}table{width:100%;border-collapse:collapse}td,th{border:1px solid #819487;padding:3mm}.source{font-size:9pt;overflow-wrap:anywhere}";
  const htmlCard = (c) =>
    `<article><h2>${esc(c.title)}</h2>${c.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}${c.bullets ? "<ul>" + c.bullets.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>" : ""}${c.image ? `<img src="data:image/${c.image.endsWith("png") ? "png" : "jpeg"};base64,${images[c.image].toString("base64")}">` : ""}${c.table ? `<table><thead><tr>${c.table.headers.map((v) => `<th>${esc(v)}</th>`).join("")}</tr></thead><tbody>${c.table.rows.map((r) => "<tr>" + r.map((v) => "<td>" + esc(v) + "</td>").join("") + "</tr>").join("")}</tbody></table>` : ""}<p class="source">Quelle: ${esc(c.source)}</p></article>`;
  async function pdf(name, html) {
    await writeFile(join(out, name + ".html"), html);
    await page.setContent(html);
    await page.pdf({
      path: join(out, name + ".pdf"),
      preferCSSPageSize: true,
      printBackground: true,
    });
  }
  await pdf(
    "A-Word-Originalvergleich",
    `<!doctype html><meta charset="utf-8"><style>${style}article{height:125mm;margin-bottom:5mm}article:nth-child(2n){break-after:page}</style>${A.map(htmlCard).join("")}`,
  );
  await pdf(
    "B-Word-Originalvergleich",
    `<!doctype html><meta charset="utf-8"><style>${style}article{break-after:page}</style>${B.map(htmlCard).join("")}`,
  );
  await pdf(
    "C-PDF-12-Karten",
    `<!doctype html><meta charset="utf-8"><style>${style}article{height:125mm;margin-bottom:5mm}article:nth-child(2n){break-after:page}</style>${A.map(htmlCard).join("")}`,
  );
  await pdf(
    "D-PDF-Mehrspaltig",
    `<!doctype html><meta charset="utf-8"><style>${style}.cols{display:grid;grid-template-columns:1fr 1fr;gap:5mm}article{height:80mm;padding:3mm}article h2{font-size:11pt}article p{font-size:10pt}article img{max-height:24mm;object-fit:contain}table{font-size:9pt}td,th{padding:1mm}</style><div class="cols">${[B[0], B[3], B[1], B[4], B[2], B[5]].map(htmlCard).join("")}</div>`,
  );
  await pdf(
    "E-PDF-Scan-ohne-Text",
    `<!doctype html><style>@page{size:A4;margin:15mm}img{width:100%;height:auto}</style><img src="data:image/png;base64,${images["bild-1.png"].toString("base64")}">`,
  );
  await pdf(
    "G-PDF-Seitenuebergreifend",
    `<!doctype html><meta charset="utf-8"><style>${style}.next{break-before:page}</style><h2>Karte 1: Über zwei Seiten</h2><p>Erster Teil: 12,5 °C.</p><p class="next">Fortsetzung ohne neue Kartenüberschrift: 3,50 g.</p><h2>Vertiefungskarte 2: Neue Frage</h2><p>Welche Grenzen haben die Messwerte?</p>`,
  );
  await pdf(
    "H-PDF-Abbruch-38-Seiten",
    `<!doctype html><meta charset="utf-8"><style>${style}article{break-after:page}</style>${Array.from({ length: 38 }, (_, i) => htmlCard({ ...A[i % 12], title: `Karte ${i + 1}: Große Probe` })).join("")}`,
  );
} finally {
  await browser.close();
}
// A genuine PDF with a JavaScript open action; parser must reject, never execute.
const objects = [
  "<< /Type /Catalog /Pages 2 0 R /OpenAction 4 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>",
  "<< /S /JavaScript /JS (app.alert\\(1\\)) >>",
];
let raw = "%PDF-1.4\n",
  offsets = [0];
for (let i = 0; i < objects.length; i++) {
  offsets.push(Buffer.byteLength(raw));
  raw += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
}
const xref = Buffer.byteLength(raw);
raw += `xref\n0 5\n0000000000 65535 f \n${offsets
  .slice(1)
  .map((x) => String(x).padStart(10, "0") + " 00000 n \n")
  .join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
await writeFile(join(out, "F-PDF-JavaScript.pdf"), raw);
await writeFile(
  join(out, "ORIGINAL-INHALTE.json"),
  JSON.stringify(
    {
      notice:
        "Own synthetic data and diagrams; no school-approved content; no OCR or AI.",
      A,
      B,
      table,
      expectedA: { cards: 12, required: 9, extensionIds: [3, 8, 12] },
      expectedB: { cards: 6, images: 2, tables: 1 },
      expectedC: { cards: 12 },
      expectedScan: { textCards: 0 },
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    output: out,
    genuineDocxAndPdf: true,
    types: ["A", "B", "C", "D", "E", "F", "G", "H"],
  }),
);
