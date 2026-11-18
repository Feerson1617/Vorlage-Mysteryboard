import { test, expect } from "vitest";
import { nextEdgeId, MAX_EDGES, type Edge } from "../src/core/model";
const edges = (ids: number[]) => ids.map((id) => ({ id }) as Edge);
test("importierte maximale ID bleibt erhalten und freie Lücke wird benutzt", () => {
  const existing = edges([1, 2, 4, 1000000]);
  expect(nextEdgeId(existing)).toBe(3);
  expect(existing.map((e) => e.id)).toEqual([1, 2, 4, 1000000]);
});
test("dichte Historie bleibt auch an der Verbindungsgrenze im gültigen ID-Bereich", () => {
  expect(
    nextEdgeId(edges(Array.from({ length: MAX_EDGES - 1 }, (_, i) => i + 1))),
  ).toBe(MAX_EDGES);
  expect(nextEdgeId([])).toBe(1);
});
