import {
  validCardText,
  type CardContent,
  type CardText,
  type Mystery,
  type Work,
} from "./model";

export function withStudentText(
  work: Work,
  card: CardContent,
  value: CardText,
): Work {
  if (!card.studentEditable || !validCardText(value))
    throw new Error("Diese Textänderung ist für die Karte nicht zulässig.");
  const { textEdits, ...rest } = work;
  const edits = (textEdits ?? []).filter((edit) => edit.id !== card.id);
  if (value.title !== card.title || value.text !== card.text)
    edits.push({ id: card.id, title: value.title, text: value.text });
  return edits.length
    ? { ...rest, schema: 3, textEdits: edits.sort((a, b) => a.id - b.id) }
    : { ...rest, schema: work.team ? 2 : 1 };
}

export function withStudentCards(
  mystery: Mystery,
  edits: Work["textEdits"],
): Mystery {
  if (!edits?.length) return mystery;
  const byId = new Map(edits.map((edit) => [edit.id, edit]));
  return {
    ...mystery,
    cards: mystery.cards.map((card) => {
      const edit = card.studentEditable && byId.get(card.id);
      return edit ? { ...card, title: edit.title, text: edit.text } : card;
    }),
  };
}
