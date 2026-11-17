const { contextBridge, ipcRenderer } = require("electron");
// No generic invoke, path, filesystem, Electron or Node handles cross the bridge.
contextBridge.exposeInMainWorld(
  "mysteryStudio",
  Object.freeze({
    previewTask: (bytes) => ipcRenderer.invoke("preview:open", bytes),
    openProject: () => ipcRenderer.invoke("project:open"),
    openRecent: (id) => ipcRenderer.invoke("project:recent", id),
    recentProjects: () => ipcRenderer.invoke("project:list"),
    saveProject: (bytes, saveAs = false) =>
      ipcRenderer.invoke("project:save", { bytes, saveAs }),
    projectState: (state) => ipcRenderer.invoke("project:state", state),
    detachProject: () => ipcRenderer.invoke("project:detach"),
    saveExport: (bytes, name, kind) =>
      ipcRenderer.invoke("export:save", { bytes, name, kind }),
    printPDF: (html) => ipcRenderer.invoke("export:pdf", html),
    onSaved: (listener) => {
      const fn = () => listener();
      ipcRenderer.on("project:saved", fn);
      return () => ipcRenderer.removeListener("project:saved", fn);
    },
  }),
);
