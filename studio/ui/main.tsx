import React from "react";
import { createRoot } from "react-dom/client";
import { StudioApp } from "./StudioApp";
import "../../src/style.css";
import "./studio.css";
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <main className="welcome">
        <h1>MysteryBoard Studio</h1>
        <p role="alert">{this.state.error}</p>
        <p>
          Bitte die App schließen und das zuletzt gespeicherte Projekt erneut
          öffnen.
        </p>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <StudioApp />
  </Boundary>,
);
