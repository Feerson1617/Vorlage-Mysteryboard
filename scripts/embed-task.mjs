import { parseDocument } from "htmlparser2";

// Match an actual inert bootstrap element, never card text or minified JS.
export function embedTask(html, documentBytes, classroom = false) {
  const document = parseDocument(html, {
    withStartIndices: true,
    withEndIndices: true,
  });
  const slots = [];
  const visit = (node) => {
    if (
      node.name === "script" &&
      node.attribs?.id === "mysteryboard-launch" &&
      node.attribs?.type === "application/json"
    )
      slots.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(document);
  if (slots.length !== 1)
    throw new Error("Genau eine Aufgaben-Einbettung erwartet.");
  const node = slots[0];
  const json = JSON.stringify({
    classroom,
    task: Buffer.from(documentBytes).toString("base64"),
  });
  return (
    html.slice(0, node.startIndex) +
    `<script id="mysteryboard-launch" type="application/json">${json}</script>` +
    html.slice(node.endIndex + 1)
  );
}
