import type { CardState, Work } from "./model";

export type CardMove = {
  id: number;
  from: Pick<CardState, "x" | "y">;
  to: Pick<CardState, "x" | "y">;
};

export function moveCard(work: Work, move: CardMove): Work {
  const card = work.cards.find((card) => card.id === move.id);
  if (
    !card ||
    card.x !== move.from.x ||
    card.y !== move.from.y ||
    (card.x === move.to.x && card.y === move.to.y)
  )
    return work;
  return {
    ...work,
    cards: [
      ...work.cards.filter((card) => card.id !== move.id),
      { ...card, ...move.to },
    ],
  };
}

export const HISTORY_LIMIT = 40;
export type WorkHistory = {
  present: Work | null;
  past: Work[];
  future: Work[];
  baseline: string | null;
  gestureSession: object | null;
};
export type HistoryAction =
  | { type: "load"; work: Work | null }
  | { type: "edit"; work: Work }
  | { type: "move-card"; move: CardMove; session: object | null }
  | { type: "undo" }
  | { type: "redo" };
export const emptyHistory: WorkHistory = {
  present: null,
  past: [],
  future: [],
  baseline: null,
  gestureSession: null,
};
const append = (stack: Work[], work: Work) => [
  ...stack.slice(-(HISTORY_LIMIT - 1)),
  work,
];
export function historyReducer(
  state: WorkHistory,
  action: HistoryAction,
): WorkHistory {
  switch (action.type) {
    case "load":
      if (!action.work) return emptyHistory;
      return {
        present: action.work,
        past: [],
        future: [],
        baseline: JSON.stringify(action.work),
        gestureSession: {},
      };
    case "move-card": {
      if (
        !state.present ||
        !action.session ||
        state.gestureSession !== action.session
      )
        return state;
      const work = moveCard(state.present, action.move);
      return work === state.present
        ? state
        : historyReducer(state, { type: "edit", work });
    }
    case "edit":
      if (
        !state.present ||
        JSON.stringify(state.present) === JSON.stringify(action.work)
      )
        return state;
      return {
        ...state,
        present: action.work,
        past: append(state.past, state.present),
        future: [],
      };
    case "undo":
      if (!state.present || !state.past.length) return state;
      return {
        ...state,
        gestureSession: {},
        present: state.past.at(-1)!,
        past: state.past.slice(0, -1),
        future: append(state.future, state.present),
      };
    case "redo":
      if (!state.present || !state.future.length) return state;
      return {
        ...state,
        gestureSession: {},
        present: state.future.at(-1)!,
        past: append(state.past, state.present),
        future: state.future.slice(0, -1),
      };
  }
}
// Baseline means reproducible from the loaded source, never "download completed".
// Generating, downloading or sharing a PNG cannot prove external file retention.
export function hasChanges(state: WorkHistory): boolean {
  return (
    state.present !== null && JSON.stringify(state.present) !== state.baseline
  );
}
