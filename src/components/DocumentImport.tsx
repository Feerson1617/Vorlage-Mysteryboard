import { useEffect, useRef, useState } from "react";
import type { Draft } from "../core/documents";
import { reviseDraft } from "../core/authoring";
import {
  verifyImageDecode,
  imageFromFile,
  inspectDataImage,
} from "../core/media";
import {
  checkImportFile,
  proposeCards,
  takeImportedCards,
  mergeImported,
  splitImported,
  canRejoinImported,
  type Card,
  type ImportResult,
} from "../core/document-import/model";
import ImportWorker from "../core/document-import/parser.worker?worker&inline";
import { TableEditor } from "./TableEditor";
import { TableView } from "./TableView";
import { MediaView } from "./MediaView";
import { PdfRegionControls, PdfRegionOverlay } from "./PdfRegionEditor";
import {
  changeRegions,
  regionCard,
  type PdfLayout,
  type PdfRegion,
} from "../core/document-import/pdf-layout";

import {
  LocalOcr,
  ocrBase,
  ocrWords,
  type OcrData,
} from "../core/document-import/ocr";
import {
  inspectScan,
  prepareScan,
  plainPreparation,
  scanFrames,
  ocrItems,
  ocrCard,
  graphicCandidate,
  fallbackRegions,
  checkOcrBudget,
  type Preparation,
} from "../core/document-import/scan";
import { type Rect, type PdfItem } from "../core/document-import/pdf-layout";

