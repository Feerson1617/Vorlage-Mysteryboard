import { parseDocument } from "htmlparser2";
import postcss from "postcss";
import { licenses } from "./licenses.mjs";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFile, mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { documentImportAssets } from "../document-import-assets.ts";
const root = process.cwd();
await mkdir("studio/dist", { recursive: true });
const common = {
  configFile: false,
  plugins: [react(), viteSingleFile()],
  define: {
    __PLAYER_BUILD__: "true",
    __UNIVERSAL__: "false",
    __INITIAL_DOCUMENT__: "null",
  },
  build: { target: "es2022", assetsInlineLimit: 10_000_000, sourcemap: false },
};
const modules = [];
const playerStyle = {
  name: "student-only-styles",
  resolveId(id) {
    if (id === "virtual:player-style.css") return "\0player-style.css";
  },
  async load(id) {
    if (id !== "\0player-style.css") return;
    const css = postcss.parse(await readFile("src/style.css", "utf8"));
    css.walkComments((c) => c.remove());
    css.walkRules((rule) => {
      const selectors = rule.selectors.filter(
        (selector) =>
          !/\.(author(?:-|\b)|ocr(?:-|\b)|import(?:-|\b)|document-import|help-editor|help-config|teacher-entry|universal(?:-|\b)|file-download)/.test(
            selector,
          ),
      );
      if (!selectors.length) rule.remove();
      else rule.selectors = selectors;
    });
    css.walkAtRules((rule) => {
      if (rule.nodes && !rule.nodes.length) rule.remove();
    });
    return css.toString();
  },
};

await build({
  ...common,
  root: resolve("studio/player"),
  plugins: [
    ...common.plugins,
    playerStyle,
    {
      name: "player-boundary-audit",
      generateBundle() {
        for (const id of this.getModuleIds())
          modules.push(id.replace(root + "/", ""));
      },
    },
  ],
  build: {
    ...common.build,
    outDir: resolve("studio/dist/player"),
    emptyOutDir: true,
  },
});
let player = await readFile("studio/dist/player/index.html", "utf8");
const packageNames = [
  ...new Set(
    modules
      .filter((m) => m.startsWith("node_modules/"))
      .map((m) => {
        const parts = m.split("/");
        return parts[1].startsWith("@")
          ? parts.slice(1, 3).join("/")
          : parts[1];
      }),
  ),
].sort();
const notices = [];
for (const name of packageNames) {
  const dir = "node_modules/" + name;
  for (const file of (
    await (await import("node:fs/promises")).readdir(dir)
  ).filter((f) =>
    /^(license|licence|notice|copying|copyright)([.-]|$)/i.test(f),
  )) {
    try {
      notices.push({
        package: name,
        file,
        text: await readFile(dir + "/" + file, "utf8"),
      });
    } catch {}
  }
}
const licenseJSON = JSON.stringify(notices).replaceAll("<", "\\u003c");
const licenseNode =
  '\n<script type="application/json" id="mysteryboard-licenses">' +
  licenseJSON +
  "</script>\n";
const tree = parseDocument(player, { withEndIndices: true });
let body;
const visit = (node) => {
  if (node.name === "body") body = node;
  for (const child of node.children ?? []) visit(child);
};
visit(tree);
if (!body || body.endIndex == null) throw Error("Player body missing");
const at = body.endIndex - 6;
if (player.slice(at, body.endIndex + 1).toLowerCase() !== "</body>")
  throw Error("Player closing body missing");
player = player.slice(0, at) + licenseNode + player.slice(at);
await writeFile("studio/dist/player/index.html", player);
if (player.includes(".author-editor") || player.includes(".ocr-controls"))
  throw Error("Teacher styles in Player");
if (
  Buffer.byteLength(player) >= 10_000_000 ||
  modules.some((m) =>
    /AuthorEditor|DocumentImport|HelpEditor|document-import\/|authoring\.ts|tesseract/i.test(
      m,
    ),
  )
)
  throw Error("Player boundary violated");
