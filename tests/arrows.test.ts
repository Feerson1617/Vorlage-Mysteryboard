import { describe, it, expect, vi } from "vitest";
import { arrowSize, edgeArrow, edgeGeometry } from "../src/core/layout";
describe("Sichtbare Pfeilgeometrie ohne Datenmigration", () => {
  it("kehrt einen Pfeil bei nah beieinanderliegenden Karten nicht geometrisch um", () => {
    const edge = { id: 1, from: 1, to: 2, direction: 1 as const, label: "" };
    const layouts = new Map([
      [1, { height: 100 }],
      [2, { height: 100 }],
    ]) as Parameters<typeof edgeGeometry>[2];
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({ measureText: () => ({ width: 0 }) }),
      }),
    });
    const g = edgeGeometry(
      edge,
      [
        { id: 1, x: 0, y: 0, color: 0 },
        { id: 2, x: 310, y: 0, color: 0 },
      ],
      layouts,
    );
    vi.unstubAllGlobals();
    expect(g.start.x).toBeGreaterThan(300);
    expect(g.end.x).toBeLessThan(310);
    expect(g.end.x).toBeGreaterThan(g.start.x);
  });
  it.each([0, 1, 2] as const)(
    "erhält direction %i und legt die Spitze an den richtigen Endpunkt",
    (direction) => {
      const edge = { id: 1, from: 1, to: 2, direction, label: "" },
        a = { x: 20, y: 50 },
        b = { x: 420, y: 200 },
        head = edgeArrow(edge, a, b);
      if (!direction) expect(head).toBeNull();
      else {
        expect(head![0]).toEqual(direction === 1 ? b : a);
        expect(head![1]).not.toEqual(head![2]);
      }
      expect(edge.direction).toBe(direction);
    },
  );
  it("begrenzt die Vergrößerung bei extremem Herauszoomen", () => {
    expect(arrowSize(1).length).toBe(14);
    expect(arrowSize(0.2).length * 0.2).toBe(10);
    expect(arrowSize(0.001).length).toBe(60);
  });
});
