#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const key = arg.slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, "true");
    }
  }
}

const root = path.resolve(args.get("root") || "vscode");
const workspaceNeedle = args.get("workspace") || "yugiohwebsiteadvanced";
const outputRoot = path.resolve(args.get("out") || "docs/build-trail/raw/copilot-vscode");
const includeResponses = args.get("include-responses") !== "false";

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function readJson(filePath) {
  const raw = safeRead(filePath);
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { parseError: String(error) };
  }
}

function listDirs(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

function listFiles(dirPath, extensions) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
      .map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString();
}

function slugify(value) {
  return String(value || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

function workspaceFolder(storageDir) {
  const json = readJson(path.join(storageDir, "workspace.json"));
  return json && typeof json.folder === "string" ? decodeURIComponent(json.folder.replace("file://", "")) : "";
}

function readSessionIndex(storageDir) {
  const dbPath = path.join(storageDir, "state.vscdb");
  if (!fs.existsSync(dbPath)) return new Map();

  try {
    const raw = execFileSync("sqlite3", [
      dbPath,
      "select value from ItemTable where key='chat.ChatSessionStore.index';",
    ], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const parsed = JSON.parse(raw);
    return new Map(Object.entries(parsed.entries || {}));
  } catch {
    return new Map();
  }
}

function responseText(request) {
  if (!includeResponses) return "";
  const chunks = [];
  for (const item of request.response || []) {
    if (!item || typeof item !== "object") continue;
    if (["thinking", "mcpServersStarting", "progressMessage"].includes(item.kind)) continue;
    if (typeof item.value === "string") chunks.push(item.value);
    if (typeof item.response === "string") chunks.push(item.response);
  }

  return chunks
    .filter((chunk) => chunk.trim())
    .filter((chunk) => !chunk.includes("<environment_info>"))
    .filter((chunk) => !chunk.includes("<workspace_info>"))
    .filter((chunk) => !chunk.includes("<userRequest>"))
    .join("\n\n")
    .trim();
}

function toolNames(request) {
  const rounds = request?.result?.metadata?.toolCallRounds || [];
  const names = new Set();
  for (const round of rounds) {
    for (const call of round.toolCalls || []) {
      if (call.name) names.add(call.name);
    }
  }
  return [...names].sort();
}

function editedFilesFromRequest(request) {
  const files = new Set();
  for (const event of request.editedFileEvents || []) {
    const filePath = event?.uri?.fsPath || event?.uri?.path;
    if (filePath) files.add(filePath);
  }
  return [...files].sort();
}

function parseChatFile(filePath) {
  const ext = path.extname(filePath);
  const sessions = [];

  if (ext === ".jsonl") {
    const lines = safeRead(filePath).split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed?.v?.sessionId) sessions.push(parsed.v);
      } catch {
        // Ignore partial or corrupt lines.
      }
    }
    return sessions;
  }

  const parsed = readJson(filePath);
  if (parsed?.sessionId) sessions.push(parsed);
  if (parsed?.v?.sessionId) sessions.push(parsed.v);
  return sessions;
}

function summarizeState(storageDir, sessionId) {
  const statePath = path.join(storageDir, "chatEditingSessions", sessionId, "state.json");
  const state = readJson(statePath);
  if (!state || state.parseError) {
    return {
      hasState: false,
      checkpointCount: 0,
      operationCount: 0,
      filesTouched: [],
      requestsWithEdits: [],
    };
  }

  const files = new Set();
  for (const [uri] of state.initialFileContents || []) {
    if (typeof uri === "string") files.add(decodeURIComponent(uri.replace("file://", "")));
  }
  for (const entry of state.recentSnapshot?.entries || []) {
    if (entry.resource) files.add(decodeURIComponent(entry.resource.replace("file://", "")));
  }
  for (const op of state.timeline?.operations || []) {
    const filePath = op?.uri?.fsPath || op?.uri?.path;
    if (filePath) files.add(filePath);
  }

  const requestIds = new Set();
  for (const checkpoint of state.timeline?.checkpoints || []) {
    if (checkpoint.requestId) requestIds.add(checkpoint.requestId);
  }

  return {
    hasState: true,
    checkpointCount: state.timeline?.checkpoints?.length || 0,
    operationCount: state.timeline?.operations?.length || 0,
    filesTouched: [...files].sort(),
    requestsWithEdits: [...requestIds].sort(),
  };
}

function normalizeRequest(request) {
  return {
    requestId: request.requestId || "",
    timestamp: request.timestamp || null,
    date: formatDate(request.timestamp),
    modelId: request.modelId || request.agent?.modelId || "",
    agent: request.agent?.fullName || request.agent?.name || "",
    prompt: request.message?.text || "",
    response: responseText(request),
    tools: toolNames(request),
    editedFiles: editedFilesFromRequest(request),
    error: request.result?.errorDetails?.message || "",
  };
}

