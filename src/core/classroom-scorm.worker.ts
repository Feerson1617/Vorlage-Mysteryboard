import { scormEntries, zipScorm } from "./scorm-package";
import launch from "../../scorm/launch.html?raw";
import session from "../../scorm/session.js?raw";
self.onmessage = (
  event: MessageEvent<{ html: string; id: string; title: string }>,
) => {
  try {
    const { html, id, title } = event.data;
    const zip = zipScorm(
      scormEntries(new TextEncoder().encode(html), launch, session, id, title),
    );
    self.postMessage({ zip }, { transfer: [zip.buffer] });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
