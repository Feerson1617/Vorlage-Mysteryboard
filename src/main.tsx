import React from "react";
import { createRoot } from "react-dom/client";
import dataset from "@mystery";
import { validateMystery } from "./core/model";
import { UniversalApp } from "./UniversalApp";
import { readDocument } from "./core/documents";
import "./style.css";
import { captureRuntimeShell } from "./core/classroom-scorm";
import { readLaunch } from "./core/launch-document";
captureRuntimeShell();
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="welcome">
        <h1>Die Anwendung konnte nicht geöffnet werden.</h1>
        <p>Öffne die unveränderte MysteryBoard-HTML-Datei erneut.</p>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Start() {
  const launch = readLaunch();
  return (
    <UniversalApp
      classroom={launch?.classroom ?? false}
      initialDocument={
        launch?.task ??
        (__INITIAL_DOCUMENT__
          ? readDocument(
              Uint8Array.from(atob(__INITIAL_DOCUMENT__), (c) =>
                c.charCodeAt(0),
              ),
            )
          : null)
      }
      builtIn={__UNIVERSAL__ ? undefined : validateMystery(dataset)}
    />
  );
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Start />
  </ErrorBoundary>,
);
