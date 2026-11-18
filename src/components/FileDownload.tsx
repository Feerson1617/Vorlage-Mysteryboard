import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";

export function FileDownload({
  file,
  onClose,
}: {
  file: File;
  onClose: () => void;
}) {
  const [url] = useState(() => {
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  });
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <Dialog title="Datei sichern" onClose={onClose}>
      <p>
        Die Datei ist vorbereitet. Legt sie bewusst in „Dateien“ ab. Die
        Anwendung kann nicht prüfen, ob sie dort dauerhaft gespeichert wurde.
      </p>
      {url ? (
        <a className="button primary full" href={url} download={file.name}>
          Datei herunterladen
        </a>
      ) : (
        <p role="alert">
          Der Download konnte nicht vorbereitet werden. Schließt diesen Dialog
          und versucht es erneut. Der geöffnete Stand bleibt erhalten.
        </p>
      )}
      {navigator.canShare?.({ files: [file] }) && (
        <button
          className="full"
          onClick={async () => {
            try {
              await navigator.share({ files: [file] });
            } catch (e) {
              if ((e as Error).name !== "AbortError")
                setError(
                  "Teilen ist nicht verfügbar. Bitte die Datei herunterladen.",
                );
            }
          }}
        >
          Datei teilen oder ablegen
        </button>
      )}
      <p>
        {file.name} · {(file.size / 1000000).toFixed(2)} MB
      </p>
      {error && <p role="alert">{error}</p>}
    </Dialog>
  );
}
