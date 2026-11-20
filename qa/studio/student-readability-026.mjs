import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { button } from "./controls.mjs";

const priorHash =
  "417d061406096a142a42e990d2266107fe03e0b234c6e4d8e01abad3ac49cab6";
const launchPattern =
  /<script id="mysteryboard-launch" type="application\/json">[^<]+<\/script>/;

export function detailedText(id) {
  if (id === 4) return "Ein kurzer Befund.";
  const length = [0, 500, 2000, 4000][id] ?? 1100 + (id % 3) * 180;
  const topics = [
    "Die Versiegelung nimmt zu",
    "Nasser Boden nimmt weniger Wasser auf",
    "Der Bach steigt nach Starkregen",
  ];
  const prefix = `Befund ${id}: ${topics[id % topics.length]}.\n\n`;
  const suffix = `\n\nEndbeleg ${String(id).padStart(2, "0")} vollständig.`;
  const paragraphs = [
    "Regen trifft auf Asphalt. Wasser sammelt sich in den tiefer gelegenen Straßen.",
    "Auf einer Wiese versickert Wasser. Die Wurzeln halten den Boden zusammen.",
    "Der Abfluss kann den Bach belasten. Die Messdaten zeigen Unterschiede nach Ort und Zeit.",
    "Vergleich: 12,5 Millimeter in einer Stunde. Wir trennen Beobachtung und Vermutung.",
  ];
  const series = paragraphs
    .map((_, at) => paragraphs[(at + id) % paragraphs.length])
    .join("\n\n");
  const middle = (series + "\n\n").repeat(Math.ceil(length / series.length));
  return (
    prefix + middle.slice(0, length - prefix.length - suffix.length) + suffix
  );
}

export async function checkPreview(node, text) {
  const preview = node.locator("[data-card-text] tspan");
  if (text === "Ein kurzer Befund.") {
    await expect(preview).toHaveCount(1);
    await expect(preview).toHaveText(text);
    await expect(node).not.toHaveAttribute("data-card-excerpt", "true");
    return;
  }
  await expect(preview).toHaveCount(6);
  await expect(node).toHaveAttribute("data-card-excerpt", "true");
  await expect(
    node.getByText("Vollständigen Text öffnen", { exact: true }),
  ).toBeVisible();
  await expect(node).not.toContainText(text.trim().split("\n").at(-1));
}

export function layoutObservation(ui) {
  return ui.locator("svg.board").evaluate((svg) => {
    const cards = [...svg.querySelectorAll("[data-card]")].map((node) => {
      const rect = node.querySelector(":scope > rect");
      const body =
        node.querySelector("[data-card-text]") ??
        node.querySelectorAll(":scope > text")[1];
      return {
        id: Number(node.dataset.card),
        x: Number(node.dataset.x),
        y: Number(node.dataset.y),
        width: rect.width.baseVal.value,
        height: rect.height.baseVal.value,
        color: rect.getAttribute("fill"),
        lines: body.querySelectorAll("tspan").length,
        excerpt: node.dataset.cardExcerpt === "true",
        label: node.querySelector("[data-number] text").textContent,
      };
    });
    let overlappingPairs = 0;
    for (const [i, a] of cards.entries()) {
      for (const b of cards.slice(i + 1)) {
        if (
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height
        )
          overlappingPairs++;
      }
    }
    return {
      cards,
      positions: cards.map(({ id, x, y, color, label }) => [
        id,
        x,
        y,
        color,
        label,
      ]),
      overlappingPairs,
      connectors: [
        ...svg.querySelectorAll(
          "[data-edge] line[marker-end], [data-edge] line[marker-start]",
        ),
      ].map((line) => ({
        x1: line.x1.baseVal.value,
        startY: line.y1.baseVal.value,
        x2: line.x2.baseVal.value,
        endY: line.y2.baseVal.value,
      })),
      labels: [...svg.querySelectorAll("[data-edge-label]")].map(
        (node) => node.textContent,
      ),
      zoom: Number(svg.dataset.zoom),
    };
  });
}

async function useBaseline(out) {
  const path = process.env.STUDIO_025_SCORM;
  assert(path, "STUDIO_025_SCORM must point to the validated 0.2.5 export.");
  const archive = await readFile(path);
  assert.equal(createHash("sha256").update(archive).digest("hex"), priorHash);
  const previous = unzipSync(archive);
  const changed = Buffer.from(previous["app.html"]).toString();
  const current = await readFile(join(out, "launch-30", "app.html"), "utf8");
  const launch = current.match(launchPattern)[0];
  assert.match(changed, launchPattern);
  const dir = join(out, "before-30");
  await mkdir(dir, { recursive: true });
  for (const [name, bytes] of Object.entries(previous)) {
    await writeFile(
      join(dir, name),
      name === "app.html"
        ? changed.replace(launchPattern, () => launch)
        : bytes,
    );
  }
}

