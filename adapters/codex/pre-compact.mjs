#!/usr/bin/env node
// Reuse the existing incremental slicing, scheduling, and logging loop.
process.argv.push("--runtime=codex");
await import("../../hooks/self-improve-trigger.mjs");
