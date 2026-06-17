(function () {
  const localHosts = new Set(["", "localhost", "127.0.0.1", "0.0.0.0", "::1"]);
  const isLocal = localHosts.has(window.location.hostname);

  if (!isLocal) return;

  const prodArchive = document.querySelector("#prod-archive");
  const localArchive = document.querySelector("#local-archive");

  if (prodArchive) prodArchive.hidden = true;
  if (localArchive) localArchive.hidden = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  loadScript(`assets/build-trail-data.js?v=local-${Date.now()}`)
    .then(() => loadScript("script.js"))
    .catch(() => {
      const resultCount = document.querySelector("#result-count");
      if (resultCount) {
        resultCount.textContent = "Local build trail data was not found.";
      }
    });
})();
