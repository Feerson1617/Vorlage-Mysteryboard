import type { Draft, Task } from "../../src/core/documents";
export interface StudioBridge {
  openProject: () => Promise<{ bytes: Uint8Array; name: string } | null>;
  openRecent: (
    id: string,
  ) => Promise<{ bytes: Uint8Array; name: string } | null>;
  recentProjects: () => Promise<{ id: string; name: string }[]>;
  saveProject: (
    bytes: Uint8Array,
    saveAs?: boolean,
  ) => Promise<{ name: string } | null>;
  projectState: (state: {
    bytes: Uint8Array;
    dirty: boolean;
    forms: boolean;
  }) => Promise<void>;
  detachProject: () => Promise<void>;
  saveExport: (
    bytes: Uint8Array,
    name: string,
    kind: "scorm" | "document" | "png",
  ) => Promise<boolean>;
  printPDF: (html: string) => Promise<boolean>;
  onSaved: (listener: () => void) => () => void;
}
export interface EditorIntegration {
  state: (draft: Draft, dirty: boolean, forms: boolean) => void;
  save: (draft: Draft, saveAs: boolean) => Promise<boolean>;
  open: () => void;
  detach: () => void;
  print: (task: Task) => void;
  scorm: (task: Task, signal: AbortSignal) => Promise<File>;
  onSaved: (fn: () => void) => () => void;
}
declare global {
  interface Window {
    mysteryStudio?: StudioBridge;
  }
}
