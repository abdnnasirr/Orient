#!/usr/bin/env node
import { install } from "./install.mjs";
import { guidance } from "./runtime.mjs";

try {
  const { config } = install({ apply: true, quiet: true });
  // AGENTS.md may have been read before SessionStart. Supply the current source
  // text in this turn as well, so refreshing a file is not mistaken for loading it.
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: guidance(config) } }));
} catch (error) {
  console.log(JSON.stringify({ systemMessage: `Orient could not refresh its shared instructions: ${error.message}` }));
}