type Crop = { x: number; y: number; w: number; h: number };
async function cropImage(src: string, crop: Crop, maxPixels = 4_000_000) {
  if (
    crop.w <= 0 ||
    crop.h <= 0 ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.x + crop.w > 100.01 ||
    crop.y + crop.h > 100.01
  )
    throw new Error(
      "Markiert einen nicht leeren Ausschnitt innerhalb der Seite.",
    );
  const image = new Image();
  image.src = src;
  await image.decode();
  const width = Math.max(1, Math.round((image.naturalWidth * crop.w) / 100)),
    height = Math.max(1, Math.round((image.naturalHeight * crop.h) / 100));
  const canvas = document.createElement("canvas");
  try {
    const scale = Math.min(
      1,
      4096 / width,
      4096 / height,
      Math.sqrt(maxPixels / (width * height)),
    );
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    canvas
      .getContext("2d")!
      .drawImage(
        image,
        (image.naturalWidth * crop.x) / 100,
        (image.naturalHeight * crop.y) / 100,
        width,
        height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    let data = canvas.toDataURL("image/png");
    try {
      inspectDataImage(data);
    } catch {
      data = canvas.toDataURL("image/jpeg", 0.9);
      inspectDataImage(data);
    }
    return data;
  } finally {
    canvas.width = canvas.height = 0;
    image.src = "";
  }
}
export function DocumentImport({
  draft,
  initialFile,
  multipleImages = false,
  studio = false,
  dirty,
  onApply,
  onCancel,
}: {
  draft: Draft;
  initialFile?: File;
  multipleImages?: boolean;
  studio?: boolean;
  dirty: boolean;
  onApply: (next: Draft, count: number) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1),
    [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<ImportResult | null>(null),
    [cards, setCards] = useState<Card[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    [index, setIndex] = useState(0);
  const [correction, setCorrection] = useState<
      "bounds" | "text" | "structure" | "media" | null
    >(null),
    [diagnostics, setDiagnostics] = useState(false),
    [originalZoom, setOriginalZoom] = useState(1),
    [appendTitle, setAppendTitle] = useState(draft.content.title);
  const automaticPages = useRef(new Set<number>());
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [view, setView] = useState<"original" | "cards">("cards"),
    [page, setPage] = useState(1),
    [pageImage, setPageImage] = useState("");
  const [mode, setMode] = useState<"append" | "new">("append"),
    [title, setTitle] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [crop, setCrop] = useState<Crop>({ x: 0, y: 0, w: 100, h: 100 }),
    [mark, setMark] = useState(false),
    [picked, setPicked] = useState("");
  const [instruction, setInstruction] = useState<{
    text: string;
    cardId?: number;
  }>();
  const fileInput = useRef<HTMLInputElement>(null),
    photoInput = useRef<HTMLInputElement>(null),
    cameraInput = useRef<HTMLInputElement>(null);
  const ocrController = useRef<AbortController | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrInfo, setOcrInfo] = useState<
    Record<number, { data: OcrData; checked: boolean; regions: PdfRegion[] }>
  >({});
  const [rasterPages, setRasterPages] = useState<number[]>([]);
  const [preparation, setPreparation] = useState<Preparation>(plainPreparation);
  const [rawPageImage, setRawPageImage] = useState("");
  const [showUntouched, setShowUntouched] = useState(false);
  const worker = useRef<Worker | null>(null),
    request = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    alive = useRef(true),
    textarea = useRef<HTMLTextAreaElement>(null),
    cropStart = useRef<{ x: number; y: number } | null>(null),
    cropPointers = useRef(new Set<number>()),
    cropBefore = useRef<Crop>({ x: 0, y: 0, w: 100, h: 100 });
  const originalURL = useRef("");
  const regionRenders = useRef(
    new Map<
      number,
      {
        resolve: (src: string) => void;
        reject: (e: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  const preparations = useRef(new Map<number, Preparation>());
  const groups = Object.entries(draft.content.cardGroups!);
  const defaultGroup = groups.find(([, g]) => !g.prefix)?.[0] ?? groups[0][0];
  const extensionGroup =
    groups.find(([, g]) => g.prefix === "V" || /vertief/i.test(g.label))?.[0] ??
    defaultGroup;
  const canMark =
    mark &&
    (!studio ||
      correction === "bounds" ||
      correction === "media" ||
      correction === "text");
  const current = cards[index];
  const uncertainGraphics = result?.pdfLayout?.unassignedGraphics ?? [];
  const offerInstructions = (text: string, cardId?: number) => {
    setInstruction({ text, cardId });
    if (cardId !== undefined)
      setSelected((ids) => ids.filter((id) => id !== cardId));
    setReviewed(false);
    setMessage(
      "Text als Aufgabenstellung gewählt. Bitte vor der Übernahme prüfen.",
    );
  };
  const wordCardFor = (block: ImportResult["blocks"][number]) => {
    const candidates = result?.cards.filter(
      (c) =>
        (block.text && c.title === block.text) ||
        (block.text && c.text === block.text),
    );
    return candidates?.length === 1 ? candidates[0].id : undefined;
  };
  const unchecked = cards.filter(
    (c) => selected.includes(c.id) && ocrInfo[c.id] && !ocrInfo[c.id].checked,
  ).length;
  const [activeOriginal, setActiveOriginal] = useState("");
  const activeRegion =
    result?.pdfLayout?.regions.find(
      (r) => r.cardId === current?.id && r.page === page,
    ) ??
    (current
      ? ocrInfo[current.id]?.regions.find((r) => r.page === page)
      : undefined);
  useEffect(() => {
    let cancelled = false;
    setActiveOriginal("");
    if (
      !pageImage ||
      !activeRegion ||
      !current ||
      !ocrInfo[current.id] ||
      !result?.pdfLayout
    )
      return;
    const b = activeRegion.bounds,
      p = result.pdfLayout.pages[page - 1];
    const source =
      result.format === "image" && !preparations.current.has(page)
        ? originalURL.current
        : pageImage;
    void cropImage(source, {
      x: (b.x / p.width) * 100,
      y: (b.y / p.height) * 100,
      w: (b.width / p.width) * 100,
      h: (b.height / p.height) * 100,
    })
      .then((src) => {
        if (!cancelled && alive.current) setActiveOriginal(src);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    pageImage,
    current?.id,
    page,
    activeRegion?.bounds.x,
    activeRegion?.bounds.y,
    activeRegion?.bounds.width,
    activeRegion?.bounds.height,
  ]);
  const initialCards = useRef<Card[]>([]);
  const splitGeometry = useRef(new WeakMap<Card, PdfRegion[]>());
  function proposalsChanged() {
    return (
      result &&
      (cards.length !== initialCards.current.length ||
        cards.some((c, i) => c !== initialCards.current[i]) ||
        selected.length !== initialCards.current.length)
    );
  }
  function stop() {
    request.current++;
    ocrController.current?.abort();
    clearTimeout(timer.current);
    for (const p of regionRenders.current.values()) {
      clearTimeout(p.timer);
      p.reject(new DOMException("OCR abgebrochen", "AbortError"));
    }
    regionRenders.current.clear();
    worker.current?.terminate();
    worker.current = null;
  }
  useEffect(
    () => () => {
      alive.current = false;
      stop();
      if (originalURL.current) URL.revokeObjectURL(originalURL.current);
    },
    [],
  );
  function deadline(ms: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      stop();
      if (alive.current) {
        setBusy(false);
        setError(
          "Der Import wurde wegen der Verarbeitungsdauer beendet. Bitte eine kleinere Datei verwenden. Der bisherige Entwurf bleibt erhalten.",
        );
      }
    }, ms);
  }
  function renderPage(n: number, highResolution = rasterPages.includes(n)) {
    if (!worker.current) return;
    setBusy(true);
    setMessage(`PDF-Seite ${n} wird angezeigt …`);
    deadline(20000);
    worker.current.postMessage({
      type: "render",
      id: ++request.current,
      page: n,
      ocr: highResolution,
    });
  }
  async function openFile(f: File) {
    try {
      if (
        proposalsChanged() &&
        !confirm(
          "Andere Datei öffnen? Noch nicht übernommene Importänderungen werden verworfen. Der geöffnete Entwurf bleibt unverändert.",
        )
      )
        return;
      const format = checkImportFile(f.name, f.size);
      stop();
      setBusy(true);
      setMessage("Die Datei wird lokal gelesen …");
      setError("");
      setResult(null);
      setCards([]);
      setSelected([]);
      setInstruction(undefined);
      setReviewed(false);
      setPageImage("");
      setPage(1);
      setStep(1);
      setFile(f);
      preparations.current.clear();
      automaticPages.current.clear();
      setCorrection(null);
      setDiagnostics(false);
      setOriginalZoom(1);
      setMark(false);
      setOcrInfo({});
      setRasterPages([]);
      setRawPageImage("");
      setPreparation(plainPreparation);
      setTitle(f.name.replace(/\.[^.]+$/, ""));
      if (originalURL.current) URL.revokeObjectURL(originalURL.current);
      originalURL.current = URL.createObjectURL(f);
      const id = ++request.current;
      if (format === "image") {
        inspectScan(new Uint8Array(await f.arrayBuffer()));
        const prepared = await prepareScan(originalURL.current);
        if (!alive.current || id !== request.current) return;
        const layout: PdfLayout = {
          pages: [
            { width: prepared.width, height: prepared.height, items: [] },
          ],
          regions: [],
          sections: [],
          uncertainPages: [1],
        };
        const r: ImportResult = {
          format: "image",
          name: f.name,
          blocks: [],
          cards: [],
          images: [],
          pages: [layout.pages[0]],
          pdfLayout: layout,
          noText: true,
          warnings: [
            "OCR-Vorschläge sind nicht fachlich geprüft. Jede Karte und besonders Zahlen am Original kontrollieren.",
          ],
        };
        setResult(r);
        initialCards.current = [];
        setStep(2);
        setView("original");
        setPageImage(prepared.src);
        setRawPageImage(prepared.src);
        setRasterPages([1]);
        setBusy(false);
        setMessage(
          "Foto geöffnet. Jetzt Kartengrenzen und Text lokal erkennen oder einen einzelnen Bereich markieren.",
        );
        return;
      }
      deadline(45000);
      const bytes = await f.arrayBuffer();
      if (!alive.current || id !== request.current) return;
      const instance = new ImportWorker({
        name: "mysteryboard-document-import",
      });
      worker.current = instance;
      instance.onerror = () => {
        if (!alive.current || worker.current !== instance) return;
        stop();
        setBusy(false);
        setError(
          studio
            ? "Die Datei konnte nicht gelesen werden. Bitte eine gültige Word- oder PDF-Datei auswählen."
            : "Die Datei konnte nicht gelesen werden. Bitte eine gültige Word- oder PDF-Datei beziehungsweise einen aktuellen Browser verwenden.",
        );
      };
      instance.onmessage = async (e) => {
        const data = e.data;
        if (!alive.current || worker.current !== instance) return;
        const pending = regionRenders.current.get(data.id);
        if (
          pending &&
          (data.type === "rendered-region" || data.type === "error")
        ) {
          clearTimeout(pending.timer);
          regionRenders.current.delete(data.id);
          data.type === "error"
            ? pending.reject(Error(data.message))
            : pending.resolve(data.image);
          return;
        }
        if (data.type === "progress") {
          setMessage(data.message);
          return;
        }
        if (data.type === "ready") return;
        if (data.id !== request.current) return;
        clearTimeout(timer.current);
        setBusy(false);
        if (data.type === "error") {
          stop();
          setError(data.message);
          return;
        }
        if (data.type === "parsed") {
          const r = data.result as ImportResult;
          if (multipleImages && r.format === "docx") {
            r.cards = proposeCards(r.blocks, true);
            r.warnings.push(
              "Mehrere Bilder innerhalb einer erkannten Karte bleiben gemeinsam erhalten (bis vier pro Karte). Bild-/Kartenzuordnung am Original kontrollieren; zusätzliche Bilder werden in weiteren Vorschlägen erhalten.",
            );
          }
          setResult(r);
          const proposed = r.cards.map((c) => ({
            ...c,
            group: c.group === "extension" ? extensionGroup : defaultGroup,
          }));
          initialCards.current = proposed;
          setCards(proposed);
          setSelected(r.cards.map((c) => c.id));
          setIndex(0);
          setStep(2);
          setView("cards");
          setMessage(
            "Die Vorschläge sind noch nicht im Entwurf. Bitte am Original prüfen.",
          );
          if (r.format === "pdf") {
            setRasterPages(
              r.pdfLayout?.pages.flatMap((p, i) =>
                p.items.reduce((n, t) => n + t.text.trim().length, 0) < 20
                  ? [i + 1]
                  : [],
              ) ?? [],
            );
            renderPage(
              1,
              r.pdfLayout?.pages[0].items.reduce(
                (n, t) => n + t.text.trim().length,
                0,
              )! < 20,
            );
          }
        } else if (data.type === "rendered") {
          const options =
            preparations.current.get(data.page) ?? plainPreparation;
          let image = data.image;
          if (preparations.current.has(data.page)) {
            try {
              image = (await prepareScan(data.image, options)).src;
            } catch (e) {
              setError((e as Error).message);
              return;
            }
            if (!alive.current || data.id !== request.current) return;
          }
          setPageImage(image);
          setRawPageImage(data.image);
          setPreparation(options);
          setShowUntouched(false);
          setCrop({ x: 0, y: 0, w: 100, h: 100 });
          setMark(false);
          setMessage("Seite lokal angezeigt.");
        }
      };
      instance.postMessage({ type: "parse", id, format, name: f.name, bytes }, [
        bytes,
      ]);
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (initialFile) void openFile(initialFile);
  }, []);
  function editRegions(next: PdfLayout, affected: number[], removed: number[]) {
    if (
      ocrBase() &&
      (rasterPages.includes(page) ||
        affected.some(
          (id) => !regionCard(next, id).text && !regionCard(next, id).title,
        ))
    ) {
      void recognizeRegions(next, affected, removed);
      return false;
    }
    try {
      const updated = affected.map((id) => {
        const card = regionCard(next, id),
          old = cards.find((c) => c.id === id);
        if (!(card.title || card.text || card.source))
          throw new Error(
            "Dieser Bereich enthält keinen auslesbaren Text. Bitte die Grenzen ändern oder den vorhandenen Bildausschnitt verwenden; es wird keine OCR durchgeführt.",
          );
        if (!old)
          return {
            ...card,
            group: card.group === "extension" ? extensionGroup : defaultGroup,
          };
        const original = regionCard(result!.pdfLayout!, id);
        if (
          (old.title !== original.title ||
            old.text !== original.text ||
            old.source !== original.source) &&
          !confirm(
            "Diesen Kartenbereich neu aus dem Original lesen? Manuell geänderte Überschrift, Text und Quelle werden ersetzt. Bilder, Tabellen und Kartengruppe bleiben erhalten.",
          )
        )
          throw new Error(
            "Bereichsänderung abgebrochen. Die bisherigen Karten bleiben erhalten.",
          );
        let merged = old;
        for (const removedId of removed) {
          const other = cards.find((c) => c.id === removedId);
          if (other) merged = mergeImported(merged, other, multipleImages);
        }
        const preserved = { ...merged };
        delete preserved.source;
        return { ...preserved, ...card, group: old.group };
      });
      let remaining = cards
        .filter((c) => !removed.includes(c.id))
        .map((c) => updated.find((u) => u.id === c.id) ?? c);
      const added = updated.filter(
        (c) => !cards.some((old) => old.id === c.id),
      );
      const insertion = current
        ? remaining.findIndex((c) => c.id === current.id) + 1
        : remaining.length;
      remaining = [
        ...remaining.slice(0, insertion),
        ...added,
        ...remaining.slice(insertion),
      ];
      if (remaining.length > 100)
        throw new Error(
          "Mehr als 100 Karten sind nicht möglich. Bitte zuerst Bereiche entfernen oder das PDF aufteilen.",
        );
      setCards(remaining);
      if (affected.length)
        setIndex(
          Math.max(
            0,
            remaining.findIndex((c) => c.id === affected[0]),
          ),
        );
      if (!affected.length)
        setIndex(Math.max(0, Math.min(index, remaining.length - 1)));
      setSelected([
        ...selected.filter((id) => !removed.includes(id)),
        ...added.map((c) => c.id),
      ]);
      setIndex(
        Math.max(
          0,
          remaining.findIndex((c) => c.id === (affected[0] ?? current?.id)),
        ),
      );
      setResult({ ...result!, pdfLayout: next });
      setReviewed(false);
      setMark(false);
      setError("");
      setMessage(
        "Kartengrenzen geändert. Betroffene Texte wurden räumlich neu aus dem Original gelesen; nicht zugeordnete Texte bleiben unter Dokumentabschnitte verfügbar.",
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  function forgetRegions(ids: number[], restore: PdfRegion[] = []) {
    if (!result?.pdfLayout) return;
    const next = changeRegions(result.pdfLayout, [
      ...result.pdfLayout.regions.filter((r) => !ids.includes(r.cardId)),
      ...restore,
    ]);
    setResult({ ...result, pdfLayout: next });
  }
  function update(patch: Partial<Card>) {
    if (current && ocrInfo[current.id])
      setOcrInfo({
        ...ocrInfo,
        [current.id]: { ...ocrInfo[current.id], checked: false },
      });
    setCards(cards.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    setReviewed(false);
    setError("");
  }
  function addCard(patch: Partial<Card> = {}) {
    const id = Math.max(0, ...cards.map((c) => c.id)) + 1;
    const infos = { ...ocrInfo };
    delete infos[id];
    setOcrInfo(infos);
    setCards([
      ...cards,
      { id, title: "", text: "", group: defaultGroup, ...patch },
    ]);
    setSelected([...selected, id]);
    setIndex(cards.length);
    setView("cards");
    setReviewed(false);
  }
  function remove() {
    if (!current) return;
    const infos = { ...ocrInfo };
    delete infos[current.id];
    setOcrInfo(infos);
    forgetRegions([current.id]);
    setCards(cards.filter((c) => c.id !== current.id));
    setSelected(selected.filter((id) => id !== current.id));
    setIndex(Math.max(0, index - 1));
    setReviewed(false);
  }
  function split() {
    if (!current) return;
    const at = textarea.current?.selectionStart ?? 0;
    if (at <= 0 || at >= current.text.length) {
      setError(
        "Setzt den Textcursor an die gewünschte Grenze innerhalb des Kartentexts.",
      );
      return;
    }
    const id = Math.max(...cards.map((c) => c.id)) + 1;
    const pair = splitImported(current, at, id);
    if (ocrInfo[current.id])
      setOcrInfo({
        ...ocrInfo,
        [current.id]: { ...ocrInfo[current.id], checked: false },
        [id]: { ...ocrInfo[current.id], checked: false },
      });
    if (result?.pdfLayout)
      splitGeometry.current.set(
        pair[0],
        result.pdfLayout.regions.filter((r) => r.cardId === current.id),
      );
    forgetRegions([current.id]);
    setCards([...cards.slice(0, index), ...pair, ...cards.slice(index + 1)]);
    setSelected([...selected, id]);
    setReviewed(false);
  }
  function merge() {
    try {
      const next = cards[index + 1],
        exact = canRejoinImported(current, next),
        joined = mergeImported(current, next, multipleImages);
      if (
        !exact &&
        !confirm(
          "Diese Karten können nicht eindeutig als unveränderte Teilstücke zurückgesetzt werden. Ihre Texte und die zweite Überschrift werden mit Absätzen verbunden; unterschiedliche Quellen, Bilder und Tabelleninformationen bleiben erhalten. Die gemeinsame Karte verwendet die Kartengruppe der ersten Karte. Zusammenfügen und die Textgrenze sowie Kartengruppe anschließend am Original prüfen?",
        )
      )
        return;
      forgetRegions(
        [current.id, next.id],
        exact ? (splitGeometry.current.get(current) ?? []) : [],
      );
      const infos = { ...ocrInfo };
      if (ocrInfo[current.id] || ocrInfo[next.id])
        infos[current.id] = {
          ...(ocrInfo[current.id] ?? ocrInfo[next.id]),
          ...(!exact && ocrInfo[current.id] && ocrInfo[next.id]
            ? {
                data: {
                  text: [
                    ocrInfo[current.id].data.text,
                    ocrInfo[next.id].data.text,
                  ].join("\n\n"),
                  confidence: Math.min(
                    ocrInfo[current.id].data.confidence,
                    ocrInfo[next.id].data.confidence,
                  ),
                  blocks: [
                    ...(ocrInfo[current.id].data.blocks ?? []),
                    ...(ocrInfo[next.id].data.blocks ?? []),
                  ],
                },
              }
            : {}),
          checked: false,
          regions: [
            ...new Map(
              [
                ...(ocrInfo[current.id]?.regions ?? []),
                ...(ocrInfo[next.id]?.regions ?? []),
              ].map((r) => [`${r.page}-${r.id}`, r]),
            ).values(),
          ],
        };
      delete infos[next.id];
      setOcrInfo(infos);
      setCards([...cards.slice(0, index), joined, ...cards.slice(index + 2)]);
      setSelected([
        ...selected.filter((id) => id !== next.id && id !== current.id),
        ...(selected.includes(current.id) || selected.includes(next.id)
          ? [current.id]
          : []),
      ]);
      setReviewed(false);
      setError("");
      setMessage(
        exact
          ? "Teilung zurückgenommen: Text, Quelle und Karteninformationen entsprechen wieder dem Original vor der Teilung."
          : "Karten mit Absätzen zusammengefügt. Bitte Textgrenze und gemeinsame Kartengruppe am Original prüfen.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function close() {
    if (
      step !== 1 &&
      cards.length &&
      !confirm(
        "Import schließen? Noch nicht übernommene Importänderungen werden verworfen. Der Entwurf bleibt unverändert.",
      )
    )
      return;
    stop();
    onCancel();
  }
  async function attach(asNew = false) {
    try {
      if (!pageImage) return;
      setBusy(true);
      setError("");
      const data = await cropImage(pageImage, crop);
      await verifyImageDecode(data);
      if (!alive.current) return;
      if (asNew) addCard({ image: data });
      else if (multipleImages && current?.image) {
        if ((current.extraImages?.length ?? 0) >= 3)
          throw Error(
            "Höchstens vier Bilder pro Karte. Bitte einen weiteren Kartenvorschlag anlegen.",
          );
        update({
          extraImages: [...(current.extraImages ?? []), { src: data }],
        });
      } else update({ image: data });
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function cropPoint(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(
        100,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * 100),
      ),
      y: Math.min(
        100,
        Math.max(0, ((e.clientY - rect.top) / rect.height) * 100),
      ),
    };
  }
  async function apply() {
    try {
      setError("");
      if (!reviewed)
        throw new Error(
          "Bitte zuerst den Vergleich mit dem Original bestätigen.",
        );
      const chosen = cards.filter(
        (c) => selected.includes(c.id) && c.id !== instruction?.cardId,
      );
      const graphicIds = new Set(
        result?.pdfLayout?.regions
          .filter((region) => region.graphic)
          .map((region) => region.cardId),
      );
      if (
        chosen.some(
          (card) => graphicIds.has(card.id) && !card.image && !card.text.trim(),
        )
      )
        throw Error(
          "Eine ausgewählte Bildkarte hat kein Bild. Bitte den Ausschnitt übernehmen oder die Karte abwählen.",
        );
      if (
        instruction &&
        (!instruction.text.trim() || instruction.text.length > 4000)
      )
        throw Error(
          "Bitte die Aufgabenstellung ausfüllen oder auf höchstens 4000 Zeichen kürzen.",
        );
      if (
        chosen.some(
          (c) => ocrInfo[c.id] && (!ocrInfo[c.id].checked || !c.text.trim()),
        )
      )
        throw Error(
          "Bitte jede OCR-Karte einzeln am Original prüfen und bestätigen. Leere Karten entfernen oder manuell ausfüllen.",
        );
      let next = takeImportedCards(draft, chosen, mode, title);
      if (instruction)
        next = reviseDraft(next, {
          ...next.content,
          instructions: instruction.text.trim(),
        });
      if (
        studio &&
        mode === "append" &&
        draft.content.title &&
        appendTitle !== next.content.title
      )
        next = reviseDraft(next, { ...next.content, title: appendTitle });
      setBusy(true);
      for (const c of chosen)
        for (const src of [
          c.image,
          ...(c.extraImages ?? []).map((i) => i.src),
        ].filter((x): x is string => !!x))
          await verifyImageDecode(src);
      if (!alive.current) return;
      if (
        mode === "new" &&
        (!studio ||
          dirty ||
          draft.content.cards.length > 0 ||
          !!draft.content.title) &&
        !confirm(
          `${dirty ? "Der geöffnete Entwurf enthält noch nicht dauerhaft abgelegte Änderungen. " : ""}Ein neues Mystery beginnen? Der geöffnete Entwurf wird ersetzt. Brecht ab und sichert ihn zuerst, wenn ihr ihn behalten möchtet.`,
        )
      ) {
        setBusy(false);
        return;
      }
      stop();
      onApply(next, chosen.length);
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }
  async function withOcr(
    action: (session: LocalOcr, signal: AbortSignal) => Promise<void>,
  ) {
    const controller = new AbortController();
    ocrController.current?.abort();
    ocrController.current = controller;
    let session: LocalOcr | undefined;
    setBusy(true);
    setOcrRunning(true);
    setError("");
    try {
      session = new LocalOcr(controller.signal, (m) => {
        if (alive.current && !controller.signal.aborted) setMessage(m);
      });
      await session.start();
      await action(session, controller.signal);
    } catch (e) {
      if (alive.current && ocrController.current === controller)
        setError(
          (e as Error).name === "AbortError"
            ? "OCR abgebrochen. Vorherige Vorschläge und Entwurf bleiben erhalten."
            : /Bereiche überlagern/.test((e as Error).message)
              ? "Die automatische Aufteilung ist unsicher: Bereiche überlagern sich. Bitte die Karten einzeln im Original markieren und als Textkarten hinzufügen. Bisherige Vorschläge und Entwurf bleiben erhalten."
              : (e as Error).message,
        );
    } finally {
      session?.close();
      if (ocrController.current === controller) {
        ocrController.current = null;
        if (alive.current) {
          setBusy(false);
          setOcrRunning(false);
        }
      }
    }
  }
  const contains = (item: PdfItem, b: Rect) =>
    item.x + item.width / 2 >= b.x &&
    item.x + item.width / 2 <= b.x + b.width &&
    item.y + item.height / 2 >= b.y &&
    item.y + item.height / 2 <= b.y + b.height;
  async function recognizeRegions(
    next: PdfLayout,
    affected: number[],
    removed: number[] = [],
    session?: LocalOcr,
    signal?: AbortSignal,
  ) {
    if (!pageImage) return;
    if (
      !session &&
      affected.some((id) => cards.some((c) => c.id === id)) &&
      !confirm(
        "Betroffene Karten erneut erkennen? Überschrift, Text und Quelle werden nach erfolgreicher OCR ersetzt. Andere Karten und der Entwurf bleiben erhalten.",
      )
    )
      return;
    const run = async (engine: LocalOcr, abort: AbortSignal) => {
      let remaining = cards.filter((c) => !removed.includes(c.id));
      const infos = { ...ocrInfo };
      for (const id of removed) delete infos[id];
      let items = [...next.pages[page - 1].items];
      const dimensions = next.pages[page - 1];
      for (const [i, id] of affected.entries()) {
        abort.throwIfAborted();
        const region = next.regions.find(
          (r) => r.page === page && r.cardId === id,
        );
        if (!region) continue;
        setMessage(`Karte ${i + 1} von ${affected.length} wird erkannt …`);
        const b = region.bounds;
        let src: string;
        const prepared = preparations.current.get(page);
        if (result?.format === "pdf" && !prepared) {
          src = await new Promise<string>((resolve, reject) => {
            const id = ++request.current;
            const cancel = () => {
              clearTimeout(timer);
              regionRenders.current.delete(id);
              request.current++;
              worker.current?.postMessage({ type: "cancel-render" });
              reject(new DOMException("OCR abgebrochen", "AbortError"));
            };
            const finish = (value: string) => {
              abort.removeEventListener("abort", cancel);
              resolve(value);
            };
            const failure = (e: Error) => {
              abort.removeEventListener("abort", cancel);
              reject(e);
            };
            const timer = setTimeout(() => {
              regionRenders.current.delete(id);
              request.current++;
              worker.current?.postMessage({ type: "cancel-render" });
              failure(
                Error(
                  "PDF-OCR-Ausschnitt konnte nicht rechtzeitig gerendert werden.",
                ),
              );
            }, 20000);
            regionRenders.current.set(id, {
              resolve: finish,
              reject: failure,
              timer,
            });
            abort.addEventListener("abort", cancel, { once: true });
            worker.current!.postMessage({
              type: "render-region",
              id,
              page,
              bounds: b,
            });
          });
        } else {
          const source =
            result?.format === "image" && !prepared
              ? originalURL.current
              : pageImage;
          src = await cropImage(source, {
            x: (b.x / dimensions.width) * 100,
            y: (b.y / dimensions.height) * 100,
            w: (b.width / dimensions.width) * 100,
            h: (b.height / dimensions.height) * 100,
          });
        }
        const data = await engine.recognize(src);
        abort.throwIfAborted();
        const raw = ocrCard(data, id),
          old = remaining.find((c) => c.id === id);
        let preserved: Partial<Card> = old ? { ...old } : {};
        delete preserved.source;
        const card = {
          ...preserved,
          ...raw,
          group:
            old?.group ??
            (raw.group === "extension" ? extensionGroup : defaultGroup),
        } as Card;
        if (
          multipleImages &&
          !card.image &&
          !card.extraImages?.length &&
          (await graphicCandidate(src, data))
        ) {
          card.image = src;
          card.imageAlt = "Originalausschnitt aus der importierten Karte";
          card.imageCaption = "Originalausschnitt";
        }
        if (!old) remaining.push(card);
        else remaining = remaining.map((c) => (c.id === id ? card : c));
        infos[id] = { data, checked: false, regions: [region] };
        const image = new Image();
        image.src = src;
        await image.decode();
        const scale = b.width / image.naturalWidth;
        image.src = "";
        items = [
          ...items.filter((t) => !contains(t, b)),
          ...ocrItems(data, scale, { x: b.x, y: b.y }),
        ];
      }
      if (remaining.length > 100)
        throw Error(
          "Mehr als 100 Karten sind nicht möglich. Bitte den Scan aufteilen.",
        );
      checkOcrBudget(next.pages, page - 1, items);
      const pages = next.pages.map((p, i) =>
        i === page - 1 ? { ...p, items } : p,
      );
      // An automatic heading region can extend over an otherwise empty scan.
      // Tighten only such existing regions to their original text before adding
      // an independent OCR area; never duplicate or replace the existing text.
      const additions = next.regions.filter(
        (r) =>
          r.page === page &&
          affected.includes(r.cardId) &&
          !cards.some((c) => c.id === r.cardId),
      );
      const regions = next.regions.map((r) => {
        if (
          r.page !== page ||
          affected.includes(r.cardId) ||
          r.strategy === "manual" ||
          !additions.some(
            (a) =>
              a.bounds.x < r.bounds.x + r.bounds.width &&
              a.bounds.x + a.bounds.width > r.bounds.x &&
              a.bounds.y < r.bounds.y + r.bounds.height &&
              a.bounds.y + a.bounds.height > r.bounds.y,
          )
        )
          return r;
        const owned = next.pages[page - 1].items.filter((t) =>
          contains(t, r.bounds),
        );
        if (!owned.length) return r;
        const x = Math.max(0, Math.min(...owned.map((t) => t.x)) - 1),
          y = Math.max(0, Math.min(...owned.map((t) => t.y)) - 1);
        return {
          ...r,
          bounds: {
            x,
            y,
            width:
              Math.min(
                next.pages[page - 1].width,
                Math.max(...owned.map((t) => t.x + t.width)) + 1,
              ) - x,
            height:
              Math.min(
                next.pages[page - 1].height,
                Math.max(...owned.map((t) => t.y + t.height)) + 1,
              ) - y,
          },
        };
      });
      const layout = changeRegions({ ...next, pages }, regions);
      if (layout.sections.length > 4000)
        throw Error(
          "Zu viele Dokumentabschnitte. Bitte die Aufnahme aufteilen.",
        );
      abort.throwIfAborted();
      if (!alive.current) return;
      setCards(remaining);
      if (affected.length)
        setIndex(
          Math.max(
            0,
            remaining.findIndex((c) => c.id === affected[0]),
          ),
        );
      if (!affected.length)
        setIndex(Math.max(0, Math.min(index, remaining.length - 1)));
      setSelected([
        ...selected.filter((id) => !removed.includes(id)),
        ...affected.filter((id) => !selected.includes(id)),
      ]);
      setOcrInfo(infos);
      setResult({
        ...result!,
        pdfLayout: layout,
        blocks: [
          ...result!.blocks.filter((b) => b.page !== page),
          ...layout.sections.filter((b) => b.page === page),
        ],
      });
      setReviewed(false);
      setMark(false);
      setMessage(
        "OCR beendet. Jede Karte, Zahl und Quellenangabe am Original kontrollieren und einzeln bestätigen. Erkennungssicherheit ist keine Garantie für Richtigkeit.",
      );
    };
    if (session && signal) await run(session, signal);
    else await withOcr(run);
  }
  async function recognizePage() {
    if (!result?.pdfLayout || !pageImage) return;
    if (!rasterPages.includes(page)) {
      setError(
        "Diese Seite besitzt eine Textebene. Für fehlende Bildtexte einen nicht überlappenden Ausschnitt markieren und als Textkarte hinzufügen; vorhandene Texte bleiben erhalten.",
      );
      return;
    }
    const layout = result.pdfLayout;
    if (
      layout.regions.some((r) => r.page === page) &&
      !confirm(
        "Karten dieser Scan-Seite neu aufteilen? Die bisherigen Vorschläge dieser Seite werden erst nach erfolgreicher Erkennung ersetzt.",
      )
    )
      return;
    await withOcr(async (engine, signal) => {
      const frames = await scanFrames(pageImage);
      signal.throwIfAborted();
      const fullSource = frames.length
        ? await cropImage(pageImage, { x: 0, y: 0, w: 100, h: 100 }, 1_500_000)
        : pageImage;
      const full = await engine.recognize(fullSource);
      signal.throwIfAborted();
      const dimensions = layout.pages[page - 1],
        img = new Image();
      img.src = fullSource;
      await img.decode();
      const scale = dimensions.width / img.naturalWidth;
      img.src = pageImage;
      await img.decode();
      const frameScale = dimensions.width / img.naturalWidth;
      img.src = "";
      const items = ocrItems(full, scale),
        bounds = frames.length
          ? frames.map((b) => ({
              x: b.x * frameScale,
              y: b.y * frameScale,
              width: b.width * frameScale,
              height: b.height * frameScale,
            }))
          : fallbackRegions({ ...dimensions, items });
      const usable = bounds.length
        ? bounds
        : [{ x: 0, y: 0, width: dimensions.width, height: dimensions.height }];
      if (usable.length > 100)
        throw Error(
          "Mehr als 100 Kartenbereiche erkannt. Bitte die Aufnahme aufteilen.",
        );
      const old = layout.regions
          .filter((r) => r.page === page)
          .map((r) => r.cardId),
        id = Math.max(0, ...cards.map((c) => c.id)) + 1,
        rid = Math.max(0, ...layout.regions.map((r) => r.id)) + 1;
      const regions = [
        ...layout.regions.filter((r) => r.page !== page),
        ...usable
          .sort((a, b) => (Math.abs(a.y - b.y) < 10 ? a.x - b.x : a.y - b.y))
          .map((bounds, i) => ({
            id: rid + i,
            cardId: id + i,
            page,
            bounds,
            strategy: "manual" as const,
          })),
      ];
      const next = {
        ...layout,
        pages: layout.pages.map((p, i) =>
          i === page - 1 ? { ...p, items } : p,
        ),
        regions,
      };
      await recognizeRegions(
        next,
        usable.map((_, i) => id + i),
        old,
        engine,
        signal,
      );
    });
  }
  async function prepareMarkedCrop() {
    const image = new Image();
    image.src = rawPageImage;
    setBusy(true);
    setError("");
    try {
      await image.decode();
      if (!alive.current) return;
      await prepareImage({
        ...preparation,
        crop: {
          x: (crop.x * image.naturalWidth) / 100,
          y: (crop.y * image.naturalHeight) / 100,
          width: (crop.w * image.naturalWidth) / 100,
          height: (crop.h * image.naturalHeight) / 100,
        },
      });
    } catch {
      if (alive.current)
        setError(
          "Der Bildausschnitt konnte nicht vorbereitet werden. Bitte die Seite erneut öffnen.",
        );
    } finally {
      image.src = "";
      if (alive.current) setBusy(false);
    }
  }
  async function prepareImage(options: Preparation) {
    if (!result?.pdfLayout || !rawPageImage) return;
    const ids = result.pdfLayout.regions
      .filter((r) => r.page === page)
      .map((r) => r.cardId);
    if (
      ids.length &&
      !confirm(
        "Bildvorbereitung ändern? Die OCR-Vorschläge dieser Seite werden verworfen; Texte anderer Seiten und der Entwurf bleiben erhalten.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const prepared = await prepareScan(rawPageImage, options);
      if (!alive.current) return;
      setPageImage(prepared.src);
      preparations.current.set(page, options);
      setPreparation(options);
      setCards(cards.filter((c) => !ids.includes(c.id)));
      setSelected(selected.filter((id) => !ids.includes(id)));
      const infos = { ...ocrInfo };
      for (const id of ids) delete infos[id];
      setOcrInfo(infos);
      setIndex(0);
      setCrop({ x: 0, y: 0, w: 100, h: 100 });
      const layout = result.pdfLayout;
      const next = changeRegions(
        {
          ...layout,
          pages: layout.pages.map((p, i) =>
            i === page - 1
              ? { width: prepared.width, height: prepared.height, items: [] }
              : p,
          ),
        },
        layout.regions.filter((r) => r.page !== page),
      );
      setResult({ ...result, pdfLayout: next });
      setReviewed(false);
      setMessage(
        "Bild vorbereitet. Original bleibt zum Vergleich verfügbar. Kartengrenzen neu erkennen oder markieren.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function chooseCard(n: number) {
    setIndex(n);
    const region =
      result?.pdfLayout?.regions.find((r) => r.cardId === cards[n]?.id) ??
      ocrInfo[cards[n]?.id]?.regions[0];
    if (
      region &&
      region.page !== page &&
      result?.format === "pdf" &&
      (studio || ocrInfo[cards[n]?.id])
    ) {
      setPage(region.page);
      setPageImage("");
      setRawPageImage("");
      renderPage(region.page);
    }
  }
  function reorder(delta: number) {
    const n = index + delta;
    if (n < 0 || n >= cards.length) return;
    const next = [...cards];
    [next[index], next[n]] = [next[n], next[index]];
    setCards(next);
    setIndex(n);
    setReviewed(false);
  }
  const originalText =
    result?.blocks
      .filter((b) => result.format !== "pdf" || b.page === page)
      .map((b) =>
        b.table
          ? [
              b.table.headers.join("\t"),
              ...b.table.rows.map((r) => r.join("\t")),
            ].join("\n")
          : b.text,
      )
      .filter(Boolean)
      .join("\n\n") ?? "";
  useEffect(() => {
    if (
      studio &&
      result &&
      step === 2 &&
      pageImage &&
      !busy &&
      rasterPages.includes(page) &&
      ocrBase() &&
      !automaticPages.current.has(page)
    ) {
      automaticPages.current.add(page);
      void recognizePage();
    }
  }, [studio, result, step, pageImage, busy, page, rasterPages]);
  return (
    <section
      className={"document-import" + (studio ? " studio-import" : "")}
      data-correction={correction ?? "none"}
      data-has-result={!!result}
      aria-label="Dokument importieren"
    >
      <h2>
        {studio
          ? step === 2
            ? "Karten kontrollieren"
            : step === 3
              ? "Karten übernehmen"
              : "Material importieren"
          : "Dokument importieren"}
      </h2>
      <p className="small" hidden={studio}>
        1. Datei auswählen · 2. Karten prüfen · 3. Karten übernehmen
      </p>
      <p hidden={studio && step !== 1}>
        Die Verarbeitung bleibt auf diesem Gerät. Es wird nichts automatisch
        gespeichert.
      </p>
      <div className="actions import-file-actions">
        <button
          hidden={studio && !!result}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Word- oder PDF-Datei auswählen
        </button>
        <button
          hidden={studio && !!result}
          disabled={busy}
          onClick={() => photoInput.current?.click()}
        >
          Foto oder Scan importieren
        </button>
        <input
          hidden
          ref={photoInput}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          aria-label="Foto oder Scan"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void openFile(f);
          }}
        />
        <button
          hidden={studio && !!result}
          disabled={busy}
          onClick={() => cameraInput.current?.click()}
        >
          Foto aufnehmen
        </button>
        <input
          hidden
          ref={cameraInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          aria-label="Foto aufnehmen"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void openFile(f);
          }}
        />
        {ocrRunning && (
          <button onClick={() => ocrController.current?.abort()}>
            {studio ? "Erkennung abbrechen" : "OCR abbrechen"}
          </button>
        )}
        <input
          hidden
          ref={fileInput}
          type="file"
          accept=".docx,.pdf"
          aria-label="Word- oder PDF-Datei"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void openFile(f);
          }}
        />
        <button hidden={studio && ocrRunning} onClick={close}>
          {busy
            ? "Import abbrechen"
            : studio
              ? "Zur Pinnwand"
              : "Zurück zum Entwurf"}
        </button>
      </div>
      {file && (
        <p className="small" hidden={studio && !diagnostics}>
          {file.name} ·{" "}
          {result?.format === "pdf"
            ? "PDF"
            : result?.format === "docx"
              ? "Word (.docx)"
              : "Datei"}
          {result?.pages ? ` · ${result.pages.length} Seiten` : ""}
          {result
            ? ` · ${result.blocks.filter((b) => b.text).length} Textbereiche · ${result.images.length} Bilder`
            : ""}
        </p>
      )}
      {message && (
        <p role="status" hidden={studio && !busy && !diagnostics}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {busy && (
        <p aria-live="polite">
          Bitte warten. Ein Abbruch verändert den bisherigen Entwurf nicht.
        </p>
      )}
      <fieldset className="import-step-body" disabled={busy}>
        {result && step === 2 && (
          <>
            <h3 hidden={studio}>2. Karten prüfen</h3>
            {studio && (
              <div className="studio-import-summary">
                <p role="status">
                  {cards.length} Karten erkannt
                  {unchecked > 0
                    ? ` · ${unchecked} noch am Original prüfen`
                    : Object.keys(ocrInfo).length
                      ? " · OCR-Karten geprüft"
                      : " · Bitte am Original kontrollieren"}
                </p>
                <button
                  aria-expanded={!!correction}
                  onClick={() => {
                    setCorrection(correction ? null : "bounds");
                    setMark(false);
                    setDiagnostics(false);
                  }}
                >
                  {" "}
                  {correction
                    ? "Zur einfachen Ansicht"
                    : "Erkennung korrigieren"}
                </button>
              </div>
            )}
            {studio && correction && (
              <nav
                className="studio-import-tools-nav"
                aria-label="Erkennung korrigieren"
              >
                {(
                  [
                    ["bounds", "Kartengrenzen"],
                    ["text", "Texterkennung"],
                    ["structure", "Kartenstruktur"],
                    ["media", "Bilder, Diagramme und Tabellen"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={correction === id}
                    onClick={() => {
                      setCorrection(id);
                      setMark(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button
                  className="studio-diagnostics-button"
                  aria-expanded={diagnostics}
                  onClick={() => setDiagnostics(!diagnostics)}
                >
                  Details zur Erkennung
                </button>
              </nav>
            )}
            <p className="import-warning" hidden={studio}>
              Unsichere Gliederung: Bitte alle vorgeschlagenen Grenzen, Inhalte
              und Pflicht-/Vertiefungsangaben am Original kontrollieren. Es
              findet keine fachliche Erkennung statt.
            </p>
            {studio && !cards.length && pageImage && !busy && (
              <div className="studio-recognize-empty">
                <p>
                  Erkenne die Karten dieser Aufnahme und kontrolliere danach die
                  Vorschläge.
                </p>
                <button
                  disabled={!ocrBase()}
                  onClick={() => void recognizePage()}
                >
                  Text und Karten erkennen
                </button>
              </div>
            )}
            {result.noText && !Object.keys(ocrInfo).length && !studio && (
              <p role="status">
                Dieses Dokument enthält keinen auslesbaren Text. Sie können eine
                Seite als Bild übernehmen oder im vollständigen OCR-Autorenpaket
                Text lokal erkennen lassen.
              </p>
            )}
            {!studio && result.pdfLayout?.uncertainPages.includes(page) && (
              <p role="status" className="import-warning">
                Auf dieser PDF-Seite könnten mehrere Mystery-Karten stehen.
                Bitte überprüfe die Aufteilung. Unter „Original ansehen“ lassen
                sich eigene Textbereiche markieren, teilen und ergänzen.
              </p>
            )}
            {!!uncertainGraphics.length && (
              <details className="import-warning">
                <summary>Grafiken ohne sichere Kartenzuordnung prüfen</summary>
                {uncertainGraphics.map(
                  ({ page: graphicPage, bounds }, index) => (
                    <button
                      key={index}
                      disabled={busy}
                      onClick={() => {
                        if (graphicPage !== page) {
                          setPage(graphicPage);
                          renderPage(graphicPage);
                        } else {
                          const original =
                            result.pdfLayout!.pages[graphicPage - 1];
                          setCrop({
                            x: (bounds.x / original.width) * 100,
                            y: (bounds.y / original.height) * 100,
                            w: (bounds.width / original.width) * 100,
                            h: (bounds.height / original.height) * 100,
                          });
                          setMark(true);
                        }
                        setCorrection("media");
                        setView("original");
                      }}
                    >
                      {graphicPage === page
                        ? `Grafik ${index + 1} auf Seite ${page} markieren`
                        : `Zur Grafik auf Seite ${graphicPage}`}
                    </button>
                  ),
                )}
              </details>
            )}
            <div data-import-tool="structure">
              {" "}
              {result.pdfLayout && (
                <details className="pdf-document-sections">
                  <summary>
                    Dokumentabschnitte außerhalb der Karten (
                    {result.pdfLayout.sections.length})
                  </summary>
                  <p className="small">
                    Diese Texte bleiben zum Vergleich verfügbar und werden nicht
                    automatisch als Karten übernommen. Zum Aufbewahren die
                    Originaldatei ablegen oder den Text kopieren.
                  </p>
                  {result.suggestedTitle && (
                    <>
                      <p>
                        Titelvorschlag aus dem Dokument: {result.suggestedTitle}
                      </p>
                      <button
                        disabled={result.suggestedTitle.length > 100}
                        onClick={() => {
                          setTitle(result.suggestedTitle!);
                          setMessage(
                            "Titelvorschlag gewählt. Den Titel vor der Kartenübernahme bestätigen.",
                          );
                        }}
                      >
                        Titelvorschlag übernehmen
                      </button>
                      {result.suggestedTitle.length > 100 && (
                        <p>Bitte den Titel auf höchstens 100 Zeichen kürzen.</p>
                      )}
                    </>
                  )}
                  <textarea
                    aria-label="Separate Dokumentabschnitte"
                    readOnly
                    rows={8}
                    value={result.pdfLayout.sections
                      .map((b) => `Seite ${b.page}\n${b.text}`)
                      .join("\n\n")}
                  />
                  {result.pdfLayout.sections
                    .filter((block) =>
                      /^\s*(?:Ziel|Aufgabenstellung)\s*:/i.test(block.text),
                    )
                    .map((block, index) => (
                      <button
                        key={index}
                        onClick={() => offerInstructions(block.text)}
                      >
                        Abschnitt „Ziel“ als Aufgabenstellung übernehmen
                      </button>
                    ))}
                </details>
              )}
              <details>
                <summary>Hinweise zur Übernahme</summary>
                {result.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </details>
            </div>{" "}
            <div className="actions import-tabs">
              <button
                aria-pressed={view === "cards"}
                onClick={() => setView("cards")}
              >
                Karten ansehen
              </button>
              <button
                aria-pressed={view === "original"}
                onClick={() => setView("original")}
              >
                Original ansehen
              </button>
            </div>
            <div className="import-review" data-view={view}>
              <section
                className="import-original"
                aria-label="Original vergleichen"
              >
                <h3>Original</h3>
                {result.format === "docx" && (
                  <p className="small">
                    Absätze, Tabellen und Bilder aus Word. Die Seiteneinteilung
                    kann abweichen; für den vollständigen Vergleich die
                    Originaldatei ablegen und in Word öffnen.
                  </p>
                )}
                {originalURL.current &&
                  (!studio || diagnostics || correction === "text") && (
                    <a
                      className="button"
                      href={originalURL.current}
                      download={file?.name}
                    >
                      Originaldatei ablegen
                    </a>
                  )}
                {result.format === "docx" && (
                  <div className="import-docx-original">
                    {result.blocks.map((b, i) => (
                      <div
                        key={i}
                        data-word-card={studio ? wordCardFor(b) : undefined}
                        data-selected={studio && wordCardFor(b) === current?.id}
                        role={studio && wordCardFor(b) ? "button" : undefined}
                        tabIndex={studio && wordCardFor(b) ? 0 : undefined}
                        aria-label={
                          studio && wordCardFor(b)
                            ? `Bereich ${cards.findIndex((c) => c.id === wordCardFor(b)) + 1} auswählen`
                            : undefined
                        }
                        onClick={() => {
                          const n = cards.findIndex(
                            (c) => c.id === wordCardFor(b),
                          );
                          if (studio && n >= 0) chooseCard(n);
                        }}
                        onKeyDown={(e) => {
                          const n = cards.findIndex(
                            (c) => c.id === wordCardFor(b),
                          );
                          if (
                            studio &&
                            n >= 0 &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            chooseCard(n);
                          }
                        }}
                      >
                        {b.kind === "heading" ? (
                          <h4>{b.text}</h4>
                        ) : b.table ? (
                          <TableView table={b.table} />
                        ) : b.image ? (
                          <MediaView
                            lazy
                            src={b.image}
                            alt={b.imageAlt || "Bild aus dem Word-Dokument"}
                          />
                        ) : (
                          <p>{b.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(result.format === "pdf" || result.format === "image") && (
                  <>
                    <label>
                      {result.format === "image" ? "Bild" : "PDF-Seite"}
                      <select
                        aria-label="PDF-Seite"
                        disabled={busy}
                        value={page}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setPage(n);
                          setPageImage("");
                          setRawPageImage("");
                          renderPage(n);
                        }}
                      >
                        {result.pages!.map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            Seite {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                    {pageImage && (
                      <>
                        {studio && (
                          <label className="studio-original-zoom">
                            Original vergrößern
                            <input
                              aria-label="Original vergrößern"
                              type="range"
                              min="1"
                              max="3"
                              step="0.25"
                              value={originalZoom}
                              onChange={(e) =>
                                setOriginalZoom(Number(e.target.value))
                              }
                            />
                          </label>
                        )}
                        <div
                          data-import-tool="text"
                          className="ocr-preparation"
                          aria-label="Foto und Scan vorbereiten"
                        >
                          <p className="small">
                            {ocrBase()
                              ? "Deutsche Texterkennung vollständig lokal. Jede Karte vor der Übernahme prüfen."
                              : "OCR benötigt das vollständige lokale OCR-Autorenpaket oder OCR-SCORM. Die kompakte Einzel-HTML enthält keine Sprachmodelle."}
                          </p>
                          <button
                            disabled={!ocrBase()}
                            onClick={() => void recognizePage()}
                          >
                            Kartengrenzen und Text erkennen
                          </button>
                          {rasterPages.includes(page) && (
                            <details>
                              <summary>Bild vorbereiten</summary>
                              <button
                                onClick={() =>
                                  void prepareImage({
                                    ...preparation,
                                    angle: (preparation.angle + 90) % 360,
                                  })
                                }
                              >
                                Foto um 90° drehen
                              </button>
                              <label>
                                Schräglage (Grad)
                                <input
                                  type="number"
                                  min={-360}
                                  max={360}
                                  step={0.5}
                                  value={preparation.angle}
                                  onChange={(e) =>
                                    setPreparation({
                                      ...preparation,
                                      angle: Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Kontrast
                                <input
                                  type="number"
                                  min={0.5}
                                  max={2}
                                  step={0.1}
                                  value={preparation.contrast}
                                  onChange={(e) =>
                                    setPreparation({
                                      ...preparation,
                                      contrast: Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Bildansicht
                                <select
                                  value={preparation.mode}
                                  onChange={(e) =>
                                    setPreparation({
                                      ...preparation,
                                      mode: e.target
                                        .value as Preparation["mode"],
                                    })
                                  }
                                >
                                  <option value="color">Farbe</option>
                                  <option value="gray">Graustufen</option>
                                  <option value="bw">
                                    Schwarz-Weiß (kontrollieren)
                                  </option>
                                </select>
                              </label>
                              <button
                                onClick={() => void prepareImage(preparation)}
                              >
                                Bildvorbereitung anwenden
                              </button>
                              <button
                                disabled={
                                  !mark ||
                                  preparation.angle !== 0 ||
                                  preparation.crop !== undefined
                                }
                                onClick={() => void prepareMarkedCrop()}
                              >
                                Auf Markierung zuschneiden
                              </button>
                              <button
                                onClick={() =>
                                  void prepareImage(plainPreparation)
                                }
                              >
                                Bildvorbereitung zurücksetzen
                              </button>
                              <p className="small">
                                Drehung und Zuschnitt am Original prüfen.
                                Schräglage manuell korrigieren; keine
                                automatische Perspektivkorrektur. Schwarz-Weiß
                                kann feine Zeichen verlieren.
                              </p>
                            </details>
                          )}
                          <label>
                            <input
                              type="checkbox"
                              checked={showUntouched}
                              onChange={(e) =>
                                setShowUntouched(e.target.checked)
                              }
                            />{" "}
                            Unbearbeitete Aufnahme zusätzlich vergleichen
                          </label>
                          {showUntouched && (
                            <img
                              src={rawPageImage}
                              alt="Unbearbeitete Aufnahme"
                            />
                          )}
                        </div>
                        <label
                          className="help-toggle"
                          data-import-tool="bounds media text"
                        >
                          <input
                            type="checkbox"
                            checked={canMark}
                            onChange={(e) => setMark(e.target.checked)}
                          />
                          Ausschnitt markieren
                        </label>
                        <div className="studio-original-scroll">
                          <div
                            className={
                              "import-page " + (canMark ? "marking" : "")
                            }
                            style={{
                              width:
                                studio && result.pdfLayout
                                  ? `min(${originalZoom * 100}%, calc(max(160px, 100vh - 455px) * ${(result.pdfLayout.pages[page - 1].width / result.pdfLayout.pages[page - 1].height) * originalZoom}))`
                                  : `${originalZoom * 100}%`,
                            }}
                            onPointerDown={(e) => {
                              if (!canMark) return;
                              e.preventDefault();
                              e.currentTarget.setPointerCapture(e.pointerId);
                              cropPointers.current.add(e.pointerId);
                              if (cropPointers.current.size > 1) {
                                cropStart.current = null;
                                setCrop(cropBefore.current);
                              } else {
                                cropBefore.current = crop;
                                cropStart.current = cropPoint(e);
                              }
                            }}
                            onPointerMove={(e) => {
                              if (
                                !canMark ||
                                !cropStart.current ||
                                cropPointers.current.size !== 1 ||
                                !cropPointers.current.has(e.pointerId)
                              )
                                return;
                              const p = cropPoint(e),
                                s = cropStart.current;
                              setCrop({
                                x: Math.min(s.x, p.x),
                                y: Math.min(s.y, p.y),
                                w: Math.max(0.1, Math.abs(s.x - p.x)),
                                h: Math.max(0.1, Math.abs(s.y - p.y)),
                              });
                            }}
                            onPointerUp={(e) => {
                              cropPointers.current.delete(e.pointerId);
                              cropStart.current = null;
                            }}
                            onPointerCancel={(e) => {
                              cropPointers.current.delete(e.pointerId);
                              cropStart.current = null;
                              setCrop(cropBefore.current);
                            }}
                            onLostPointerCapture={(e) => {
                              if (cropPointers.current.has(e.pointerId)) {
                                cropPointers.current.delete(e.pointerId);
                                cropStart.current = null;
                                setCrop(cropBefore.current);
                              }
                            }}
                          >
                            <img
                              src={pageImage}
                              alt={`Original-PDF-Seite ${page}`}
                            />
                            {result.pdfLayout && (
                              <PdfRegionOverlay
                                readableNumbers={studio}
                                layout={
                                  current &&
                                  ocrInfo[current.id] &&
                                  !result.pdfLayout.regions.some(
                                    (r) => r.cardId === current.id,
                                  )
                                    ? {
                                        ...result.pdfLayout,
                                        regions: [
                                          ...result.pdfLayout.regions,
                                          ...ocrInfo[current.id].regions.map(
                                            (r) => ({
                                              ...r,
                                              cardId: current.id,
                                            }),
                                          ),
                                        ],
                                      }
                                    : result.pdfLayout
                                }
                                page={page}
                                cardId={current?.id}
                                mark={canMark}
                                numberFor={(id) =>
                                  cards.findIndex((c) => c.id === id) + 1
                                }
                                onSelect={(id) => {
                                  const n = cards.findIndex((c) => c.id === id);
                                  if (n >= 0) {
                                    setIndex(n);
                                    if (!studio)
                                      setMessage(
                                        `Kartenbereich ${n + 1} ausgewählt. Zugehöriger Text unter „Karten ansehen“.`,
                                      );
                                    if (studio && window.innerWidth < 900)
                                      setView("cards");
                                  }
                                }}
                              />
                            )}
                            {canMark && (
                              <span
                                className="import-crop"
                                style={{
                                  left: crop.x + "%",
                                  top: crop.y + "%",
                                  width: crop.w + "%",
                                  height: crop.h + "%",
                                }}
                              />
                            )}
                          </div>
                        </div>
                        {canMark && (
                          <>
                            <p className="small">
                              Mit Finger oder Maus einen Bereich markieren oder
                              die Prozentwerte anpassen.
                            </p>
                            <div className="import-crop-fields">
                              {(
                                [
                                  ["Links", "x"],
                                  ["Oben", "y"],
                                  ["Breite", "w"],
                                  ["Höhe", "h"],
                                ] as const
                              ).map(([label, key]) => (
                                <label key={key}>
                                  {label} (%)
                                  <input
                                    type="number"
                                    min={key === "x" || key === "y" ? 0 : 1}
                                    max={100}
                                    value={Math.round(crop[key])}
                                    onChange={(e) => {
                                      const n = Math.max(
                                        key === "x" || key === "y" ? 0 : 1,
                                        Math.min(100, Number(e.target.value)),
                                      );
                                      setCrop((old) => {
                                        const next = { ...old, [key]: n };
                                        next.w = Math.min(next.w, 100 - next.x);
                                        next.h = Math.min(next.h, 100 - next.y);
                                        return next;
                                      });
                                    }}
                                  />
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                        <div data-import-tool="bounds">
                          {" "}
                          {result.pdfLayout && (
                            <PdfRegionControls
                              layout={result.pdfLayout}
                              page={page}
                              cardId={current?.id}
                              crop={crop}
                              nextId={
                                Math.max(0, ...cards.map((c) => c.id)) + 1
                              }
                              numberFor={(id) =>
                                cards.findIndex((c) => c.id === id) + 1
                              }
                              onMark={(value) => {
                                setCrop(value);
                                setMark(true);
                              }}
                              onChange={editRegions}
                            />
                          )}
                        </div>
                        <div data-import-tool="media">
                          {" "}
                          <div className="actions">
                            <button
                              disabled={!current || busy}
                              onClick={() => void attach()}
                            >
                              Ausschnitt der aktuellen Karte zuordnen
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => void attach(true)}
                            >
                              Seite als Bildkarte hinzufügen
                            </button>
                            {canMark && (
                              <button
                                disabled={busy}
                                onClick={() => void attach(true)}
                              >
                                Markierten Ausschnitt als Bildkarte übernehmen
                              </button>
                            )}
                          </div>
                        </div>{" "}
                      </>
                    )}
                  </>
                )}
                <div data-import-tool="text">
                  {" "}
                  <label>
                    Ausgelesener{" "}
                    {result.format === "pdf" ? "Seitentext" : "Dokumenttext"}
                    <textarea
                      readOnly
                      value={originalText}
                      rows={6}
                      onSelect={(e) => {
                        const t = e.currentTarget;
                        setPicked(
                          t.value.slice(t.selectionStart, t.selectionEnd),
                        );
                      }}
                    />
                  </label>
                  <button
                    disabled={!picked}
                    onClick={() => addCard({ text: picked })}
                  >
                    Textauswahl als Karte hinzufügen
                  </button>
                </div>{" "}
              </section>
              <section
                className="import-cards"
                aria-label="Importkarten prüfen"
              >
                <h3>
                  {studio
                    ? `Karte ${cards.length ? index + 1 : 0} von ${cards.length}`
                    : "Karten"}
                </h3>
                <p hidden={studio}>
                  {cards.length} Vorschläge · {selected.length} zur Übernahme
                  ausgewählt
                </p>
                {current && (
                  <>
                    <p
                      className="import-warning"
                      hidden={
                        studio &&
                        !/[\uFFFD\u0000]/.test(current.title + current.text)
                      }
                    >
                      Vorschlag {index + 1}: Grenze, Reihenfolge und
                      Kartengruppe bitte am Original prüfen.
                      {/[\uFFFD\u0000]/.test(current.title + current.text)
                        ? " Möglicherweise nicht lesbare Zeichen gefunden; bitte korrigieren."
                        : ""}
                    </p>
                    <label data-import-tool="structure">
                      Karte auswählen
                      <select
                        aria-label="Importkarte auswählen"
                        value={index}
                        onChange={(e) => chooseCard(Number(e.target.value))}
                      >
                        {cards.map((c, i) => (
                          <option key={c.id} value={i}>
                            {i + 1} · {ocrInfo[c.id]?.checked ? "✓ " : ""}
                            {c.title || "Ohne Überschrift"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="actions import-card-navigation">
                      <button
                        disabled={index === 0}
                        onClick={() => chooseCard(index - 1)}
                      >
                        Vorherige Karte
                      </button>
                      <button
                        disabled={index === cards.length - 1}
                        onClick={() => chooseCard(index + 1)}
                      >
                        Nächste Karte
                      </button>
                    </div>
                    <label className="help-toggle" data-import-tool="structure">
                      <input
                        type="checkbox"
                        checked={selected.includes(current.id)}
                        onChange={(e) => {
                          setSelected(
                            e.target.checked
                              ? [...selected, current.id]
                              : selected.filter((id) => id !== current.id),
                          );
                          setReviewed(false);
                        }}
                      />
                      Diese Karte übernehmen
                    </label>
                    <label>
                      Überschrift
                      <input
                        value={current.title}
                        onChange={(e) => update({ title: e.target.value })}
                      />
                    </label>
                    {activeOriginal && (
                      <details className="ocr-original-detail">
                        <summary>
                          Original dieser Karte vergrößert vergleichen
                        </summary>
                        <img
                          src={activeOriginal}
                          alt={`Originalausschnitt der Importkarte ${index + 1}`}
                        />
                        <p className="small">
                          Ausschnitt aus der Aufnahme, keine OCR-Nachzeichnung.
                          Im vollständigen Original bleibt die Karte markiert.
                        </p>
                      </details>
                    )}
                    <label>
                      Kartentext
                      <textarea
                        ref={textarea}
                        value={current.text}
                        rows={studio ? 6 : 8}
                        onChange={(e) => update({ text: e.target.value })}
                      />
                    </label>
                    {result.format === "pdf" &&
                      (instruction?.cardId === current.id ? (
                        <button
                          onClick={() => {
                            setInstruction(undefined);
                            setSelected((ids) =>
                              ids.includes(current.id)
                                ? ids
                                : [...ids, current.id],
                            );
                            setReviewed(false);
                          }}
                        >
                          Wieder als Karte übernehmen
                        </button>
                      ) : (
                        /^\s*(?:Ziel|Aufgabenstellung)\s*(?::|$)/i.test(
                          current.title || current.text,
                        ) && (
                          <button
                            onClick={() =>
                              offerInstructions(
                                [current.title, current.text]
                                  .filter(Boolean)
                                  .join("\n\n"),
                                current.id,
                              )
                            }
                          >
                            Als Aufgabenstellung übernehmen
                          </button>
                        )
                      ))}
                    <p className="small" data-import-tool="structure">
                      {current.text.length} von höchstens 4000 Zeichen. Zum
                      Teilen den Textcursor an die Grenze setzen.
                    </p>
                    <label>
                      Kartengruppe
                      <select
                        aria-label="Import-Kartengruppe"
                        value={current.group}
                        onChange={(e) => update({ group: e.target.value })}
                      >
                        {groups.map(([id, g]) => (
                          <option key={id} value={id}>
                            {g.label}
                            {g.prefix ? ` (${g.prefix})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quellenangabe
                      <textarea
                        value={current.source ?? ""}
                        onChange={(e) => update({ source: e.target.value })}
                      />
                    </label>
                    {current.image && (
                      <>
                        <MediaView
                          src={current.image}
                          alt={current.imageAlt || "Bild dieser Importkarte"}
                        />
                        <div data-import-tool="media">
                          {" "}
                          <label>
                            Bildbeschreibung
                            <input
                              value={current.imageAlt ?? ""}
                              onChange={(e) =>
                                update({ imageAlt: e.target.value })
                              }
                            />
                          </label>
                          <button
                            onClick={() => {
                              const next = { ...current };
                              delete next.image;
                              delete next.imageAlt;
                              setCards(
                                cards.map((c, i) => (i === index ? next : c)),
                              );
                              setReviewed(false);
                            }}
                          >
                            Bild von Karte entfernen
                          </button>
                        </div>{" "}
                      </>
                    )}
                    <div data-import-tool="media">
                      {" "}
                      {current.extraImages?.map((img, i) => (
                        <figure key={i}>
                          <MediaView
                            src={img.src}
                            alt={img.alt || "Zusätzliches Originalbild"}
                          />
                          {img.caption && (
                            <figcaption>{img.caption}</figcaption>
                          )}
                          {img.source && <p>Quelle: {img.source}</p>}
                          <button
                            onClick={() =>
                              update({
                                extraImages: current.extraImages!.filter(
                                  (_, n) => n !== i,
                                ),
                              })
                            }
                          >
                            Zusätzliches Bild von Importkarte entfernen
                          </button>
                        </figure>
                      ))}
                      {!!result.images.length && (
                        <label>
                          Bild aus dem Dokument
                          <select
                            value={result.images.indexOf(current.image ?? "")}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (n >= 0) {
                                if (
                                  multipleImages &&
                                  current.image &&
                                  current.image !== result.images[n]
                                ) {
                                  if ((current.extraImages?.length ?? 0) >= 3) {
                                    setError(
                                      "Höchstens vier Bilder pro Karte. Bitte einen weiteren Vorschlag anlegen.",
                                    );
                                    return;
                                  }
                                  update({
                                    extraImages: [
                                      ...(current.extraImages ?? []),
                                      { src: result.images[n] },
                                    ],
                                  });
                                } else update({ image: result.images[n] });
                              }
                            }}
                          >
                            <option value={-1}>Bild auswählen</option>
                            {result.images.map((_, i) => (
                              <option value={i} key={i}>
                                Bild {i + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>{" "}
                    <label>
                      {studio
                        ? current.image
                          ? "Bild ersetzen (PNG, JPEG, WebP)"
                          : "Bild hinzufügen (PNG, JPEG, WebP)"
                        : "Bild ersetzen (PNG, JPEG, WebP)"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          try {
                            setBusy(true);
                            const image = await imageFromFile(f);
                            if (alive.current) update({ image });
                          } catch (e) {
                            if (alive.current) setError((e as Error).message);
                          } finally {
                            if (alive.current) setBusy(false);
                          }
                        }}
                      />
                    </label>
                    {ocrInfo[current.id] && (
                      <section
                        className="import-warning"
                        aria-label="OCR kontrollieren"
                      >
                        <div data-import-tool="text">
                          {" "}
                          <p>
                            OCR-Sicherheit:{" "}
                            {Math.round(ocrInfo[current.id].data.confidence)} %.
                            Keine Garantie für fachliche Richtigkeit. Zahlen,
                            Einheiten, Eigennamen und Quellen stets vergleichen.
                          </p>
                          {!current.text.trim() && !studio && (
                            <p role="alert">
                              Kein verwertbarer Text erkannt. Bitte schärfer
                              fotografieren, Bereich ändern oder Text manuell
                              eingeben.
                            </p>
                          )}
                          <p>
                            Unsichere Wörter (?):{" "}
                            {ocrWords(ocrInfo[current.id].data)
                              .filter((w) => w.confidence < 85)
                              .slice(0, 50)
                              .map((w) => w.text + " (?)")
                              .join(" · ") ||
                              "Keine niedrigen Wortwerte gemeldet; trotzdem am Original prüfen."}
                          </p>
                          <details>
                            <summary>Rohe OCR-Ausgabe vergleichen</summary>
                            <pre className="ocr-raw">
                              {ocrInfo[current.id].data.text}
                            </pre>
                          </details>
                        </div>{" "}
                        {studio && !current.text.trim() && (
                          <p role="alert">
                            Kein verwertbarer Text erkannt. Bitte den Kartentext
                            am Original ergänzen.
                          </p>
                        )}
                        {studio && (
                          <p className="small">
                            Zahlen, Einheiten, Quellen und Bilder am Original
                            kontrollieren.
                            {ocrWords(ocrInfo[current.id].data).some(
                              (w) => w.confidence < 85,
                            )
                              ? " Unsichere Wörter erkannt; Einzelheiten unter „Erkennung korrigieren → Texterkennung“."
                              : ""}
                          </p>
                        )}
                        <label>
                          <input
                            type="checkbox"
                            checked={ocrInfo[current.id].checked}
                            disabled={!current.text.trim()}
                            onChange={(e) => {
                              setOcrInfo({
                                ...ocrInfo,
                                [current.id]: {
                                  ...ocrInfo[current.id],
                                  checked: e.target.checked,
                                },
                              });
                              setReviewed(false);
                            }}
                          />{" "}
                          Diese OCR-Karte mit dem Original geprüft,
                          einschließlich Zahlen und Quellen.
                        </label>
                      </section>
                    )}
                    <div data-import-tool="media">
                      {" "}
                      {current.table ? (
                        <TableEditor
                          table={current.table}
                          onChange={(table) => {
                            if (table) update({ table });
                            else {
                              const next = { ...current };
                              delete next.table;
                              setCards(
                                cards.map((c, i) => (i === index ? next : c)),
                              );
                              setReviewed(false);
                            }
                          }}
                        />
                      ) : (
                        <button
                          onClick={() =>
                            update({
                              table: { headers: ["", ""], rows: [["", ""]] },
                            })
                          }
                        >
                          Tabelle hinzufügen
                        </button>
                      )}
                    </div>
                    <div data-import-tool="structure">
                      {" "}
                      <div className="actions">
                        <button onClick={split}>
                          Karte am Textcursor teilen
                        </button>
                        <button
                          disabled={index >= cards.length - 1}
                          onClick={merge}
                        >
                          Mit nächster Karte zusammenfügen
                        </button>
                        <button onClick={remove}>Importkarte entfernen</button>
                        <button
                          disabled={index === 0}
                          onClick={() => reorder(-1)}
                        >
                          Karte nach vorne
                        </button>
                        <button
                          disabled={index === cards.length - 1}
                          onClick={() => reorder(1)}
                        >
                          Karte nach hinten
                        </button>
                      </div>
                    </div>{" "}
                    <div className="actions" data-import-tool="text">
                      {result.pdfLayout?.regions.some(
                        (r) => r.cardId === current.id && r.page === page,
                      ) && (
                        <button
                          disabled={!ocrBase()}
                          onClick={() =>
                            void recognizeRegions(result.pdfLayout!, [
                              current.id,
                            ])
                          }
                        >
                          Diese Karte erneut per OCR erkennen
                        </button>
                      )}
                    </div>
                  </>
                )}
                <button
                  data-import-tool="structure"
                  disabled={cards.length >= 100}
                  onClick={() => addCard()}
                >
                  Importkarte hinzufügen
                </button>
              </section>
            </div>
            {studio && correction === "text" && (
              <section className="studio-import-source">
                <h4>Anderes Material auswählen</h4>
                <div className="actions">
                  <button onClick={() => fileInput.current?.click()}>
                    Andere Word- oder PDF-Datei
                  </button>
                  <button onClick={() => photoInput.current?.click()}>
                    Anderes Foto oder Scan
                  </button>
                  <button onClick={() => cameraInput.current?.click()}>
                    Foto aufnehmen
                  </button>
                </div>
              </section>
            )}
            <div className="actions">
              {studio && unchecked > 0 && (
                <p className="small">
                  Noch {unchecked} OCR-Karten einzeln am Original prüfen und
                  bestätigen.
                </p>
              )}
              <button
                disabled={busy || !selected.length || (studio && unchecked > 0)}
                className="primary"
                onClick={() => {
                  setStep(3);
                  setError("");
                }}
              >
                Weiter zur Übernahme
              </button>
            </div>
          </>
        )}
        {result && step === 3 && (
          <>
            <h3 hidden={studio}>3. Karten übernehmen</h3>
            <p>
              {studio
                ? `${selected.length} Karten können übernommen werden.`
                : `${selected.length} ausgewählte Karten. Bis jetzt wurde der Entwurf nicht verändert.`}
            </p>
            <label className="help-toggle import-target-choice">
              <input
                type="radio"
                name="import-target"
                checked={mode === "append"}
                onChange={() => setMode("append")}
              />
              Karten zu diesem Mystery hinzufügen
            </label>
            <label className="help-toggle import-target-choice">
              <input
                type="radio"
                name="import-target"
                checked={mode === "new"}
                onChange={() => setMode("new")}
              />
              Neues Mystery aus dem Dokument erstellen
            </label>
            {(studio || mode === "new" || !draft.content.title) && (
              <label>
                Mystery-Titel
                <input
                  aria-describedby="document-import-title-hint"
                  value={
                    studio && mode === "append" && draft.content.title
                      ? appendTitle
                      : title
                  }
                  onChange={(e) =>
                    studio && mode === "append" && draft.content.title
                      ? setAppendTitle(e.target.value)
                      : setTitle(e.target.value)
                  }
                />
              </label>
            )}
            {(mode === "new" || !draft.content.title) && (
              <p id="document-import-title-hint" className="small">
                Vorschlag aus dem Dateinamen; bitte prüfen.
              </p>
            )}
            {instruction && (
              <label>
                Aufgabenstellung
                <textarea
                  aria-label="Aufgabenstellung"
                  rows={6}
                  value={instruction.text}
                  onChange={(event) => {
                    setInstruction({
                      ...instruction,
                      text: event.target.value,
                    });
                    setReviewed(false);
                  }}
                />
              </label>
            )}
            {!studio && mode === "new" && (
              <>
                <p>
                  Der bisherige Entwurf wird erst nach einer zusätzlichen
                  Bestätigung ersetzt. Sichert ihn vorher, wenn ihr ihn behalten
                  möchtet.
                </p>
              </>
            )}
            <label className="help-toggle">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              Ich habe Texte, Grenzen, Bilder, Tabellen und
              Pflicht-/Vertiefungskarten mit dem Original geprüft.
            </label>
            <p hidden={studio}>
              Übernehmen ändert nur den geöffneten Entwurf. Danach „Entwurf
              sichern“ bewusst herunterladen und „Schülerversion erstellen“ für
              die Klasse verwenden.
            </p>
            <div className="actions">
              <button disabled={busy} onClick={() => setStep(2)}>
                Zurück zu den Karten
              </button>
              <button
                disabled={busy || !reviewed || (studio && unchecked > 0)}
                className="primary"
                onClick={() => void apply()}
              >
                {studio ? "Karten übernehmen" : "Geprüfte Karten übernehmen"}
              </button>
            </div>
          </>
        )}
      </fieldset>
    </section>
  );
}
