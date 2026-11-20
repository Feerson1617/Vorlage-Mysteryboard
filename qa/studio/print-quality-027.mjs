import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { button } from "./controls.mjs";

const pattern =
  /<script id="mysteryboard-launch" type="application\/json">[^<]+<\/script>/;
const oldScormHash =
  "e920ed8cbd39abffc8089fce2edc60fe05452d7b178f93f2635db3d429809350";

function printData(frame) {
  return frame.locator("body").evaluate((body) => {
    const sections = [...body.querySelectorAll(".print-page")];
    const entries = [
      ...body.querySelectorAll(
        "p[data-card-text],p[data-card-source],p[data-card-table],p[data-edge-label],article[data-card-id] > h3,article[data-edge-id] > h3,.print-image-caption",
      ),
    ].map((node) => {
      const page = node.closest(".print-page");
      const pageBox = page.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return {
        page: Number(page.dataset.page),
        bounds: [
          box.left - pageBox.left,
          box.top - pageBox.top,
          box.right - pageBox.left,
          box.bottom - pageBox.top,
        ],
        text: node.textContent,
        cardText: node.dataset.cardText,
        source: node.dataset.cardSource,
        table: node.dataset.cardTable,
        edgeLabel: node.dataset.edgeLabel,
        tokenSplit: node.parentElement.hasAttribute("data-token-split"),
      };
    });
    const overview = body.querySelector("[data-print-overview]");
    const scale = (svg) => {
      const box = svg.getBoundingClientRect();
      return Math.min(
        box.height / svg.viewBox.baseVal.height,
        box.width / svg.viewBox.baseVal.width,
      );
    };
    return {
      pageCount: sections.length,
      sections: sections.map((s) => s.dataset.section),
      entries,
      imagePages: sections.filter((s) => s.dataset.section === "images").length,
      cards: [...overview.querySelectorAll("[data-overview-card-id]")].map(
        (c) => ({
          id: Number(c.dataset.overviewCardId),
          x: Number(c.dataset.x),
          y: Number(c.dataset.y),
          color: c.querySelector("rect").getAttribute("fill"),
          lines: c.querySelectorAll("[data-overview-text-line]").length,
        }),
      ),
      overviewScale: scale(overview),
      tileScales: [...body.querySelectorAll("[data-print-tile]")].map(scale),
      tileCards: [...body.querySelectorAll("[data-print-tile]")].map((map) =>
        map.dataset.tileCards.split(",").map(Number),
      ),
    };
  });
}

export async function openPrint(ui, paper) {
  await button(ui, "Menü").click();
  await button(ui, "Druckfassung / PDF").click();
  if (paper === "a3") await ui.getByLabel("Papierformat").selectOption("a3");
  const frame = ui.frameLocator('iframe[title="Druckvorschau"]');
  await expect(frame.locator("html")).toHaveAttribute(
    "data-print-paper",
    paper,
  );
  await expect(frame.locator("body")).toHaveAttribute(
    "data-print-ready",
    "true",
    { timeout: 120000 },
  );
  await expect(button(ui, "Drucken / PDF speichern")).toBeEnabled();
  return frame;
}

export async function actualPrint(browser, ui, paper, output) {
  const frame = await openPrint(ui, paper);
  const result = await printData(frame);
  if (browser && output) {
    const html = await frame.locator("html").evaluate((node) => node.outerHTML);
    const target = await browser.newPage();
    try {
      await target.setContent("<!doctype html>" + html);
      await target.pdf({
        path: output,
        preferCSSPageSize: true,
        printBackground: true,
      });
    } finally {
      await target.close();
    }
  }
  await button(ui.getByRole("dialog"), "Schließen").click();
  return result;
}

