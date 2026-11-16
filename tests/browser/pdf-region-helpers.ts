import { expect, type Browser, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { unzipSync } from "fflate";
import { button, rootPage, type UI } from "./authoring-helpers";
export async function downloadClassroom(ui: UI, info: TestInfo, name: string) {
  await button(ui, "Schülerversion erstellen").tap();
  await button(ui, "Für itslearning als SCORM herunterladen").tap();
  const pending = rootPage(ui).waitForEvent("download");
  await ui
    .getByRole("link", { name: "Datei herunterladen", exact: true })
    .click();
  const file = await pending,
    path = info.outputPath(name);
  await file.saveAs(path);
  const bytes = await readFile(path),
    entries = unzipSync(bytes);
  expect(Object.keys(entries).sort()).toEqual([
    "app.html",
    "imsmanifest.xml",
    "launch.html",
    "session.js",
  ]);
  execFileSync("python3", [
    "-c",
    "import zipfile,sys,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; r=E.fromstring(z.read('imsmanifest.xml')); n={'i':'http://www.imsproject.org/xsd/imscp_rootv1p1p2'}; assert r.find('i:metadata/i:schemaversion',n).text=='1.2'; assert r.find('i:resources/i:resource',n).attrib['href']=='launch.html'",
    path,
  ]);
  expect(entries["app.html"].length).toBeLessThan(10_000_000);
  for (const name of ["session.js", "launch.html"])
    expect(Buffer.from(entries[name])).toEqual(await readFile("scorm/" + name));
  if (process.env.PDF_REGION_DOWNLOADS) {
    await mkdir(process.env.PDF_REGION_DOWNLOADS, { recursive: true });
    await copyFile(path, join(process.env.PDF_REGION_DOWNLOADS, name));
  }
  await button(ui, "Schließen").tap();
  return bytes;
}
export async function classroom(
  browser: Browser,
  info: TestInfo,
  bytes: Buffer,
  title: string,
  viewport: { width: number; height: number },
  name: string,
) {
  const dir = info.outputPath(name);
  await mkdir(dir, { recursive: true });
  for (const [n, b] of Object.entries(unzipSync(bytes)))
    await writeFile(join(dir, n), b);
  const context = await browser.newContext({ hasTouch: true, viewport }),
    page = await context.newPage();
  const requests: string[] = [],
    errors: string[] = [];
  context.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://localhost:5174/")
    )
      requests.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (window !== window.top) return;
    (window as any).__calls = [];
    (window as any).API = Object.fromEntries(
      [
        "LMSInitialize",
        "LMSFinish",
        "LMSGetValue",
        "LMSSetValue",
        "LMSCommit",
      ].map((n) => [
        n,
        (...args: string[]) => {
          (window as any).__calls.push([n, ...args]);
          return "true";
        },
      ]),
    );
  });
  await page.goto(
    "http://localhost:5174/" +
      relative(process.cwd(), join(dir, "launch.html")),
  );
  const ui = page.frames().find((f) => f.url().endsWith("/app.html"))!;
  await expect(
    ui.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(ui.getByLabel("Mystery-Datei", { exact: true })).toHaveCount(0);
  await context.setOffline(true);
  return {
    context,
    page,
    ui,
    async finish() {
      expect(requests).toEqual([]);
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => (window as any).__calls)).toEqual([
        ["LMSInitialize", ""],
      ]);
      await page.evaluate(() =>
        window.dispatchEvent(
          new PageTransitionEvent("pagehide", { persisted: false }),
        ),
      );
      expect(await page.evaluate(() => (window as any).__calls)).toEqual([
        ["LMSInitialize", ""],
        ["LMSFinish", ""],
      ]);
      await context.close();
    },
  };
}
