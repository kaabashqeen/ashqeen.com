#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const inputPath = path.resolve(process.argv[2] || "assets/build-trail-data.js");
const outputPath = path.resolve(process.argv[3] || "assets/changelog-data.js");

// Dates (in "Mon DD, YYYY" format) to exclude from the public changelog entirely
const EXCLUDED_DATE_LABELS = new Set([
  "Jun 16, 2026",
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function loadTrailData(filePath) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), context);
  return context.window.YGOPLUS_BUILD_TRAIL;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compact(value, max = 150) {
  const text = clean(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}

function digestSignal(action) {
  return clean([action.title, action.sessionTitle, action.prompt, action.result].filter(Boolean).join(" "))
    .replace(/Traceback[\s\S]*/gi, " ")
    .replace(/\bFile\s+"[^"]+",\s+line\s+\d+[^"]*/gi, " ")
    .replace(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[^\s"]+/gi, " ")
    .replace(/\b\d{3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, " ")
    .replace(/\[redacted (?:config|secret|database url|local endpoint|email|token|api key|number|phone|embedded data|private ip|stack trace|stack frame|dev\/server log|auth header|access key|webhook secret|stripe id|code|deck code|external URL)\]/gi, " ")
    .replace(/\(base\)|\(\.venv\)|zsh:|command not found|sqlalchemy\.exc\.[A-Za-z]+|jinja2\.exceptions\.[A-Za-z]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function monthKey(timestamp) {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function monthLabel(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function changeType(text) {
  const value = text.toLowerCase();
  if (/fix|bug|issue|error|not working|broken|incorrect|lost|cutoff|overflow|duplicate|regression|doesnt|get updated|missing (?:from|on|in|after|when)/.test(value)) {
    return "fix";
  }
  if (/can we design|design .*page|tier list maker|add|create|new|implement|build|launch|setup|integrate|option|feature|page|flow/.test(value)) {
    return "feature";
  }
  if (/style|design|layout|mobile|spacing|theme|homepage|showcase|font|image|visual|polish|modern/.test(value)) {
    return "improvement";
  }
  if (/deploy|database|postgres|stripe|subscription|email|ses|render|cache|api|route|server|env/.test(value)) {
    return "ops";
  }
  return "update";
}

function areaLabel(text, category) {
  const value = text.toLowerCase();
  const areas = [
    [/\/hands|hand stat|starting hand|opening hand|brick|starter|handtrap|conditional|ideal hand|probability calculator|monte ?carlo|hypergeometric/, "Hand statistics"],
    [/visual deck|deck editor|deck builder|deck view|deck list|deck import|ydke|deck name|deck search/, "Deck tools"],
    [/board editor|endboard|board view|board card|visual builder|board search/, "Board tools"],
    [/showcase|homepage|home page|landing|hero/, "Showcase pages"],
    [/tier list|creator/, "Creator tools"],
    [/card image|card search|card data|tcgplayer|price|card database|genesys/, "Card data"],
    [/stripe|subscription|membership|pricing|paid|tier/, "Memberships"],
    [/email|verification|password|username|account|login|registration/, "Accounts"],
    [/database|postgres|sqlite|migration|db|model/, "Data layer"],
    [/deploy|render|production|server|cache|r2|static/, "Infrastructure"],
    [/mobile|spacing|layout|css|theme|modal|popup|overflow|image/, "Interface"],
  ];

  for (const [pattern, label] of areas) {
    if (pattern.test(value)) return label;
  }

  return {
    business: "Business",
    infrastructure: "Infrastructure",
    interface: "Interface",
    process: "Process",
    product: "Product",
  }[category] || "Product";
}

function verbFor(type) {
  return {
    feature: "Added",
    fix: "Fixed",
    improvement: "Improved",
    ops: "Hardened",
    update: "Updated",
  }[type] || "Updated";
}

function themePhrase(text, area, type) {
  const value = text.toLowerCase();
  const phrases = [
    [/external card database|cardinfo|fname|card image|image_url|card_images/, "card data ingestion"],
    [/ydke|deck import|deck file|deck parser|deck text|deck input/, "deck import and parsing"],
    [/ideal hand|starter|brick|handtrap|opening hand|starting hand/, "opening-hand probability rules"],
    [/monte ?carlo|simulation|samples|confidence|accuracy|hypergeometric/, "hand simulation accuracy"],
    [/visual deck|deck editor|deck builder/, "deck editor workflows"],
    [/board editor|endboard|board search|starting hand filter|opponent filter/, "board editor workflows"],
    [/pricing|membership|plus|pro|free tier|access levels?|subscription/, "membership tier design"],
    [/name.*updated|update.*name/, "name updates and saved state"],
    [/conditional|brick|starter/, "conditional card logic"],
    [/hand stat|starting hand/, "hand statistics calculations"],
    [/lost|persist|save|saved/, "saved data persistence"],
    [/spacing|whitespace|align|sizing|cutoff|overflow/, "layout spacing and sizing"],
    [/mobile/, "mobile presentation"],
    [/showcase|homepage|hero/, "the public showcase flow"],
    [/tier list/, "creator tier-list workflows"],
    [/stripe|subscription|membership|pricing/, "membership and billing flows"],
    [/email|verification|password|username|account/, "account communication flows"],
    [/database|postgres|sqlite|migration|model/, "data model and storage behavior"],
    [/card image|tcgplayer|price|card data|genesys/, "card data and pricing behavior"],
    [/search|filter/, "search and filtering"],
    [/deploy|production|render|cache|r2/, "production deployment behavior"],
    [/endpoint|route|api/, "routing and API behavior"],
  ];

  for (const [pattern, phrase] of phrases) {
    if (pattern.test(value)) return phrase;
  }

  return `${area.toLowerCase()} work`;
}

function contextDetail(text, area) {
  const value = text.toLowerCase();
  const details = [
    [/external card database|cardinfo|fname/, "External card-data lookup, card-name normalization, and cached card metadata."],
    [/card image|image_url|card_images/, "Card image loading and cached image data for sample hands and deck displays."],
    [/ydke|deck import|deck file|deck parser|deck text|deck input/, "Deck import/parsing from pasted lists, YDKE links, and saved deck text."],
    [/starter|brick|handtrap|ideal hand|opening hand|starting hand/, "Starter, brick, and handtrap conditions used by the hand probability tools."],
    [/probability tree|hypergeometric|monte ?carlo|simulation|samples|confidence/, "Exact and simulated probability calculations for YGO opening-hand analysis."],
    [/\/hands|hand stats|hand probability|probability calculator/, "The /hands and hand-statistics flow."],
    [/visual deck|deck editor|deck builder/, "The visual deck builder and deck editing experience."],
    [/board editor|endboard|board search/, "The board editor, endboard tools, and board search experience."],
    [/showcase|homepage|landing|hero/, "The public showcase/homepage flow for presenting YGOPLUS."],
    [/stripe|subscription|membership|pricing|plus|pro|free tier|access levels?/, "Membership, access control, and pricing logic."],
    [/email|verification|password|username|account|login|registration/, "Account creation, verification, login, and user communication flows."],
    [/deploy|render|production|dns|hosting|server|cache|r2/, "Production hosting, DNS, deployment, and cache behavior."],
    [/database|postgres|sqlite|migration|model/, "Database models, migrations, and persistence behavior."],
  ];

  for (const [pattern, detail] of details) {
    if (pattern.test(value)) return detail;
  }

  return `${area} behavior and supporting product polish.`;
}

function promptContext(action) {
  const text = digestSignal(action);
  const prompt = clean(action.prompt);
  const snippets = [
    [/starter|brick|handtrap|ideal hand/i, "Tuned starter/brick/handtrap conditions."],
    [/external card database|cardinfo|fname/i, "Worked through external card lookup details."],
    [/card image|image_url|card_images/i, "Adjusted card image handling."],
    [/deck input|deck list|ydke|deck import/i, "Improved deck-list input or import behavior."],
    [/visual deck|deck editor|deck builder/i, "Adjusted deck editor behavior."],
    [/board editor|endboard|board search/i, "Adjusted board editor behavior."],
    [/stripe|membership|pricing|plus|pro|free tier/i, "Refined membership/pricing rules."],
    [/dns|hosting|deploy|production|render/i, "Worked through production setup."],
    [/database|postgres|sqlite|migration/i, "Touched persistence or data-layer behavior."],
  ];

  for (const [pattern, snippet] of snippets) {
    if (pattern.test(`${text} ${prompt}`)) return snippet;
  }

  return compact(prompt, 120);
}

function buildHighlight(action) {
  const text = digestSignal(action);
  const type = changeType(text);
  const area = areaLabel(text, action.category);
  const phrase = themePhrase(text, area, type);
  return `${verbFor(type)} ${phrase}: ${promptContext(action)}`;
}

// External site names that should never appear in public changelog output
const EXTERNAL_SITE_PATTERN = /ygoprodeck|tcgplayer|genesys|cardinfo|konami|yugipedia|fname/i;

function buildChangelog(trailData) {
  const usefulActions = trailData.actions.filter((action) => {
    const text = digestSignal(action).toLowerCase();
    if (/approved the next step|retried the previous attempt|try again|^yes$|^ok$/.test(text)) return false;
    if (action.dateLabel && EXCLUDED_DATE_LABELS.has(action.dateLabel)) return false;
    return true;
  });

  const groups = new Map();
  for (const action of usefulActions) {
    const key = `${action.dateLabel}|${action.source}|${action.sessionTitle}`;
    if (!groups.has(key)) {
      groups.set(key, {
        source: action.source,
        sessionTitle: action.sessionTitle,
        timestamp: action.timestamp,
        dateLabel: action.dateLabel,
        actions: [],
      });
    }

    const group = groups.get(key);
    group.timestamp = Math.max(group.timestamp, action.timestamp);
    group.actions.push(action);
  }

  const entries = Array.from(groups.values())
    .map((group, index) => {
      const text = group.actions.map(digestSignal).join(" ");
      const categories = group.actions.reduce((counts, action) => {
        counts[action.category] = (counts[action.category] || 0) + 1;
        return counts;
      }, {});
      const category = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || "product";
      const type = changeType(text);
      const area = areaLabel(`${group.sessionTitle} ${text}`, category);
      const phrase = themePhrase(text, area, type);
      const context = contextDetail(`${group.sessionTitle} ${text}`, area);
      const highlights = Array.from(new Set(group.actions.map(buildHighlight)))
        .filter((h) => !EXTERNAL_SITE_PATTERN.test(h))
        .slice(0, 4);

      return {
        id: `change-${index + 1}`,
        type,
        typeLabel: verbFor(type),
        area,
        category,
        timestamp: group.timestamp,
        isoDate: new Date(group.timestamp).toISOString(),
        dateLabel: group.dateLabel,
        monthKey: monthKey(group.timestamp),
        monthLabel: monthLabel(group.timestamp),
        title: `${verbFor(type)} ${phrase}`,
        summary: `A ${group.source} session focused on ${phrase} across ${group.actions.length} ${group.actions.length === 1 ? "prompt" : "prompts"}. Context: ${context}`,
        context,
        highlights,
        promptCount: group.actions.length,
        source: group.source,
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const months = Array.from(
    entries.reduce((map, entry) => {
      if (!map.has(entry.monthKey)) {
        map.set(entry.monthKey, {
          key: entry.monthKey,
          label: entry.monthLabel,
          timestamp: entry.timestamp,
          entries: 0,
          prompts: 0,
        });
      }

      const month = map.get(entry.monthKey);
      month.timestamp = Math.max(month.timestamp, entry.timestamp);
      month.entries += 1;
      month.prompts += entry.promptCount;
      return map;
    }, new Map()).values(),
  ).sort((a, b) => b.timestamp - a.timestamp);

  const typeCounts = entries.reduce((counts, entry) => {
    counts[entry.type] = (counts[entry.type] || 0) + 1;
    return counts;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      entries: entries.length,
      prompts: usefulActions.length,
      latestLabel: entries[0]?.dateLabel || "",
      typeCounts,
    },
    months,
    entries,
  };
}

function main() {
  const trailData = loadTrailData(inputPath);
  const changelog = buildChangelog(trailData);
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `window.YGOPLUS_CHANGELOG = ${JSON.stringify(changelog, null, 2)};\n`);
  console.log(`Wrote ${outputPath}`);
  console.log(`${changelog.stats.entries} changelog entries from ${changelog.stats.prompts} prompts`);
}

main();
