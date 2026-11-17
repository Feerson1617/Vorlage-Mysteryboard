import test from "node:test";
import assert from "node:assert/strict";
import { _electron, expect } from "@playwright/test";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { unzipSync } from "fflate";
import { fixtures } from "../../qa/studio/fixtures.mjs";
const out = resolve(process.env.STUDIO_EVIDENCE || "artifacts/studio-tests");
const executable =
  process.env.STUDIO_EXEC ||
  resolve(
    "out/MysteryBoard Studio-darwin-arm64/MysteryBoard Studio.app/Contents/MacOS/MysteryBoard Studio",
  );
test(
  "Packaged macOS ARM64 Studio: native files, PDFs, SCORM, OCR and close protection",
  { skip: process.platform !== "darwin", timeout: 1200000 },
  async () => {
    assert.equal(process.arch, "arm64");
    await mkdir(out, { recursive: true });
    const sources = await fixtures(out);
    const app = await _electron.launch({
      executablePath: executable,
      args: ["--user-data-dir=" + join(out, "native-profile")],
      timeout: 60000,
    });
    const checks = [];
    try {
      const page = await app.firstWindow();
      page.setDefaultTimeout(30000);
      await expect(
        page.getByRole("heading", { name: "MysteryBoard Studio", exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: join(out, "Mac-Studio-Start.png") });
      const prefs = await app.evaluate(({ BrowserWindow, app }) => ({
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        isPackaged: app.isPackaged,
        prefs:
          BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
        argv: process.argv,
      }));
      assert.equal(prefs.isPackaged, true);
      assert.equal(prefs.prefs.sandbox, true);
      assert.equal(prefs.prefs.contextIsolation, true);
      assert.equal(prefs.prefs.nodeIntegration, false);
      assert.equal(prefs.prefs.webSecurity, true);
      assert(!prefs.argv.includes("--no-sandbox"));
      assert.equal(await page.evaluate(() => typeof require), "undefined");
      checks.push(
        "native sandbox/context isolation/node integration preferences verified",
      );
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      });
      for (const source of sources) {
        await app.evaluate(({ dialog }, path) => {
          dialog.showOpenDialog = async () => ({
            canceled: false,
            filePaths: [path],
          });
        }, source.path);
        if (await page.locator(".studio-project-menu summary").count())
          await page.locator(".studio-project-menu summary").click();
        await page
          .getByRole("button", { name: "Mystery öffnen", exact: true })
          .click();
        await expect(page.locator(".studio-board [data-card]")).toHaveCount(
          source.n,
        );
        await page
          .getByLabel("Mystery-Titel", { exact: true })
          .fill(source.document.content.title + " geprüft");
        const saved = join(out, `Studio-${source.n}-gespeichert.mysteryboard`);
        await app.evaluate(({ dialog }, path) => {
          dialog.showSaveDialog = async () => ({
            canceled: false,
            filePath: path,
          });
        }, saved);
        await page
          .getByRole("button", { name: "Projekt sichern", exact: true })
          .click();
        await expect
          .poll(async () => {
            try {
              return JSON.parse(await readFile(saved, "utf8")).content.title;
            } catch {
              return "";
            }
          })
          .toBe(source.document.content.title + " geprüft");
        checks.push(source.n + " native project read/write");
        const pdf = join(out, `Studio-${source.n}-Karten.pdf`);
        await app.evaluate(({ dialog }, path) => {
          dialog.showSaveDialog = async () => ({
            canceled: false,
            filePath: path,
          });
        }, pdf);
        await page
          .getByRole("button", { name: "Exportieren", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Als Druck-PDF exportieren",
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("button", { name: "PDF speichern", exact: true }),
        ).toBeEnabled({ timeout: 60000 });
        await page
          .getByRole("button", { name: "PDF speichern", exact: true })
          .click();
        await expect
          .poll(
            async () => {
              try {
                return (await stat(pdf)).size;
              } catch {
                return 0;
              }
            },
            { timeout: 60000 },
          )
          .toBeGreaterThan(1000);
        await page.screenshot({
          path: join(out, `Mac-Studio-PDF-${source.n}.png`),
        });
        await page
          .getByRole("dialog", {
            name: "Als Druck-PDF exportieren",
            exact: true,
          })
          .getByRole("button", { name: "Schließen", exact: true })
          .click();
        checks.push(source.n + " native vector PDF");
        if (source.n === 5 || source.n === 16) {
          const zipPath = join(out, `Studio-${source.n}-SCORM.zip`);
          await app.evaluate(({ dialog }, path) => {
            dialog.showSaveDialog = async () => ({
              canceled: false,
              filePath: path,
            });
          }, zipPath);
          await page
            .getByRole("button", { name: "Exportieren", exact: true })
            .click();
          await page
            .getByRole("button", {
              name: "Als SCORM für itslearning exportieren",
              exact: true,
            })
            .click();
          await expect
            .poll(async () => {
              try {
                return (await stat(zipPath)).size;
              } catch {
                return 0;
              }
            })
            .toBeGreaterThan(1000);
          const entries = unzipSync(new Uint8Array(await readFile(zipPath)));
          assert.deepEqual(Object.keys(entries).sort(), [
            "app.html",
            "imsmanifest.xml",
            "launch.html",
            "session.js",
          ]);
          const html = Buffer.from(entries["app.html"]).toString();
          assert(!html.includes("Lehrkräftemodus öffnen"));
          assert(!html.includes("tesseract.min.js"));
          checks.push(source.n + " actual independent player SCORM");
        }
      }
      // Native close warning cancellation keeps the actual packaged application alive.
      await page
        .getByLabel("Mystery-Titel", { exact: true })
        .fill("Noch nicht gesichert");
      await app.evaluate(async ({ dialog, BrowserWindow }) => {
        dialog.showMessageBox = async () => ({ response: 0 });
        BrowserWindow.getAllWindows()[0].close();
      });
      await expect(page.locator(".studio-board")).toBeVisible();
      checks.push("cancel close retains unsaved project");
      // Actual custom-protocol OCR, with strict security and packaged local files.
      for (const name of [
        "Gerades-Foto.jpg",
        "Scan-B-16.pdf",
        "Scan-A-20.pdf",
      ]) {
        await page
          .getByRole("button", { name: "Material importieren", exact: true })
          .click();
        await page
          .getByLabel("Mystery-Datei", { exact: true })
          .setInputFiles(resolve("tests/fixtures/ocr", name));
        await expect(
          page.getByRole("heading", { name: "2. Karten prüfen", exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await expect(page.locator(".import-step-body")).not.toHaveAttribute(
          "disabled",
          "",
          { timeout: 60000 },
        );
        await page
          .getByRole("button", { name: "Original ansehen", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Kartengrenzen und Text erkennen",
            exact: true,
          })
          .click();
        await expect(page.locator(".import-step-body")).not.toHaveAttribute(
          "disabled",
          "",
          { timeout: 240000 },
        );
        await expect(page.getByRole("alert")).toHaveCount(0);
        await page
          .getByRole("button", { name: "Karten ansehen", exact: true })
          .click();
        const count = await page
          .getByLabel("Importkarte auswählen", { exact: true })
          .locator("option")
          .count();
        assert(count > 0);
        await page.screenshot({ path: join(out, `Mac-OCR-${name}.png`) });
        checks.push("custom protocol OCR " + name + " cards " + count);
        await page
          .getByRole("button", { name: "Import abbrechen", exact: true })
          .click();
      }
      await writeFile(
        join(out, "native-macos.json"),
        JSON.stringify(
          {
            passed: true,
            ...prefs,
            checks,
            platform:
              "real hosted macOS ARM64 runner; not a physical classroom Mac",
            nativeDialogs:
              "dialog results selected by test harness; real application filesystem and printToPDF used",
            physicalM1AndManagedIpadAndItslearning: "open",
          },
          null,
          2,
        ),
      );
      console.log(checks.join("\n"));
    } finally {
      await app.close();
    }
  },
);
