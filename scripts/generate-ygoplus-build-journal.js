#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { redactSensitiveText } = require("./redact-build-trail-text");

const inputPath = path.resolve(process.argv[2] || "docs/build-trail/raw/copilot-vscode/sessions.json");
const outputPath = path.resolve(process.argv[3] || "docs/build-trail/ygoplus-build-journal.md");
const EXCLUDED_DATE_KEYS = new Set(
  (process.env.BUILD_TRAIL_EXCLUDE_DATES || "")
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean),
);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function centralDate(value, options = {}) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: options.monthOnly ? "long" : "long",
    day: options.monthOnly ? undefined : "numeric",
    hour: options.includeTime ? "numeric" : undefined,
    minute: options.includeTime ? "2-digit" : undefined,
  }).format(date);
}

function centralDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function isExcludedDate(timestamp) {
  return EXCLUDED_DATE_KEYS.has(centralDateKey(timestamp));
}

function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "long",
  }).format(date);
}

function cleanPrompt(prompt) {
  return redactSensitiveText(prompt)
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

function isExcludedPrompt(value) {
  const text = cleanPrompt(value).toLowerCase();
  return /\b(resume\s+(?:entry|bullet|bullets|line|summary|language)|resume-ready|(?:entry|bullet|bullets)\s+for\s+(?:my\s+)?resume|(?:for|on|to|into|put\s+on)\s+(?:my\s+)?resume|actual resume|cv|curriculum vitae|cover letter|linkedin|job application|roles?\s+i'?m\s+applying|recruiter|mckinsey|quantumblack|hackerrank|dspractice)\b/.test(text);
}

function sentenceFromPrompt(prompt) {
  const cleaned = cleanPrompt(prompt)
    .replace(/^@agent\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "I continued the work.";
  if (/^(yes|yep|yeah|ok|okay)$/i.test(cleaned)) return "I confirmed the direction and asked the agent to continue.";
  if (/try again/i.test(cleaned)) return "I asked the agent to retry the previous step.";
  if (cleaned.length <= 140) return cleaned;
  return `${cleaned.slice(0, 137).trim()}...`;
}

function actionSummary(prompt) {
  const summary = sentenceFromPrompt(prompt);
  if (/^I\s(asked|confirmed)/i.test(summary)) return summary;
  return `I asked: ${summary}`;
}

function summarizeSession(session) {
  const title = redactSensitiveText(session.title || session.customTitle || "Untitled session");
  const requests = session.requests || [];
  const files = session.state?.filesTouched || [];
  const firstPrompt = requests.find((request) => cleanPrompt(request.prompt))?.prompt || "";

  if (/untitled/i.test(title) && firstPrompt) return sentenceFromPrompt(firstPrompt);
  return title;
}

function sessionDate(session) {
  const timestamps = (session.requests || [])
    .map((request) => request.timestamp)
    .filter(Boolean)
    .sort((a, b) => a - b);
  return timestamps[0] || Date.parse(session.createdAt) || session.lastMessageDate || 0;
}

function markdownForPrompt(request, index) {
  const prompt = cleanPrompt(request.prompt);
  const lines = [];
  lines.push(`#### Action ${index}`);
  lines.push("");
  lines.push(`- Time: ${centralDate(request.timestamp, { includeTime: true }) || request.date || "Unknown"}`);
  if (request.modelId) lines.push(`- Model: \`${request.modelId}\``);
  if (request.tools?.length) lines.push(`- Tools used: ${request.tools.map((tool) => `\`${tool}\``).join(", ")}`);
  if (request.editedFiles?.length) {
    lines.push("- Files edited in transcript:");
    for (const file of request.editedFiles) lines.push(`  - \`${redactSensitiveText(file)}\``);
  }
  lines.push("");
  lines.push(actionSummary(prompt));
  lines.push("");
  return lines.join("\n");
}

