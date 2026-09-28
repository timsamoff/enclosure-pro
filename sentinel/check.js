#!/usr/bin/env node
// Sentinel gate checks for Enclosure Pro.
// Modes:
//   node sentinel/check.js            staged (pre-commit) checks
//   node sentinel/check.js --full     full-repo scan of HEAD (pre-push)
//   node sentinel/check.js --full --write-baseline   record current full-scan violations as baseline
//   node sentinel/check.js --local    working-tree checks for gitignored files (CLAUDE.md, sentinel-notes/)
// Rules and their origin are documented in sentinel-notes/INTEGRATION_CHECKLIST.md.

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
process.chdir(ROOT);

const EXCEPTIONS_FILE = "sentinel-exceptions.json";
const BASELINE_FILE = "sentinel-baseline.json";
const EXT_MANIFEST = "sentinel-known-extensions.txt";
const PENDING_FILE = path.join(gitDir(), "sentinel-pending.json");

// Rules that can be overridden per commit with a "Sentinel-Override: <RULE> <reason>" trailer.
// Mechanical rules (COLOR, DEBUG, VERSION, CATEGORY, API, MENU-ACTION, MENU-LABEL, EXT) cannot.
const OVERRIDABLE = new Set(["PALETTE", "SHAPE", "DOCS", "README", "DESIGN"]);

