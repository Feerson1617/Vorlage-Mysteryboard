// SCORM 1.2 lifecycle only. No reads/writes of learner, progress or work data.
// The app itself is byte-identical to the standalone HTML and knows no API.
(() => {
  function find(start) {
    let current = start;
    for (let depth = 0; current && depth < 20; depth++) {
      try {
        if (current.API && typeof current.API.LMSInitialize === "function")
          return current.API;
        if (current.parent === current) break;
        current = current.parent;
      } catch {
        // A cross-origin LMS must provide its own accessible SCORM adapter.
        break;
      }
    }
    return null;
  }
  let api = find(window);
  if (!api) {
    try {
      api = find(window.opener);
    } catch {
      /* Offline launch still works. */
    }
  }
  let active = false;
  try {
    active = api?.LMSInitialize("") === "true";
  } catch {
    /* No app reset. */
  }
  window.addEventListener("pagehide", (event) => {
    // A bfcache visit is not an ended session. Never finish on a canceled exit.
    if (!active || event.persisted) return;
    active = false;
    try {
      api.LMSFinish("");
    } catch {
      /* No work data leaves this wrapper. */
    }
  });
})();
