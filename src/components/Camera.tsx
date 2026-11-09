import { useEffect, useRef, useState } from "react";
import { scanPixels } from "../core/qr";
export function Camera({
  onScan,
  onChoose,
}: {
  onScan: (text: string) => boolean;
  onChoose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    [message, setMessage] = useState("Die Kamera wird geöffnet …"),
    [active, setActive] = useState(false),
    [retry, setRetry] = useState(0);
  const callback = useRef(onScan);
  callback.current = onScan;
  useEffect(() => {
    let stopped = false,
      stream: MediaStream | undefined,
      raf = 0,
      last = 0;
    const canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const stop = () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    const tick = (time: number) => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2 && time - last > 180) {
        last = time;
        canvas.width = 640;
        canvas.height = Math.max(
          1,
          Math.round((v.videoHeight / v.videoWidth) * 640),
        );
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const code = scanPixels(
          ctx.getImageData(0, 0, canvas.width, canvas.height),
        );
        if (code) {
          stop();
          setActive(false);
          if (callback.current(code.data)) {
            stopped = true;
            return;
          }
          setMessage(
            "Der Code konnte nicht übernommen werden. Versuche es erneut oder wähle die Originaldatei.",
          );
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error();
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
          },
          audio: false,
        });
        if (stopped) {
          stop();
          return;
        }
        video.current!.srcObject = stream;
        await video.current!.play();
        if (stopped) {
          stop();
          return;
        }
        setActive(true);
        setMessage("Halte den vollständigen Code ruhig in die Kamera.");
        raf = requestAnimationFrame(tick);
      } catch {
        if (!stopped) {
          setActive(false);
          setMessage(
            "Die Kamera ist hier nicht verfügbar oder wurde nicht freigegeben. Du kannst stattdessen das Sicherungsbild auswählen.",
          );
        }
        stop();
      }
    }
    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stop();
    };
  }, [retry]);
  return (
    <>
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        className="camera"
        hidden={!active}
      />
      <p role="status">{message}</p>
      <div className="actions">
        <button onClick={onChoose}>Sicherungsbild auswählen</button>
        {!active && (
          <button onClick={() => setRetry((v) => v + 1)}>
            Kamera erneut versuchen
          </button>
        )}
      </div>
    </>
  );
}