function markdownForSession(session) {
  const lines = [];
  lines.push(`# ${session.title || session.customTitle || session.sessionId}`);
  lines.push("");
  lines.push(`- Session ID: \`${session.sessionId}\``);
  if (session.workspaceFolder) lines.push(`- Workspace: \`${session.workspaceFolder}\``);
  if (session.createdAt) lines.push(`- Created: ${session.createdAt}`);
  if (session.lastMessageDate) lines.push(`- Last message: ${formatDate(session.lastMessageDate)}`);
  lines.push(`- Requests: ${session.requests.length}`);
  lines.push(`- State checkpoints: ${session.state.checkpointCount}`);
  lines.push(`- State operations: ${session.state.operationCount}`);
  lines.push("");

  if (session.state.filesTouched.length) {
    lines.push("## Files Touched");
    for (const filePath of session.state.filesTouched) lines.push(`- \`${filePath}\``);
    lines.push("");
  }

  if (!session.requests.length) {
    lines.push("## Transcript");
    lines.push("No prompt transcript was available in the copied VS Code chat session files. The session index/state still preserved title, timing, and edited-file metadata.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## Transcript");
  session.requests.forEach((request, index) => {
    lines.push("");
    lines.push(`### ${index + 1}. ${request.date || request.requestId}`);
    if (request.modelId) lines.push(`- Model: \`${request.modelId}\``);
    if (request.tools.length) lines.push(`- Tools: ${request.tools.map((tool) => `\`${tool}\``).join(", ")}`);
    if (request.editedFiles.length) {
      lines.push("- Edited files:");
      for (const filePath of request.editedFiles) lines.push(`  - \`${filePath}\``);
    }
    if (request.error) lines.push(`- Error: ${request.error}`);
    lines.push("");
    lines.push("User prompt:");
    lines.push("");
    lines.push("```text");
    lines.push((request.prompt || "").trim());
    lines.push("```");
    if (request.response) {
      lines.push("");
      lines.push("Assistant response:");
      lines.push("");
      lines.push(request.response.trim());
    }
  });

  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n");
}

function main() {
  if (!fs.existsSync(root)) {
    throw new Error(`Storage root not found: ${root}`);
  }

  ensureDir(outputRoot);

  const allSessions = [];
  for (const storageDir of listDirs(root)) {
    const folder = workspaceFolder(storageDir);
    if (workspaceNeedle && !folder.includes(workspaceNeedle)) continue;

    const index = readSessionIndex(storageDir);
    const sessionsById = new Map();

    for (const [sessionId, entry] of index.entries()) {
      sessionsById.set(sessionId, {
        sessionId,
        title: entry.title || "",
        customTitle: "",
        workspaceFolder: folder,
        createdAt: formatDate(entry.timing?.created || entry.timing?.startTime || entry.lastMessageDate),
        lastMessageDate: entry.lastMessageDate || null,
        requests: [],
        state: summarizeState(storageDir, sessionId),
      });
    }

    const chatDir = path.join(storageDir, "chatSessions");
    for (const filePath of listFiles(chatDir, [".json", ".jsonl"])) {
      for (const rawSession of parseChatFile(filePath)) {
        const sessionId = rawSession.sessionId || path.basename(filePath, path.extname(filePath));
        const current = sessionsById.get(sessionId) || {
          sessionId,
          title: "",
          customTitle: "",
          workspaceFolder: folder,
          createdAt: formatDate(rawSession.creationDate),
          lastMessageDate: rawSession.lastMessageDate || null,
          requests: [],
          state: summarizeState(storageDir, sessionId),
        };

        current.title ||= rawSession.customTitle || rawSession.title || "";
        current.customTitle = rawSession.customTitle || "";
        current.createdAt ||= formatDate(rawSession.creationDate);
        current.requests = (rawSession.requests || []).map(normalizeRequest);
        sessionsById.set(sessionId, current);
      }
    }

    allSessions.push(...sessionsById.values());
  }

  allSessions.sort((a, b) => {
    const first = a.lastMessageDate || Date.parse(a.createdAt) || 0;
    const second = b.lastMessageDate || Date.parse(b.createdAt) || 0;
    return first - second;
  });

  const sessionsDir = path.join(outputRoot, "sessions");
  ensureDir(sessionsDir);

  for (const session of allSessions) {
    const date = (session.createdAt || formatDate(session.lastMessageDate) || "unknown").slice(0, 10);
    const name = `${date}-${slugify(session.title || session.customTitle || session.sessionId)}-${session.sessionId.slice(0, 8)}`;
    fs.writeFileSync(path.join(sessionsDir, `${name}.json`), `${JSON.stringify(session, null, 2)}\n`);
    fs.writeFileSync(path.join(sessionsDir, `${name}.md`), `${markdownForSession(session)}\n`);
  }

  const indexLines = [
    "# VS Code Copilot Build Trail",
    "",
    `Workspace filter: \`${workspaceNeedle || "all"}\``,
    `Extracted at: ${new Date().toISOString()}`,
    `Sessions: ${allSessions.length}`,
    `Requests with prompt text: ${allSessions.reduce((sum, session) => sum + session.requests.length, 0)}`,
    "",
    "## Sessions",
    "",
    "| Date | Title | Requests | Files | Session |",
    "| --- | --- | ---: | ---: | --- |",
  ];

  for (const session of allSessions) {
    const date = (session.createdAt || formatDate(session.lastMessageDate) || "").slice(0, 10);
    const title = (session.title || session.customTitle || "Untitled").replace(/\|/g, "\\|");
    indexLines.push(`| ${date} | ${title} | ${session.requests.length} | ${session.state.filesTouched.length} | \`${session.sessionId}\` |`);
  }

  fs.writeFileSync(path.join(outputRoot, "index.md"), `${indexLines.join("\n")}\n`);
  fs.writeFileSync(path.join(outputRoot, "sessions.json"), `${JSON.stringify(allSessions, null, 2)}\n`);

  console.log(`Extracted ${allSessions.length} sessions to ${outputRoot}`);
  console.log(`Requests with prompt text: ${allSessions.reduce((sum, session) => sum + session.requests.length, 0)}`);
}

main();
