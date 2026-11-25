import { encodeDocument, readDocument, type Task } from "./documents";

export const LAUNCH_ID = "mysteryboard-launch";
export function launchJSON(
  task: Task,
  classroom: boolean,
  bytes = encodeDocument(task),
) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return JSON.stringify({ classroom, task: btoa(binary) });
}
export function readLaunch() {
  const text = document.getElementById(LAUNCH_ID)?.textContent;
  if (!text || text.trim() === "null") return null;
  const value = JSON.parse(text);
  if (
    !value ||
    typeof value.classroom !== "boolean" ||
    typeof value.task !== "string"
  )
    throw new Error("Ungültige eingebettete Aufgabe.");
  const task = readDocument(
    Uint8Array.from(atob(value.task), (c) => c.charCodeAt(0)),
  );
  if (task.kind !== "task")
    throw new Error("Eingebettet werden dürfen nur freigegebene Aufgaben.");
  return { task, classroom: value.classroom };
}
