import { useState } from "react";
export function CopyIssues({ message }: { message: string }) {
  const [result, setResult] = useState<"copied" | "manual">();
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            if (window.mysteryStudio?.copyIssues)
              await window.mysteryStudio.copyIssues(message);
            else await navigator.clipboard.writeText(message);
            setResult("copied");
          } catch {
            setResult("manual");
          }
        }}
      >
        Fehlerhinweise kopieren
      </button>
      {result === "copied" && <span role="status"> Hinweise kopiert.</span>}
      {result === "manual" && (
        <label>
          Hinweise zum manuellen Kopieren
          <textarea
            readOnly
            value={message}
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
    </>
  );
}
