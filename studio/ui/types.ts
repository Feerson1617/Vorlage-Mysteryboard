import type { Draft, Task } from "../../src/core/documents";
export type ProjectCommand = "open" | "save" | "save-as";
export type SavedProject = { bytes: Uint8Array; name: string };
export interface StudioBridge {
  chooseMaterial?: () => Promise<{ name: string; bytes: Uint8Array } | null>;
  previewTask: (bytes: Uint8Array) => Promise<void>;
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
  modalState: (active: boolean) => Promise<void>;
  saveExport: (
    bytes: Uint8Array,
    name: string,
    kind: "scorm" | "document" | "png",
  ) => Promise<boolean>;
  printPDF: (html: string) => Promise<boolean>;
  onSaved: (listener: (saved: SavedProject) => void) => () => void;
  onCommand: (listener: (command: ProjectCommand) => void) => () => void;
}
export interface EditorIntegration {
  name: string;
  modal?: boolean;
  unsaved?: boolean;
  levelName?: string;
  levels?: (draft: Draft) => void;
  exportLevels?: (draft: Draft) => Promise<void>;
  matchesSaved?: (d: Draft, saved: Uint8Array) => boolean;
  state: (draft: Draft, dirty: boolean, forms: boolean) => void;
  save: (draft: Draft, saveAs: boolean) => Promise<boolean>;
  open: () => void;
  detach: () => void;
  print: (task: Task) => void;
  preview: (task: Task) => void;
  scorm: (task: Task, signal: AbortSignal) => Promise<File>;
  onSaved: (fn: (saved: SavedProject) => void) => () => void;
  onCommand: (fn: (command: ProjectCommand) => void) => () => void;
}
declare global {
  interface Window {
    mysteryStudio?: StudioBridge;
  }
}
