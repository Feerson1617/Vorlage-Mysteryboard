import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
export async function inspectOriginal(page, out) {
  const ref = JSON.parse(
    await readFile(new URL("./original-reference.json", import.meta.url)),
  );
  const measured = [];
  for (const [n, rects] of ref.pages.entries()) {
    await page
      .getByLabel("PDF-Seite", { exact: true })
      .selectOption(String(n + 1));
    const overlays = page.locator("[data-pdf-region]");
    await expect(overlays).toHaveCount(rects.length);
    const found = await overlays.evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.querySelector("rect");
        const get = (k) => Number(r.getAttribute(k));
        return {
          id: Number(node.dataset.regionCard),
          box: [
            get("x"),
            get("y"),
            get("x") + get("width"),
            get("y") + get("height"),
          ],
        };
      }),
    );
    const cards = [];
    for (const ref of rects) {
      const candidates = found.filter(({ box }) =>
        box.every((v, i) => Math.abs(v - ref[i]) <= 2),
      );
      assert.equal(
        candidates.length,
        1,
        JSON.stringify({ page: n + 1, ref, found }),
      );
      const match = candidates[0];
      await page
        .getByRole("button", {
          name: `Bereich ${match.id} auswählen`,
          exact: true,
        })
        .click();
      cards.push({
        ...match,
        ref,
        text: (
          await Promise.all(
            ["Überschrift", "Kartentext", "Quellenangabe"].map((label) =>
              page
                .getByRole("textbox", { name: new RegExp("^" + label) })
                .inputValue(),
            ),
          )
        ).join("\n"),
      });
    }
    assert.equal(new Set(cards.map((c) => c.id)).size, rects.length);
    measured.push(cards);
    await page.screenshot({ path: join(out, `Originalseite-${n + 1}.png`) });
  }
  await writeFile(
    join(out, "Originalabgleich-privat.json"),
    JSON.stringify(measured),
  );
}
