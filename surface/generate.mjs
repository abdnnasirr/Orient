#!/usr/bin/env node
// Self-improver surface generator.
// Reads ~/.orient/self-improve.log, filters the mechanics noise, and bakes a
// single self-contained HTML file that shows — at a glance — what the
// self-improver actually did: skills created/edited, brain pages written,
// and anything flagged for the user.
//
// No dependencies. Re-run to refresh. Data is baked in at generate time
// (the file is opened via file://, so nothing is fetched at runtime).
//
//   node generate.mjs                 # uses ~/.orient/self-improve.log
//   node generate.mjs /path/to.log    # override the source log

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = process.argv[2] || join(homedir(), ".orient", "self-improve.log");
const OUT_PATH = join(HERE, "self-improver.html");

// ---------------------------------------------------------------------------
// 1. Read + split into signal vs noise
// ---------------------------------------------------------------------------

const raw = readFileSync(LOG_PATH, "utf8");
const lines = raw.split(/\r?\n/);

// A run "result" line begins with a date and names a mode. Two shapes appear:
//   [2026-06-29] mine-a-session — ...
//   2026-06-29 | mine-a-session | ...
//   [2026-06-30T20:51:35.000Z] mine-a-session complete — ...
// Noise lines are: `[iso] FIRED ...`, `[iso] skipped: ...`, and blanks.
const DATE_HEAD =
  /^\[?(\d{4}-\d{2}-\d{2})(?:T[\d:.]+Z?)?\]?\s*[|—-]?\s*(mine-a-session|clean-the-brain)/i;

const runs = [];
let firedCount = 0;
let skippedCount = 0;

for (const line of lines) {
  const t = line.trim();
  if (!t) continue;
  if (/\bFIRED\b/.test(t)) {
    firedCount++;
    continue;
  }
  if (/^\[?[\d:TZ.-]+\]?\s*skipped:/i.test(t)) {
    skippedCount++;
    continue;
  }
  const m = t.match(DATE_HEAD);
  if (!m) continue; // anything else we don't recognise as a run result -> skip

  const date = m[1];
  const mode = /clean-the-brain/i.test(m[2]) ? "clean-brain" : "mine";
  // The body is everything after the mode token.
  const body = t.slice(m.index + m[0].length).replace(/^\s*[|—-]\s*/, "").trim();
  runs.push({ date, mode, body });
}

// ---------------------------------------------------------------------------
// 2. Extract plain-language items from each run's freeform body
// ---------------------------------------------------------------------------

