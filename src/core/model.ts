export type CardContent = {
  id: number;
  title: string;
  text: string;
  image?: string;
  imageAlt?: string;
};
export type CardState = { id: number; x: number; y: number; color: number };
export type Edge = {
  id: number;
  from: number;
  to: number;
  direction: 0 | 1 | 2;
  label: string;
};
export type Work = {
  schema: 1;
  mystery: string;
  version: string;
  cards: CardState[];
  edges: Edge[];
  categories: string[];
};
export type Mystery = {
  id: string;
  version: string;
  title: string;
  cards: CardContent[];
  initial: { cards: CardState[]; edges: Edge[]; categories: string[] };
};
export const COLORS = [
  "#ffffff",
  "#e0ebe4",
  "#e0e9f1",
  "#f3e8ce",
  "#eadfea",
  "#f0ded8",
];
export const COLOR_NAMES = [
  "Ohne Farbe",
  "Grün",
  "Blau",
  "Gelb",
  "Violett",
  "Rot",
];
export const MAX_EDGES = 300;
export const MAX_LABEL = 500;
export const initialWork = (m: Mystery): Work =>
  structuredClone({
    schema: 1,
    mystery: m.id,
    version: m.version,
    ...m.initial,
  });
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const string = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
export function validateWork(value: unknown, m: Mystery): Work {
  if (!object(value) || value.schema !== 1)
    throw new Error("Dieses Speicherformat wird nicht unterstützt.");
  if (value.mystery !== m.id)
    throw new Error("Dieses Sicherungsbild gehört zu einem anderen Mystery.");
  if (value.version !== m.version)
    throw new Error(
      "Dieses Sicherungsbild gehört zu einer anderen Mystery-Version.",
    );
  const { cards, edges, categories } = value;
  const fail = () => {
    throw new Error(
      "Der Arbeitsstand ist unvollständig oder enthält ungültige Daten.",
    );
  };
  if (
    !Array.isArray(cards) ||
    cards.length !== m.cards.length ||
    !Array.isArray(edges) ||
    edges.length > MAX_EDGES ||
    !Array.isArray(categories) ||
    categories.length !== COLORS.length ||
    !categories.every((c) => string(c, 40))
  )
    return fail();
  const expected = new Set(m.cards.map((c) => c.id)),
    seen = new Set<number>(),
    edgeIds = new Set<number>(),
    pairs = new Set<string>();
  for (const c of cards) {
    if (
      !object(c) ||
      !integer(c.id, 1, 1000) ||
      !expected.has(c.id) ||
      seen.has(c.id) ||
      typeof c.x !== "number" ||
      !Number.isFinite(c.x) ||
      Math.abs(c.x) > 100000 ||
      typeof c.y !== "number" ||
      !Number.isFinite(c.y) ||
      Math.abs(c.y) > 100000 ||
      !integer(c.color, 0, COLORS.length - 1)
    )
      return fail();
    seen.add(c.id);
  }
  for (const e of edges) {
    if (
      !object(e) ||
      !integer(e.id, 1, 1000000) ||
      edgeIds.has(e.id) ||
      !integer(e.from, 1, 1000) ||
      !integer(e.to, 1, 1000) ||
      !seen.has(e.from) ||
      !seen.has(e.to) ||
      e.from === e.to ||
      !integer(e.direction, 0, 2) ||
      !string(e.label, MAX_LABEL)
    )
      return fail();
    const pair = [e.from, e.to].sort((a, b) => a - b).join(":");
    if (pairs.has(pair)) return fail();
    pairs.add(pair);
    edgeIds.add(e.id);
  }
  // Only known fields are admitted; imported objects never become app configuration.
  return {
    schema: 1,
    mystery: m.id,
    version: m.version,
    cards: cards.map((c) => ({ id: c.id, x: c.x, y: c.y, color: c.color })),
    edges: edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      direction: e.direction,
      label: e.label,
    })),
    categories: [...categories],
  };
}
export function validateMystery(value: unknown): Mystery {
  if (
    !object(value) ||
    !string(value.id, 100) ||
    !value.id ||
    !string(value.version, 40) ||
    !value.version ||
    !string(value.title, 100) ||
    !Array.isArray(value.cards) ||
    value.cards.length < 1 ||
    value.cards.length > 100 ||
    !object(value.initial)
  )
    throw new Error("Ungültige Mystery-Inhalte.");
  const ids = new Set<number>();
  for (const c of value.cards) {
    if (
      !object(c) ||
      !integer(c.id, 1, value.cards.length) ||
      ids.has(c.id) ||
      !string(c.title, 100) ||
      !string(c.text, 4000) ||
      (c.image !== undefined &&
        (typeof c.image !== "string" ||
          !/^data:image\/(svg\+xml|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
            c.image,
          ))) ||
      (c.imageAlt !== undefined && !string(c.imageAlt, 300))
    )
      throw new Error("Ungültige Karte oder nicht eingebettetes Bild.");
    ids.add(c.id);
  }
  const m = value as unknown as Mystery;
  validateWork(
    { schema: 1, mystery: m.id, version: m.version, ...m.initial },
    m,
  );
  return m;
}
