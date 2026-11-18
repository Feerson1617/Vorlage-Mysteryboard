import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export const pinboard = (page) => page.locator(".studio-board svg.board");
export async function coordinates(board, id) {
  const card = board.locator(`[data-card="${id}"]`);
  return card.evaluate((node) => [
    Number(node.dataset.x),
    Number(node.dataset.y),
  ]);
}

export async function displacedRelease(
  page,
  id,
  { dx = 49, dy = 26, cancel, during } = {},
) {
  const board = pinboard(page);
  const card = board.locator(`[data-card="${id}"]`);
  const before = await coordinates(board, id);
  const zoom = Number(await board.getAttribute("data-zoom"));
  const box = await card.locator("rect").first().boundingBox();
  assert(box, "Expected a visible card");
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  // Browsers may coalesce the move. Deliver only the two measured endpoints.
  await card.dispatchEvent("pointerdown", {
    pointerId: 42,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
  });
  if (during) await during();
  await board.dispatchEvent(cancel || "pointerup", {
    pointerId: 42,
    pointerType: "mouse",
    button: 0,
    clientX: x + dx,
    clientY: y + dy,
  });
  const expected = cancel
    ? before
    : before.map(
        (value, axis) =>
          Math.round((value + [dx, dy][axis] / zoom) * 100) / 100,
      );
  await expect.poll(() => coordinates(board, id)).toEqual(expected);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.deepEqual(
    await coordinates(board, id),
    expected,
    "Position changed again on the next render",
  );
  return { id, before, expected, actual: await coordinates(board, id), zoom };
}

export async function moveWithMouse(
  page,
  id,
  { dx, dy, steps = 1, during, offBoard = false },
) {
  const board = pinboard(page);
  const before = await coordinates(board, id);
  const zoom = Number(await board.getAttribute("data-zoom"));
  const rect = await board
    .locator(`[data-card="${id}"] rect`)
    .first()
    .boundingBox();
  const x = Math.round(rect.x + rect.width / 2),
    y = Math.round(rect.y + rect.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (during) await during();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
  const expected = before.map(
    (v, i) => Math.round((v + [dx, dy][i] / zoom) * 100) / 100,
  );
  await expect.poll(() => coordinates(board, id)).toEqual(expected);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const actual = await coordinates(board, id);
  assert.deepEqual(actual, expected);
  return { id, before, expected, actual, zoom, dx, dy, steps, offBoard };
}
