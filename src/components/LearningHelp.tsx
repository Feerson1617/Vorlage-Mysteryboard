import { useEffect, useRef } from "react";
import { cardNumber, type Mystery } from "../core/model";
import { DEFAULT_METHOD_HELP } from "../core/help";

export function LearningHelp({
  mystery,
  active,
  onToggle,
  onClose,
}: {
  mystery: Mystery;
  active: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null),
    orientationHeading = useRef<HTMLHeadingElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    heading.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (active) orientationHeading.current?.focus();
  }, [active]);
  return (
    <section
      className="learning-help"
      role="dialog"
      aria-label="Hilfe"
      aria-modal="false"
    >
      <div className="help-head">
        <h2 ref={heading} tabIndex={-1}>
          Hilfe
        </h2>
        <button
          className="icon-button"
          aria-label="Hilfe schließen"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="help-body">
        {!active && (
          <>
            <h3>1. Denkimpuls</h3>
            <p>{mystery.help?.method ?? DEFAULT_METHOD_HELP}</p>
          </>
        )}
        {mystery.help?.categories && (
          <>
            {active && (
              <div id="orientation-legend">
                <h3 ref={orientationHeading} tabIndex={-1}>
                  2. Nummernorientierung
                </h3>
                <ul className="help-legend">
                  {mystery.help.categories.map((category) => (
                    <li key={category.id}>
                      <span
                        className="help-swatch"
                        style={{ backgroundColor: category.color }}
                        aria-hidden="true"
                      />
                      <span>
                        <strong>{category.label}</strong>
                        <br />
                        Karten{" "}
                        {category.cardIds
                          .slice()
                          .sort((a, b) => a - b)
                          .map((id) => cardNumber(mystery, id))
                          .join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="small">
                  Keine Reihenfolge oder fertige Erklärung. Auch unmarkierte
                  Karten können wichtig sein.
                </p>
              </div>
            )}
          </>
        )}
      </div>
      {mystery.help?.categories && (
        <div className="help-footer">
          <button
            aria-expanded={active}
            aria-controls="orientation-legend"
            onClick={onToggle}
          >
            {active ? "Orientierung ausblenden" : "Weitere Hilfe anzeigen"}
          </button>
        </div>
      )}
    </section>
  );
}
