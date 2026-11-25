import test from "node:test";
import assert from "node:assert/strict";
import { _electron, expect } from "@playwright/test";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { unzipSync } from "fflate";
import {
  openExports,
  closeExports,
  chooseImportCard,
} from "../../qa/studio/controls.mjs";
import { fixtures } from "../../qa/studio/fixtures.mjs";
import { scanWorkflow } from "../../qa/studio/scan-workflow.mjs";
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
    const keyDriver = join(out, "native-keys.node");
    execFileSync("xcrun", [
      "clang++",
      "-std=c++17",
      "-fobjc-arc",
      "-shared",
      "-undefined",
      "dynamic_lookup",
      "-I" + resolve(dirname(process.execPath), "../include/node"),
      "-framework",
      "AppKit",
      resolve("qa/studio/native-keys.mm"),
      "-o",
      keyDriver,
    ]);
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
      const rendererConfirmations = [];
      let rendererFileChoosers = 0;
      // Count any remaining renderer pickers separately from material:choose.
      page.on("filechooser", () => {
        rendererFileChoosers++;
      });
      page.on("dialog", (d) => {
        rendererConfirmations.push(d.message());
        d.accept().catch((e) => {
          if (!String(e).includes("No dialog is showing")) throw e;
        });
      });
      await expect(
        page.getByRole("heading", { name: "MysteryBoard Studio", exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: join(out, "Mac-Studio-Start.png") });
      const prefs = await app.evaluate(({ BrowserWindow, app }) => ({
        platform: process.platform,
        arch: process.arch,
        appVersion: app.getVersion(),
        sourceCommit: process.env.GITHUB_SHA || "local-native-run",
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
      const nativeCommand = async (id) => {
        console.log(
          "Native focus:",
          await app.evaluate(
            (_, path) =>
              process
                .getBuiltinModule("module")
                .createRequire(process.execPath)(path)
                .focus(),
            keyDriver,
          ),
        );
        await page.evaluate(() => {
          globalThis.__nativeCommands = [];
          globalThis.__nativeUnsubscribe?.();
          globalThis.__nativeUnsubscribe = window.mysteryStudio.onCommand(
            (command) => globalThis.__nativeCommands.push(command),
          );
        });
        await expect
          .poll(
            () =>
              app.evaluate(({ BrowserWindow, app }) => {
                const window = BrowserWindow.getAllWindows()[0];
                app.show();
                window.show();
                app.focus({ steal: true });
                window.focus();
                return window.isFocused();
              }),
            { timeout: 30000 },
          )
          .toBe(true);
        await expect
          .poll(() =>
            app.evaluate(
              ({ Menu }, id) =>
                Menu.getApplicationMenu().getMenuItemById(id).enabled,
              id,
            ),
          )
          .toBe(true);
        const eventAudit = JSON.parse(
          await app.evaluate(
            ({ BrowserWindow }, { path, id }) => {
              const driver = process
                .getBuiltinModule("module")
                .createRequire(process.execPath)(path);
              return driver.shortcut(
                id === "project-open" ? "o" : "s",
                id === "project-save-as",
              );
            },
            { path: keyDriver, id },
          ),
        );
        console.log("Native key event:", JSON.stringify(eventAudit));
        assert.equal(eventAudit.command, true);
        assert.equal(eventAudit.shift, id === "project-save-as");
        assert.equal(eventAudit.keyCode, id === "project-open" ? 31 : 1);
        await expect
          .poll(() => page.evaluate(() => globalThis.__nativeCommands))
          .toEqual([id.replace("project-", "")]);
      };
      const accelerators = await app.evaluate(({ Menu }) =>
        Object.fromEntries(
          ["project-open", "project-save", "project-save-as"].map((id) => [
            id,
            Menu.getApplicationMenu().getMenuItemById(id).accelerator,
          ]),
        ),
      );
      assert.deepEqual(accelerators, {
        "project-open": "CmdOrCtrl+O",
        "project-save": "CmdOrCtrl+S",
        "project-save-as": "CmdOrCtrl+Shift+S",
      });
      checks.push("native Ablage accelerators for open, save and save as");
      await app.evaluate(({ dialog }) => {
        globalThis.__nativeDialogRecords = [];
        globalThis.__overviewDecisions = [];
        globalThis.__selectNativeDialog = (...args) => {
          const options = args.at(-1);
          globalThis.__nativeDialogRecords.push({
            message: options?.message,
            buttons: options?.buttons,
          });
          const overview =
            options?.message ===
            "Zur Projektübersicht? Ungesicherte Änderungen gehen verloren.";
          return {
            response:
              overview && globalThis.__overviewDecisions.length
                ? globalThis.__overviewDecisions.shift()
                  ? 0
                  : 1
                : options?.message === "Ungesicherte Änderungen"
                  ? 1
                  : 0,
            checkboxChecked: false,
          };
        };
        dialog.showMessageBox = async (...args) =>
          globalThis.__selectNativeDialog(...args);
        dialog.showMessageBoxSync = (...args) =>
          globalThis.__selectNativeDialog(...args).response;
      });
      for (const source of sources) {
        await app.evaluate(({ dialog }, path) => {
          dialog.showOpenDialog = async () => ({
            canceled: false,
            filePaths: [path],
          });
        }, source.path);
        await nativeCommand("project-open");
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
        await nativeCommand("project-save");
        await expect
          .poll(async () => {
            try {
              return JSON.parse(await readFile(source.path, "utf8")).content
                .title;
            } catch {
              return "";
            }
          })
          .toBe(source.document.content.title + " geprüft");
        await nativeCommand("project-save-as");
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
        if (source.n === 16) {
          await page.screenshot({
            path: join(out, "Mac-UX-Hauptleiste-und-Pinnwand.png"),
          });
          await openExports(page);
          await page.screenshot({
            path: join(out, "Mac-UX-Speichern-und-Exportieren.png"),
          });
          await closeExports(page);
        }
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
            name: "Als Druck-PDF speichern",
            exact: true,
          })
          .click();
        if (source.n !== 5) {
          await page.getByText("Druckoptionen", { exact: true }).click();
          if (source.n === 16 || source.n === 60)
            await page
              .getByRole("combobox", { name: "Papier", exact: true })
              .selectOption("A3");
          if (source.n === 16 || source.n === 20)
            await page
              .getByRole("checkbox", { name: "Querformat", exact: true })
              .check();
        }
        await expect(
          page.getByRole("button", { name: "PDF speichern", exact: true }),
        ).toBeEnabled({ timeout: 60000 });
        await expect
          .poll(() =>
            app.evaluate(({ Menu }) =>
              ["project-open", "project-save", "project-save-as"].every(
                (id) => !Menu.getApplicationMenu().getMenuItemById(id).enabled,
              ),
            ),
          )
          .toBe(true);
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
            name: "Als Druck-PDF speichern",
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
              name: "Für itslearning exportieren",
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
          if (source.n === 5) {
            await openExports(page);
            const opened = app.waitForEvent("window");
            await page
              .getByRole("button", {
                name: "Schüleransicht prüfen",
                exact: true,
              })
              .click();
            const guest = await opened;
            await expect(
              guest.getByRole("heading", {
                name: source.document.content.title + " geprüft",
                exact: true,
              }),
            ).toBeVisible();
            assert.equal(
              await guest.evaluate(() => typeof window.mysteryStudio),
              "undefined",
            );
            assert.equal(
              await guest.evaluate(() => typeof require),
              "undefined",
            );
            await guest.close();
            await closeExports(page);
            checks.push("isolated real Player preview without Studio bridge");
          }
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
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async (...args) =>
          globalThis.__selectNativeDialog(...args);
      });
      await writeFile(
        join(out, "native-macos-progress.json"),
        JSON.stringify({ prefs, checks, complete: false }, null, 2),
      );
      async function pickMaterial(path) {
        await app.evaluate(({ dialog }, filePath) => {
          dialog.showOpenDialog = async (_owner, options) => {
            if (options.title !== "Unterrichtsmaterial auswählen") throw Error("Unerwarteter Dateidialog.");
            (globalThis.__materialPicks ??= []).push(filePath);
            return { canceled: false, filePaths: [filePath] };
          };
        }, path);
        await page.getByRole("button", {name:"Importieren",exact:true}).click();
      }
      // Actual custom-protocol OCR, with strict security and packaged local files.
      for (const name of [
        "Gerades-Foto.jpg",
        "Scan-B-16.pdf",
        "Scan-A-20.pdf",
      ]) {
        await pickMaterial(resolve("tests/fixtures/ocr", name));
        await expect(
          page.getByRole("heading", {
            name: "Karten kontrollieren",
            exact: true,
          }),
        ).toBeVisible({ timeout: 60000 });
        await expect(page.locator(".import-step-body")).not.toHaveAttribute(
          "disabled",
          "",
          { timeout: 60000 },
        );
        await expect(page.locator(".import-step-body")).not.toHaveAttribute(
          "disabled",
          "",
          { timeout: 240000 },
        );
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(
          page
            .getByLabel("Importkarte auswählen", { exact: true })
            .locator("option"),
        ).toHaveCount(
          name === "Scan-A-20.pdf" ? 15 : name === "Scan-B-16.pdf" ? 16 : 4,
          { timeout: 240000 },
        );
        if (name === "Scan-A-20.pdf") {
          await page.getByLabel("PDF-Seite", { exact: true }).selectOption("2");
          await expect(page.locator(".import-step-body")).not.toHaveAttribute(
            "disabled",
            "",
            { timeout: 60000 },
          );
          await expect(page.locator(".import-step-body")).not.toHaveAttribute(
            "disabled",
            "",
            { timeout: 240000 },
          );
          await expect(page.getByRole("alert")).toHaveCount(0);
        }
        await expect(
          page
            .getByLabel("Importkarte auswählen", { exact: true })
            .locator("option"),
        ).toHaveCount(
          name === "Scan-A-20.pdf" ? 20 : name === "Scan-B-16.pdf" ? 16 : 4,
          { timeout: 240000 },
        );
        const count = await page
          .getByLabel("Importkarte auswählen", { exact: true })
          .locator("option")
          .count();
        assert.equal(
          count,
          name === "Scan-A-20.pdf" ? 20 : name === "Scan-B-16.pdf" ? 16 : 4,
        );
        await page.screenshot({ path: join(out, `Mac-OCR-${name}.png`) });
        if (name === "Scan-B-16.pdf") {
          const available = await app.evaluate(({ BrowserWindow, screen }) => {
            const window = BrowserWindow.getAllWindows()[0];
            const area = screen.getDisplayMatching(window.getBounds()).workArea;
            const content = window.getContentBounds();
            const frame = window.getBounds();
            window.setPosition(area.x, area.y);
            return {
              area,
              width: area.width - (frame.width - content.width),
              height: area.height - (frame.height - content.height),
            };
          });
          const viewports = [];
          for (const [width, height] of [
            [1280, 900],
            [1024, 768],
            [768, 1024],
            [720, 600],
          ]) {
            const target = {
              width: Math.min(width, available.width),
              height: Math.min(height, available.height),
            };
            await app.evaluate(
              ({ BrowserWindow }, { width, height }) =>
                BrowserWindow.getAllWindows()[0].setContentSize(width, height),
              target,
            );
            await expect
              .poll(() => page.evaluate(() => window.innerWidth))
              .toBe(target.width);
            await expect
              .poll(() => page.evaluate(() => window.innerHeight))
              .toBe(target.height);
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth),
            ).toBeLessThanOrEqual(target.width + 1);
            await expect(
              page.getByRole("button", {
                name: "Erkennung korrigieren",
                exact: true,
              }),
            ).toBeVisible();
            viewports.push({ requested: { width, height }, actual: target });
            await page.screenshot({
              path: join(
                out,
                `Mac-UX-Import-${target.width}x${target.height}.png`,
              ),
            });
          }
          await writeFile(
            join(out, "native-viewports.json"),
            JSON.stringify(
              { available, viewports, unboundedPortraitNativeTest: false },
              null,
              2,
            ),
          );
          await app.evaluate(
            ({ BrowserWindow }, size) =>
              BrowserWindow.getAllWindows()[0].setContentSize(
                size.width,
                size.height,
              ),
            viewports[0].actual,
          );
        }
        checks.push("custom protocol OCR " + name + " cards " + count);
        await page
          .getByRole("button", { name: "Zur Pinnwand", exact: true })
          .click();
      }
      // A new import must detach the old native save path. Canceling its first
      // Save must leave the previously saved project bytes completely unchanged.
      const oldProject = join(out, "Studio-60-gespeichert.mysteryboard"),
        oldBytes = await readFile(oldProject);
      await pickMaterial(resolve("tests/fixtures/ocr/Gerades-Foto.jpg"));
      await expect(
        page.getByRole("heading", {
          name: "Karten kontrollieren",
          exact: true,
        }),
      ).toBeVisible({ timeout: 60000 });
      await expect(page.locator(".import-step-body")).not.toHaveAttribute(
        "disabled",
        "",
        { timeout: 240000 },
      );
      const picker = page.getByLabel("Importkarte auswählen", { exact: true });
      await expect(picker.locator("option")).toHaveCount(4, {
        timeout: 240000,
      });
      for (let i = 0; i < 4; i++) {
        await chooseImportCard(page, i);
        await page.getByRole("checkbox", { name: /Diese OCR-Karte/ }).check();
      }
      await page
        .getByRole("button", { name: "Weiter zur Übernahme", exact: true })
        .click();
      await page
        .getByRole("radio", {
          name: "Neues Mystery aus dem Dokument erstellen",
          exact: true,
        })
        .check();
      await page.screenshot({ path: join(out, "Mac-UX-Radioauswahl.png") });
      await page.getByRole("checkbox", { name: /Ich habe Texte/ }).check();
      await page
        .getByRole("button", {
          name: "Karten übernehmen",
          exact: true,
        })
        .click();
      await expect(page.locator(".studio-board [data-card]")).toHaveCount(4);
      await app.evaluate(({ dialog }) => {
        globalThis.__studioSaveRequests = 0;
        dialog.showSaveDialog = async () => {
          globalThis.__studioSaveRequests++;
          return { canceled: true };
        };
      });
      await openExports(page);
      await page
        .getByRole("button", {
          name: "Bearbeitbares Mystery sichern",
          exact: true,
        })
        .click();
      await expect
        .poll(() => app.evaluate(() => globalThis.__studioSaveRequests))
        .toBe(1);
      assert.deepEqual(await readFile(oldProject), oldBytes);
      checks.push(
        "new imported mystery asks for a new path and preserves old project bytes",
      );
      await closeExports(page);
      const overviewPromptStart = await app.evaluate(() => {
        globalThis.__overviewDecisions = [false, true];
        return globalThis.__nativeDialogRecords.length;
      });
      await page
        .getByRole("button", { name: "Zur Projektübersicht", exact: true })
        .click();
      await expect(page.locator(".studio-board [data-card]")).toHaveCount(4);
      await expect(page.locator(".studio-unsaved")).toBeVisible();
      await page
        .getByRole("button", { name: "Zur Projektübersicht", exact: true })
        .click();
      assert.deepEqual(
        await app.evaluate(
          (_, start) =>
            globalThis.__nativeDialogRecords
              .slice(start)
              .map((record) => record.message),
          overviewPromptStart,
        ),
        [
          "Zur Projektübersicht? Ungesicherte Änderungen gehen verloren.",
          "Zur Projektübersicht? Ungesicherte Änderungen gehen verloren.",
        ],
      );
      checks.push(
        "overview confirmation: cancel retains dirty cards; explicit discard returns home",
      );
      await page
        .getByRole("button", { name: "Neues Mystery erstellen", exact: true })
        .click();
      await expect
        .poll(() =>
          app.evaluate(
            ({ Menu }) =>
              !Menu.getApplicationMenu().getMenuItemById("project-open")
                .enabled,
          ),
        )
        .toBe(true);
      await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("UX");
      await page
        .getByRole("button", { name: "Mystery erstellen", exact: true })
        .click();
      const emptyPath = join(out, "Leeres-Projekt.mysteryboard");
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      }, emptyPath);
      await openExports(page);
      await expect(
        page.getByRole("button", {
          name: "Bearbeitbares Mystery sichern",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(
        page.getByRole("button", {
          name: "Für itslearning exportieren",
          exact: true,
        }),
      ).toBeDisabled();
      await page.screenshot({
        path: join(out, "Mac-UX-Leeres-Projekt-exportieren.png"),
      });
      await closeExports(page);
      await nativeCommand("project-save");
      await expect
        .poll(async () => {
          try {
            return JSON.parse(await readFile(emptyPath, "utf8")).content.cards
              .length;
          } catch {
            return -1;
          }
        })
        .toBe(0);
      await expect(page.locator(".studio-unsaved")).toHaveCount(0);
      checks.push("empty untitled project saved with real native Command-S");
      const emptyBytes = await readFile(emptyPath);
      await page
        .getByLabel("Mystery-Titel", { exact: true })
        .fill("Noch nicht gesichert");
      await app.evaluate(({ dialog }) => {
        globalThis.__studioSaveRequests = 0;
        dialog.showSaveDialog = async () => {
          globalThis.__studioSaveRequests++;
          return { canceled: true };
        };
      });
      await nativeCommand("project-save-as");
      await expect
        .poll(() => app.evaluate(() => globalThis.__studioSaveRequests))
        .toBe(1);
      await expect(page.locator(".studio-unsaved")).toBeVisible();
      assert.deepEqual(await readFile(emptyPath), emptyBytes);
      checks.push(
        "native Shift-Command-S cancellation retains dirty state and file bytes",
      );
      const badPath = join(out, "Datei-ist-Verzeichnis.mysteryboard");
      await mkdir(badPath, { recursive: true });
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      }, badPath);
      await nativeCommand("project-save-as");
      await expect(page.getByRole("alert")).toHaveCount(1);
      await expect(page.getByRole("alert")).toContainText(
        "konnte nicht gespeichert werden",
      );
      await expect(page.locator(".studio-unsaved")).toBeVisible();
      assert.deepEqual(await readFile(emptyPath), emptyBytes);
      await page.screenshot({ path: join(out, "Mac-UX-Schreibfehler.png") });
      const recovered = join(out, "Wieder-gesichert.mysteryboard");
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      }, recovered);
      await nativeCommand("project-save-as");
      await expect
        .poll(async () => {
          try {
            return JSON.parse(await readFile(recovered, "utf8")).content.title;
          } catch {
            return "";
          }
        })
        .toBe("Noch nicht gesichert");
      await expect(page.locator(".studio-unsaved")).toHaveCount(0);
      await expect(page.getByRole("alert")).toHaveCount(0);
      checks.push(
        "native write failure stays dirty and visible; subsequent save recovers",
      );
      const scanPath = join(out, "Scan-UX-korrigiert.mysteryboard");
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      }, scanPath);
      const corrected = await scanWorkflow(page, out, pickMaterial);
      assert.equal(
        JSON.parse(await readFile(scanPath, "utf8")).content.cards[0].text,
        corrected,
      );
      checks.push(
        "native scan card and boundary correction retain unrelated data and require individual review",
      );
      const materialPicks = await app.evaluate(() => globalThis.__materialPicks);
      assert.deepEqual(materialPicks, [
        "Gerades-Foto.jpg", "Scan-B-16.pdf", "Scan-A-20.pdf",
        "Gerades-Foto.jpg", "Gerades-Foto.jpg",
      ].map(name => resolve("tests/fixtures/ocr", name)));
      const nativeDialogRecords = await app.evaluate(
        () => globalThis.__nativeDialogRecords,
      );
      console.log(
        "Confirmation channels:",
        JSON.stringify({ nativeDialogRecords, rendererConfirmations }),
      );
      // Electron reports the same question through both channels. Its native
      // dialog calls determine the selected answer; do not sum the observers.
      const confirmations = nativeDialogRecords.map((record) => record.message);
      assert.equal(
        confirmations.filter((message) =>
          message.startsWith("Import schließen?"),
        ).length,
        3,
      );
      assert(
        confirmations.some((message) =>
          message.includes("Ein neues Mystery beginnen?"),
        ),
      );
      assert(
        confirmations.some((message) =>
          message.startsWith("Betroffene Karten erneut erkennen?"),
        ),
      );
      await writeFile(
        join(out, "native-macos.json"),
        JSON.stringify(
          {
            passed: true,
            ...prefs,
            checks,
            rendererConfirmations,
            nativeDialogRecords,
            rendererFileChoosers,
            materialPicks,
            platform:
              "real hosted macOS ARM64 runner; not a physical classroom Mac",
            nativeDialogs:
              "native file/close dialog and renderer-confirm answers selected by test harness; confirmation calls asserted, real filesystem and printToPDF; physical OS dialog interaction not tested",
            shortcutTest:
              "synthetic Quartz keyboard events dispatched through the installed app's NSApplication; exact received commands checked, no menu-click substitution or physical keyboard claim",
            physicalM1AndManagedIpadAndItslearning: "open",
          },
          null,
          2,
        ),
      );
      console.log(checks.join("\n"));
    } catch (error) {
      await writeFile(
        join(out, "Mac-Fokus-und-Menue.json"),
        JSON.stringify(
          await app
            .evaluate(({ BrowserWindow, Menu, app }) => ({
              hidden: app.isHidden(),
              focused: BrowserWindow.getFocusedWindow()?.id,
              windows: BrowserWindow.getAllWindows().map((w) => ({
                id: w.id,
                focused: w.isFocused(),
                visible: w.isVisible(),
                enabled: w.isEnabled(),
                focusable: w.isFocusable(),
                modal: w.isModal(),
                loading: w.webContents.isLoadingMainFrame(),
                url: w.webContents.getURL(),
              })),
              menu: Object.fromEntries(
                ["project-open", "project-save", "project-save-as"].map(
                  (id) => [
                    id,
                    Menu.getApplicationMenu().getMenuItemById(id).enabled,
                  ],
                ),
              ),
            }))
            .catch(() => ({})),
          null,
          2,
        ),
      );
      const page = await app.firstWindow().catch(() => null);
      if (page) {
        await page
          .screenshot({ path: join(out, "Mac-Fehler.png") })
          .catch(() => {});
        await writeFile(
          join(out, "Mac-Fehler.txt"),
          String(error) +
            "\n" +
            (await page
              .locator("body")
              .innerText()
              .catch(() => "")),
        );
      }
      throw error;
    } finally {
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
      await app.close();
    }
  },
);
