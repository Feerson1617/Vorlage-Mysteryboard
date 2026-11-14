import type { HelpCategory, HelpConfig } from "./model";
import type { Content } from "./documents";
import { validateContent } from "./documents";
export const METHOD_PRESETS = [
  [
    "Beobachtung erklären",
    "Sucht euch eine Beobachtung aus, die ihr erklären möchtet. Welche Informationen helfen euch dabei?",
  ],
  [
    "Ursache und Wirkung",
    "Welche Karten beschreiben Bedingungen oder Ursachen? Welche möglichen Folgen ergeben sich daraus? Begründet eure Verbindungen.",
  ],
  [
    "Zusammenhänge überprüfen",
    "Schaut euch eure Pfeile an: Könnt ihr jeden Zusammenhang erklären? Welche Verbindung ist noch unsicher?",
  ],
  [
    "Perspektiven vergleichen",
    "Welche Personen oder Gruppen kommen vor? Welche unterschiedlichen Interessen könnten ihr Handeln erklären?",
  ],
  [
    "Räumliche Ebenen verbinden",
    "Welche Vorgänge spielen sich an unterschiedlichen Orten oder auf verschiedenen räumlichen Ebenen ab? Wie hängen sie zusammen?",
  ],
] as const;
export const HELP_PALETTE = [
  ["Blau", "#2166ac"],
  ["Orange", "#f5a623"],
  ["Grün", "#287c43"],
  ["Violett", "#7b4da8"],
  ["Rot", "#a63a3a"],
  ["Türkis", "#087f8c"],
  ["Ocker", "#8c6d1f"],
  ["Graublau", "#4c5b63"],
] as const;
export type HelpSystem = "causes" | "conflicts" | "custom";
export const SYSTEM_LABELS: Record<HelpSystem, string> = {
  causes: "Ursachen und Wirkungen",
  conflicts: "Nutzungskonflikte",
  custom: "Eigene Kategorien",
};
export function helpTemplate(system: HelpSystem): HelpCategory[] {
  const names =
    system === "causes"
      ? [
          "Bedingungen und Einflussfaktoren",
          "Prozesse und Veränderungen",
          "Beobachtungen und Folgen",
        ]
      : system === "conflicts"
        ? [
            "Akteure und Perspektiven",
            "Interessen und Handlungszwänge",
            "Auswirkungen und Konflikte",
          ]
        : [];
  return names.map((label, i) => ({
    id: `group${i + 1}`,
    label,
    color: HELP_PALETTE[i][1],
    cardIds: [],
  }));
}
export type HelpIssue = {
  group?: number;
  field: "label" | "color" | "cards" | "method" | "groups";
  message: string;
};
export function checkHelp(
  content: Content,
  method: string,
  enabled: boolean,
  groups: HelpCategory[],
): { help?: HelpConfig; issues: HelpIssue[] } {
  const issues: HelpIssue[] = [],
    labels = new Set<string>(),
    colors = new Set<string>(),
    ids = new Set<number>();
  if (method.trim().length > 500)
    issues.push({
      field: "method",
      message: "Bitte kürzt den Hilfetext auf höchstens 500 Zeichen.",
    });
  if (enabled) {
    if (!groups.length || groups.length > 6)
      issues.push({
        field: "groups",
        message:
          "Bitte legt eine bis sechs Gruppen an oder schaltet die farbige Hilfe aus.",
      });
    for (const [group, c] of groups.entries()) {
      const label = c.label.trim(),
        color = c.color.toLowerCase();
      if (!label)
        issues.push({
          group,
          field: "label",
          message: "Bitte gebt dieser Gruppe einen Namen.",
        });
      else if (label.length > 60 || labels.has(c.label))
        issues.push({
          group,
          field: "label",
          message: "Bitte wählt einen eigenen Namen mit höchstens 60 Zeichen.",
        });
      labels.add(c.label);
      if (!/^#[0-9a-f]{6}$/.test(color) || colors.has(color))
        issues.push({
          group,
          field: "color",
          message: "Bitte wählt für jede Gruppe eine andere lesbare Farbe.",
        });
      colors.add(color);
      if (!c.cardIds.length)
        issues.push({
          group,
          field: "cards",
          message:
            "Dieser Gruppe ist noch keine Karte zugeordnet. Ordnet eine Karte zu oder entfernt die Gruppe.",
        });
      for (const id of c.cardIds) {
        if (!content.cards.some((card) => card.id === id) || ids.has(id))
          issues.push({
            group,
            field: "cards",
            message:
              "Bitte ordnet jede vorhandene Karte höchstens einer Gruppe zu.",
          });
        ids.add(id);
      }
    }
  }
  if (issues.length) return { issues };
  const help = {
    ...(method.trim() ? { method } : {}),
    ...(enabled
      ? {
          categories: groups.map((c) => ({
            ...c,
            label: c.label,
            color: c.color,
            cardIds: [...c.cardIds],
          })),
        }
      : {}),
  };
  const next = { ...content };
  if (Object.keys(help).length) next.help = help;
  else delete next.help;
  // Same final gate as imported documents, including foreign references/IDs.
  try {
    validateContent(next, true);
  } catch {
    return {
      issues: [
        {
          field: "groups",
          message:
            "Die Hilfe konnte noch nicht übernommen werden. Bitte prüft die Gruppen und zugeordneten Karten.",
        },
      ],
    };
  }
  return { help: next.help, issues: [] };
}