// Split a body into clause-ish fragments so we can attribute pieces to buckets.
function fragments(body) {
  return body
    .split(/(?:\s[—–-]\s|;|\.(?:\s|$)|\|)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// A genuinely NEW skill (created by THIS run), not an edit/sync/reference.
// This bucket is the live question the user is tracking, so it errs toward
// honesty: it only fires when a fragment explicitly announces a brand-new
// skill this run wrote into being, and it rejects fragments that are
// negatives ("no new skill edits"), status notes ("updated to Status: ...
// BUILT"), or references to another run / a past event ("already wrote",
// "was written by c82b216d", "confirmed", "skill written at 22:21 by ...").
function skillsCreated(body) {
  const out = [];
  const seen = new Set();

  for (const frag of fragments(body)) {
    // Hard rejects — these are not "this run created a new skill".
    if (/\bno (?:new )?skill/i.test(frag)) continue; // "No new skill edits"
    if (/\bskill edits?\b/i.test(frag)) continue; // "new skill edits"
    if (/already (?:wrote|written|had|filed|reflect)/i.test(frag)) continue;
    if (/written by [0-9a-f]{6,}/i.test(frag)) continue; // "written by c82b216d"
    if (/\bby (?:a )?(?:prior|parallel)\b/i.test(frag)) continue;
    if (/\b(?:confirmed|verified|status|installed to|synced|on disk)\b/i.test(frag))
      continue;
    if (/\bwritten at \d/i.test(frag)) continue; // "skill written at 22:21"

    // Accept — explicit creation phrasing.
    let m;
    // "New skill: X" / "New skill (outreach)" / "new concept skill X"
    if ((m = /\bnew skill[:\s(]+([a-z][\w./-]*)/i.exec(frag)))
      push(cleanSkillName(m[1]));
    // "X/SKILL.md written and behavior-tested" — creation, present tense
    else if ((m = /\b([a-z][\w-]*)\/SKILL\.md written\b/i.exec(frag)))
      push(cleanSkillName(m[1]));
    // "outreach skill written and behavior-tested" — must include a test/build
    // verb nearby to distinguish creation from a passing mention.
    else if (
      (m = /\b([a-z][\w-]*) skill (?:written|created)\b/i.exec(frag)) &&
      /(behavior-tested|and (?:behavior-)?tested|installed|PASS|SHIP)/i.test(frag)
    )
      push(cleanSkillName(m[1]));
  }

  function push(name) {
    if (!name) return;
    // Guard against grammar words that slipped through ("new", "no", "the").
    if (/^(new|no|the|a|edits?|edit)$/i.test(name)) return;
    const k = name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(name);
  }
  return out;
}

function cleanSkillName(s) {
  if (!s) return "";
  return s.replace(/\/?SKILL\.md.*$/i, "").replace(/[.,]$/, "").trim();
}

// Skill EDITS — the run touched an existing skill's SKILL.md (updated,
// corrected, added a rule, synced, fixed). We surface a short human phrase.
function skillsEdited(body) {
  const out = [];
  const seen = new Set();
  for (const frag of fragments(body)) {
    const isSkillish =
      /SKILL\.md/i.test(frag) ||
      /\bskill(?:s)?\s*(?:edit|edits|fix|sync|sync applied)/i.test(frag) ||
      /^skill[s]?:/i.test(frag);
    if (!isSkillish) continue;
    // ignore the "no skill edits needed" negatives — handled elsewhere
    if (/\bno (?:new )?skill(?:s)? (?:edit|change|edits|changes)/i.test(frag)) continue;
    // ignore pure "created" phrasing (that's the created bucket)
    if (/\bnew skill[:\s]/i.test(frag) && !/updat|correct|added|fix|sync/i.test(frag))
      continue;
    const phrase = tidy(frag);
    const key = phrase.toLowerCase().slice(0, 60);
    if (phrase && !seen.has(key)) {
      seen.add(key);
      out.push(phrase);
    }
  }
  return out;
}

// Brain writes — pages written/updated/created, and new concept pages.
function brainWrites(body) {
  const out = [];
  const seen = new Set();
  // Explicit "new page X" / "X CREATED"
  const reNewPage = /\bnew (?:concept )?page[:\s]+([A-Za-z][\w /&'-]+?)(?=[.,;)]|$)/gi;
  let m;
  while ((m = reNewPage.exec(body))) add(tidy(m[1]) + " (new page)");
  const reCreated = /\b([A-Za-z][\w.-]+\.md) CREATED\b/gi;
  while ((m = reCreated.exec(body))) add(tidy(m[1]) + " (new page)");

  // The "Brain:" section — take fragments that name a .md page or a bucket.
  const brainIdx = body.search(/\bbrain(?:\s+writes?)?\s*[:—-]/i);
  const scope = brainIdx >= 0 ? body.slice(brainIdx) : body;
  for (const frag of fragments(scope)) {
    if (!/\.md\b/.test(frag)) continue;
    if (/SKILL\.md/i.test(frag)) continue; // that's a skill, not a brain page
    if (/\bMEMORY\.md\b/.test(frag)) continue; // memory index, not the brain vault
    if (isFlagFrag(frag)) continue; // a flag, shown in its own bucket, not here
    const phrase = tidy(frag);
    const key = phrase.toLowerCase().slice(0, 70);
    if (phrase && phrase.length > 3) add(phrase, key);
  }

  function add(phrase, key) {
    key = key || phrase.toLowerCase().slice(0, 70);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

// Is this fragment a flag / blocked / needs-user item?
function isFlagFrag(frag) {
  return (
    /\bflag(?:ged)? for (?:user|owner)/i.test(frag) ||
    /\bBLOCKED\b/.test(frag) ||
    /⚠/.test(frag) ||
    /\bUSER ACTION\b/i.test(frag) ||
    /\bpermission[- ]gate/i.test(frag) ||
    /\bflagged\b/i.test(frag)
  );
}

// Flags — blocked / needs-user items. Surfaced prominently.
function flags(body) {
  const out = [];
  const seen = new Set();
  for (const frag of fragments(body)) {
    if (!isFlagFrag(frag)) continue;
    const phrase = tidy(frag);
    const key = phrase.toLowerCase().slice(0, 70);
    if (phrase && !seen.has(key)) {
      seen.add(key);
      out.push(phrase);
    }
  }
  return out;
}

// Trim a fragment down to a readable phrase, strip leading bucket labels.
function tidy(s) {
  return s
    .replace(/^(?:brain|skill|skills|memory|obsidian|log)\s*[:—-]\s*/i, "")
    .replace(/^\(not applied\)\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[|—–-]\s*/, "")
    .trim();
}

// clean-the-brain runs report "fixed N issues — a; b; c" rather than page
// writes. Surface those repairs (they are brain work, so they land in the
// brain bucket) instead of letting the run read as an empty sweep.
function cleanBrainFixes(body) {
  const m = body.match(/fixed \d+ issues?\s*[—–-]?\s*(.+)$/i);
  if (!m) return [];
  return m[1]
    .split(/;\s*/)
    .map((s) => tidy(s).replace(/[.]$/, ""))
    .filter((s) => s.length > 3);
}

// A run is "meaningful" if it produced any signal at all. Pure "nothing to
// change / already mined" runs are still real runs, but we mark them quiet.
for (const r of runs) {
  r.created = skillsCreated(r.body);
  r.edited = skillsEdited(r.body);
  r.brain = brainWrites(r.body);
  if (r.mode === "clean-brain" && !r.brain.length) r.brain = cleanBrainFixes(r.body);
  r.flags = flags(r.body);
  r.quiet =
    r.created.length + r.edited.length + r.brain.length + r.flags.length === 0;
}

// Most recent first. Log is chronological, so reverse.
runs.reverse();

// ---------------------------------------------------------------------------
// 3. Aggregate by day (the page's unit of exploration) + totals
// ---------------------------------------------------------------------------

// Parallel runs on the same day often report the same item; the day view
// dedupes so the page shows each piece of work once. (This is rendering-side
// aggregation only — parsing above is untouched.)
const dayMap = new Map();
for (const r of runs) {
  let d = dayMap.get(r.date);
  if (!d) {
    d = {
      date: r.date,
      runCount: 0,
      working: 0,
      quiet: 0,
      created: new Map(),
      edited: new Map(),
      brain: new Map(),
      flags: new Map(),
    };
    dayMap.set(r.date, d);
  }
  d.runCount++;
  if (r.quiet) d.quiet++;
  else d.working++;
  for (const s of r.created) dedupeAdd(d.created, s);
  for (const s of r.edited) dedupeAdd(d.edited, s);
  for (const s of r.brain) dedupeAdd(d.brain, s);
  for (const s of r.flags) dedupeAdd(d.flags, s);
}
function dedupeAdd(map, phrase) {
  const k = phrase.toLowerCase().slice(0, 70);
  if (!map.has(k)) map.set(k, phrase);
}

// Most recent day first (runs are already reversed, Map keeps insert order).
const days = [...dayMap.values()];
for (const d of days) {
  d.created = [...d.created.values()];
  d.edited = [...d.edited.values()];
  d.brain = [...d.brain.values()];
  d.flags = [...d.flags.values()];
  d.skillsN = d.created.length + d.edited.length;
}

const totals = {
  runs: runs.length,
  working: sum(days.map((d) => d.working)),
  quiet: sum(days.map((d) => d.quiet)),
  created: sum(days.map((d) => d.created.length)),
  edited: sum(days.map((d) => d.edited.length)),
  brain: sum(days.map((d) => d.brain.length)),
  flags: sum(days.map((d) => d.flags.length)),
  fired: firedCount,
  skipped: skippedCount,
};
function sum(a) {
  return a.reduce((x, y) => x + y, 0);
}

// Distinct skills ever created (the live question the user is tracking).
const createdSet = new Set();
for (const r of runs) for (const s of r.created) createdSet.add(s.toLowerCase());
const distinctCreated = [...createdSet];

const dateRange = runs.length
  ? { from: runs[runs.length - 1].date, to: runs[0].date }
  : null;
// ---------------------------------------------------------------------------
// 4. Story lines — rendering-side only. The parsed items above are dense log
//    fragments; the default view retells each day as a few story lines —
//    WHAT got sharper or learned, and WHY — grouped by the skill or page it
//    touched, not by run. The raw fragments stay behind "Show the full
//    detail". Parsing above is untouched.
// ---------------------------------------------------------------------------

// "project-notes.md" -> "Project notes"; "corrections-i-keep-giving" ->
// "Corrections I keep giving". Generic: works for any user's page names.
function humanizeName(raw) {
  let s = String(raw).split("/").pop().replace(/\.md$/i, "").replace(/[-_]+/g, " ").trim();
  if (!s) return "";
  s = s
    .split(" ")
    .map((w) => (/^(ui|ux|ai|api|css|db|id)$/i.test(w) ? w.toUpperCase() : w === "i" ? "I" : w))
    .join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Strip the mechanics a reader never asked for: timestamps, run counters,
// transcript ids, line/message refs, home paths, list enumerators.
function scrub(s) {
  return String(s)
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\(\s*(?:\d+(?:st|nd|rd|th)|\d+\+?)\s*(?:consecutive\s+)?runs?[^)]*\)/gi, " ")
    .replace(/\b(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?(?:\s*UTC)?(?:\s*[–—-]\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*UTC)?)?\b/gi, " ")
    .replace(/\btranscript\s+[0-9a-f]{6,}\b/gi, " ")
    .replace(/\b[0-9a-f]{8}\b/g, " ")
    .replace(/\b(?:lines?|msgs?|messages?)\s*~?\d+(?:\s*[–—-]\s*\d+)?\b/gi, " ")
    .replace(/~\/[\w./-]+/g, " ")
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/g, " ")
    .replace(/\(\s*[,;.]*\s*\)/g, " ")
    .replace(/\s+([,;.])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function skillSubjectOf(frag) {
  let m;
  if ((m = /([A-Za-z][\w-]*)\s*\/\s*SKILL\.md/.exec(frag))) return m[1].toLowerCase();
  if ((m = /\b([A-Za-z][\w-]{2,})\s+SKILL\.md/.exec(frag))) return m[1].toLowerCase();
  if ((m = /\bskill edits?:\s*([a-z][\w-]{2,})/i.exec(frag))) return m[1].toLowerCase();
  return null;
}
function brainSubjectOf(frag) {
  const re = /([\w'./-]*[\w'-])\.md\b/g;
  let m;
  while ((m = re.exec(frag))) {
    const base = m[1].split("/").pop().toLowerCase();
    if (base !== "skill") return base; // X/SKILL.md is a skill, not a page
  }
  if ((m = /^(.+?)\s*\(new page\)$/.exec(frag))) return m[1].split("/").pop().toLowerCase();
  return null;
}

function stripSubject(s, subj) {
  const t = subj.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return s
    .replace(new RegExp("['\"“”]?(?:[\\w~.-]+\\/)*" + t + "(?:\\s*\\/\\s*SKILL\\.md|\\.md)?['\"“”]?", "gi"), " ")
    .replace(/\bSKILL\.md\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Fragments that only report status, not new work — no story in them.
const STATUS_RE =
  /^(?:already|all\b|both\b|current|confirmed|synced|status|exists?\b|was\b|were\b|no\b|nothing|previous\b|fully\b|in both|retains|and\b|prior\b|parallel\b|this session)/i;

// Fragments that are really flags/blockers in disguise — they belong in the
// low "for your eyes" box or the full detail, never in a story line.
// (BLOCKED/FLAGGED are the log's uppercase state words; lowercase mentions
// like "blocked for 12 runs" inside a fix report are fine.)
function isBlockerFrag(frag) {
  return (
    /\bBLOCKED\b|\bFLAGGED\b|USER ACTION/.test(frag) ||
    /\buser must\b|\bneeds? manual\b|\bmanually add\b|permission[- ]gat|still points/i.test(frag)
  );
}

// Turn one raw fragment into the WHY of a story line, or null if it has none.
function reasonOf(frag, subj) {
  let s = scrub(frag);
  s = s.replace(
    /^(?:skill (?:edit|edits|fix|sync|flag)s?(?: applied| for user)?|brain(?: writes?| corrections?| current| updates?)?|memory updates?|this run(?: added)?|my contribution|one brain update|two changes|flag for (?:the )?(?:user|owner)|flagged for user)\s*[:—–-]?\s*/i,
    ""
  );
  if (subj) s = stripSubject(s, subj);
  s = s
    .replace(/^\s*[—–:;,./-]+\s*/, "")
    .replace(/^\+\d+\s*(?:entries|entry|additions?|corrections?|links?|sections?|notes?|open (?:questions?|items?)|open design (?:points?|questions?))?\s*[:—–-]?\s*/i, "")
    .replace(/^⚠\s*(?:OPEN (?:ITEM|TODO)|USER ACTION(?: NEEDED)?)?\s*(?:added)?\s*[:—–-]?\s*/i, "")
    .replace(/^\s*[—–:;,./-]+\s*/, "")
    .replace(/[\s—–:;,(-]+$/, "")
    .trim();
  // Unwrap a reason that is one whole parenthetical; drop unbalanced parens.
  const par = /^\(([^()]+)\)?$/.exec(s);
  if (par) s = par[1].trim();
  if (s.startsWith("(")) s = s.slice(1);
  const opens = (s.match(/\(/g) || []).length;
  const closes = (s.match(/\)/g) || []).length;
  if (opens !== closes)
    s = s.replace(/[()]/g, " ").replace(/\s+([,;.])/g, "$1").replace(/\s{2,}/g, " ").trim();
  s = s.trim();
  if (s.length < 10 || !/[a-z]{3}/i.test(s)) return null;
  if (!/^[A-Za-z0-9'"“⚠]/.test(s)) return null;
  if (STATUS_RE.test(s)) return null;
  // A reason that is itself a status note ("already current", "updated
  // accordingly") tells the reader nothing — drop it.
  if (/\balready\b|\bcurrent through\b|\ball current\b/i.test(s)) return null;
  if (/^(?:updated|corrected|extended|appended|noted|confirmed|synced|cleaned)(?:\s+accordingly)?\.?$/i.test(s)) return null;
  if (s.length > 140) s = s.slice(0, 140).replace(/\s+\S*$/, "") + "…";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Group a day's fragments by the skill/page they touched; keep the most
// informative reason per group as its story line.
function storyGroups(items, kind) {
  const groups = new Map();
  for (const frag of items) {
    if (kind === "skill" && isFlagFrag(frag)) continue; // flags live low on the page
    if (isBlockerFrag(frag)) continue; // a blocker in disguise, not work
    if (/^previous \d+ runs/i.test(frag)) continue; // recap of other runs, not work
    const subj = kind === "skill" ? skillSubjectOf(frag) : brainSubjectOf(frag);
    if (!subj) continue;
    let g = groups.get(subj);
    if (!g) {
      g = { subj, name: humanizeName(subj), isNew: false, touches: 0, reasons: [] };
      groups.set(subj, g);
    }
    g.touches++;
    if (/\(new page\)|\bCREATED\b/.test(frag)) g.isNew = true;
    const r = reasonOf(frag, subj);
    if (r) g.reasons.push(r);
  }
  const out = [...groups.values()].filter((g) => g.reasons.length || g.isNew);
  for (const g of out) g.why = g.reasons.slice().sort((a, b) => b.length - a.length)[0] || "";
  out.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.touches - a.touches);
  return out;
}

for (const d of days) {
  d.skillStory = storyGroups(d.edited, "skill");
  // A skill created this day joins the skills story, tagged — no separate bar.
  for (const name of d.created) {
    const k = name.toLowerCase();
    let g = d.skillStory.find((x) => x.subj === k);
    if (!g) {
      g = { subj: k, name: humanizeName(k), isNew: true, touches: 1, reasons: [], why: "" };
      d.skillStory.unshift(g);
    }
    g.isNew = true;
  }
  d.learnStory = storyGroups(d.brain, "brain");
}

// The three headline numbers: distinct skills sharpened, distinct things
// learned, sessions mined. Flags are NOT headline — they live low.
const skillSubjects = new Set();
const learnSubjects = new Set();
for (const d of days) {
  for (const g of d.skillStory) skillSubjects.add(g.subj);
  for (const g of d.learnStory) learnSubjects.add(g.subj);
}

// Open flags — things it left for the user's eyes. A flag is dropped when a
// later note says it was resolved, or when real work landed on the same
// skill/page (the improver got past the blocker itself).
const RESOLVED_RE = /\b(resolved|fixed|repointed|succeeded|applied via|now DONE|CLOSED|filed|SHIP|hardened)\b/;
const workedOn = new Set([...skillSubjects, ...learnSubjects]);
const flagGroups = new Map();
for (const d of days) {
  for (const frag of d.flags) {
    // Prefer the concrete .md file a flag names (so all flags about one file
    // land in one group), then fall back to a skill-name mention.
    const subj = brainSubjectOf(frag) || skillSubjectOf(frag);
    const key = subj || scrub(frag).toLowerCase().slice(0, 50);
    let g = flagGroups.get(key);
    if (!g) {
      g = { subj, frags: [], resolved: false };
      flagGroups.set(key, g);
    }
    g.frags.push(frag); // days are recent-first, so frags[0] is the latest word
    if (RESOLVED_RE.test(frag)) g.resolved = true;
  }
}
const openFlags = [];
for (const g of flagGroups.values()) {
  if (g.resolved) continue;
  if (g.subj && workedOn.has(g.subj)) continue;
  const frag = g.frags[0];
  let text = g.subj ? reasonOf(frag, g.subj) : null;
  if (!text) {
    // No subject: present the scrubbed fragment itself, but only if it can
    // stand alone as a plain sentence — headless shards stay in the detail.
    text = scrub(frag)
      .replace(/^(?:flag(?:ged)? for (?:the )?(?:user|owner))\s*[:—–-]?\s*/i, "")
      .replace(/^⚠\s*(?:OPEN (?:ITEM|TODO)|USER ACTION(?: NEEDED)?)?\s*(?:added)?\s*[:—–-]?\s*/i, "")
      .replace(/[()]/g, " ")
      .replace(/⚠/g, " ")
      .replace(/\bOPEN (?:TODO|ITEM)\s*:?\s*/g, "— ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (/^(?:is|was|are|were|and|hit|the|path|added as|needs manual)\b/i.test(text)) continue;
    if (text.length < 25) continue;
    // If it mentions something the improver later did real work on, the
    // day's story already covers it — don't nag twice.
    const low = text.toLowerCase();
    if ([...workedOn].some((t) => t.length >= 5 && low.includes(t))) continue;
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (!/[a-z]{3}/i.test(text)) continue;
  if (text.length > 140) text = text.slice(0, 140).replace(/\s+\S*$/, "") + "…";
  openFlags.push({ name: g.subj ? humanizeName(g.subj) : "", text });
}

// ---------------------------------------------------------------------------
// 5. Render HTML — one glance: three numbers, the day strip, then days that
//    open into story lines. Everything else is behind "Show the full detail".
// ---------------------------------------------------------------------------

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function utcDate(iso) {
  return new Date(iso + "T00:00:00Z");
}
function human(iso) {
  const d = utcDate(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
function humanLong(iso) {
  const d = utcDate(iso);
  return `${WDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
function plural(n, word, pl) {
  return `${n} ${n === 1 ? word : pl || word + "s"}`;
}

// --- Activity strip: one column per calendar day, gaps included, so
// accumulation over time is visible at a glance. (Kept as-is — raw volume.)
function stripHtml() {
  if (!dateRange) return "";
  const cols = [];
  const from = utcDate(dateRange.from);
  const to = utcDate(dateRange.to);
  let max = 1;
  for (const d of days) max = Math.max(max, d.skillsN + d.brain.length + d.flags.length);
  const H = 56; // px available for the tallest bar
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const d = dayMap.get(iso);
    if (!d) {
      cols.push(
        `<div class="col" title="${esc(human(iso))} — no runs"><div class="bar"><span class="zero"></span></div><span class="dl">${esc(human(iso))}</span></div>`
      );
      continue;
    }
    const segs = [
      ["skill", d.skillsN],
      ["brain", d.brain.length],
      ["flag", d.flags.length],
    ]
      .filter(([, n]) => n > 0)
      .map(([kind, n]) => {
        const h = Math.max(3, Math.round((n / max) * H));
        return `<span class="seg seg-${kind}" style="height:${h}px"></span>`;
      })
      .join("");
    const tip = `${human(iso)} — ${plural(d.skillsN, "skill change")}, ${plural(
      d.brain.length, "thing")} learned, ${d.flags.length} for your eyes`;
    cols.push(
      `<div class="col" title="${esc(tip)}"><div class="bar">${segs || '<span class="zero"></span>'}</div><span class="dl">${esc(human(iso))}</span></div>`
    );
  }
  return `<div class="strip glass" aria-label="Activity per day">
    <div class="cols">${cols.join("")}</div>
    <div class="legend">
      <span><i class="sw sw-skill"></i>Skills</span>
      <span><i class="sw sw-brain"></i>Learned</span>
      <span><i class="sw sw-flag"></i>For your eyes</span>
    </div>
  </div>`;
}

// --- Story list for one day: capped story lines, name + why.
const STORY_CAP = 5;
function storyList(kind, label, groups) {
  if (!groups.length) return "";
  const lis = groups
    .slice(0, STORY_CAP)
    .map((g) => {
      const tag = g.isNew
        ? `<span class="tag">${kind === "skill" ? "built new" : "new page"}</span> `
        : "";
      const why = g.why ? `<span class="why"> — ${esc(g.why)}</span>` : "";
      return `<li class="st-${kind}">${tag}<strong>${esc(g.name)}</strong>${why}</li>`;
    })
    .join("");
  const more =
    groups.length > STORY_CAP
      ? `<p class="morenote">+ ${groups.length - STORY_CAP} more in the full detail.</p>`
      : "";
  return `<div class="ssec"><h3 class="sl sl-${kind}">${label}</h3><ul class="story">${lis}</ul>${more}</div>`;
}

// --- Raw fragment list (inside "Show the full detail" only).
function rawList(kind, label, items) {
  if (!items.length) return "";
  return `<div class="sec"><h3 class="sl sl-${kind}">${label}<span class="sn">${items.length}</span></h3><ul>${items
    .map((t) => `<li>${esc(t)}</li>`)
    .join("")}</ul></div>`;
}

function dayHtml(d, idx) {
  const skillsStory = storyList("skill", "What got sharper", d.skillStory);
  const learnStory = storyList("brain", "What it learned", d.learnStory);
  const quietBody =
    !skillsStory && !learnStory
      ? `<p class="quietline">It ran, but found nothing new to change.</p>`
      : "";

  const rawInner =
    rawList("skill", "Skill notes", d.edited) +
    rawList("brain", "Brain notes", d.brain) +
    rawList("flag", "Left for your review", d.flags);
  const runLine = `<p class="runline">${plural(d.working, "working run")}${
    d.quiet ? ` and ${plural(d.quiet, "quiet sweep")}` : ""
  } produced these notes.</p>`;
  const detail = rawInner
    ? `<button class="reveal" type="button" aria-expanded="false">Show the full detail</button>
      <div class="raw" hidden>${runLine}${rawInner}</div>`
    : "";

  const chips =
    [
      d.skillStory.length
        ? `<span class="chip c-skill">${plural(d.skillStory.length, "skill")} sharper</span>`
        : "",
      d.learnStory.length
        ? `<span class="chip c-brain">${d.learnStory.length} learned</span>`
        : "",
    ].join("") || `<span class="chip">nothing new</span>`;

  const open = idx === 0; // most recent day starts open
  return `<section class="day glass${open ? " open" : ""}">
    <button class="dhead" type="button" aria-expanded="${open}">
      <svg class="caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="dd">${esc(humanLong(d.date))}</span>
      <span class="chips">${chips}</span>
    </button>
    <div class="dbody">
      ${quietBody}
      ${skillsStory}
      ${learnStory}
      ${detail}
    </div>
  </section>`;
}

const daysHtml = days.map((d, i) => dayHtml(d, i)).join("\n");

// --- The low flags box: what it left for the user, in plain words.
const eyesHtml = openFlags.length
  ? `<section class="eyes glass">
    <h2>${openFlags.length === 1 ? "1 thing" : openFlags.length + " things"} it wants your eyes on</h2>
    <ul>${openFlags
      .slice(0, 6)
      .map(
        (f) =>
          `<li>${f.name ? `<strong>${esc(f.name)}</strong> — ` : ""}${esc(f.text)}</li>`
      )
      .join("")}</ul>
    ${openFlags.length > 6 ? `<p class="morenote">The rest are in each day's full detail.</p>` : ""}
  </section>`
  : totals.flags
    ? `<p class="eyes-none">Nothing is waiting on you — everything it flagged was later handled.</p>`
    : "";

const createdSub = distinctCreated.length
  ? `including ${plural(distinctCreated.length, "brand-new skill")}: ${distinctCreated
      .map((s) => esc(s))
      .join(", ")}`
  : `all by sharpening skills that already exist`;

const periodLine = dateRange
  ? `Covering <strong>${esc(human(dateRange.from))} &ndash; ${esc(human(dateRange.to))}, ${utcDate(dateRange.to).getUTCFullYear()}</strong>.`
  : "No runs found yet.";

const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>The self-improver — what it has done</title>
<style>
  /* ============================================================
     The self-improver's surface, in the system diagram's world.
     Deep-space nebula floor · translucent glass panels with
     hairline borders + colored edge-glows · dog-eared page cards ·
     glowing green self-improve identity · palette on near-black.
     Palette (from system.svg): violet #a78bff · amber #e0905b ·
     green #5fd39b · cyan #38c7e8 · blue #6ea0ff · base #08090c.
     ============================================================ */
  :root{
    --base:#08090c; --base2:#0b0c12;
    --violet:#a78bff; --amber:#e0905b; --green:#5fd39b;
    --cyan:#38c7e8; --blue:#6ea0ff;
    /* text on dark — comfortable contrast for long reading */
    --ink:#e9ecf6; --ink-soft:#c7cddd; --muted:#8b93ab; --faint:#6b7288;
    /* one glass surface + one hairline, the diagram's two constants */
    --glass:rgba(255,255,255,0.045);
    --glass-lift:rgba(255,255,255,0.07);
    --hair:rgba(255,255,255,0.10);
    --hair-strong:rgba(255,255,255,0.18);
  }
  *{box-sizing:border-box}
  html{background:var(--base)}
  body{margin:0;color:var(--ink);position:relative;min-height:100vh;
    font:400 16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}

  /* ---- the deep-space nebula floor: base + four hue blooms + stars,
     a fixed layer the whole page floats on (system.svg's background). ---- */
  .sky{position:fixed;inset:0;z-index:-2;background:
    radial-gradient(120vmax 80vmax at 50% -8%, rgba(167,139,255,0.22), transparent 60%),
    radial-gradient(90vmax 80vmax at 4% 34%, rgba(224,144,91,0.14), transparent 60%),
    radial-gradient(90vmax 80vmax at 96% 40%, rgba(56,199,232,0.13), transparent 60%),
    radial-gradient(120vmax 90vmax at 50% 112%, rgba(95,211,155,0.20), transparent 62%),
    radial-gradient(140vmax 120vmax at 50% 20%, #13141d, #0b0c12 52%, #06070b 100%)}
  .stars{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.5;
    background-image:
      radial-gradient(1px 1px at 12% 18%, rgba(205,216,255,.7), transparent),
      radial-gradient(1px 1px at 82% 12%, rgba(205,216,255,.6), transparent),
      radial-gradient(1px 1px at 63% 8%, rgba(205,216,255,.5), transparent),
      radial-gradient(1px 1px at 27% 62%, rgba(205,216,255,.5), transparent),
      radial-gradient(1px 1px at 90% 55%, rgba(205,216,255,.55), transparent),
      radial-gradient(1px 1px at 6% 78%, rgba(205,216,255,.5), transparent),
      radial-gradient(1px 1px at 45% 90%, rgba(205,216,255,.45), transparent),
      radial-gradient(1px 1px at 73% 84%, rgba(205,216,255,.5), transparent),
      radial-gradient(1px 1px at 96% 92%, rgba(205,216,255,.4), transparent),
      radial-gradient(1px 1px at 35% 40%, rgba(205,216,255,.4), transparent)}

  .wrap{max-width:880px;margin:0 auto;padding:56px 24px 96px;position:relative;z-index:1}
  button{font:inherit;color:inherit}

  /* one reusable glass-panel chrome: translucent fill, hairline border,
     real blur, a soft drop + a colored edge-glow set per-zone via --edge. */
  .glass{position:relative;border-radius:18px;
    background:linear-gradient(180deg,var(--glass-lift),var(--glass));
    border:1px solid var(--hair);
    -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
    box-shadow:0 18px 46px -22px rgba(0,0,0,.7),
      inset 0 1px 0 rgba(255,255,255,.05),
      0 0 0 1px var(--edge,transparent),
      0 0 34px -14px var(--edge-glow,transparent)}

  /* ---- hero: the identity line, headline, three glowing stat panels ---- */
  .kicker{font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;
    color:var(--green);font-weight:700;margin:0 0 14px;
    text-shadow:0 0 16px rgba(95,211,155,.45)}
  h1{font:600 clamp(28px,4.6vw,40px)/1.14 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    margin:0 0 14px;letter-spacing:-.015em;text-wrap:balance;color:#f3f5fb}
  .lede{font-size:17px;line-height:1.62;color:var(--ink-soft);margin:0;max-width:60ch}
  .period{font-size:14px;color:var(--muted);margin:12px 0 0}
  .period strong{color:var(--ink-soft);font-weight:600}

  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:30px 0 0}
  @media(max-width:680px){.stats{grid-template-columns:1fr}}
  .stat{--edge:rgba(255,255,255,.06);--edge-glow:transparent;padding:18px 18px 16px;overflow:hidden}
  .stat::before{content:"";position:absolute;inset:0 0 auto 0;height:2px;
    background:linear-gradient(90deg,transparent,var(--dot,var(--green)),transparent);opacity:.9;
    box-shadow:0 0 14px var(--dot-glow,rgba(95,211,155,.5))}
  .stat .n{font:600 40px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;
    letter-spacing:-.02em;color:var(--dot,var(--green));
    text-shadow:0 0 22px var(--dot-glow,rgba(95,211,155,.4))}
  .stat .k{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink);margin-top:10px;font-weight:700}
  .stat .sub{font-size:12.5px;color:#9aa1b8;margin-top:5px;line-height:1.55}
  .stat.s-skill{--dot:var(--violet);--dot-glow:rgba(167,139,255,.4);--edge-glow:rgba(167,139,255,.5)}
  .stat.s-brain{--dot:var(--green);--dot-glow:rgba(95,211,155,.4);--edge-glow:rgba(95,211,155,.5)}
  .stat.s-runs{--dot:var(--blue);--dot-glow:rgba(110,160,255,.4);--edge-glow:rgba(110,160,255,.45)}

  /* ---- activity strip: bars in the palette hues, each with its own glow ---- */
  .strip{padding:20px 18px 14px;margin:16px 0 0;--edge-glow:rgba(110,160,255,.3)}
  .cols{display:flex;align-items:flex-end;gap:6px;overflow-x:auto;padding-bottom:2px}
  .col{flex:1 1 0;min-width:34px;max-width:96px;text-align:center}
  .bar{display:flex;flex-direction:column-reverse;align-items:stretch;justify-content:flex-start;
    height:64px;gap:3px}
  .seg{display:block;border-radius:3px}
  .seg-skill{background:var(--violet);box-shadow:0 0 12px -1px rgba(167,139,255,.7)}
  .seg-brain{background:var(--green);box-shadow:0 0 12px -1px rgba(95,211,155,.7)}
  .seg-flag{background:var(--amber);box-shadow:0 0 12px -1px rgba(224,144,91,.7)}
  .zero{display:block;height:3px;border-radius:3px;background:rgba(255,255,255,.08)}
  .dl{display:block;font-size:10.5px;color:var(--muted);margin-top:8px;letter-spacing:.03em;white-space:nowrap}
  .legend{display:flex;gap:18px;margin-top:14px;padding-top:12px;border-top:1px solid var(--hair);
    font-size:11.5px;color:var(--muted)}
  .legend span{display:inline-flex;align-items:center;gap:6px}
  .sw{width:9px;height:9px;border-radius:2.5px;display:inline-block}
  .sw-skill{background:var(--violet);box-shadow:0 0 8px rgba(167,139,255,.8)}
  .sw-brain{background:var(--green);box-shadow:0 0 8px rgba(95,211,155,.8)}
  .sw-flag{background:var(--amber);box-shadow:0 0 8px rgba(224,144,91,.8)}

  /* ---- the day ledger: each day a glass panel that opens into its story ---- */
  .hint{font-size:12.5px;color:var(--muted);display:block;margin:40px 0 14px;letter-spacing:.02em}
  .day{margin:0 0 12px;overflow:hidden;--edge-glow:rgba(95,211,155,.26)}
  .dhead{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:0;
    background:transparent;padding:16px 18px;cursor:pointer;min-height:52px}
  .dhead:hover{background:rgba(255,255,255,.03)}
  .dhead:focus-visible{outline:2px solid var(--green);outline-offset:-2px;border-radius:18px}
  .caret{flex:none;color:var(--green);transition:transform .2s;filter:drop-shadow(0 0 5px rgba(95,211,155,.6))}
  .day.open .caret{transform:rotate(90deg)}
  .dd{font:600 15.5px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;
    white-space:nowrap;color:#f0f2f9;letter-spacing:.01em}
  .chips{display:flex;gap:7px;flex-wrap:wrap;margin-left:auto;justify-content:flex-end}
  .chip{font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--muted);
    background:rgba(255,255,255,.05);border:1px solid var(--hair);
    padding:3px 11px;border-radius:999px;white-space:nowrap}
  .chip.c-skill{background:rgba(167,139,255,.14);border-color:rgba(167,139,255,.4);color:#cdbcff}
  .chip.c-brain{background:rgba(95,211,155,.14);border-color:rgba(95,211,155,.4);color:#9ce9c2}
  .dbody{display:none;padding:6px 20px 20px;border-top:1px solid var(--hair)}
  .day.open .dbody{display:block;animation:fadein .25s ease}
  @keyframes fadein{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}

  /* story lines — section titles as letter-spaced small-caps */
  .ssec{margin:18px 0 0}
  .sl{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;margin:0 0 10px}
  .sl-skill{color:var(--violet)} .sl-brain{color:var(--green)} .sl-flag{color:var(--amber)}
  .sn{font-weight:500;color:var(--muted);margin-left:8px;letter-spacing:0}
  .story{list-style:none;margin:0;padding:0}
  /* each story line reads as a dog-eared page-card: glass tile, folded top-right
     corner, a glowing colored dot at its head — the skills/pages the run touched. */
  .story li{position:relative;margin:0 0 9px;padding:11px 14px 11px 34px;font-size:14.5px;line-height:1.6;
    color:var(--ink-soft);background:var(--glass);border:1px solid var(--hair);border-radius:11px}
  .story li::after{content:"";position:absolute;top:0;right:0;width:14px;height:14px;
    background:var(--base2);
    border-left:1px solid var(--hair);border-bottom:1px solid var(--hair);
    border-bottom-left-radius:5px;border-top-right-radius:11px}
  .story li::before{content:"";position:absolute;left:14px;top:16px;width:8px;height:8px;border-radius:50%}
  .story li.st-skill::before{background:var(--violet);box-shadow:0 0 10px rgba(167,139,255,.9)}
  .story li.st-brain::before{background:var(--green);box-shadow:0 0 10px rgba(95,211,155,.9)}
  .story strong{font-weight:600;color:#f0f2f9}
  .story .why{color:#a6adc2}
  .tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
    color:#cdbcff;background:rgba(167,139,255,.16);border:1px solid rgba(167,139,255,.4);
    border-radius:5px;padding:1px 7px;margin-right:5px;vertical-align:1.5px}
  li.st-brain .tag{color:#9ce9c2;background:rgba(95,211,155,.16);border-color:rgba(95,211,155,.4)}
  .morenote{font-size:12.5px;color:var(--muted);margin:6px 0 0;font-style:italic}
  .quietline{font-size:13.5px;color:var(--muted);font-style:italic;margin:16px 0 2px}

  /* the full detail, behind a click */
  .reveal{display:inline-block;border:1px solid var(--hair-strong);background:rgba(255,255,255,.03);
    border-radius:999px;padding:6px 16px;font-size:12.5px;color:var(--ink-soft);cursor:pointer;
    margin-top:16px;transition:all .2s}
  .reveal:hover{color:var(--ink);border-color:rgba(95,211,155,.5);box-shadow:0 0 18px -6px rgba(95,211,155,.6)}
  .reveal:focus-visible{outline:2px solid var(--green);outline-offset:2px}
  .raw{margin-top:6px}
  .runline{font-size:12.5px;color:var(--muted);margin:12px 0 0;font-style:italic}
  .sec{margin:14px 0 0}
  .sec ul{margin:0;padding-left:18px}
  .sec li{margin:0 0 6px;font-size:13px;color:var(--muted);line-height:1.6}

  /* ---- flags, in amber glass — "wants your eyes on" ---- */
  .eyes{padding:20px 22px 18px;margin:32px 0 0;
    --edge:rgba(224,144,91,.28);--edge-glow:rgba(224,144,91,.4);
    background:linear-gradient(180deg,rgba(224,144,91,.1),rgba(224,144,91,.03))}
  .eyes h2{font:600 17px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;
    color:#f0b483;margin:0 0 12px;letter-spacing:.01em;
    text-shadow:0 0 20px rgba(224,144,91,.35)}
  .eyes ul{margin:0;padding:0;list-style:none}
  .eyes li{position:relative;font-size:14px;color:#f0dcc9;line-height:1.6;margin:0 0 8px;padding-left:20px}
  .eyes li::before{content:"";position:absolute;left:0;top:8px;width:7px;height:7px;border-radius:50%;
    background:var(--amber);box-shadow:0 0 9px rgba(224,144,91,.9)}
  .eyes strong{color:#f7c9a3;font-weight:600}
  .eyes-none{font-size:13.5px;color:var(--muted);font-style:italic;margin:32px 0 0}

  footer{margin-top:48px;color:var(--muted);font-size:13px;line-height:1.75}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;
    background:rgba(255,255,255,.06);color:var(--ink-soft);padding:1px 6px;border-radius:5px;
    border:1px solid var(--hair)}

  @media(prefers-reduced-motion:reduce){
    *{transition:none!important;animation:none!important}
  }
</style>
</head>
<body>
<div class="sky" aria-hidden="true"></div>
<div class="stars" aria-hidden="true"></div>
<div class="wrap">

  <header>
    <p class="kicker">Orient &middot; the self-improver</p>
    <h1>What the self-improver has been doing.</h1>
    <p class="lede">After each session it quietly sharpens its skills and files what it learned into its knowledge base — the brain. This is that record: the real work, with the mechanics filtered out.</p>
    <p class="period">${periodLine}</p>

    <div class="stats">
      <div class="stat glass s-skill">
        <div class="n">${skillSubjects.size}</div>
        <div class="k">Skills sharpened</div>
        <div class="sub">${createdSub}</div>
      </div>
      <div class="stat glass s-brain">
        <div class="n">${learnSubjects.size}</div>
        <div class="k">Things it learned</div>
        <div class="sub">topics written into its knowledge base</div>
      </div>
      <div class="stat glass s-runs">
        <div class="n">${totals.working}</div>
        <div class="k">Sessions mined</div>
        <div class="sub">runs that read real work and kept what mattered</div>
      </div>
    </div>

    ${stripHtml()}
  </header>

  <span class="hint">Most recent day first &mdash; click a day for the story.</span>

  ${daysHtml}

  ${eyesHtml}

  <footer>
    Generated ${esc(generatedAt)} from <code>~/.orient/self-improve.log</code>.
    Re-run <code>node surface/generate.mjs</code> to refresh.
  </footer>

</div>
<script>
(function () {
  var daySections = Array.prototype.slice.call(document.querySelectorAll(".day"));
  daySections.forEach(function (d) {
    var head = d.querySelector(".dhead");
    if (!head) return;
    head.addEventListener("click", function () {
      var open = !d.classList.contains("open");
      d.classList.toggle("open", open);
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
  Array.prototype.slice.call(document.querySelectorAll(".reveal")).forEach(function (b) {
    b.addEventListener("click", function () {
      var raw = b.nextElementSibling;
      if (!raw) return;
      var show = raw.hasAttribute("hidden");
      if (show) raw.removeAttribute("hidden");
      else raw.setAttribute("hidden", "");
      b.setAttribute("aria-expanded", show ? "true" : "false");
      b.textContent = show ? "Hide the full detail" : "Show the full detail";
    });
  });
})();
</script>
</body>
</html>
`;

writeFileSync(OUT_PATH, html, "utf8");

// A short console summary so a run is self-verifying.
console.log(`Source : ${LOG_PATH}`);
console.log(`Output : ${OUT_PATH}`);
console.log(
  `Parsed : ${totals.runs} runs (${totals.working} working, ${totals.quiet} quiet) across ${days.length} day(s); filtered ${totals.fired} FIRED + ${totals.skipped} skipped`
);
console.log(
  `Story  : ${skillSubjects.size} skills sharpened, ${learnSubjects.size} things learned, ${openFlags.length} open flag(s) for the user`
);
console.log(
  `Skills created (distinct): ${distinctCreated.length ? distinctCreated.join(", ") : "none"}`
);
