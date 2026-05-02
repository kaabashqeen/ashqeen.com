const year = document.querySelector("#year");
const grid = document.querySelector("#article-grid");
const cards = Array.from(document.querySelectorAll(".research-card"));
const tabs = Array.from(document.querySelectorAll("[data-filter]"));
const sortToggle = document.querySelector("#sort-toggle");
const mediaToggle = document.querySelector("#media-toggle");
const resultCount = document.querySelector("#result-count");

let activeFilter = "all";
let sortDirection = "newest";

if (year) {
  year.textContent = new Date().getFullYear();
}

function visibleCards() {
  return cards.filter((card) => {
    return activeFilter === "all" || card.dataset.category === activeFilter;
  });
}

function updateCount(total) {
  if (!resultCount) {
    return;
  }

  resultCount.textContent = `${total} ${total === 1 ? "entry" : "entries"}`;
}

function renderCards() {
  const sortedCards = [...cards].sort((a, b) => {
    const first = new Date(a.dataset.date);
    const second = new Date(b.dataset.date);

    return sortDirection === "newest" ? second - first : first - second;
  });

  sortedCards.forEach((card) => grid?.append(card));

  const shownCards = visibleCards();
  cards.forEach((card) => {
    card.hidden = !shownCards.includes(card);
  });

  updateCount(shownCards.length);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeFilter = tab.dataset.filter;

    tabs.forEach((button) => {
      const isActive = button === tab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    renderCards();
  });
});

sortToggle?.addEventListener("click", () => {
  sortDirection = sortDirection === "newest" ? "oldest" : "newest";
  sortToggle.textContent = sortDirection === "newest" ? "Sort newest" : "Sort oldest";
  sortToggle.setAttribute("aria-pressed", String(sortDirection === "oldest"));
  renderCards();
});

mediaToggle?.addEventListener("click", () => {
  const isHidden = document.body.classList.toggle("media-hidden");

  mediaToggle.textContent = isHidden ? "Show media" : "Hide media";
  mediaToggle.setAttribute("aria-pressed", String(!isHidden));
});

renderCards();
