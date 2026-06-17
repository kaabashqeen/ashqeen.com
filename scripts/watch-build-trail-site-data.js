#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const roots = [
  path.resolve("docs/build-trail/raw/copilot-vscode"),
  process.env.CLAUDE_AGENT_SESSIONS ||
    "/Users/kaabashqeen/Library/Application Support/Claude/local-agent-mode-sessions",
  process.env.CODEX_SESSIONS || "/Users/kaabashqeen/.codex/sessions",
].filter((root) => fs.existsSync(root));

let timer;
let running = false;
let pending = false;

function regenerate() {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  const child = spawn(process.execPath, ["scripts/generate-build-trail-site-data.js"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  child.on("exit", () => {
    const changelog = spawn(process.execPath, ["scripts/generate-changelog-site-data.js"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });

    changelog.on("exit", () => {
      const analytics = spawn(process.execPath, ["scripts/generate-analytics-site-data.js"], {
        cwd: process.cwd(),
        stdio: "inherit",
      });

      analytics.on("exit", () => {
        running = false;
        if (pending) {
          pending = false;
          schedule();
        }
      });
    });
  });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(regenerate, 500);
}

regenerate();

for (const root of roots) {
  try {
    fs.watch(root, { recursive: true }, schedule);
    console.log(`Watching ${root}`);
  } catch (error) {
    console.warn(`Could not watch ${root}: ${error.message}`);
  }
}
