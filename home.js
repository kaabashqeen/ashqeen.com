const homeAnalytics = window.YGOPLUS_ANALYTICS;

const homeStatPrompts = document.querySelector("#home-stat-prompts");
const homeStatCodePrompts = document.querySelector("#home-stat-code-prompts");
const homeStatFiles = document.querySelector("#home-stat-files");
const homeStatStreak = document.querySelector("#home-stat-streak");

function homeNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function setHomeText(element, value) {
  if (element) element.textContent = value;
}

function renderHomeAnalytics() {
  const stats = homeAnalytics?.stats;
  if (!stats) return;

  setHomeText(homeStatPrompts, homeNumber(stats.prompts));
  setHomeText(homeStatCodePrompts, homeNumber(stats.codeChangingPrompts));
  setHomeText(homeStatFiles, homeNumber(stats.filesChanged));
  setHomeText(homeStatStreak, stats.longestStreak?.durationLabel || "-");
}

renderHomeAnalytics();
