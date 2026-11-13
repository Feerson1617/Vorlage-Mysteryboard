export type CardContent = {
  id: number;
  title: string;
  text: string;
  image?: string;
  imageAlt?: string;
  group?: string;
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
  schema: 1 | 2;
  mystery: string;
  version: string;
  cards: CardState[];
  edges: Edge[];
  categories: string[];
  team?: string;
};
export type HelpCategory = {
  id: string;
  label: string;
  color: string;
  cardIds: number[];
};
export type HelpConfig = { method?: string; categories?: HelpCategory[] };
export type StartLayout =
  { mode: "ordered"; columns?: number } | { mode: "explicit" };
export type Mystery = {
  id: string;
  version: string;
  title: string;
  cards: CardContent[];
  cardGroups?: Record<string, { label: string; prefix: string }>;
  startLayout?: StartLayout;
  help?: HelpConfig;
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
export const MAX_TEAM_NAME = 80;
// Display metadata belongs to the content; numeric IDs remain stable in saves.
export function cardNumber(m: Mystery, id: number): string {
  const group = m.cards.find((card) => card.id === id)?.group;
  const prefix =
    group && m.cardGroups && Object.hasOwn(m.cardGroups, group)
      ? m.cardGroups[group].prefix
      : "";
  return prefix + id;
}
export const teamName = (work: Work | null): string => work?.team ?? "";
export function withTeam(work: Work, name: string): Work {
  if (typeof name !== "string")
    throw new Error("Der Teamname muss Text enthalten.");
  const team = name.trim();
  if (team && !validTeamName(team))
    throw new Error(
      `Der Teamname darf höchstens ${MAX_TEAM_NAME} Zeichen und keine Steuerzeichen enthalten.`,
    );
  const { team: _oldTeam, ...rest } = work;
  // Clearing the name returns the unchanged legacy representation and QR size.
  return team ? { ...rest, schema: 2, team } : { ...rest, schema: 1 };
}
// At most MAX_EDGES IDs are occupied, so a gap exists within 1..MAX_EDGES+1.
export function nextEdgeId(edges: Edge[]): number {
  const used = new Set(edges.map((edge) => edge.id));
  let id = 1;
  while (used.has(id)) id++;
  return id;
}
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
export const validTeamName = (value: unknown): value is string =>
  string(value, MAX_TEAM_NAME) &&
  value.trim().length > 0 &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(value);
export function validateWork(value: unknown, m: Mystery): Work {
  if (!object(value) || (value.schema !== 1 && value.schema !== 2))
    throw new Error("Dieses Speicherformat wird nicht unterstützt.");
  if (
    (value.schema === 1 && value.team !== undefined) ||
    (value.schema === 2 && !validTeamName(value.team))
  )
    throw new Error(
      "Der Arbeitsstand enthält einen ungültigen Teamnamen oder ein unpassendes Speicherformat.",
    );
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
    schema: value.schema,
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
    ...(value.schema === 2 ? { team: value.team as string } : {}),
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
    (value.initial !== undefined && !object(value.initial))
  )
    throw new Error("Ungültige Mystery-Inhalte.");
  const groups = value.cardGroups;
  if (groups !== undefined) {
    if (!object(groups) || Object.keys(groups).length > 100)
      throw new Error("Ungültige Kartengruppen.");
    for (const [key, group] of Object.entries(groups)) {
      if (
        !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key) ||
        ["constructor", "prototype", "__proto__"].includes(key) ||
        !object(group) ||
        !string(group.label, 80) ||
        !group.label.trim() ||
        !string(group.prefix, 3) ||
        /[\s\p{Cc}\p{Cf}]/u.test(group.prefix)
      )
        throw new Error("Ungültige Kartengruppe oder Kennzeichnung.");
    }
  }
  const ids = new Set<number>(),
    displays = new Set<string>();
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
      (c.imageAlt !== undefined && !string(c.imageAlt, 300)) ||
      (c.group !== undefined &&
        (!string(c.group, 40) ||
          !object(groups) ||
          !Object.hasOwn(groups, c.group)))
    )
      throw new Error("Ungültige Karte oder nicht eingebettetes Bild.");
    ids.add(c.id);
    const prefix =
      c.group === undefined
        ? ""
        : (groups as Record<string, { prefix: string }>)[c.group as string]
            .prefix;
    const display = prefix + c.id;
    if (displays.has(display))
      throw new Error("Die Kartenkennzeichnungen sind nicht eindeutig.");
    displays.add(display);
  }
  const layout = value.startLayout;
  if (
    layout !== undefined &&
    (!object(layout) ||
      !["ordered", "explicit"].includes(String(layout.mode)) ||
      Object.keys(layout).some((k) => !["mode", "columns"].includes(k)) ||
      (layout.columns !== undefined &&
        (layout.mode !== "ordered" || !integer(layout.columns, 1, 12))))
  )
    throw new Error("Ungültige Startablage.");
  if (
    object(layout) &&
    layout.mode === "explicit" &&
    value.initial === undefined
  )
    throw new Error("Eine explizite Startablage benötigt Anfangspositionen.");
  const help = value.help;
  const shortText = (v: unknown, max: number) =>
    string(v, max) && v.trim().length > 0 && !/[\p{Cc}\p{Cf}]/u.test(v);
  if (help !== undefined) {
    if (
      !object(help) ||
      Object.keys(help).some((k) => !["method", "categories"].includes(k)) ||
      (help.method !== undefined && !shortText(help.method, 500))
    )
      throw new Error("Ungültiger methodischer Hilfetext.");
    if (help.categories !== undefined) {
      if (
        !Array.isArray(help.categories) ||
        help.categories.length < 1 ||
        help.categories.length > 6
      )
        throw new Error("Die Orientierungshilfe benötigt 1–6 Hilfekategorien.");
      const categoryIds = new Set<string>(),
        labels = new Set<string>(),
        colors = new Set<string>(),
        assigned = new Set<number>();
      for (const category of help.categories) {
        if (
          !object(category) ||
          Object.keys(category).some(
            (k) => !["id", "label", "color", "cardIds"].includes(k),
          ) ||
          typeof category.id !== "string" ||
          !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(category.id) ||
          ["constructor", "prototype", "__proto__"].includes(category.id) ||
          categoryIds.has(category.id) ||
          !shortText(category.label, 60) ||
          labels.has(category.label as string) ||
          typeof category.color !== "string" ||
          !/^#[0-9a-fA-F]{6}$/.test(category.color) ||
          colors.has(category.color.toLowerCase()) ||
          !Array.isArray(category.cardIds) ||
          category.cardIds.length < 1 ||
          category.cardIds.length > value.cards.length
        )
          throw new Error("Ungültige oder doppelte Hilfekategorie.");
        categoryIds.add(category.id);
        labels.add(category.label as string);
        colors.add(category.color.toLowerCase());
        for (const id of category.cardIds) {
          if (typeof id !== "number" || !ids.has(id) || assigned.has(id))
            throw new Error(
              "Die Orientierungshilfe enthält unbekannte oder mehrfach zugeordnete Karten.",
            );
          assigned.add(id);
        }
      }
    }
  }
  // Normalize new contents without initial positions to a neutral, valid Work
  // seed. The UI lays it out once, using actual measured heights and viewport.
  // Existing contents without new metadata remain explicitly positioned.
  const m = {
    ...value,
    ...(value.initial === undefined
      ? {
          startLayout: layout ?? { mode: "ordered" },
          initial: {
            cards: [...ids]
              .sort((a, b) => a - b)
              .map((id, i) => ({ id, x: i * 480, y: 0, color: 0 })),
            edges: [],
            categories: Array(COLORS.length).fill(""),
          },
        }
      : {}),
  } as unknown as Mystery;
  validateWork(
    { schema: 1, mystery: m.id, version: m.version, ...m.initial },
    m,
  );
  if (
    m.startLayout?.mode === "ordered" &&
    (m.initial.edges.length ||
      m.initial.cards.some((c) => c.color !== 0) ||
      m.initial.categories.some(Boolean))
  )
    throw new Error(
      "Die nummerische Startablage muss ohne Pfeile, Farben und Kategorien beginnen.",
    );
  return m;
}