async function observeMedia(ui, card) {
  const media = card.locator(":scope > image");
  await expect(media).toBeVisible();
  const box = await media.evaluate(async (image) => {
    const original = new Image();
    original.src = image.getAttribute("href");
    await original.decode();
    const rect = image.parentElement.querySelector(":scope > rect");
    return {
      y: image.y.baseVal.value,
      height: image.height.baseVal.value,
      width: image.width.baseVal.value,
      original: [original.naturalWidth, original.naturalHeight],
      cardHeight: rect.height.baseVal.value,
    };
  });
  assert(
    Math.abs(box.width / box.height - box.original[0] / box.original[1]) < 0.01,
  );
  assert(box.y > 0 && box.y + box.height < box.cardHeight);
  await card.press("Enter");
  const reading = ui.getByRole("dialog");
  await expect(reading.locator(".reading img")).toBeVisible();
  await expect(reading.locator(".reading img")).toHaveJSProperty(
    "naturalWidth",
    box.original[0],
  );
  await expect(reading.locator(".reading")).toContainText(
    "Unveränderliche Quelle",
  );
  await button(reading, "Bild vergrößern").click();
  await expect(
    reading.getByRole("slider", { name: "Bildvergrößerung" }),
  ).toBeVisible();
  await button(reading, "Schließen").click();
  return box;
}

export async function compareReadability(
  out,
  learner,
  backup,
  viewport,
  engine,
) {
  await useBaseline(out);
  const screenshots = [];
  const states = [];
  for (const [label, resource] of [
    ["Vorher", "before-30"],
    ["Nachher", "launch-30"],
  ]) {
    const { page, ui, external } = await learner(
      30,
      viewport,
      backup,
      resource,
    );
    await expect(ui.locator("svg.board [data-card] > image")).toHaveCount(2);
    await ui
      .locator("svg.board")
      .evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    states.push(await layoutObservation(ui));
    const name = `${label}-30-${engine}.png`;
    await page.screenshot({ path: join(out, name) });
    screenshots.push(name);
    if (label === "Nachher") {
      for (const id of [1, 2])
        await observeMedia(ui, ui.locator(`[data-card="${id}"]`));
      await expect(button(ui, "Überlagerte Karten anzeigen")).toHaveCount(0);
    }
    assert.deepEqual(external, []);
    await page.context().close();
  }
  const [before, after] = states;
  assert.deepEqual(after.positions, before.positions);
  assert.deepEqual(after.labels, before.labels);
  assert.equal(after.labels.length, 3);
  assert(before.overlappingPairs > 0);
  assert.equal(after.overlappingPairs, 0);
  assert(before.cards[1].height > after.cards[1].height * 2);
  assert(before.cards[2].height > after.cards[2].height * 2);
  assert.equal(after.cards.filter((c) => c.excerpt).length, 23);
  assert(after.cards.every((c) => c.lines <= 6));
  await writeFile(
    join(out, `Vergleich-30-${engine}.json`),
    JSON.stringify(
      {
        viewport,
        screenshots,
        priorHash,
        backupSha256: createHash("sha256")
          .update(await readFile(backup))
          .digest("hex"),
        before,
        after,
      },
      null,
      2,
    ) + "\n",
  );
  return {
    viewport,
    screenshots,
    overlappingPairs: [before.overlappingPairs, after.overlappingPairs],
    tallest: states.map(({ cards }) =>
      Math.max(...cards.map((card) => card.height)),
    ),
    cardsWithExcerpt: after.cards.filter((c) => c.excerpt).length,
  };
}

export async function capturePrint(browser, ui, path, edits) {
  await button(ui, "Menü").click();
  await button(ui, "Druckfassung / PDF").click();
  await expect(button(ui, "Drucken / PDF speichern")).toBeEnabled({
    timeout: 90000,
  });
  const frame = ui.frameLocator('iframe[title="Druckvorschau"]');
  for (const edit of edits) {
    const part = frame.locator(`[data-card-text="${edit.id}"]`);
    assert.equal((await part.allTextContents()).join(""), edit.text);
  }
  const html = await frame.locator("html").evaluate((node) => node.outerHTML);
  const printing = await browser.newPage();
  try {
    await printing.setContent("<!doctype html>" + html);
    await printing.pdf({
      path,
      preferCSSPageSize: true,
      printBackground: true,
    });
  } finally {
    await printing.close();
  }
}
