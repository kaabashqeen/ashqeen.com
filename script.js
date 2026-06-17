const data = window.YGOPLUS_BUILD_TRAIL;
const year = document.querySelector("#year");
const statActions = document.querySelector("#stat-actions");
const statSessions = document.querySelector("#stat-sessions");
const statFirst = document.querySelector("#stat-first");
const statLast = document.querySelector("#stat-last");
const monthList = document.querySelector("#month-list");
const trailList = document.querySelector("#trail-list");
const resultCount = document.querySelector("#result-count");
const searchInput = document.querySelector("#trail-search");
const tabs = Array.from(document.querySelectorAll("[data-filter]"));
const loadMore = document.querySelector("#load-more");
const sortToggle = document.querySelector("#sort-toggle");

const pageSize = 80;
let activeFilter = "all";
let visibleLimit = pageSize;
let searchTerm = "";
let sortDirection = "newest";

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
  return new Intl.NumberFormat("en-US").format(value);
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function promptNoun(count) {
  return count === 1 ? "prompt" : "prompts";
}

function searchableText(action) {
  return [
    action.title,
    action.prompt,
    action.sessionTitle,
    categoryLabels[action.category],
    action.source,
  ]
    .join(" ")
    .toLowerCase();
}

function filteredActions() {
  if (!data?.actions) return [];

  const matches = data.actions.filter((action) => {
    const matchesFilter = activeFilter === "all" || action.category === activeFilter;
    const matchesSearch = !searchTerm || searchableText(action).includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  return matches.sort((a, b) => {
    return sortDirection === "newest" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
  });
}

function renderStats() {
  if (!data?.stats) return;

  setText(statActions, formatNumber(data.stats.actions));
  setText(statSessions, formatNumber(data.stats.sessions));
  setText(statFirst, data.stats.firstPromptLabel.replace(/, \d{1,2}:\d{2}.*/, ""));
  setText(statLast, data.stats.lastPromptLabel.replace(/, \d{1,2}:\d{2}.*/, ""));
}

function renderMonths() {
  if (!monthList || !data?.months) return;

  monthList.innerHTML = data.months
    .map((month) => {
      return `
        <article class="month-card">
          <strong>${escapeHtml(month.label)}</strong>
          <span>${formatNumber(month.actionCount)} ${promptNoun(month.actionCount)}</span>
          <span>${formatNumber(month.sessionCount)} ${month.sessionCount === 1 ? "session" : "sessions"}</span>
          <span>${escapeHtml(month.topCategoryLabel)} led the month</span>
        </article>
      `;
    })
    .join("");
}

function renderTrail() {
  if (!trailList) return;

  const actions = filteredActions();
  const shown = actions.slice(0, visibleLimit);

  trailList.innerHTML = shown
    .map((action) => {
      const categoryLabel = categoryLabels[action.category] || "Process";
      const summary = `Prompted ${action.source} about: ${action.prompt.replace(/\.$/, "")}.`;
      const fileText = action.editedFileCount
        ? `<span class="entry-files">${action.editedFileCount} ${action.editedFileCount === 1 ? "file" : "files"} changed</span>`
        : "";
      const modelText = action.model ? `<span>${escapeHtml(action.model)}</span>` : "";

      return `
        <article class="trail-entry">
          <div class="entry-number">#${String(action.number).padStart(4, "0")}</div>
          <div class="entry-body">
            <h3>${escapeHtml(action.title)}</h3>
            <p>${escapeHtml(summary)}</p>
            <div class="entry-prompt">${escapeHtml(action.prompt)}</div>
          </div>
          <div class="entry-meta">
            <span class="entry-pill">${escapeHtml(categoryLabel)}</span>
            <time datetime="${escapeHtml(action.isoDate)}">${escapeHtml(action.timeLabel)}</time>
            <span>${escapeHtml(action.source)}</span>
            <span>${escapeHtml(action.sessionTitle)}</span>
            <span>Step ${action.actionInSession} of ${action.sessionPromptCount}</span>
            ${modelText}
            ${fileText}
          </div>
        </article>
      `;
    })
    .join("");

  setText(
    resultCount,
    `${formatNumber(actions.length)} ${promptNoun(actions.length)} shown ${sortDirection} first`,
  );

  if (loadMore) {
    loadMore.hidden = visibleLimit >= actions.length;
    loadMore.textContent = `Load more (${formatNumber(Math.max(actions.length - visibleLimit, 0))} left)`;
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeFilter = tab.dataset.filter || "all";
    visibleLimit = pageSize;

    tabs.forEach((button) => {
      const isActive = button === tab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    renderTrail();
  });
});

searchInput?.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  visibleLimit = pageSize;
  renderTrail();
});

loadMore?.addEventListener("click", () => {
  visibleLimit += pageSize;
  renderTrail();
});

sortToggle?.addEventListener("click", () => {
  sortDirection = sortDirection === "newest" ? "oldest" : "newest";
  visibleLimit = pageSize;
  sortToggle.textContent = sortDirection === "newest" ? "Newest first" : "Oldest first";
  sortToggle.setAttribute("aria-pressed", String(sortDirection === "newest"));
  renderTrail();
});

renderStats();
renderMonths();
renderTrail();