export function verifyPrintStructure(result, stored) {
  const { work, content } = stored;
  assert.deepEqual(
    result.cards.map(({ id, x, y }) => [id, x, y]),
    work.cards.map(({ id, x, y }) => [id, x, y]),
  );
  assert(result.cards.every((card) => card.lines <= 6));
  const edits = new Map((work.textEdits || []).map((e) => [e.id, e.text]));
  for (const card of content.cards) {
    const segments = result.entries.filter(
      (part) => Number(part.cardText) === card.id,
    );
    assert.equal(
      segments.map((part) => part.text).join(""),
      edits.get(card.id) ?? card.text,
      "Exact print text of card " + card.id,
    );
    assert(
      segments.slice(1).every((part) => /\S/.test(part.text)),
      "No empty card continuation",
    );
    assert(
      segments
        .slice(0, -1)
        .every((part) => /\s$/u.test(part.text) || part.tokenSplit),
      "Ordinary words cannot break across fragments",
    );
  }
  for (const edge of work.edges) {
    assert.equal(
      result.entries
        .filter((e) => Number(e.edgeLabel) === edge.id)
        .map((part) => part.text)
        .join(""),
      edge.label,
    );
  }
  if (result.tileScales.length) {
    assert(Math.min(...result.tileScales) >= 0.72);
    assert.equal(new Set(result.tileCards.flat()).size, work.cards.length);
  }
}

async function usePrior(out) {
  const path = process.env.STUDIO_026_SCORM;
  assert(path, "STUDIO_026_SCORM must point to the verified 0.2.6 export.");
  const archive = await readFile(path);
  assert.equal(
    createHash("sha256").update(archive).digest("hex"),
    oldScormHash,
  );
  const original = unzipSync(archive);
  const current = await readFile(join(out, "launch-30", "app.html"), "utf8");
  const oldApp = Buffer.from(original["app.html"]).toString();
  assert.match(oldApp, pattern);
  const launch = current.match(pattern)[0];
  const reference = join(out, "before-print-30");
  await mkdir(reference, { recursive: true });
  for (const [name, bytes] of Object.entries(original)) {
    await writeFile(
      join(reference, name),
      name === "app.html" ? oldApp.replace(pattern, () => launch) : bytes,
    );
  }
}

export async function comparePrints(out, learner, browser, ui, backup, stored) {
  await usePrior(out);
  const base = await learner(
    30,
    { width: 1024, height: 768 },
    backup,
    "before-print-30",
  );
  const audit = {};
  for (const paper of ["a4", "a3"]) {
    const format = paper.toUpperCase();
    const before = await actualPrint(
      browser,
      base.ui,
      paper,
      join(out, `Vorher-${format}.pdf`),
    );
    const after = await actualPrint(
      browser,
      ui,
      paper,
      join(out, `Nachher-${format}.pdf`),
    );
    verifyPrintStructure(after, stored);
    assert(
      after.tileScales.length > 0 && after.overviewScale > before.overviewScale,
    );
    assert(after.imagePages === 3);
    assert(
      after.entries.some(
        (part) => part.table && part.text.includes("Pegelstand"),
      ),
    );
    const wordSplits = before.entries.filter(
      (part, i, parts) =>
        part.cardText &&
        part.cardText === parts[i + 1]?.cardText &&
        /\p{L}$/u.test(part.text) &&
        /^\p{L}/u.test(parts[i + 1].text),
    ).length;
    audit[paper] = { before, after, wordSplits, priorHash: oldScormHash };
  }
  assert(Object.values(audit).some((result) => result.wordSplits > 0));
  assert.deepEqual(base.external, []);
  await base.page.context().close();
  await writeFile(
    join(out, "Druckvergleich-DOM.json"),
    JSON.stringify(audit, null, 2) + "\n",
  );
  return Object.fromEntries(
    Object.entries(audit).map(([paper, test]) => [
      paper,
      {
        pages: test.after.pageCount,
        tiles: test.after.tileScales.length,
        reproducedWordSplits: test.wordSplits,
      },
    ]),
  );
}
