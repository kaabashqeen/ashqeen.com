#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const inputPath = path.resolve(process.argv[2] || "assets/build-trail-data.js");
const outputPath = path.resolve(process.argv[3] || "assets/analytics-data.js");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function loadTrailData(filePath) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), context);
  return context.window.YGOPLUS_BUILD_TRAIL;
}

function centralParts(timestamp) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function dateLabel(timestamp, options = {}) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: options.monthOnly ? "long" : "short",
    day: options.monthOnly ? undefined : "numeric",
    year: "numeric",
    hour: options.time ? "numeric" : undefined,
    minute: options.time ? "2-digit" : undefined,
  }).format(new Date(timestamp));
}

function hourLabel(hour) {
  const date = new Date(Date.UTC(2026, 0, 1, hour));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
  }).format(date);
}

function durationLabel(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${minutes} min`;
  if (!mins) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function topEntries(map, limit = 5) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function textForAction(action) {
  return [action.title, action.prompt, action.result, action.category].filter(Boolean).join(" ").toLowerCase();
}

function isImplementationSignal(action) {
  const text = textForAction(action);
  return /\b(add|added|adding|build|built|building|change|changed|create|created|creating|debug|debugged|deploy|deployed|edit|edited|editing|fix|fixed|fixing|implement|implemented|implementation|install|installed|integrate|integrated|patch|patched|refactor|refactored|remove|removed|rewrite|rewrote|ship|shipped|test|tested|update|updated|wire|wired|write|wrote)\b|\b(api|backend|bug|cache|component|css|database|deploy|endpoint|error|frontend|generator|html|javascript|js|layout|migration|model|navbar|page|python|route|script|server|style|template|ui|ux)\b/.test(
    text,
  );
}

function addPromptRecord(map, key) {
  if (!map.has(key)) {
    map.set(key, { label: key, count: 0 });
  }
  map.get(key).count += 1;
}

function buildStreaks(actions, gapMinutes = 45) {
  const sorted = [...actions].sort((a, b) => a.timestamp - b.timestamp);
  const streaks = [];
  let current = null;
  const maxGap = gapMinutes * 60 * 1000;

  for (const action of sorted) {
    if (!current || action.timestamp - current.end > maxGap) {
      if (current) streaks.push(current);
      current = {
        start: action.timestamp,
        end: action.timestamp,
        prompts: 1,
        sources: new Set([action.source]),
        categories: new Map([[action.category, 1]]),
      };
    } else {
      current.end = action.timestamp;
      current.prompts += 1;
      current.sources.add(action.source);
      increment(current.categories, action.category);
    }
  }

  if (current) streaks.push(current);

  return streaks
    .map((streak) => {
      const topCategory = topEntries(streak.categories, 1)[0]?.label || "product";
      return {
        start: streak.start,
        end: streak.end,
        durationMs: Math.max(60000, streak.end - streak.start),
        durationLabel: durationLabel(Math.max(60000, streak.end - streak.start)),
        prompts: streak.prompts,
        startLabel: dateLabel(streak.start, { time: true }),
        endLabel: dateLabel(streak.end, { time: true }),
        sourceLabel: Array.from(streak.sources).join(", "),
        category: topCategory,
      };
    })
    .sort((a, b) => b.durationMs - a.durationMs || b.prompts - a.prompts);
}

function codeChangeFootprint(actions) {
  const bySource = new Map();
  const byCategory = new Map();
  const byMonth = new Map();
  const implementationBySource = new Map();
  const implementationByCategory = new Map();
  const implementationByMonth = new Map();
  const changedActions = actions.filter((action) => {
    const filesChanged = action.codeChange?.filesChanged || action.editedFileCount || 0;
    return filesChanged > 0;
  });
  const implementationActions = actions.filter(isImplementationSignal);

  for (const action of implementationActions) {
    const parts = centralParts(action.timestamp);
    const month = `${parts.month} ${parts.year}`;

    addPromptRecord(implementationBySource, action.source);
    addPromptRecord(implementationByCategory, action.category);
    addPromptRecord(implementationByMonth, month);
  }

  for (const action of changedActions) {
    const filesChanged = action.codeChange?.filesChanged || action.editedFileCount || 0;
    const parts = centralParts(action.timestamp);
    const month = `${parts.month} ${parts.year}`;

    for (const [map, key] of [
      [bySource, action.source],
      [byCategory, action.category],
      [byMonth, month],
    ]) {
      if (!map.has(key)) {
        map.set(key, { label: key, count: 0, promptCount: 0 });
      }

      const record = map.get(key);
      record.count += filesChanged;
      record.promptCount += 1;
    }
  }

  const totalFilesChanged = changedActions.reduce((sum, action) => {
    return sum + (action.codeChange?.filesChanged || action.editedFileCount || 0);
  }, 0);
  const biggest = [...changedActions].sort((a, b) => {
    return (b.codeChange?.filesChanged || b.editedFileCount || 0) - (a.codeChange?.filesChanged || a.editedFileCount || 0);
  })[0];

  return {
    promptCount: changedActions.length,
    totalFilesChanged,
    averageFilesPerCodePrompt: changedActions.length ? totalFilesChanged / changedActions.length : 0,
    implementationPromptCount: implementationActions.length,
    implementationShare: actions.length ? implementationActions.length / actions.length : 0,
    implementationBySource: Array.from(implementationBySource.values()).sort((a, b) => b.count - a.count),
    implementationByCategory: Array.from(implementationByCategory.values()).sort((a, b) => b.count - a.count),
    implementationByMonth: Array.from(implementationByMonth.values()).sort((a, b) => b.count - a.count).slice(0, 12),
    metadataBackedPromptCount: changedActions.length,
    metadataMissingPromptCount: Math.max(0, implementationActions.length - changedActions.length),
    biggestPrompt: biggest
      ? {
          title: biggest.title,
          source: biggest.source,
          dateLabel: biggest.timeLabel,
          filesChanged: biggest.codeChange?.filesChanged || biggest.editedFileCount || 0,
          category: biggest.category,
        }
      : null,
    bySource: Array.from(bySource.values()).sort((a, b) => b.count - a.count),
    byCategory: Array.from(byCategory.values()).sort((a, b) => b.count - a.count),
    byMonth: Array.from(byMonth.values()).sort((a, b) => b.count - a.count).slice(0, 12),
    implementationNote:
      "Implementation prompts are counted from cleaned titles, prompts, results, and categories that read like product, code, design, debugging, or deployment work. This view includes Codex, Claude, ChatGPT, and Copilot.",
    note:
      "Confirmed file counts use edited-file metadata from the prompt history. In this archive, that metadata is mostly available from VS Code Copilot, so the file-count chart is narrower than the all-source implementation signal chart.",
  };
}

function scorePersonality(actions) {
  const promptText = actions.map((action) => action.prompt).join(" ").toLowerCase();
  const total = Math.max(1, actions.length);
  const questionCount = (promptText.match(/\?/g) || []).length;
  const fixCount = actions.filter((action) => /fix|issue|error|not working|why|check|make sure|doesnt/.test(action.prompt.toLowerCase())).length;
  const designCount = actions.filter((action) => /design|style|look|spacing|image|layout|modern|smooth|natural/.test(action.prompt.toLowerCase())).length;
  const systemsCount = actions.filter((action) => /database|route|api|model|deploy|stripe|email|cache|script|logic|flow/.test(action.prompt.toLowerCase())).length;
  const iterationCount = actions.filter((action) => /again|still|better|adjust|rework|change|remove|add|try|make sure/.test(action.prompt.toLowerCase())).length;

  const scores = [
    {
      key: "systems",
      label: "Systems-oriented builder",
      score: Math.round((systemsCount / total) * 100),
      detail: "Consistently connected product behavior to routes, data models, deployment, and long-term maintainability.",
    },
    {
      key: "iterative",
      label: "Relentless iterator",
      score: Math.round((iterationCount / total) * 100),
      detail: "Kept pushing through versions until the experience matched the intended mental model.",
    },
    {
      key: "debugger",
      label: "Reality-checking debugger",
      score: Math.round((fixCount / total) * 100),
      detail: "Tested frequently, noticed mismatches quickly, and brought concrete failures back into the loop.",
    },
    {
      key: "designer",
      label: "Product-minded visual editor",
      score: Math.round((designCount / total) * 100),
      detail: "Strong focus on what feels natural, clear, and usable to someone encountering the product for the first time.",
    },
    {
      key: "curious",
      label: "Question-led learner",
      score: Math.min(100, Math.round((questionCount / total) * 45)),
      detail: "Used questions to clarify tradeoffs before locking in a direction.",
    },
  ].sort((a, b) => b.score - a.score);

  const top = scores[0];
  const secondary = scores[1];

  return {
    name: `${top.label} / ${secondary.label}`,
    summary:
      "The prompting history reads like a founder-builder who alternates between shipping, testing, and tightening the product loop.",
    note: "A work-style read derived from prompt patterns across the full build history.",
    traits: scores,
  };
}

function buildAnalytics(trailData) {
  const actions = [...trailData.actions].sort((a, b) => a.timestamp - b.timestamp);
  const byHour = new Map();
  const byWeekday = new Map();
  const byMonth = new Map();
  const bySource = new Map();
  const byCategory = new Map();
  const byDate = new Map();

  for (const action of actions) {
    const parts = centralParts(action.timestamp);
    increment(byHour, Number(parts.hour));
    increment(byWeekday, parts.weekday);
    increment(byMonth, `${parts.month} ${parts.year}`);
    increment(bySource, action.source);
    increment(byCategory, action.category);
    increment(byDate, `${parts.month} ${parts.day}, ${parts.year}`);
  }

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    count: byHour.get(hour) || 0,
  }));

  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ({
    label: day,
    count: byWeekday.get(day) || 0,
  }));

  const streaks = buildStreaks(actions);
  const codeChanges = codeChangeFootprint(actions);
  const busiestHour = [...hourly].sort((a, b) => b.count - a.count)[0];
  const busiestDay = [...weekdays].sort((a, b) => b.count - a.count)[0];
  const busiestDate = topEntries(byDate, 1)[0];
  const longestStreak = streaks[0];

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      prompts: actions.length,
      firstLabel: dateLabel(actions[0]?.timestamp || Date.now(), { time: true }),
      latestLabel: dateLabel(actions[actions.length - 1]?.timestamp || Date.now(), { time: true }),
      busiestHour,
      busiestDay,
      busiestDate,
      longestStreak,
      codeChangingPrompts: codeChanges.implementationPromptCount,
      metadataBackedCodePrompts: codeChanges.promptCount,
      filesChanged: codeChanges.totalFilesChanged,
    },
    hourly,
    weekdays,
    months: topEntries(byMonth, 12),
    sources: topEntries(bySource, 8),
    categories: topEntries(byCategory, 8),
    streaks: streaks.slice(0, 8),
    codeChanges,
    personality: scorePersonality(actions),
  };
}

function main() {
  const trailData = loadTrailData(inputPath);
  const analytics = buildAnalytics(trailData);
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `window.YGOPLUS_ANALYTICS = ${JSON.stringify(analytics, null, 2)};\n`);
  console.log(`Wrote ${outputPath}`);
  console.log(`${analytics.stats.prompts} prompts analyzed`);
}

main();
