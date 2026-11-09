import type { Work } from "./model";

export const HISTORY_LIMIT = 40;
export type WorkHistory = {
  present: Work | null;
  past: Work[];
  future: Work[];
  baseline: string | null;
};
export type HistoryAction =
  | { type: "load"; work: Work | null }
  | { type: "edit"; work: Work }
  | { type: "undo" }
  | { type: "redo" };
export const emptyHistory: WorkHistory = {
  present: null,
  past: [],
  future: [],
  baseline: null,
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
      return {
        present: action.work,
        past: [],
        future: [],
        baseline: action.work ? JSON.stringify(action.work) : null,
      };
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
        present: state.past.at(-1)!,
        past: state.past.slice(0, -1),
        future: append(state.future, state.present),
      };
    case "redo":
      if (!state.present || !state.future.length) return state;
      return {
        ...state,
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
