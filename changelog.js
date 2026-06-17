const changelog = window.YGOPLUS_CHANGELOG;
const year = document.querySelector("#year");
const statEntries = document.querySelector("#change-stat-entries");
const statPrompts = document.querySelector("#change-stat-prompts");
const statLatest = document.querySelector("#change-stat-latest");
const statFixes = document.querySelector("#change-stat-fixes");
const changeSearch = document.querySelector("#change-search");
const changeTabs = Array.from(document.querySelectorAll("[data-change-filter]"));
const changeSortToggle = document.querySelector("#change-sort-toggle");
const changeResultCount = document.querySelector("#change-result-count");
const changeList = document.querySelector("#changelog-list");
const changeLoadMore = document.querySelector("#change-load-more");

const changePageSize = 40;
let changeFilter = "all";
let changeSearchTerm = "";
let changeSortDirection = "newest";
let changeVisibleLimit = changePageSize;

if (year) {
  year.textContent = new Date().getFullYear();
}

function numberFormat(value) {
  return new Intl.NumberFormat("en-US").format(value);
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

function updateNoun(count) {
  return count === 1 ? "update" : "updates";
}

function searchableChange(entry) {
  return [
    entry.title,
    entry.summary,
    entry.context,
    entry.area,
    entry.source,
    entry.typeLabel,
    ...(entry.highlights || []),
  ]
    .join(" ")
    .toLowerCase();
}

function filteredChanges() {
  if (!changelog?.entries) return [];

  const matches = changelog.entries.filter((entry) => {
    const matchesFilter = changeFilter === "all" || entry.type === changeFilter;
    const matchesSearch = !changeSearchTerm || searchableChange(entry).includes(changeSearchTerm);
    return matchesFilter && matchesSearch;
  });

  return matches.sort((a, b) => {
    return changeSortDirection === "newest" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
  });
}

function renderChangeStats() {
  if (!changelog?.stats) return;

  setText(statEntries, numberFormat(changelog.stats.entries));
  setText(statPrompts, numberFormat(changelog.stats.prompts));
  setText(statLatest, changelog.stats.latestLabel || "-");
  setText(statFixes, numberFormat(changelog.stats.typeCounts?.fix || 0));
}

function renderChangelog() {
  if (!changeList) return;

  const entries = filteredChanges();
  const shown = entries.slice(0, changeVisibleLimit);

  changeList.innerHTML = shown
    .map((entry) => {
      const highlights = (entry.highlights || [])
        .map((highlight) => `<li>${escapeHtml(highlight)}</li>`)
        .join("");
      const context = entry.context ? `<p class="change-context">${escapeHtml(entry.context)}</p>` : "";

      return `
        <article class="change-entry">
          <div class="change-date">
            <time datetime="${escapeHtml(entry.isoDate)}">${escapeHtml(entry.dateLabel)}</time>
            <span>${escapeHtml(entry.source)}</span>
          </div>
          <div class="change-body">
            <div class="change-kicker">
              <span>${escapeHtml(entry.typeLabel)}</span>
              <span>${escapeHtml(entry.area)}</span>
            </div>
            <h3>${escapeHtml(entry.title)}</h3>
            <p>${escapeHtml(entry.summary)}</p>
            ${context}
            <ul>${highlights}</ul>
          </div>
          <div class="change-meta">
            <span>${numberFormat(entry.promptCount)} ${entry.promptCount === 1 ? "prompt" : "prompts"}</span>
            <span>${escapeHtml(entry.monthLabel)}</span>
          </div>
        </article>
      `;
    })
    .join("");

  setText(
    changeResultCount,
    `${numberFormat(entries.length)} ${updateNoun(entries.length)} shown ${changeSortDirection} first`,
  );

  if (changeLoadMore) {
    changeLoadMore.hidden = changeVisibleLimit >= entries.length;
    changeLoadMore.textContent = `Load more (${numberFormat(Math.max(entries.length - changeVisibleLimit, 0))} left)`;
  }
}

changeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    changeFilter = tab.dataset.changeFilter || "all";
    changeVisibleLimit = changePageSize;

    changeTabs.forEach((button) => {
      const isActive = button === tab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    renderChangelog();
  });
});

changeSearch?.addEventListener("input", (event) => {
  changeSearchTerm = event.target.value.trim().toLowerCase();
  changeVisibleLimit = changePageSize;
  renderChangelog();
});

changeSortToggle?.addEventListener("click", () => {
  changeSortDirection = changeSortDirection === "newest" ? "oldest" : "newest";
  changeVisibleLimit = changePageSize;
  changeSortToggle.textContent = changeSortDirection === "newest" ? "Newest first" : "Oldest first";
  changeSortToggle.setAttribute("aria-pressed", String(changeSortDirection === "newest"));
  renderChangelog();
});

changeLoadMore?.addEventListener("click", () => {
  changeVisibleLimit += changePageSize;
  renderChangelog();
});

renderChangeStats();
renderChangelog();
