const { contextBridge, ipcRenderer } = require("electron");
// No generic invoke, path, filesystem, Electron or Node handles cross the bridge.
contextBridge.exposeInMainWorld(
  "mysteryStudio",
  Object.freeze({
    copyIssues: (message) => ipcRenderer.invoke("exchange:copy-issues",message),
    saveTemplate: (ext) => ipcRenderer.invoke("template:save", ext),
    chooseMaterial: (scope) => ipcRenderer.invoke("material:choose",scope),
    previewTask: (bytes) => ipcRenderer.invoke("preview:open", bytes),
    openProject: () => ipcRenderer.invoke("project:open"),
    openRecent: (id) => ipcRenderer.invoke("project:recent", id),
    recentProjects: () => ipcRenderer.invoke("project:list"),
    saveProject: (bytes, saveAs = false) =>
      ipcRenderer.invoke("project:save", { bytes, saveAs }),
    projectState: (state) => ipcRenderer.invoke("project:state", state),
    leaveHome: () => ipcRenderer.invoke("project:leave-home"),
    replaceWithExchange: () => ipcRenderer.invoke("project:replace-exchange"),
    detachProject: () => ipcRenderer.invoke("project:detach"),
    modalState: (active) => ipcRenderer.invoke("app:modal", active),
    saveExport: (bytes, name, kind) =>
      ipcRenderer.invoke("export:save", { bytes, name, kind }),
    printPDF: (html) => ipcRenderer.invoke("export:pdf", html),
    onSaved: (listener) => {
      const fn = (_event, saved) => listener(saved);
      ipcRenderer.on("project:saved", fn);
      return () => ipcRenderer.removeListener("project:saved", fn);
    },
    onCommand: (listener) => {
      const fn = (_event, command) => {
        if (["open", "save", "save-as"].includes(command)) listener(command);
      };
      ipcRenderer.on("project:command", fn);
      return () => ipcRenderer.removeListener("project:command", fn);
    },
  }),
);