await writeFile(
  "studio/dist/player-boundary.json",
  JSON.stringify(
    {
      bytes: Buffer.byteLength(player),
      sha256: createHash("sha256").update(player).digest("hex"),
      modules: modules.sort(),
      editorModules: 0,
      ocrModules: 0,
    },
    null,
    2,
  ) + "\n",
);
const fonts = {
  serif: (
    await readFile("studio/assets/fonts/LiberationSerif-Regular.ttf")
  ).toString("base64"),
  serifBold: (
    await readFile("studio/assets/fonts/LiberationSerif-Bold.ttf")
  ).toString("base64"),
  regular: (
    await readFile(
      "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf",
    )
  ).toString("base64"),
  bold: (
    await readFile(
      "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf",
    )
  ).toString("base64"),
};
const virtual = {
  name: "studio-packaged-assets",
  resolveId(id) {
    if (id === "virtual:studio-fonts" || id === "virtual:studio-player")
      return "\0" + id;
  },
  load(id) {
    if (id === "\0virtual:studio-fonts")
      return "export default " + JSON.stringify(fonts);
    if (id === "\0virtual:studio-player")
      return "export default " + JSON.stringify(player);
  },
};
await build({
  ...common,
  root: resolve("studio/ui"),
  plugins: [react(), documentImportAssets(), virtual, viteSingleFile()],
  define: {
    __PLAYER_BUILD__: "false",
    __UNIVERSAL__: "false",
    __INITIAL_DOCUMENT__: "null",
  },
  worker: { plugins: () => [documentImportAssets()], format: "es" },
  build: {
    ...common.build,
    outDir: resolve("studio/dist/studio"),
    emptyOutDir: true,
  },
});
const dest = "studio/dist/studio/ocr";
await mkdir(dest, { recursive: true });
const paths = {
  "host.html": "ocr/host.html",
  "host.js": "ocr/host.js",
  "MODEL-LICENSE.txt": "ocr/MODEL-LICENSE.txt",
  "tesseract.min.js": "node_modules/tesseract.js/dist/tesseract.min.js",
  "worker.min.js": "node_modules/tesseract.js/dist/worker.min.js",
  "tesseract-core-lstm.wasm.js":
    "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "deu.traineddata.gz":
    "node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz",
  "Tesseract-LICENSE.txt": "node_modules/tesseract.js/LICENSE.md",
  "Core-LICENSE.txt": "node_modules/tesseract.js-core/LICENSE",
  "tesseract.min.js.LICENSE.txt":
    "node_modules/tesseract.js/dist/tesseract.min.js.LICENSE.txt",
  "worker.min.js.LICENSE.txt":
    "node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt",
  "German-model-package.json":
    "node_modules/@tesseract.js-data/deu/package.json",
  "German-model-README.md": "node_modules/@tesseract.js-data/deu/README.md",
};
for (const [name, source] of Object.entries(paths))
  await copyFile(source, dest + "/" + name);
const html = await readFile("studio/dist/studio/index.html", "utf8");
const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`,
);
if (Buffer.byteLength(html) >= 10_000_000)
  throw Error("Studio HTML exceeds 10 MB");
const csp = `default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval' ${hashes.join(" ")}; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'`;
await writeFile("studio/dist/studio/player-template.html", player);
await writeFile(
  "studio/dist/studio/security.json",
  JSON.stringify({ csp }, null, 2) + "\n",
);
await build({
  configFile: false,
  build: {
    target: "node24",
    outDir: resolve("studio/electron"),
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    lib: {
      entry: resolve("studio/electron/main.ts"),
      formats: ["cjs"],
      fileName: () => "main.cjs",
    },
    rollupOptions: {
      external: (id) => id === "electron" || id.startsWith("node:"),
    },
  },
});
await licenses("studio/dist/studio/licenses");
console.log("Studio, local OCR resources and isolated Player built.");