function git(args, opts = {}) {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function gitDir() {
  return path.resolve(execFileSync("git", ["rev-parse", "--git-dir"], { encoding: "utf8" }).trim());
}

// ---------- content access ----------

function stagedContent(file) {
  try {
    return git(["show", `:${file}`]);
  } catch {
    return null;
  }
}

function headContent(file) {
  try {
    return git(["show", `HEAD:${file}`]);
  } catch {
    return null;
  }
}

function stagedFiles() {
  const out = git(["diff", "--cached", "--name-status", "--no-renames", "-z"]);
  const parts = out.split("\0").filter(Boolean);
  const files = [];
  for (let i = 0; i < parts.length; i += 2) files.push({ status: parts[i], file: parts[i + 1] });
  return files;
}

// Added and removed lines of the staged diff (or the working-tree diff against HEAD) for one file,
// with new-file line numbers for additions.
function stagedDiff(file, cached = true) {
  const out = git(["diff", ...(cached ? ["--cached"] : ["HEAD"]), "-U0", "--no-color", "--no-ext-diff", "--", file]);
  const added = [];
  const removed = [];
  let newLine = 0;
  for (const line of out.split("\n")) {
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      newLine = parseInt(h[1], 10);
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added.push({ line: newLine++, text: line.slice(1) });
    else if (line.startsWith("-")) removed.push({ text: line.slice(1) });
  }
  return { added, removed };
}

// ---------- rule helpers ----------

const isClientSource = (f) => /^client\/src\/.+\.(ts|tsx)$/.test(f);

// Line ranges (1-based, inclusive) of a top-level `export const NAME = {` block.
function blockRange(content, name) {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^export const ${name}\\b`).test(l));
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth === 0 && i > start) return [start + 1, i + 1];
  }
  return [start + 1, lines.length];
}

const inRange = (r, n) => r && n >= r[0] && n <= r[1];

// Text of the brace-delimited declaration starting on the first line matching `re` ("" if absent).
function declBlock(content, re) {
  if (!content) return "";
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => re.test(l));
  if (start < 0) return "";
  let depth = 0;
  let opened = false;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") {
        depth++;
        opened = true;
      } else if (ch === "}") depth--;
    }
    if (opened && depth === 0) return lines.slice(start, i + 1).join("\n");
  }
  return lines.slice(start).join("\n");
}

// Did the saved-project format change? Compares the declarations themselves, not just their header lines.
const FORMAT_DECLS = [
  ["client/src/types/schema.ts", /^export interface ProjectState\b/],
  ["client/src/types/schema.ts", /^export interface PlacedComponent\b/],
  ["client/src/hooks/useFileOperations.ts", /const projectFileSchema\s*=/],
  ["client/src/hooks/useFileOperations.ts", /const legacyComponentSchema\s*=/],
];
function fileFormatChanged(oldContent, newContent) {
  return FORMAT_DECLS.some(([f, re]) => declBlock(oldContent(f), re) !== declBlock(newContent(f), re));
}

// What in this change does CLAUDE.md describe? Content-based, so trivial edits to these files don't trigger it.
function claudeReasons(addedText, changedText, formatChanged) {
  const r = [];
  if (addedText("client/src/types/schema.ts").some((t) => /^\s*["']?[A-Za-z0-9][\w-]*["']?\s*:\s*\{/.test(t))) r.push("new component type or enclosure");
  if (addedText("electron/main.js").some((t) => /^\s*label:\s*'/.test(t))) r.push("native menu item");
  if (changedText("electron/preload.js").some((t) => /^\s{2}\w+\s*:/.test(t))) r.push("preload bridge function");
  if (addedText("client/src/hooks/useKeyboardShortcuts.ts").some((t) => /e\.key|e\.code/.test(t)) || changedText("client/src/lib/hotkeys.ts").some((t) => /^\s*\w+\s*:/.test(t))) r.push("keyboard shortcut");
  if (formatChanged) r.push("save-file format");
  return r;
}

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\((?!\s*var\()/;
const DEBUG_RE = /console\.trace\s*\(|^\s*console\.log\s*\(/;
const VERSION_RE = /["'`]v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?["'`]/;
const CATEGORY_RES = [
  /\b(?:category|selectedCategory)\s*[!=]==?\s*["']([^"']+)["']/g,
  /["']([^"']+)["']\s*[!=]==?\s*(?:[\w.]+\.)?(?:category|selectedCategory)\b/g,
  /\bcategories\[\s*["']([^"']+)["']\s*\]/g,
];
const API_RE = /\belectronAPI\??\.(\w+)/g;

function categoriesFrom(schema) {
  const set = new Set();
  for (const m of schema.matchAll(/category:\s*"([^"]+)"/g)) set.add(m[1]);
  return set;
}

function preloadKeys(preload) {
  const start = preload.indexOf("exposeInMainWorld");
  const body = start >= 0 ? preload.slice(start) : preload;
  return new Set([...body.matchAll(/^\s{2}(\w+)\s*:/gm)].map((m) => m[1]));
}

function dtsKeys(dts) {
  const start = dts.indexOf("interface ElectronAPI");
  const end = dts.indexOf("declare global");
  const body = dts.slice(start, end > start ? end : undefined);
  return new Set([...body.matchAll(/^\s{2}(\w+)\s*:/gm)].map((m) => m[1]));
}

// Per-line content rules shared by staged (added lines) and full (all lines) modes.
function lineViolations(file, lines, ctx) {
  const v = [];
  if (!isClientSource(file)) return v;
  const mfr = file === "client/src/types/schema.ts" && ctx.fullContent ? blockRange(ctx.fullContent, "MANUFACTURERS") : null;
  for (const { line, text } of lines) {
    const t = text.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    // COLOR: exempt only inside the MANUFACTURERS data block of schema.ts (brand colors are data, not theme).
    if (COLOR_RE.test(text) && !inRange(mfr, line)) {
      v.push({ rule: "COLOR", file, line, text: t, fix: "Use a Tailwind token class or a shared color constant instead of a hardcoded color (see brand-color-token-design-brief.md)." });
    }
    if (DEBUG_RE.test(text)) {
      v.push({ rule: "DEBUG", file, line, text: t, fix: "Remove console.trace/console.log before committing (comment it out or delete it)." });
    }
    if (VERSION_RE.test(text)) {
      v.push({ rule: "VERSION", file, line, text: t, fix: "Don't hardcode a version; use import.meta.env.APP_VERSION (from package.json)." });
    }
    for (const re of CATEGORY_RES) {
      for (const m of text.matchAll(re)) {
        if (!ctx.categories.has(m[1])) {
          v.push({ rule: "CATEGORY", file, line, text: t, fix: `"${m[1]}" is not a category in schema.ts COMPONENT_TYPES (known: ${[...ctx.categories].join(", ")}).` });
        }
      }
    }
    for (const m of text.matchAll(API_RE)) {
      const name = m[1];
      const missing = [];
      if (!ctx.preload.has(name)) missing.push("electron/preload.js");
      if (!ctx.dts.has(name)) missing.push("client/src/types/electron.d.ts");
      if (missing.length) {
        v.push({ rule: "API", file, line, text: t, fix: `window.electronAPI.${name} is not defined in ${missing.join(" and ")}; add it there or call an existing function.` });
      }
    }
  }
  return v;
}

// Cross-file menu wiring checks, evaluated on whole-file content.
function menuViolations(mainJs, preload, designer) {
  const v = [];
  const sent = new Set([...mainJs.matchAll(/send\(\s*['"]menu-action['"]\s*,\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
  const handled = new Set([...preload.matchAll(/action\s*===\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
  for (const a of sent) if (!handled.has(a)) v.push({ rule: "MENU-ACTION", file: "electron/preload.js", text: `menu-action '${a}'`, fix: `main.js sends menu-action '${a}' but no preload listener handles it; add an onMenu… listener for '${a}'.` });
  for (const a of handled) if (!sent.has(a)) v.push({ rule: "MENU-ACTION", file: "electron/main.js", text: `menu-action '${a}'`, fix: `preload.js listens for menu-action '${a}' but main.js never sends it; remove the listener or wire the menu item.` });

  const onMenu = [...preload.matchAll(/^\s{2}(onMenu\w+)\s*:/gm)].map((m) => m[1]);
  for (const k of onMenu) if (!new RegExp(`electronAPI\\??\\.${k}\\b`).test(designer)) v.push({ rule: "MENU-ACTION", file: "client/src/pages/Designer.tsx", text: k, fix: `preload exposes ${k} but Designer.tsx never registers it, so that native menu item does nothing.` });

  // MENU-LABEL: updateMenuState's list must match real File menu labels, and every
  // initially-disabled item must be in that list or it can never be enabled.
  const upd = mainJs.match(/function updateMenuState[\s\S]*?const itemsToUpdate = \[([\s\S]*?)\];/);
  const listed = new Set(upd ? [...upd[1].matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]) : []);
  const tmplStart = mainJs.indexOf("function createApplicationMenu");
  const tmpl = tmplStart >= 0 ? mainJs.slice(tmplStart) : "";
  const labels = new Set();
  const disabled = [];
  let current = null;
  for (const l of tmpl.split("\n")) {
    const m = l.match(/^\s*label:\s*'([^']+)'/);
    if (m) {
      current = m[1];
      labels.add(current);
    }
    if (/enabled:\s*false/.test(l) && current) disabled.push(current);
  }
  for (const l of listed) if (!labels.has(l)) v.push({ rule: "MENU-LABEL", file: "electron/main.js", text: l, fix: `updateMenuState lists '${l}' but no File menu item has that label; update the list to match the menu.` });
  for (const d of disabled) if (!listed.has(d)) v.push({ rule: "MENU-LABEL", file: "electron/main.js", text: d, fix: `'${d}' starts disabled but isn't in updateMenuState's list, so it can never be enabled.` });
  return v;
}

// ---------- exceptions & baseline ----------

function loadExceptions() {
  if (!fs.existsSync(EXCEPTIONS_FILE)) return { active: [], expired: [] };
  let list;
  try {
    list = JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, "utf8"));
  } catch (e) {
    throw new Error(`${EXCEPTIONS_FILE} is not valid JSON: ${e.message}`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const active = [];
  const expired = [];
  for (const e of list) {
    const bad = ["rule", "files", "reason", "owner", "reviewBy"].filter((k) => !e[k]);
    if (bad.length) throw new Error(`${EXCEPTIONS_FILE}: entry missing ${bad.join(", ")}: ${JSON.stringify(e)}`);
    if (e.files.some((f) => /[*?]/.test(f))) throw new Error(`${EXCEPTIONS_FILE}: wildcards not allowed in files: ${JSON.stringify(e)}`);
    (e.reviewBy < today ? expired : active).push(e);
  }
  return { active, expired };
}

// An exception matches by rule + exact file + (optional) content substring, never by line number.
function isExcepted(v, exceptions) {
  return exceptions.some((e) => e.rule === v.rule && e.files.includes(v.file) && (!e.match || (v.text || "").includes(e.match)));
}

const baselineKey = (v) => `${v.rule}|${v.file}|${(v.text || "").trim()}`;

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
}

// ---------- output ----------

function report(title, violations) {
  if (!violations.length) return;
  console.error(`\n✖ Sentinel: ${title}`);
  for (const v of violations) {
    const loc = v.line ? `${v.file}:${v.line}` : v.file;
    console.error(`  [${v.rule}] ${loc}`);
    if (v.text) console.error(`      ${v.text.slice(0, 140)}`);
    console.error(`      → ${v.fix}`);
  }
}

// ---------- staged mode (pre-commit) ----------

function extOf(f) {
  const base = path.basename(f).toLowerCase();
  const ext = path.extname(base);
  return ext || `(none:${base.startsWith(".") ? base : "noext"})`;
}

function stagedMode() {
  const files = stagedFiles();
  if (!files.length) return 0;
  const names = new Set(files.map((f) => f.file));
  const has = (f) => names.has(f);

  const schema = stagedContent("client/src/types/schema.ts") || "";
  const preload = stagedContent("electron/preload.js") || "";
  const dts = stagedContent("client/src/types/electron.d.ts") || "";
  const baseCtx = { categories: categoriesFrom(schema), preload: preloadKeys(preload), dts: dtsKeys(dts) };

  const blocking = [];
  const overridable = [];
  const reminders = [];
  const diffs = {};
  for (const { status, file } of files) {
    if (status === "D") continue;
    diffs[file] = stagedDiff(file);
    const ctx = { ...baseCtx, fullContent: file.endsWith("schema.ts") ? schema : null };
    blocking.push(...lineViolations(file, diffs[file].added, ctx));
  }
  const addedText = (f) => (diffs[f] ? diffs[f].added.map((a) => a.text) : []);
  const changedText = (f) => (diffs[f] ? [...diffs[f].added, ...diffs[f].removed].map((a) => a.text) : []);

  // Cross-file menu wiring, whenever any of its files is staged.
  if (["electron/main.js", "electron/preload.js", "client/src/pages/Designer.tsx"].some(has)) {
    blocking.push(...menuViolations(stagedContent("electron/main.js") || "", preload, stagedContent("client/src/pages/Designer.tsx") || ""));
  }

  // EXT (Part 0b): first-ever file extension.
  const known = new Set(fs.existsSync(EXT_MANIFEST) ? fs.readFileSync(EXT_MANIFEST, "utf8").split(/\r?\n/).filter(Boolean) : []);
  const newExts = new Map();
  for (const { status, file } of files) {
    if (status !== "A") continue;
    const e = extOf(file);
    if (!known.has(e) && !newExts.has(e)) newExts.set(e, file);
  }

  // PALETTE (A3): new Footprint Guides entry without ComponentPalette.tsx.
  if (addedText("client/src/types/schema.ts").some((t) => /category:\s*"Footprint Guides"/.test(t)) && !has("client/src/components/ComponentPalette.tsx")) {
    overridable.push({ rule: "PALETTE", file: "client/src/types/schema.ts", fix: "A Footprint Guides entry was added. Does categorizeFootprintGuides in ComponentPalette.tsx put it in the right submenu? If yes without changes, add 'Sentinel-Override: PALETTE <reason>'." });
  }

  // SHAPE (A4/A5): shape handling changed in one renderer but not the other, or a new shape value.
  const shapeCmp = /\.shape\s*[!=]==/;
  const canvasShape = changedText("client/src/components/UnwrappedCanvas.tsx").some((t) => shapeCmp.test(t));
  const exportShape = changedText("client/src/hooks/useBaseExport.ts").some((t) => shapeCmp.test(t));
  const oldShapes = new Set([...(headContent("client/src/types/schema.ts") || "").matchAll(/shape:\s*"(\w+)"/g)].map((m) => m[1]));
  const newShape = addedText("client/src/types/schema.ts").map((t) => t.match(/shape:\s*"(\w+)"/)).find((m) => m && !oldShapes.has(m[1]));
  if ((canvasShape && !has("client/src/hooks/useBaseExport.ts")) || (exportShape && !has("client/src/components/UnwrappedCanvas.tsx")) || (newShape && !(has("client/src/components/UnwrappedCanvas.tsx") && has("client/src/hooks/useBaseExport.ts")))) {
    overridable.push({ rule: "SHAPE", file: canvasShape ? "client/src/components/UnwrappedCanvas.tsx" : exportShape ? "client/src/hooks/useBaseExport.ts" : "client/src/types/schema.ts", fix: "Shape rendering changed on one side only. Does the PDF export draw this exactly like the screen? Update both renderers, or add 'Sentinel-Override: SHAPE <reason>'." });
  }

  // DOCS (A10/B12/C5): user-visible feature changes need documentation.html or releases.html.
  const docTriggers = [];
  if (addedText("electron/main.js").some((t) => /^\s*label:\s*'/.test(t))) docTriggers.push("native menu item");
  for (const f of ["client/src/components/FileDropdownMenu.tsx", "client/src/components/AppIconMenu.tsx"]) if (addedText(f).some((t) => /<DropdownMenuItem\b/.test(t))) docTriggers.push(`menu item in ${path.basename(f)}`);
  if (addedText("client/src/hooks/useKeyboardShortcuts.ts").some((t) => /e\.key/.test(t))) docTriggers.push("keyboard shortcut");
  if (addedText("client/src/hooks/useContextMenu.ts").some((t) => /const handle\w+/.test(t)) || addedText("client/src/pages/Designer.tsx").some((t) => /contextMenu\.handle\w+\(/.test(t))) docTriggers.push("context menu action");
  if (addedText("client/src/types/schema.ts").some((t) => /^\s*["']?[A-Za-z0-9][\w-]*["']?\s*:\s*\{/.test(t))) docTriggers.push("new component type or enclosure");
  if (docTriggers.length && !has("documentation.html") && !has("releases.html")) {
    overridable.push({ rule: "DOCS", file: "documentation.html", fix: `User-visible change (${docTriggers.join(", ")}) without documentation.html or releases.html. Document it, or add 'Sentinel-Override: DOCS <reason>'. (This only checks the file was touched, not that the new thing is actually described.)` });
  }

  // README: high-level only (build scripts, new top-level folder, license).
  const headTop = new Set(git(["ls-tree", "--name-only", "HEAD"]).split("\n").filter(Boolean));
  const newTop = files.filter((f) => f.status === "A" && f.file.includes("/") && !headTop.has(f.file.split("/")[0])).map((f) => f.file.split("/")[0]);
  const pkgScripts = changedText("package.json").some((t) => /"(electron:|build|dev|start|clean)[\w:-]*"\s*:/.test(t));
  if ((newTop.length || pkgScripts || has("LICENSE")) && !has("README.md")) {
    overridable.push({ rule: "README", file: "README.md", fix: `High-level change (${[newTop.length && `new folder ${[...new Set(newTop)].join(", ")}`, pkgScripts && "build scripts", has("LICENSE") && "LICENSE"].filter(Boolean).join(", ")}) without README.md. Update it, or add 'Sentinel-Override: README <reason>'.` });
  }

  // DESIGN: architectural changes only (threshold confirmed by the user).
  const designTriggers = [];
  if (changedText("electron/main.js").some((t) => /webPreferences|new BrowserWindow|requestSingleInstanceLock|second-instance|open-file|loadFile|contextIsolation|sandbox/.test(t))) designTriggers.push("main process window/process setup");
  if (changedText("electron/preload.js").some((t) => /^\s{2}\w+\s*:/.test(t))) designTriggers.push("preload bridge shape");
  const formatChanged = fileFormatChanged(headContent, (f) => (has(f) ? stagedContent(f) : headContent(f)));
  if (formatChanged) designTriggers.push("project file format");
  if (files.some((f) => (f.status === "A" || f.status === "D") && /^client\/src\/hooks\/\w*Export\w*\.ts$/.test(f.file))) designTriggers.push("export pipeline structure");
  if (newTop.length) designTriggers.push("new top-level folder");
  if (designTriggers.length && !has("DESIGN.md")) {
    overridable.push({ rule: "DESIGN", file: "DESIGN.md", fix: `Architectural change (${designTriggers.join(", ")}) without DESIGN.md. Update it, or add 'Sentinel-Override: DESIGN <reason>'.` });
  }

  // Reminders (non-blocking).
  if (changedText("package.json").some((t) => /"version"\s*:/.test(t))) reminders.push("Version bump detected: review DESIGN.md for anything this release made inaccurate.");
  reminders.push(...localReminders(claudeReasons(addedText, changedText, formatChanged)));

  // Apply standing exceptions.
  const { active, expired } = loadExceptions();
  const keep = (v) => !isExcepted(v, active);
  const block = blocking.filter(keep);
  const over = overridable.filter(keep);
  for (const e of expired) console.error(`⚠ Sentinel: exception for ${e.rule} (${e.files.join(", ")}) expired ${e.reviewBy}; it no longer applies.`);

  for (const r of reminders) console.error(`• Sentinel reminder: ${r}`);

  // Overridable findings are decided in commit-msg, where the trailer is visible.
  if (over.length) fs.writeFileSync(PENDING_FILE, JSON.stringify(over, null, 2));
  else if (fs.existsSync(PENDING_FILE)) fs.unlinkSync(PENDING_FILE);

  let failed = false;
  if (block.length) {
    report("blocking violations in staged changes", block);
    failed = true;
  }
  if (newExts.size) {
    console.error("\n✖ Sentinel [EXT]: first-ever file type(s) in this project:");
    for (const [e, f] of newExts) console.error(`  ${e}  (${f})`);
    console.error("  Before committing, answer:");
    console.error("   1. What kind of file is this (image, 3D model, audio, new source language, document)?");
    console.error("   2. Does it need design-quality review (01's Part 7 creative-media check)? If so, raise it at the next 01 run.");
    console.error("   3. Is it referenced elsewhere in a way the integration checklist should track? If so, add a TODO for the next 02 run.");
    console.error("   A one-off file needs nothing further.");
    fs.appendFileSync(EXT_MANIFEST, [...newExts.keys()].map((e) => e + "\n").join(""));
    console.error(`  Recorded in ${EXT_MANIFEST}. Stage it (git add ${EXT_MANIFEST}) and commit again.`);
    failed = true;
  }
  if (over.length && !failed) {
    console.error(`• Sentinel: ${over.length} item(s) need a fix or a Sentinel-Override trailer; the commit message check will decide.`);
  }
  return failed ? 1 : 0;
}

// ---------- local (gitignored) files: working tree, never staged ----------

function mtime(f) {
  try {
    return fs.statSync(f).mtimeMs;
  } catch {
    return null;
  }
}

function localReminders(reasons) {
  const out = [];
  const lastCommit = parseInt(git(["log", "-1", "--format=%ct"]).trim() || "0", 10) * 1000;
  if (reasons.length) {
    const m = mtime("CLAUDE.md");
    if (m === null) out.push("CLAUDE.md is missing; it's the project's context file.");
    else if (m < lastCommit) out.push(`This change adds or alters something CLAUDE.md describes (${reasons.join(", ")}), but CLAUDE.md hasn't changed since the last commit. Does it need a line? (CLAUDE.md is gitignored, so this can't block.)`);
  }
  const todo = mtime("sentinel-notes/TODO.md");
  if (todo !== null) {
    for (const b of fs.readdirSync("sentinel-notes").filter((f) => f.endsWith("-design-brief.md"))) {
      if (mtime(path.join("sentinel-notes", b)) > todo) out.push(`sentinel-notes/${b} changed after TODO.md; update the matching TODO line (move it to Done if finished).`);
    }
  }
  return out;
}

// Manual command for the gitignored files: the brief/TODO sync is a real failure here.
function localMode() {
  const todo = mtime("sentinel-notes/TODO.md");
  const v = [];
  if (todo === null) v.push({ rule: "TODO-SYNC", file: "sentinel-notes/TODO.md", fix: "TODO.md is missing." });
  else {
    for (const b of fs.readdirSync("sentinel-notes").filter((f) => f.endsWith("-design-brief.md"))) {
      if (mtime(path.join("sentinel-notes", b)) > todo) v.push({ rule: "TODO-SYNC", file: `sentinel-notes/${b}`, fix: "Brief changed after TODO.md; update the matching TODO line's status." });
    }
  }
  // Uncommitted working-tree changes against HEAD, judged the same way as a commit.
  const changed = new Set(git(["diff", "--name-only", "HEAD"]).split("\n").filter(Boolean));
  const wt = {};
  const diffOf = (f) => (changed.has(f) ? (wt[f] = wt[f] || stagedDiff(f, false)) : { added: [], removed: [] });
  const addedWT = (f) => diffOf(f).added.map((a) => a.text);
  const changedWT = (f) => [...diffOf(f).added, ...diffOf(f).removed].map((a) => a.text);
  const readWT = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);
  const soft = localReminders(claudeReasons(addedWT, changedWT, fileFormatChanged(headContent, readWT))).filter((r) => r.startsWith("This change") || r.startsWith("CLAUDE.md"));
  for (const r of soft) console.error(`• Sentinel reminder: ${r}`);
  console.error("• Sentinel reminder: plain one-line TODO items can't be checked mechanically; if you finished one, move it to Done.");
  if (v.length) {
    report("local notes out of sync", v);
    return 1;
  }
  console.error("✓ Sentinel local checks passed.");
  return 0;
}

// ---------- full mode (pre-push) ----------

function fullViolations() {
  const files = git(["ls-files"]).split("\n").filter(Boolean);
  const schema = headContent("client/src/types/schema.ts") || "";
  const preloadSrc = headContent("electron/preload.js") || "";
  const ctx = { categories: categoriesFrom(schema), preload: preloadKeys(preloadSrc), dts: dtsKeys(headContent("client/src/types/electron.d.ts") || "") };
  const v = [];
  for (const f of files.filter(isClientSource)) {
    const content = headContent(f);
    if (content === null) continue;
    const lines = content.split("\n").map((text, i) => ({ line: i + 1, text }));
    v.push(...lineViolations(f, lines, { ...ctx, fullContent: f.endsWith("schema.ts") ? content : null }));
  }
  v.push(...menuViolations(headContent("electron/main.js") || "", preloadSrc, headContent("client/src/pages/Designer.tsx") || ""));

  // D5: website fallback download links should point at the current version.
  const version = JSON.parse(headContent("package.json")).version;
  const index = headContent("index.html") || "";
  for (const m of index.matchAll(/releases\/download\/(v[\d.]+[^/]*)\//g)) {
    if (m[1] !== `v${version}`) v.push({ rule: "DOWNLOAD-URL", file: "index.html", text: m[0], fix: `Fallback download link points at ${m[1]}; package.json is ${version}.` });
  }
  return v;
}

function tscErrorCount() {
  const r = spawnSync(process.execPath, [path.join("node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "."], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`could not run tsc: ${r.error.message}`);
  const count = (r.stdout.match(/error TS\d+/g) || []).length;
  if (r.status !== 0 && count === 0) throw new Error(`tsc failed without reporting errors:\n${r.stdout}${r.stderr}`);
  return count;
}

function hookIntegrity() {
  const v = [];
  let hooksPath = "";
  try {
    hooksPath = git(["config", "core.hooksPath"]).trim();
  } catch {}
  if (hooksPath !== ".githooks") v.push({ rule: "HOOKS", file: ".git/config", fix: "core.hooksPath is not '.githooks'; run: npm run sentinel:install" });
  const staged = git(["ls-files", "-s", ".githooks"]);
  for (const h of ["pre-commit", "commit-msg", "pre-push"]) {
    if (!fs.existsSync(path.join(".githooks", h))) v.push({ rule: "HOOKS", file: `.githooks/${h}`, fix: "Hook file is missing; restore it from git." });
    else if (!new RegExp(`^100755 .*\\t\\.githooks/${h}$`, "m").test(staged)) v.push({ rule: "HOOKS", file: `.githooks/${h}`, fix: `Hook isn't executable in git; run: git update-index --chmod=+x .githooks/${h}` });
  }
  return v;
}

function fullMode(writeBaseline) {
  const violations = fullViolations();
  const tsc = tscErrorCount();
  if (writeBaseline) {
    const data = { generated: new Date().toISOString().slice(0, 10), tscErrors: tsc, violations: violations.map(baselineKey).sort() };
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(data, null, 2) + "\n");
    console.error(`Sentinel: wrote ${BASELINE_FILE} (${violations.length} known violations, ${tsc} tsc errors).`);
    return 0;
  }
  const baseline = loadBaseline();
  if (!baseline) throw new Error(`${BASELINE_FILE} is missing; run: node sentinel/check.js --full --write-baseline`);
  const known = new Set(baseline.violations);
  const { active, expired } = loadExceptions();
  const fresh = violations.filter((v) => !known.has(baselineKey(v)) && !isExcepted(v, active));
  const infra = hookIntegrity();
  let failed = false;
  if (fresh.length) {
    report("new violations (not in baseline)", fresh);
    failed = true;
  }
  if (infra.length) {
    report("gate-check infrastructure", infra);
    failed = true;
  }
  if (tsc > baseline.tscErrors) {
    console.error(`\n✖ Sentinel [TSC]: ${tsc} type errors, baseline is ${baseline.tscErrors}. Run 'npm run check' and fix the new ones.`);
    failed = true;
  } else if (tsc < baseline.tscErrors) {
    console.error(`• Sentinel: tsc errors dropped to ${tsc} (baseline ${baseline.tscErrors}); rerun with --write-baseline to lock in the improvement.`);
  }
  if (expired.length) {
    for (const e of expired) console.error(`✖ Sentinel [EXCEPTION]: ${e.rule} exception for ${e.files.join(", ")} expired ${e.reviewBy}; renew or remove it.`);
    failed = true;
  }
  const stale = baseline.violations.length - violations.filter((v) => known.has(baselineKey(v))).length;
  console.error(`Sentinel full scan: ${violations.length} total, ${violations.length - fresh.length} known/excepted, ${fresh.length} new; ${stale} baseline entries resolved.`);
  if (!failed) console.error("✓ Sentinel full scan passed.");
  return failed ? 1 : 0;
}

// ---------- entry ----------

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--local")) return localMode();
  if (args.includes("--full")) return fullMode(args.includes("--write-baseline"));
  return stagedMode();
}

try {
  process.exitCode = main();
} catch (e) {
  // A check that can't run is a failure, never a silent pass.
  console.error(`✖ Sentinel could not run: ${e.message}`);
  process.exitCode = 2;
}
