#!/usr/bin/env node
// Sentinel commit-msg check for Enclosure Pro.
// Convention (CLAUDE.md): one-line past-tense subject <= 72 chars; optional body of up to
// 5 "- " bullets, <= 80 chars per line, a bullet may wrap onto one indented continuation
// line (<= 160 chars combined). No attribution/co-author lines. Also resolves the
// overridable findings pre-commit left in .git/sentinel-pending.json.
// Usage: node sentinel/commit-msg.js <message-file>
//        node sentinel/commit-msg.js --validate "<message text>"   (for testing/history checks)

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SUBJECT_MAX = 72;
const LINE_MAX = 80;
const BULLET_MAX = 160;
const BULLETS_MAX = 5;

// Attribution lines some AI tools add. These are stripped, never kept.
const ATTRIBUTION = [
  /^\s*co-authored-by:/i,
  /generated with \[?claude code/i,
  /^\s*claude-session:/i,
  /^\s*🤖/,
  /^\s*generated (by|with) (claude|codex|copilot|cursor|chatgpt)/i,
];
const OVERRIDE_RE = /^Sentinel-Override:\s*([A-Z-]+)\s+(\S.*)$/;

function validate(raw, pending = []) {
  const errors = [];
  let lines = raw.replace(/\r\n/g, "\n").split("\n");
  // git's default cleanup drops comment lines; ignore them here too (and everything after the scissors line).
  const scissors = lines.findIndex((l) => /^# -+ >8 -+/.test(l));
  if (scissors >= 0) lines = lines.slice(0, scissors);
  lines = lines.filter((l) => !l.startsWith("#"));

  const stripped = lines.filter((l) => ATTRIBUTION.some((re) => re.test(l)));
  lines = lines.filter((l) => !ATTRIBUTION.some((re) => re.test(l)));
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

  // Trailers: a final block of Sentinel-Override lines.
  const overrides = new Map();
  while (lines.length && OVERRIDE_RE.test(lines[lines.length - 1])) {
    const m = lines.pop().match(OVERRIDE_RE);
    overrides.set(m[1], m[2]);
  }
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

  const subject = lines[0] || "";
  const isMerge = /^Merge (branch|pull request|remote-tracking branch|tag) /.test(subject);

  if (!subject.trim()) errors.push({ rule: "SUBJECT", msg: "Empty subject line." });
  else if (!isMerge) {
    if (subject.length > SUBJECT_MAX) errors.push({ rule: "SUBJECT", msg: `Subject is ${subject.length} chars; the limit is ${SUBJECT_MAX}. Shorten it, or split the commit if it covers several things.` });
    if (/^\s|^- /.test(subject)) errors.push({ rule: "SUBJECT", msg: "Subject must be a plain sentence, not indented or a bullet." });
  }

  const body = lines.slice(1);
  if (body.length && !isMerge) {
    if (body[0].trim() !== "") errors.push({ rule: "BODY", msg: "Put a blank line between the subject and the body." });
    const rest = body.slice(1);
    const bullets = [];
    let narrative = false;
    for (const l of rest) {
      if (l.trim() === "") {
        errors.push({ rule: "BODY", msg: "No blank lines inside the body; this project's body is a single bullet list, not paragraphs." });
        narrative = true;
        continue;
      }
      if (l.length > LINE_MAX) errors.push({ rule: "BODY", msg: `Line is ${l.length} chars (limit ${LINE_MAX}): "${l.slice(0, 60)}…"` });
      if (/^- \S/.test(l)) bullets.push([l]);
      else if (/^ {2,}\S/.test(l) && bullets.length && bullets[bullets.length - 1].length === 1) bullets[bullets.length - 1].push(l);
      else {
        narrative = true;
        errors.push({ rule: "BODY", msg: /^ {2,}\S/.test(l) ? `A bullet may wrap onto only one indented line: "${l.trim().slice(0, 60)}"` : `Body lines must be "- " bullets (or one indented continuation line), not prose: "${l.slice(0, 60)}"` });
      }
    }
    for (const b of bullets) {
      const combined = b.map((x) => x.trim()).join(" ").length;
      if (combined > BULLET_MAX) errors.push({ rule: "BODY", msg: `A bullet is ${combined} chars across its lines (limit ${BULLET_MAX}): "${b[0].slice(0, 50)}…"` });
    }
    if (bullets.length > BULLETS_MAX && !overrides.has("BULLETS")) {
      errors.push({ rule: "BULLETS", msg: `${bullets.length} bullets (limit ${BULLETS_MAX}). Does this commit bundle several separate things? Consider splitting it, or describe it with fewer, broader bullets. If it's genuinely one unit, add 'Sentinel-Override: BULLETS <reason>'.` });
    }
    if (narrative && bullets.length === 0 && rest.length) errors.push({ rule: "BODY", msg: "Narrative bodies aren't allowed in this project (no override). Use a few '- ' bullets, or none." });
  }

  for (const p of pending) {
    if (!overrides.has(p.rule)) errors.push({ rule: p.rule, msg: `${p.fix}` });
  }

  return { errors, stripped };
}

function gitDir() {
  return path.resolve(execFileSync("git", ["rev-parse", "--git-dir"], { encoding: "utf8" }).trim());
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--validate") {
    const { errors } = validate(args[1] || "");
    for (const e of errors) console.log(`[${e.rule}] ${e.msg}`);
    return errors.length ? 1 : 0;
  }
  const file = args[0];
  if (!file) throw new Error("no commit message file given");
  const raw = fs.readFileSync(file, "utf8");
  const pendingFile = path.join(gitDir(), "sentinel-pending.json");
  const pending = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile, "utf8")) : [];

  const { errors, stripped } = validate(raw, pending);
  if (stripped.length) {
    // Remove attribution lines from the actual message, keeping everything else as written.
    const kept = raw.replace(/\r\n/g, "\n").split("\n").filter((l) => !ATTRIBUTION.some((re) => re.test(l))).join("\n");
    fs.writeFileSync(file, kept);
    console.error(`• Sentinel: removed ${stripped.length} attribution line(s): ${stripped.map((s) => s.trim()).join(" | ")}`);
  }
  if (errors.length) {
    console.error("\n✖ Sentinel: commit message rejected");
    for (const e of errors) console.error(`  [${e.rule}] ${e.msg}`);
    console.error("  (Your message was saved in .git/COMMIT_EDITMSG.)");
    return 1;
  }
  if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  console.error(`✖ Sentinel commit-msg could not run: ${e.message}`);
  process.exitCode = 2;
}
