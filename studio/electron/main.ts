import { templateText, templateName } from "../exchange/template";
import {
  readProject,
  encodeCollection,
  COLLECTION_BYTES,
} from "../../src/core/levels";
import { embedTask } from "../../scripts/embed-task.mjs";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  protocol,
  net,
  session,
  Menu,
} from "electron";
import {
  readFile,
  writeFile,
  rename,
  mkdir,
  stat,
  realpath,
  unlink,
} from "node:fs/promises";
import { resolve, dirname, basename, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import {
  readDocument,
  encodeDocument,
  MAX_DOCUMENT_BYTES,
  type Draft,
} from "../../src/core/documents";
import { checkStudioArchive } from "../exchange/archive";
import { parsePng } from "../../src/core/png";
const SCHEME = "mysteryboard",
  ORIGIN = SCHEME + "://app",
  URL = ORIGIN + "/index.html";
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      codeCache: true,
    },
  },
]);
app.enableSandbox();
let window: BrowserWindow;
let currentPath: string | null = null;
let state: { bytes: Uint8Array; dirty: boolean; forms: boolean } | null = null;
let closing = false,
  asking = false,
  uiBlocked = false;
let recent: { id: string; path: string }[] = [];
function updateFileMenu() {
  const focused = BrowserWindow.getFocusedWindow() === window;
  const menu = Menu.getApplicationMenu();
  for (const id of ["project-open", "project-save", "project-save-as"]) {
    const item = menu?.getMenuItemById(id);
    if (item)
      item.enabled =
        focused &&
        !window.webContents.isLoadingMainFrame() &&
        (id === "project-open" || !!state) &&
        !state?.forms &&
        !uiBlocked;
  }
}
const bytes = (value: unknown, max = MAX_DOCUMENT_BYTES) => {
  if (
    !(value instanceof Uint8Array) ||
    !value.byteLength ||
    value.byteLength > max
  )
    throw Error("Ungültige oder zu große Dateidaten.");
  return new Uint8Array(value);
};
const project = (value: unknown) => {
  const data = bytes(value, COLLECTION_BYTES),
    doc = readProject(data);
  if (doc.format === "MysteryBoardCollection")
    return { bytes: encodeCollection(doc), doc };
  if (doc.kind !== "draft")
    throw Error("Projektdateien müssen bearbeitbare Lehrkraftentwürfe sein.");
  return { bytes: encodeDocument(doc), doc: doc as Draft };
};
const recentFile = () => resolve(app.getPath("userData"), "studio-recent.json");
async function remember(path: string) {
  recent = [
    recent.find((x) => x.path === path) || { id: randomUUID(), path },
    ...recent.filter((x) => x.path !== path),
  ].slice(0, 12);
  await mkdir(dirname(recentFile()), { recursive: true });
  await atomic(recentFile(), Buffer.from(JSON.stringify(recent)));
}
async function atomic(path: string, data: Uint8Array) {
  const temporary = path + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, data, { flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
async function save(data: Uint8Array, saveAs = false) {
  const checked = project(data);
  let path = currentPath;
  if (!path || saveAs) {
    const result = await dialog.showSaveDialog(window, {
      title: "Mystery-Projekt speichern",
      defaultPath: currentPath || "Mystery.mysteryboard",
      filters: [{ name: "MysteryBoard-Projekt", extensions: ["mysteryboard"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });
    if (result.canceled || !result.filePath) return null;
    path = result.filePath;
    if (!path.toLowerCase().endsWith(".mysteryboard")) path += ".mysteryboard";
  }
  await atomic(path, checked.bytes);
  currentPath = path;
  await remember(path);
  if (state && Buffer.from(state.bytes).equals(Buffer.from(checked.bytes))) {
    state.dirty = false;
    window.setDocumentEdited(false);
    window.webContents.send("project:saved", {
      bytes: checked.bytes,
      name: basename(path),
    });
  }
  return { name: basename(path) };
}
async function allowReplace(reviewingExchange = false) {
  const forms = !!state?.forms || (uiBlocked && !reviewingExchange);
  if (!state?.dirty && !forms) return true;
  const buttons = forms
    ? ["Abbrechen", "Änderungen verwerfen"]
    : ["Abbrechen", "Änderungen verwerfen", "Projekt speichern"];
  const response = await dialog.showMessageBox(window, {
    type: "warning",
    message: "Ungesicherte Änderungen",
    detail: forms
      ? "Es ist ein Bearbeitungsschritt geöffnet. Bitte diesen zuerst übernehmen oder abbrechen. Beim Verwerfen gehen auch noch nicht übernommene Eingaben verloren."
      : "Das geöffnete Projekt enthält noch nicht gespeicherte Änderungen.",
    buttons,
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (response.response === 2) {
    const result = await save(state!.bytes);
    return !!result && !state?.dirty;
  }
  return response.response === 1;
}
async function open(path?: string) {
  if (!path) {
    const r = await dialog.showOpenDialog(window, {
      title: "Mystery öffnen",
      filters: [{ name: "MysteryBoard", extensions: ["mysteryboard", "txt"] }],
      properties: ["openFile"],
    });
    if (r.canceled) return null;
    path = r.filePaths[0];
  }
  if (!path || !/\.(mysteryboard|txt)$/i.test(path))
    throw Error(
      "Bitte eine MysteryBoard-Datei oder eine KI-Austauschdatei im TXT-Format wählen.",
    );
  const size = (await stat(path)).size;
  if (size > COLLECTION_BYTES) throw Error("Die Datei ist größer als 60 MB.");
  const data = new Uint8Array(await readFile(path));
  if (data[0] !== 137) {
    let input;
    try {
      input = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(data),
      );
    } catch {
      throw Error("Die Projektdatei enthält kein gültiges JSON.");
    }
    // Keep the current save path and dirty state until the teacher accepts the preview.
    if (input?.format === "MysteryBoardAI")
      return { bytes: data, name: basename(path) };
    if (path.toLowerCase().endsWith(".txt"))
      throw Error("Bitte eine ausgefüllte KI-Austauschdatei wählen.");
  }
  const doc = readProject(data);
  if (doc.format !== "MysteryBoardCollection" && doc.kind === "student")
    throw Error("Schülerarbeitsstände bitte im Schülerplayer öffnen.");
  if (!(await allowReplace())) return null;
  currentPath =
    doc.format === "MysteryBoardCollection" || doc.kind === "draft"
      ? path
      : null;
  state = null;
  await remember(path);
  return { bytes: data, name: basename(path) };
}
const trusted = (event: Electron.IpcMainInvokeEvent) => {
  if (
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    event.senderFrame.url !== URL
  )
    throw Error("Nicht erlaubter App-Zugriff.");
};
const handle = (name: string, fn: (arg: any) => unknown) =>
  ipcMain.handle(name, async (event, arg) => {
    trusted(event);
    return await fn(arg);
  });
async function setup() {
  const root = await realpath(resolve(__dirname, "../dist/studio"));
  const security = JSON.parse(
    await readFile(resolve(root, "security.json"), "utf8"),
  );
  protocol.handle(SCHEME, async (request) => {
    try {
      if (request.method !== "GET") return new Response("", { status: 405 });
      const u = new globalThis.URL(request.url);
      if (u.host !== "app" || u.username || u.password)
        return new Response("", { status: 403 });
      const relative = decodeURIComponent(u.pathname).replace(/^\//, "");
      const target = await realpath(resolve(root, relative));
      if (!target.startsWith(root + sep))
        return new Response("", { status: 403 });
      const content = await readFile(target);
      const extension = target.split(".").pop();
      const mime =
        {
          html: "text/html; charset=utf-8",
          js: "text/javascript",
          json: "application/json",
          gz: "application/octet-stream",
          txt: "text/plain",
        }[extension || ""] || "application/octet-stream";
      const headers = new Headers({ "Content-Type": mime });
      headers.set("Content-Security-Policy", security.csp);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "no-referrer");
      return new Response(content, { status: 200, headers });
    } catch {
      return new Response("Datei nicht gefunden", { status: 404 });
    }
  });
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const u = details.url;
    cb({
      cancel:
        !u.startsWith(ORIGIN + "/") &&
        !u.startsWith("blob:" + ORIGIN + "/") &&
        !u.startsWith("data:"),
    });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) =>
    cb(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 720,
    minHeight: 600,
    title: "MysteryBoard Studio",
    show: false,
    webPreferences: {
      preload: resolve(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== URL) event.preventDefault();
  });
  window.on("close", (event) => {
    if (closing || (!state?.dirty && !state?.forms && !uiBlocked)) return;
    event.preventDefault();
    if (asking) return;
    asking = true;
    void allowReplace()
      .then((ok) => {
        if (ok) {
          closing = true;
          window.destroy();
          app.quit();
        }
      })
      .finally(() => (asking = false));
  });
  // beforeunload is still used by the shared browser editor. Native close owns
  // the decision; never silently discard form edits or a pending native save.
  window.webContents.on("will-prevent-unload", (event) => {
    if (closing || (!state?.dirty && !state?.forms && !uiBlocked))
      event.preventDefault();
  });
  handle("preview:open", async (input) => {
    const doc = readDocument(bytes(input));
    if (doc.kind !== "task")
      throw Error("Die Vorschau benötigt eine freigegebene Aufgabe.");
    const template = await readFile(
      resolve(root, "player-template.html"),
      "utf8",
    );
    const html = embedTask(template, encodeDocument(doc), true);
    const partition = session.fromPartition("studio-preview-" + randomUUID());
    const hashes = [
      ...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),
    ].map(
      (m) =>
        "'sha256-" + createHash("sha256").update(m[1]).digest("base64") + "'",
    );
    partition.protocol.handle(
      SCHEME,
      () =>
        new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy":
              "default-src 'none'; script-src 'self' blob: " +
              hashes.join(" ") +
              "; worker-src 'self' blob:; frame-src 'self' blob: data:; style-src 'unsafe-inline'; img-src data: blob:; font-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'",
          },
        }),
    );
    partition.webRequest.onBeforeRequest((d, cb) =>
      cb({
        cancel:
          !d.url.startsWith("mysteryboard://preview/") &&
          !d.url.startsWith("blob:mysteryboard://preview/") &&
          !d.url.startsWith("data:"),
      }),
    );
    partition.setPermissionRequestHandler((_w, _p, cb) => cb(false));
    const preview = new BrowserWindow({
      width: 1100,
      height: 800,
      title: "Schüleransicht prüfen",
      webPreferences: {
        session: partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        devTools: false,
      },
    });
    preview.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    preview.webContents.on("will-navigate", (e) => e.preventDefault());
    preview.webContents.on("page-title-updated", (e) => {
      e.preventDefault();
      preview.setTitle("Schüleransicht prüfen – " + doc.content.title);
    });
    preview.webContents.on("will-prevent-unload", (event) => {
      if (
        closing ||
        dialog.showMessageBoxSync(preview, {
          type: "question",
          message: "Schüler-Vorschau schließen?",
          detail:
            "Änderungen in der Vorschau werden nicht in das Autorenprojekt übernommen.",
          buttons: ["Vorschau schließen", "Abbrechen"],
          defaultId: 1,
          cancelId: 1,
        }) === 0
      )
        event.preventDefault();
    });
    preview.on("closed", () => {
      void partition.clearStorageData();
    });
    await preview.loadURL("mysteryboard://preview/index.html");
  });
  handle("material:choose", async (scope) => {
    if (scope !== undefined && scope !== "level")
      throw Error("Unbekannte Materialauswahl.");
    const extensions =
      scope === "level"
        ? ["mysteryboard", "png"]
        : ["pdf", "docx", "png", "jpg", "jpeg", "webp", "mysteryboard"];
    const result = await dialog.showOpenDialog(window, {
      title:
        scope === "level"
          ? "Mystery als Niveau importieren"
          : "Unterrichtsmaterial auswählen",
      properties: ["openFile"],
      filters: [{ name: "Unterrichtsmaterial", extensions }],
    });
    if (result.canceled) return null;
    const path = result.filePaths[0];
    if (!extensions.includes(path?.split(".").pop()?.toLowerCase() ?? ""))
      throw Error("Dieses Dateiformat wird nicht unterstützt.");
    const info = await stat(path);
    if (!info.isFile() || info.size > 30_000_000)
      throw Error("Bitte eine Datei bis 30 MB auswählen.");
    return {
      name: basename(path),
      bytes: bytes(await readFile(path), 30_000_000),
    };
  });
  handle("template:save", async (ext: unknown) => {
    if (ext !== "mysteryboard" && ext !== "txt")
      throw Error("Unbekanntes Vorlagenformat.");
    const result = await dialog.showSaveDialog(window, {
      title: "KI-Blankovorlage speichern",
      defaultPath: templateName + "." + ext,
      filters: [{ name: "KI-Blankovorlage", extensions: [ext] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });
    if (result.canceled || !result.filePath) return false;
    await atomic(
      result.filePath.toLowerCase().endsWith("." + ext)
        ? result.filePath
        : result.filePath + "." + ext,
      Buffer.from(templateText(), "utf8"),
    );
    return true;
  });
  handle("exchange:copy-issues", (message) => {
    if (typeof message !== "string" || message.length > 64_000) throw Error("Fehlerhinweis zu lang.");
    clipboard.writeText(message);
  });
  handle("project:open", () => open());
  handle("app:modal", (active) => {
    if (typeof active !== "boolean") throw Error("Ungültiger Dialogzustand.");
    uiBlocked = active;
    updateFileMenu();
  });
  handle("project:list", () =>
    recent.map((r) => ({ id: r.id, name: basename(r.path) })),
  );
  handle("project:recent", (id) => {
    if (typeof id !== "string") throw Error("Ungültige Projektauswahl.");
    const entry = recent.find((r) => r.id === id);
    if (!entry) throw Error("Projekt nicht in der Liste.");
    return open(entry.path);
  });
  function detachProject() {
    currentPath = null;
    state = null;
    window.setDocumentEdited(false);
    updateFileMenu();
  }
  handle("project:detach",detachProject);
  handle("project:replace-exchange",async () => {
    if (!(await allowReplace(true))) return false;
    detachProject();
    return true;
  });
  handle("project:state", (s) => {
    if (!s || typeof s.dirty !== "boolean" || typeof s.forms !== "boolean")
      throw Error("Ungültiger Projektzustand.");
    state = { bytes: project(s.bytes).bytes, dirty: s.dirty, forms: s.forms };
    window.setDocumentEdited(s.dirty || s.forms);
    updateFileMenu();
  });
  handle("project:save", (s) => {
    if (!s || typeof s.saveAs !== "boolean")
      throw Error("Ungültiger Speicherauftrag.");
    return save(bytes(s.bytes, COLLECTION_BYTES), s.saveAs);
  });
  handle("export:save", async (s) => {
    if (
      !s ||
      typeof s.name !== "string" ||
      s.name.length > 220 ||
      basename(s.name) !== s.name ||
      !["scorm", "document", "png"].includes(s.kind)
    )
      throw Error("Ungültiger Export.");
    const data = bytes(
      s.bytes,
      s.kind === "scorm"
        ? 70_000_000
        : s.kind === "png"
          ? 30_000_000
          : 20_000_000,
    );
    const extension =
      s.kind === "scorm" ? "zip" : s.kind === "png" ? "png" : "mysteryboard";
    if (s.kind === "document") {
      const d = readDocument(data);
      if (d.kind === "student")
        throw Error("Studio exportiert keine Schülerarbeitsstände.");
    } else if (s.kind === "png") parsePng(data);
    else checkStudioArchive(data);
    const r = await dialog.showSaveDialog(window, {
      title: "Export speichern",
      defaultPath: s.name,
      filters: [{ name: "MysteryBoard-Export", extensions: [extension] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });
    if (r.canceled || !r.filePath) return false;
    const path = r.filePath.toLowerCase().endsWith("." + extension)
      ? r.filePath
      : r.filePath + "." + extension;
    await atomic(path, data);
    return true;
  });
  handle("export:pdf", async (html) => {
    if (
      typeof html !== "string" ||
      Buffer.byteLength(html) > 25_000_000 ||
      !html.toLowerCase().startsWith("<!doctype html>")
    )
      throw Error("Ungültige Druckfassung.");
    const print = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        javascript: false,
        webSecurity: true,
        devTools: false,
      },
    });
    print.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    try {
      await print.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(html),
      );
      const pdf = await print.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        generateTaggedPDF: true,
      });
      const r = await dialog.showSaveDialog(window, {
        title: "Druck-PDF speichern",
        defaultPath: "Mystery-Druckkarten.pdf",
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        properties: ["createDirectory", "showOverwriteConfirmation"],
      });
      if (r.canceled || !r.filePath) return false;
      await atomic(
        r.filePath.toLowerCase().endsWith(".pdf")
          ? r.filePath
          : r.filePath + ".pdf",
        pdf,
      );
      return true;
    } finally {
      print.destroy();
    }
  });
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
    {
      label: "Ablage",
      submenu: [
        {
          id: "project-open",
          label: "Mystery öffnen …",
          accelerator: "CmdOrCtrl+O",
          click: () => window.webContents.send("project:command", "open"),
        },
        { type: "separator" },
        {
          id: "project-save",
          label: "Projekt sichern",
          accelerator: "CmdOrCtrl+S",
          click: () => window.webContents.send("project:command", "save"),
        },
        {
          id: "project-save-as",
          label: "Speichern unter …",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => window.webContents.send("project:command", "save-as"),
        },
        { type: "separator" },
        { role: "close", label: "Fenster schließen" },
      ],
    },
    { role: "editMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  app.on("browser-window-focus", updateFileMenu);
  app.on("browser-window-blur", updateFileMenu);
  window.once("ready-to-show", () => window.show());
  await window.loadURL(URL);
  updateFileMenu();
}
app
  .whenReady()
  .then(async () => {
    try {
      const list = JSON.parse(await readFile(recentFile(), "utf8"));
      if (Array.isArray(list))
        recent = list
          .filter(
            (x: any) =>
              x &&
              typeof x.id === "string" &&
              typeof x.path === "string" &&
              x.path.length < 4096,
          )
          .slice(0, 12);
    } catch {}
    await setup();
  })
  .catch((error) => {
    dialog.showErrorBox(
      "MysteryBoard Studio konnte nicht starten",
      String(error.message),
    );
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
