import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import { zipSync } from "fflate";
import { scormEntries, zipScorm } from "../src/core/scorm-package.ts";
const dir = "artifacts/ocr-author";
await mkdir(`${dir}/ocr`, { recursive: true });
const paths = {
  "tesseract.min.js": "node_modules/tesseract.js/dist/tesseract.min.js",
  "worker.min.js": "node_modules/tesseract.js/dist/worker.min.js",
  "tesseract-core-lstm.wasm.js":
    "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "deu.traineddata.gz":
    "node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz",
  "host.html": "ocr/host.html",
  "host.js": "ocr/host.js",
  "Tesseract-LICENSE.txt": "node_modules/tesseract.js/LICENSE.md",
  "Core-LICENSE.txt": "node_modules/tesseract.js-core/LICENSE",
  "tesseract.min.js.LICENSE.txt":"node_modules/tesseract.js/dist/tesseract.min.js.LICENSE.txt",
  "worker.min.js.LICENSE.txt":"node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt",
  "German-model-package.json":"node_modules/@tesseract.js-data/deu/package.json",
  "German-model-README.md":"node_modules/@tesseract.js-data/deu/README.md",
};
for (const [name, path] of Object.entries(paths))
  await cp(path, `${dir}/ocr/${name}`);
const app = Buffer.from(
  (await readFile("artifacts/MysteryBoard-Universal.html", "utf8")).replace(
    "<head>",
    '<head><meta name="mysteryboard-ocr" content="ocr/">',
  ),
);
if (app.length >= 10_000_000) throw Error("HTML limit");
const entries = scormEntries(
  app,
  await readFile("scorm/launch.html", "utf8"),
  await readFile("scorm/session.js", "utf8"),
  "MysteryBoard-OCR-v3",
  "MysteryBoard – lokaler OCR-Autoreneditor",
);
for (const name of Object.keys(paths))
  entries[`ocr/${name}`] = new Uint8Array(await readFile(`${dir}/ocr/${name}`));
const license = await readFile("ocr/MODEL-LICENSE.txt");
entries["ocr/MODEL-LICENSE.txt"] = license;
const extra = Object.keys(entries)
  .filter((n) => n.startsWith("ocr/"))
  .map((n) => `<file href="${n}"/>`)
  .join("");
entries["imsmanifest.xml"] = Buffer.from(
  Buffer.from(entries["imsmanifest.xml"])
    .toString()
    .replace("</resource>", `${extra}</resource>`),
);
for (const [name, data] of Object.entries(entries))
  await writeFile(`${dir}/${name}`, data);
await writeFile("artifacts/MysteryBoard-OCR-SCORM-1.2.zip", zipScorm(entries));
for (const name of ["START.command", "start-ocr.py", "LESEN.txt"])
  await cp(`ocr/${name}`, `${dir}/${name}`);
const authorEntries = { ...entries };
for (const name of ["START.command", "start-ocr.py", "LESEN.txt"])
  authorEntries[name] = await readFile(`${dir}/${name}`);
await writeFile(
  "artifacts/MysteryBoard-OCR-Autorenpaket.zip",
  zipSync(
    Object.fromEntries(
      Object.entries(authorEntries).map(([name, bytes]) => [
        name,
        [
          bytes,
          {
            mtime: new Date(2026, 10, 16, 0, 0, 0),
            os: 3,
            attrs:
              (name === "START.command" || name === "start-ocr.py"
                ? 0o100755
                : 0o100644) << 16,
          },
        ],
      ]),
    ),
    { level: 9 },
  ),
);
const sizes = Object.entries(entries).map(([name, b]) => ({
  name,
  bytes: b.length,
  sha256: createHash("sha256").update(b).digest("hex"),
}));
await writeFile(
  "artifacts/OCR-integrity.json",
  JSON.stringify(sizes, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    sizes.map(({ name, bytes }) => ({ name, bytes })),
    null,
    2,
  ),
);