function buildJournal(sessions) {
  const withPrompts = sessions
    .map((session) => ({
      ...session,
      sortTime: sessionDate(session),
      requests: (session.requests || [])
        .filter((request) => cleanPrompt(request.prompt))
        .filter((request) => !isExcludedPrompt(`${session.title || ""} ${session.customTitle || ""} ${request.prompt}`))
        .filter((request) => !isExcludedDate(request.timestamp || Date.parse(request.date))),
    }))
    .filter((session) => session.requests.length)
    .sort((a, b) => a.sortTime - b.sortTime);
  const promptCount = withPrompts.reduce((sum, session) => sum + (session.requests || []).length, 0);

  const first = withPrompts[0]?.requests[0];
  const lastSession = withPrompts[withPrompts.length - 1];
  const last = lastSession?.requests[lastSession.requests.length - 1];

  const lines = [];
  lines.push("# Building YGOPLUS: An Iterative Development Journal");
  lines.push("");
  lines.push("This journal was generated from the exported VS Code Copilot agent sessions for the YGOPLUS workspace. It preserves the raw prompt trail while presenting it as a chronological build story.");
  lines.push("");
  lines.push("## At a Glance");
  lines.push("");
  lines.push(`- Sessions with prompt activity: ${withPrompts.length}`);
  lines.push(`- Total prompts/actions: ${promptCount}`);
  lines.push(`- First prompt: ${centralDate(first?.timestamp, { includeTime: true })}`);
  lines.push(`- Last prompt: ${centralDate(last?.timestamp, { includeTime: true })}`);
  lines.push("");
  lines.push("## The Story");
  lines.push("");
  lines.push("YGOPLUS began as a practical idea: make a Yu-Gi-Oh! endboard simulator where users could create, save, search, and revisit board states. From there, the project grew through a long sequence of agent-assisted iterations: deck building, board state persistence, hand tagging, card search, visual polish, deployment work, TCGplayer affiliate features, Stripe memberships, creator outreach, legal pages, and launch-readiness decisions.");
  lines.push("");
  lines.push("The entries below keep that evolution intact. Each chapter is a Copilot session; each action is one user prompt from that session.");
  lines.push("");

  let currentMonth = "";
  let globalAction = 1;

  for (const session of withPrompts) {
    const key = monthKey(session.sortTime);
    if (key !== currentMonth) {
      currentMonth = key;
      lines.push(`## ${currentMonth}`);
      lines.push("");
    }

    const title = summarizeSession(session);
    const date = centralDate(session.sortTime, { includeTime: true });
    lines.push(`### ${redactSensitiveText(title)}`);
    lines.push("");
    lines.push(`- Date: ${date}`);
    lines.push(`- Session ID: \`${session.sessionId}\``);
    lines.push(`- Actions in this session: ${session.requests.length}`);
    lines.push(`- State checkpoints: ${session.state?.checkpointCount || 0}`);
    lines.push(`- State edit operations: ${session.state?.operationCount || 0}`);
    if (session.state?.filesTouched?.length) {
      lines.push("- Files touched:");
      for (const file of session.state.filesTouched.slice(0, 20)) {
        lines.push(`  - \`${redactSensitiveText(file)}\``);
      }
      if (session.state.filesTouched.length > 20) {
        lines.push(`  - ...and ${session.state.filesTouched.length - 20} more`);
      }
    }
    lines.push("");
    lines.push(`In this chapter, the work centered on: ${session.requests.slice(0, 3).map((request) => sentenceFromPrompt(request.prompt)).join(" ")}${session.requests.length > 3 ? " ..." : ""}`);
    lines.push("");

    for (const request of session.requests) {
      lines.push(markdownForPrompt(request, globalAction));
      globalAction += 1;
    }
  }

  return `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n")}\n`;
}

function main() {
  const sessions = readJson(inputPath);
  const markdown = buildJournal(sessions);
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, markdown);
  console.log(`Wrote ${outputPath}`);
}

main();
