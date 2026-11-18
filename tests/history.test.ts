import { describe, it, expect } from "vitest";
import {
  historyReducer,
  emptyHistory,
  hasChanges,
  HISTORY_LIMIT,
} from "../src/core/history";
import { initialWork, validateMystery, type Work } from "../src/core/model";
import small from "../src/content/small.json";
const initial = initialWork(validateMystery(small));
describe("Rückgängig und Wiederholen", () => {
  it("stellt Position/Überlagerung, Farbe, Kategorie und Verbindungserstellung/-bearbeitung/-löschung exakt wieder her", () => {
    let history = historyReducer(emptyHistory, { type: "load", work: initial });
    const states: Work[] = [initial];
    const edits = [
      (w: Work) => {
        const c = w.cards.shift()!;
        c.x = -51.25;
        c.y += 20;
        w.cards.push(c);
      },
      (w: Work) => {
        w.cards[0].color = 5;
      },
      (w: Work) => {
        w.categories[5] = "Noch überprüfen";
      },
      (w: Work) => {
        w.edges.push({
          id: 10,
          from: 1,
          to: 12,
          direction: 1,
          label: "Ergänzung ÄÖÜ",
        });
      },
      (w: Work) => {
        w.edges[9].direction = 2;
        w.edges[9].label = "Überarbeiteter Text";
      },
      (w: Work) => {
        w.edges.pop();
      },
    ];
    for (const edit of edits) {
      const w = structuredClone(history.present!);
      edit(w);
      states.push(w);
      history = historyReducer(history, { type: "edit", work: w });
    }
    for (let i = states.length - 2; i >= 0; i--) {
      history = historyReducer(history, { type: "undo" });
      expect(history.present).toEqual(states[i]);
    }
    expect(hasChanges(history)).toBe(false);
    for (let i = 1; i < states.length; i++) {
      history = historyReducer(history, { type: "redo" });
      expect(history.present).toEqual(states[i]);
    }
    expect(hasChanges(history)).toBe(true);
    expect(initialWork(validateMystery(small))).toEqual(initial);
  });
  it("verwirft Zukunft nur nach echter neuer Bearbeitung und setzt beide Historien beim Laden zurück", () => {
    let history = historyReducer(emptyHistory, { type: "load", work: initial });
    const changed = structuredClone(initial);
    changed.cards[0].x += 10;
    history = historyReducer(history, { type: "edit", work: changed });
    history = historyReducer(history, { type: "undo" });
    history = historyReducer(history, {
      type: "edit",
      work: structuredClone(initial),
    });
    expect(history.future).toHaveLength(1);
    const branched = structuredClone(initial);
    branched.cards[0].color = 3;
    history = historyReducer(history, { type: "edit", work: branched });
    expect(history.future).toHaveLength(0);
    expect(historyReducer(history, { type: "redo" })).toBe(history);
    history = historyReducer(history, { type: "undo" });
    history = historyReducer(history, { type: "load", work: changed });
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
    expect(hasChanges(history)).toBe(false);
  });
  it("behält höchstens 40 Schritte auch über vollständiges Rückgängig/Wiederholen", () => {
    let history = historyReducer(emptyHistory, { type: "load", work: initial });
    for (let i = 1; i <= 55; i++) {
      const w = structuredClone(initial);
      w.cards[0].x = i;
      history = historyReducer(history, { type: "edit", work: w });
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < 55; i++)
      history = historyReducer(history, { type: "undo" });
    expect(history.present!.cards[0].x).toBe(15);
    expect(history.future).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < 55; i++)
      history = historyReducer(history, { type: "redo" });
    expect(history.present!.cards[0].x).toBe(55);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.future).toEqual([]);
    expect(historyReducer(history, { type: "load", work: null })).toEqual(
      emptyHistory,
    );
  });
});

describe("Bewegungen innerhalb einer Schülersitzung", () => {
  const moving = () => ({
    id: 1,
    from: { x: initial.cards[0].x, y: initial.cards[0].y },
    to: { x: initial.cards[0].x + 21, y: initial.cards[0].y + 12 },
  });
  it("übernimmt die Bewegung genau einmal und bewahrt einen dazwischen vorgenommenen Bearbeitungsschritt", () => {
    const loaded = historyReducer(emptyHistory, {
      type: "load",
      work: initial,
    });
    const changed = structuredClone(initial);
    changed.cards[1].color = 4;
    const edited = historyReducer(loaded, { type: "edit", work: changed });
    const action = {
      type: "move-card" as const,
      move: moving(),
      session: loaded.gestureSession,
    };
    const moved = historyReducer(edited, action);
    expect(moved.present!.cards.find((card) => card.id === 1)).toMatchObject(
      moving().to,
    );
    expect(
      moved.present!.cards.find((card) => card.id === changed.cards[1].id)!
        .color,
    ).toBe(4);
    expect(historyReducer(moved, action)).toBe(moved);
    expect(historyReducer(moved, { type: "undo" }).present).toEqual(changed);
  });

  it("ignoriert verspätete Bewegungen nach Laden, Rückgängig oder Wiederholen, auch bei gleicher Ausgangsposition", () => {
    const loaded = historyReducer(emptyHistory, {
      type: "load",
      work: initial,
    });
    const changed = structuredClone(initial);
    changed.cards[1].color = 4;
    const edited = historyReducer(loaded, { type: "edit", work: changed });
    const undone = historyReducer(edited, { type: "undo" });
    const redone = historyReducer(undone, { type: "redo" });
    const replaced = historyReducer(loaded, {
      type: "load",
      work: structuredClone(initial),
    });
    for (const history of [undone, redone, replaced]) {
      const action = {
        type: "move-card" as const,
        move: moving(),
        session: loaded.gestureSession,
      };
      expect(historyReducer(history, action)).toBe(history);
    }
  });

  it("überschreibt keine neuere Koordinate derselben Karte", () => {
    const loaded = historyReducer(emptyHistory, {
      type: "load",
      work: initial,
    });
    const changed = structuredClone(initial);
    changed.cards[0].x += 9;
    const edited = historyReducer(loaded, { type: "edit", work: changed });
    expect(
      historyReducer(edited, {
        type: "move-card",
        move: moving(),
        session: loaded.gestureSession,
      }),
    ).toBe(edited);
  });
});
