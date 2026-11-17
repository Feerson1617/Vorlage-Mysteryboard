import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { resolve, basename } from "node:path";
export async function licenses(destination) {
  const project = JSON.parse(await readFile("package.json", "utf8")),
    seen = new Set(),
    items = [];
  async function visit(name) {
    if (seen.has(name)) return;
    seen.add(name);
    try {
      const dir = resolve("node_modules", name),
        p = JSON.parse(await readFile(dir + "/package.json", "utf8"));
      const notices = [];
      for (const file of (await readdir(dir)).filter((f) =>
        /^(license|licence|notice|copying|copyright)([.-]|$)/i.test(f),
      )) {
        try {
          const body = await readFile(dir + "/" + file, "utf8");
          notices.push({ file, text: body });
        } catch {}
      }
      items.push({
        name,
        version: p.version,
        license: p.license ?? "See notices",
        notices,
      });
      for (const dep of Object.keys(p.dependencies ?? {}).sort())
        await visit(dep);
    } catch {}
  }
  for (const name of Object.keys(project.dependencies).sort())
    await visit(name);
  await mkdir(destination, { recursive: true });
  await writeFile(
    destination + "/THIRD-PARTY-LICENSES.json",
    JSON.stringify(items, null, 2) + "\n",
  );
  await writeFile(
    destination + "/THIRD-PARTY-LICENSES.txt",
    items
      .map(
        (i) =>
          `\n${i.name} ${i.version}\nDeclared license: ${i.license}\n` +
          i.notices.map((n) => n.file + "\n" + n.text).join("\n"),
      )
      .join("\n"),
  );
  await copyFile(
    "studio/assets/fonts/LICENSE-Liberation.txt",
    destination + "/Liberation-Serif-LICENSE.txt",
  );
  await copyFile(
    "node_modules/pdfjs-dist/standard_fonts/LICENSE_LIBERATION",
    destination + "/Liberation-Sans-LICENSE.txt",
  );
  return items.length;
}
