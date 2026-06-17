#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { redactSensitiveText } = require("./redact-build-trail-text");

const PROJECT_ROOT = "/Users/kaabashqeen/yugiohwebsiteadvanced";
const COPILOT_SESSIONS = path.resolve("docs/build-trail/raw/copilot-vscode/sessions.json");
const CHATGPT_ROOT = process.env.CHATGPT_EXPORT || path.resolve("chatgpt");
const CHATGPT_MIN_TIMESTAMP = Date.parse(process.env.CHATGPT_YGO_MIN_DATE || "2025-02-01T00:00:00-06:00");
const CLAUDE_ROOT =
  process.env.CLAUDE_AGENT_SESSIONS ||
  "/Users/kaabashqeen/Library/Application Support/Claude/local-agent-mode-sessions";
const CODEX_ROOT = process.env.CODEX_SESSIONS || "/Users/kaabashqeen/.codex/sessions";
const outputPath = path.resolve(process.argv[2] || "assets/build-trail-data.js");
const EXCLUDED_DATE_KEYS = new Set(
  (process.env.BUILD_TRAIL_EXCLUDE_DATES || "")
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean),
);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactText(value, maxLength = 260) {
  const text = cleanText(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  return `${text
    .slice(0, maxLength - 3)
    .trim()
    .replace(/\[redacted[^\]]*$/i, "[redacted]")}...`;
}

function isExcludedPrompt(value) {
  const text = cleanText(value).toLowerCase();
  return /\b(resume\s+(?:entry|bullet|bullets|line|summary|language)|resume-ready|(?:entry|bullet|bullets)\s+for\s+(?:my\s+)?resume|(?:for|on|to|into|put\s+on)\s+(?:my\s+)?resume|actual resume|cv|curriculum vitae|cover letter|linkedin|job application|roles?\s+i'?m\s+applying|recruiter|mckinsey|quantumblack|hackerrank|dspractice)\b/.test(text);
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

function chatGptRelevanceFlags(value) {
  const text = cleanText(value).toLowerCase();
  const strongTerms = [
    /\bygoplus\b/g,
    /\bygo\s*plus\b/g,
    /\bygoplus\.com\b/g,
    /\byu-?gi-?oh\b/g,
    /\byugioh\b/g,
    /\bygoprodeck\b/g,
    /\bydk\b/g,
    /\bmeta\s+deck\b/g,
  ];
  const productTerms = [
    /\bdeck(?:list| builder| editor| testing| stats| file| import| parser| simulator)?\b/g,
    /\bendboard\b/g,
    /\bstarting hand\b/g,
    /\bopening hand\b/g,
    /\bhand stat(?:s|istics)?\b/g,
    /\bstarter\b/g,
    /\bbrick\b/g,
    /\bhandtrap\b/g,
    /\bcard search\b/g,
    /\bcard database\b/g,
    /\bcard hand probability\b/g,
    /\btier list\b/g,
    /\bgenesys\b/g,
    /\btcgplayer\b/g,
    /\bduel\b/g,
  ];
  const webTerms = [
    /\bflask\b/g,
    /\btailwind\b/g,
    /\btemplate\b/g,
    /\broute\b/g,
    /\bwebsite\b/g,
    /\bhtml\b/g,
    /\bcss\b/g,
    /\bjavascript\b/g,
    /\bhosting\b/g,
    /\bdns\b/g,
  ];
  const businessTerms = [
    /\bstripe\b/g,
    /\bmembership\b/g,
    /\bearly access\b/g,
    /\bpricing\b/g,
    /\bmonetiz(?:e|ing)\b/g,
    /\bsubscription\b/g,
    /\baccess levels?\b/g,
  ];

  const count = (patterns) => patterns.reduce((sum, pattern) => sum + (text.match(pattern) || []).length, 0);

  return {
    strong: count(strongTerms),
    product: count(productTerms),
    web: count(webTerms),
    business: count(businessTerms),
    negative:
      /\bpok[eé]mon\b/.test(text) ||
      /\bresume|cover letter|interview|career|harvard|master'?s|job positioning|data scientist\b/.test(text) ||
      /\bgas station|presidents game|novel card games|puck detection|td-learning|b-?tree|snli|object detector|wikiracer|treap\b/.test(text) ||
      /\bfinding your impact|metrics for business decisions|value creation with local llms|pairwise comparison|time management|approximating research|multi-card scanning|automated tcgplayer purchase|rare packs\b/.test(text) ||
      /\bstandard deck|52!? cards?|ace|aces|diamonds?|hearts?|spades?|clubs?|poker|fair coin|two-headed coin|dice|six-sided|medical test|genetic disorder|union bound|negative binomial|geometric distribution\b/.test(text),
  };
}

function isRelevantChatGptConversation(title, requests) {
  const titleText = cleanText(title).toLowerCase();
  if (/\brare packs\b|\bspell cards as traps\b|\bcombinations probability primer\b/.test(titleText)) return false;

  const userText = requests.map((request) => request.prompt).join("\n");
  const resultText = requests.map((request) => request.response || "").join("\n");
  const combinedText = `${title}\n${userText}\n${resultText}`;
  const ygoSpecific =
    /\bygoplus\b|\bygo\s*plus\b|\bygoplus\.com\b|\byu-?gi-?oh\b|\byugioh\b|\bygoprodeck\b|\bydk\b|\bhandtraps?\b|\bbricks?\b|\bstarters?\b|\bendboards?\b/i.test(
      combinedText,
    );
  const titleFlags = chatGptRelevanceFlags(title);
  const bodyFlags = chatGptRelevanceFlags(`${userText}\n${resultText}`);
  const strong = titleFlags.strong + bodyFlags.strong;
  const product = titleFlags.product + bodyFlags.product;
  const web = titleFlags.web + bodyFlags.web;
  const business = titleFlags.business + bodyFlags.business;

  if (titleFlags.negative && !titleFlags.strong) return false;
  if (bodyFlags.negative && !strong) return false;
  if (!ygoSpecific) return false;

  if (strong && (product || web || business || strong > 1)) return true;
  if (product >= 3 && web) return true;
  if (product >= 5 && /\bdeck|hand|card\b/i.test(`${title}\n${userText}`)) return true;
  return false;
}

function isRelevantChatGptRequest(title, request) {
  const text = `${title}\n${request.prompt || ""}`;
  const flags = chatGptRelevanceFlags(text);
  const ygoSpecific =
    /\bygoplus\b|\bygo\s*plus\b|\bygoplus\.com\b|\byu-?gi-?oh\b|\byugioh\b|\bygoprodeck\b|\bydk\b|\bhandtraps?\b|\bbricks?\b|\bstarters?\b|\bendboards?\b/i.test(
      text,
    );
  const tooGeneric =
    /\bstandard deck|52!? cards?|ace|aces|diamonds?|hearts?|spades?|clubs?|poker|fair coin|two-headed coin|dice|six-sided|medical test|genetic disorder|union bound|negative binomial|geometric distribution\b/i.test(
      text,
    );
  const acknowledgement = /^(yes|yep|yeah|ok|okay|sure|thanks|thank you|thats it for now|that's it for now)$/i.test(
    cleanText(request.prompt),
  );

  if (tooGeneric && !ygoSpecific) return false;
  if (acknowledgement) return false;
  return ygoSpecific || flags.strong > 0 || flags.product >= 2;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function walkFiles(root, predicate) {
  if (!fs.existsSync(root)) return [];

  const files = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(filePath);
      } else if (predicate(filePath, entry.name)) {
        files.push(filePath);
      }
    }
  }

  return files.sort();
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part?.type === "text" && part.text) return part.text;
      if (part?.text) return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function chatGptMessageText(message) {
  const content = message?.content;
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return contentText(content);
  if (Array.isArray(content.parts)) return contentText(content.parts);
  if (content.text) return content.text;
  return "";
}

function cleanDigestOutput(value) {
  const text = redactSensitiveText(contentText(value))
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[[^\]]*(?:tool|function|command|screenshot|image|artifact)[^\]]*\]/gi, " ")
    .replace(/\b(?:stdout|stderr|traceback|stack trace|function_call|exec_command|tool_use)\b[\s\S]*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length < 24) return "";
  if (/^(ok|done|sure|yes|fixed)\.?$/i.test(text)) return "";
  return text;
}

