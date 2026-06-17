// Theme toggle — persists user preference, respects OS by default.
(function () {
  var root = document.documentElement;
  var STORAGE_KEY = "theme";

  function currentTheme() {
    var explicit = root.getAttribute("data-theme");
    if (explicit === "light" || explicit === "dark") return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(next) {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
  }

  document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
    button.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  });

  // Fill year placeholders shared across pages
  var yearEl = document.querySelector("#year");
  if (yearEl && !yearEl.textContent.trim()) {
    yearEl.textContent = new Date().getFullYear();
  }
})();
