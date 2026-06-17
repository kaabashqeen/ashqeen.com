const analytics = window.YGOPLUS_ANALYTICS;
const year = document.querySelector("#year");
const statPrompts = document.querySelector("#analytics-stat-prompts");
const statHour = document.querySelector("#analytics-stat-hour");
const statDay = document.querySelector("#analytics-stat-day");
const statStreak = document.querySelector("#analytics-stat-streak");
const statCodePrompts = document.querySelector("#analytics-stat-code-prompts");
const statFiles = document.querySelector("#analytics-stat-files");
const hourBars = document.querySelector("#hour-bars");
const weekdayBars = document.querySelector("#weekday-bars");
const sourceBars = document.querySelector("#source-bars");
const monthBars = document.querySelector("#month-bars");
const categoryBars = document.querySelector("#category-bars");
const purposeProfile = document.querySelector("#purpose-profile");
const purposeImplementation = document.querySelector("#purpose-implementation");
const implementationSourceBars = document.querySelector("#implementation-source-bars");
const implementationCategoryBars = document.querySelector("#implementation-category-bars");
const codeChangeNote = document.querySelector("#code-change-note");
const metadataSummary = document.querySelector("#metadata-summary");
const metadataNote = document.querySelector("#metadata-note");
const personalityName = document.querySelector("#personality-name");
const personalitySummary = document.querySelector("#personality-summary");
const personalityNote = document.querySelector("#personality-note");
const traitBars = document.querySelector("#trait-bars");
const streakList = document.querySelector("#streak-list");

const categoryLabels = {
  business: "Business",
  infrastructure: "Infrastructure",
  interface: "Interface",
  process: "Process",
  product: "Product",
};

if (year) {
  year.textContent = new Date().getFullYear();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatPercent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function maxCount(rows) {
  return Math.max(1, ...rows.map((row) => row.count || row.score || 0));
}

function renderBars(container, rows, options = {}) {
  if (!container) return;

  const max = options.max || maxCount(rows);
  container.innerHTML = rows
    .map((row) => {
      const value = row.count ?? row.score ?? 0;
      const width = value ? Math.max(3, Math.round((value / max) * 100)) : 0;
      const valueLabel = options.percent ? `${value}%` : formatNumber(value);
      return `
        <div class="bar-row">
          <div class="bar-copy">
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(valueLabel)}</strong>
          </div>
          <div class="bar-track" aria-hidden="true">
            <span class="bar-fill" style="--value: ${width}%"></span>
          </div>
          ${row.detail ? `<p>${escapeHtml(row.detail)}</p>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderStats() {
  const stats = analytics?.stats;
  if (!stats) return;

  setText(statPrompts, formatNumber(stats.prompts));
  setText(statHour, `${stats.busiestHour?.label || "-"} (${formatNumber(stats.busiestHour?.count)})`);
  setText(statDay, `${stats.busiestDay?.label || "-"} (${formatNumber(stats.busiestDay?.count)})`);
  setText(statStreak, stats.longestStreak?.durationLabel || "-");
  setText(statCodePrompts, formatNumber(stats.codeChangingPrompts));
  setText(statFiles, formatNumber(analytics?.codeChanges?.implementationBySource?.length || 0));
}

function renderPurpose() {
  const profile = analytics?.personality;
  const code = analytics?.codeChanges;
  const stats = analytics?.stats;
  if (!profile || !code || !stats) return;

  setText(purposeProfile, profile.name);
  setText(
    purposeImplementation,
    `${formatNumber(code.implementationPromptCount)} prompts · ${formatPercent(code.implementationShare)} of the cleaned trail`,
  );
}

function renderActivity() {
  if (!analytics) return;

  renderBars(hourBars, analytics.hourly || []);
  renderBars(weekdayBars, analytics.weekdays || []);
  renderBars(sourceBars, analytics.sources || []);
  renderBars(monthBars, analytics.months || []);
  renderBars(
    categoryBars,
    (analytics.categories || []).map((category) => ({
      ...category,
      label: categoryLabels[category.label] || category.label,
    })),
  );
}

function renderCodeChanges() {
  const code = analytics?.codeChanges;
  if (!code) return;

  setText(codeChangeNote, "Implementation prompts include every assistant surface in the cleaned trail.");
  renderBars(
    implementationSourceBars,
    (code.implementationBySource || []).map((source) => ({
      ...source,
      detail: `${formatNumber(source.count)} implementation ${source.count === 1 ? "prompt" : "prompts"}`,
    })),
  );
  renderBars(
    implementationCategoryBars,
    (code.implementationByCategory || []).map((category) => ({
      ...category,
      label: categoryLabels[category.label] || category.label,
      detail: `${formatNumber(category.count)} implementation ${category.count === 1 ? "prompt" : "prompts"}`,
    })),
  );
  setText(metadataSummary, `${formatNumber(code.metadataBackedPromptCount)} prompts include exact edited-file metadata.`);
  setText(
    metadataNote,
    `Those metadata-backed entries total ${formatNumber(code.totalFilesChanged)} tracked file changes. The chart above uses all-source implementation prompts so Codex, Claude, ChatGPT, and Copilot are all represented.`,
  );
}

function renderPersonality() {
  const profile = analytics?.personality;
  if (!profile) return;

  setText(personalityName, profile.name);
  setText(personalitySummary, profile.summary);
  setText(personalityNote, profile.note);
  renderBars(traitBars, profile.traits || [], { percent: true, max: 100 });
}

function renderStreaks() {
  if (!streakList || !analytics?.streaks) return;

  streakList.innerHTML = analytics.streaks
    .map((streak, index) => {
      const category = categoryLabels[streak.category] || streak.category || "Product";
      return `
        <article class="streak-entry">
          <div class="streak-rank">#${String(index + 1).padStart(2, "0")}</div>
          <div>
            <h3>${escapeHtml(streak.durationLabel)}</h3>
            <p>${escapeHtml(streak.startLabel)} to ${escapeHtml(streak.endLabel)}</p>
          </div>
          <div class="streak-meta">
            <span>${formatNumber(streak.prompts)} ${streak.prompts === 1 ? "prompt" : "prompts"}</span>
            <span>${escapeHtml(streak.sourceLabel)}</span>
            <span>${escapeHtml(category)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

renderStats();
renderPurpose();
renderActivity();
renderCodeChanges();
renderPersonality();
renderStreaks();