function titleFromPrompt(prompt) {
  const cleaned = compactText(redactSensitiveText(prompt), 82)
    .replace(/^@agent\s+/i, "")
    .replace(/^can you\s+/i, "")
    .replace(/^could you\s+/i, "")
    .replace(/^please\s+/i, "")
    .trim();

  if (!cleaned) return "Continued implementation";
  if (/^(yes|yep|yeah|ok|okay)$/i.test(cleaned)) return "Approved the next step";
  if (/try again/i.test(cleaned)) return "Retried the previous attempt";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function monthKey(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || date.getUTCFullYear();
  const month =
    parts.find((part) => part.type === "month")?.value ||
    String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonth(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function inferCategory(text) {
  const value = text.toLowerCase();
  if (/stripe|subscription|membership|price|pricing|payment|adsense|affiliate|tcgplayer|email|workspace/.test(value)) {
    return "business";
  }
  if (/deploy|render|server|database|migration|route|api|flask|port|github|local|image|cache|storage/.test(value)) {
    return "infrastructure";
  }
  if (/design|mobile|layout|homepage|showcase|popup|css|theme|footer|modal|overflow|look|button|spacing|style/.test(value)) {
    return "interface";
  }
  if (/deck|endboard|hand|card|replay|board|search|tag|simulator|combo|archetype|genesys|tournament/.test(value)) {
    return "product";
  }
  return "process";
}

function categoryLabel(category) {
  return {
    business: "Business",
    infrastructure: "Infrastructure",
    interface: "Interface",
    process: "Process",
    product: "Product",
  }[category] || "Process";
}

function sessionDate(session) {
  const timestamps = (session.requests || [])
    .map((request) => request.timestamp)
    .filter(Boolean)
    .sort((a, b) => a - b);
  return timestamps[0] || Date.parse(session.createdAt) || session.lastMessageDate || 0;
}

function sessionTitle(session) {
  const prompt = (session.requests || []).find((request) => cleanText(request.prompt))?.prompt;
  const title = redactSensitiveText(session.title || session.customTitle);
  return title || titleFromPrompt(prompt);
}

function loadCopilotSessions() {
  if (!fs.existsSync(COPILOT_SESSIONS)) return [];

  return readJson(COPILOT_SESSIONS).map((session) => ({
    source: "VS Code Copilot",
    sessionId: `copilot:${session.sessionId}`,
    title: session.title,
    customTitle: session.customTitle,
    createdAt: session.createdAt,
    lastMessageDate: session.lastMessageDate,
    requests: (session.requests || []).map((request) => ({
      timestamp: request.timestamp,
      date: request.date,
      prompt: request.prompt,
      response: request.response,
      modelId: request.modelId,
      tools: request.tools || [],
      editedFiles: request.editedFiles || [],
    })),
  }));
}

function loadChatGptSessions() {
  const files = walkFiles(CHATGPT_ROOT, (_filePath, name) => /^conversations-\d+\.json$/.test(name));
  const sessions = [];

  for (const file of files) {
    let conversations;
    try {
      conversations = readJson(file);
    } catch {
      continue;
    }

    for (const conversation of conversations) {
      const nodes = Object.values(conversation.mapping || {})
        .map((node) => node.message)
        .filter(Boolean)
        .filter((message) => typeof message.create_time === "number")
        .sort((a, b) => a.create_time - b.create_time);
      const requests = [];

      for (const message of nodes) {
        const role = message.author?.role;
        const text = chatGptMessageText(message);
        if (!cleanText(text)) continue;

        if (role === "user") {
          requests.push({
            timestamp: Math.round(message.create_time * 1000),
            date: new Date(message.create_time * 1000).toISOString(),
            prompt: text,
            modelId: conversation.default_model_slug || "ChatGPT",
          });
        }

        if (role === "assistant" && requests.length) {
          const lastRequest = requests[requests.length - 1];
          if (!lastRequest.response) {
            lastRequest.response = cleanDigestOutput(text);
          }
        }
      }

      if (!requests.length) continue;

      const title = redactSensitiveText(conversation.title || "");
      if (!isRelevantChatGptConversation(title, requests)) continue;

      const relevantRequests = requests.filter((request) => isRelevantChatGptRequest(title, request));
      const datedRequests = relevantRequests.filter((request) => request.timestamp >= CHATGPT_MIN_TIMESTAMP);
      if (!datedRequests.length) continue;

      sessions.push({
        source: "ChatGPT",
        sessionId: `chatgpt:${conversation.id || path.basename(file)}:${sessions.length + 1}`,
        title,
        customTitle: title,
        createdAt: conversation.create_time ? new Date(conversation.create_time * 1000).toISOString() : "",
        lastMessageDate: conversation.update_time ? Math.round(conversation.update_time * 1000) : 0,
        requests: datedRequests,
      });
    }
  }

  return sessions;
}

function loadClaudeMetadata() {
  const metadata = new Map();
  const files = walkFiles(CLAUDE_ROOT, (_filePath, name) => name.startsWith("local_") && name.endsWith(".json"));

  for (const file of files) {
    let record;
    try {
      record = readJson(file);
    } catch {
      continue;
    }

    const selectedFolders = record.userSelectedFolders || [];
    const isProjectSession = selectedFolders.some((folder) => folder === PROJECT_ROOT);
    if (!isProjectSession || !record.cliSessionId) continue;

    metadata.set(record.cliSessionId, {
      sessionId: record.sessionId || record.cliSessionId,
      cliSessionId: record.cliSessionId,
      title: record.title || "",
      initialMessage: record.initialMessage || "",
      model: record.model || "",
      createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : "",
      lastActivityAt: record.lastActivityAt || 0,
    });
  }

  return metadata;
}

function loadClaudeSessions() {
  const metadata = loadClaudeMetadata();
  if (!metadata.size) return [];

  const grouped = new Map();
  const files = walkFiles(
    CLAUDE_ROOT,
    (filePath, name) => name.endsWith(".jsonl") && !filePath.includes("/audit.jsonl") && !filePath.includes("/subagents/"),
  );

  for (const file of files) {
    for (const event of readJsonl(file)) {
      const meta = metadata.get(event.sessionId);
      if (!meta) continue;

      const id = `claude:${meta.cliSessionId}`;
      if (!grouped.has(id)) {
        grouped.set(id, {
          source: "Claude",
          sessionId: id,
          title: meta.title,
          customTitle: meta.title,
          createdAt: meta.createdAt,
          lastMessageDate: meta.lastActivityAt,
          requests: [],
        });
      }

      const session = grouped.get(id);

      if (event.type === "user" && !event.isSidechain) {
        const prompt = contentText(event.message?.content);
        const timestamp = Date.parse(event.timestamp);
        if (!prompt || Number.isNaN(timestamp)) continue;

        session.requests.push({
          timestamp,
          date: event.timestamp,
          prompt,
          modelId: meta.model,
        });
      }

      if (event.type === "assistant" && !event.isSidechain && session.requests.length) {
        const lastRequest = session.requests[session.requests.length - 1];
        if (!lastRequest.response) {
          lastRequest.response = cleanDigestOutput(event.message?.content);
        }
      }
    }
  }

  return Array.from(grouped.values());
}

function codexSessionId(filePath) {
  return `codex:${path.basename(filePath, ".jsonl")}`;
}

function loadCodexSessions() {
  const sessions = [];
  const files = walkFiles(CODEX_ROOT, (_filePath, name) => name.endsWith(".jsonl"));

  for (const file of files) {
    const events = readJsonl(file);
    const cwdValues = events
      .map((event) => event.payload?.cwd || event.payload?.turn_context?.cwd || event.payload?.data?.cwd)
      .filter(Boolean);
    const isProjectSession = cwdValues.some((cwd) => cwd === PROJECT_ROOT);
    if (!isProjectSession) continue;

    const requests = [];
    let title = "";

    for (const event of events) {
      if (event.type === "event_msg" && event.payload?.type === "thread_name_updated") {
        title = event.payload.name || event.payload.title || title;
      }

      if (event.type === "event_msg" && event.payload?.type === "user_message") {
        const prompt = cleanText(event.payload.message);
        const timestamp = Date.parse(event.timestamp);
        if (!prompt || Number.isNaN(timestamp)) continue;

        requests.push({
          timestamp,
          date: event.timestamp,
          prompt,
          modelId: "Codex",
        });
      }

      if (event.type === "event_msg" && event.payload?.type === "agent_message" && requests.length) {
        const lastRequest = requests[requests.length - 1];
        if (!lastRequest.response) {
          lastRequest.response = cleanDigestOutput(event.payload.message);
        }
      }
    }

    if (requests.length) {
      sessions.push({
        source: "Codex",
        sessionId: codexSessionId(file),
        title,
        createdAt: events[0]?.timestamp || "",
        lastMessageDate: Date.parse(events[events.length - 1]?.timestamp || "") || 0,
        requests,
      });
    }
  }

  return sessions;
}

function buildData(sessions) {
  const orderedSessions = sessions
    .map((session) => ({
      ...session,
      sortTime: sessionDate(session),
      requests: (session.requests || [])
        .filter((request) => cleanText(request.prompt))
        .filter((request) => !isExcludedPrompt(`${session.title || ""} ${session.customTitle || ""} ${request.prompt}`))
        .filter((request) => !isExcludedDate(request.timestamp || Date.parse(request.date)))
        .sort((a, b) => (a.timestamp || Date.parse(a.date)) - (b.timestamp || Date.parse(b.date))),
    }))
    .filter((session) => session.requests.length)
    .sort((a, b) => a.sortTime - b.sortTime);

  const actions = [];
  const monthMap = new Map();
  const sourceMap = new Map();
  let actionNumber = 1;

  for (const session of orderedSessions) {
    const title = sessionTitle(session);
    const sessionPromptCount = session.requests.length;
    const source = session.source || "Unknown";

    if (!sourceMap.has(source)) sourceMap.set(source, { source, sessions: 0, actions: 0 });
    sourceMap.get(source).sessions += 1;

    session.requests.forEach((request, index) => {
      const timestamp = request.timestamp || Date.parse(request.date);
      const prompt = redactSensitiveText(request.prompt);
      const result = cleanDigestOutput(request.response);
      if (isExcludedPrompt(`${title} ${prompt} ${result}`)) return;
      const category = inferCategory(`${title} ${prompt} ${result}`);
      const key = monthKey(timestamp);

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          key,
          timestamp,
          label: formatMonth(timestamp),
          actionCount: 0,
          sessions: new Set(),
          categories: new Map(),
        });
      }

      const month = monthMap.get(key);
      month.actionCount += 1;
      month.sessions.add(session.sessionId);
      month.categories.set(category, (month.categories.get(category) || 0) + 1);
      sourceMap.get(source).actions += 1;

      const action = {
        id: `action-${actionNumber}`,
        number: actionNumber,
        source,
        category,
        timestamp,
        isoDate: new Date(timestamp).toISOString(),
        dateLabel: formatDate(timestamp),
        timeLabel: formatDateTime(timestamp),
        title: titleFromPrompt(prompt),
        prompt: compactText(prompt, 360),
        sessionTitle: title,
        actionInSession: index + 1,
        sessionPromptCount,
      };

      if (result) action.result = compactText(result, 300);
      if (request.modelId) action.model = request.modelId;
      if (request.tools?.length) action.tools = request.tools;
      if (request.editedFiles?.length) {
        action.editedFileCount = request.editedFiles.length;
        action.codeChange = {
          filesChanged: request.editedFiles.length,
        };
      }

      actions.push(action);
      actionNumber += 1;
    });
  }

  const months = Array.from(monthMap.values())
    .map((month) => {
      const topCategory = Array.from(month.categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "process";
      return {
        key: month.key,
        timestamp: month.timestamp,
        label: month.label,
        actionCount: month.actionCount,
        sessionCount: month.sessions.size,
        topCategory,
        topCategoryLabel: categoryLabel(topCategory),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const first = actions[0];
  const last = actions[actions.length - 1];

  return {
    generatedAt: new Date().toISOString(),
    project: {
      name: "YGOPLUS",
      description:
        "A chronological trail of the prompts, decisions, and implementation passes used to build the Yu-Gi-Oh! website.",
      sources: Array.from(sourceMap.keys()),
      pendingSources: [],
    },
    stats: {
      actions: actions.length,
      sessions: orderedSessions.length,
      firstPrompt: first?.isoDate || "",
      lastPrompt: last?.isoDate || "",
      firstPromptLabel: first?.timeLabel || "",
      lastPromptLabel: last?.timeLabel || "",
      sources: Array.from(sourceMap.values()),
    },
    months,
    actions,
  };
}

function main() {
  const sessions = [
    ...loadCopilotSessions(),
    ...loadChatGptSessions(),
    ...loadClaudeSessions(),
    ...loadCodexSessions(),
  ];
  const data = buildData(sessions);
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `window.YGOPLUS_BUILD_TRAIL = ${JSON.stringify(data, null, 2)};\n`);

  console.log(`Wrote ${outputPath}`);
  console.log(`${data.stats.actions} prompts across ${data.stats.sessions} sessions`);
  for (const source of data.stats.sources) {
    console.log(`- ${source.source}: ${source.actions} prompts, ${source.sessions} sessions`);
  }
}

main();
