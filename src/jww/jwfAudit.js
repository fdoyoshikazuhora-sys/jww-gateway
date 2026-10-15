import { decodeJwfBytes, parseJwfText } from "./jwf.js";

const ASSIGNMENT = /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/;
const STARTUP_ONLY = new Set(["S_COMM_0", "S_MESH_0"]);

function byteLines(bytes) {
  const lines = [];
  let start = 0;
  for (let i = 0; i <= bytes.length; i += 1) {
    if (i !== bytes.length && bytes[i] !== 10 && bytes[i] !== 13) continue;
    const contentEnd = i;
    if (bytes[i] === 13 && bytes[i + 1] === 10) i += 1;
    const end = Math.min(i + 1, bytes.length);
    if (start < bytes.length || !lines.length) lines.push({ line: lines.length + 1, start, contentEnd, end });
    start = end;
  }
  return lines;
}

// This inventories source syntax; a parseable assignment is not proof that
// Jw_cad implements the key, accepts its values, or persists it in a JWW.
export function auditJwfBytes(input) {
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input || []);
  if ((bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) ||
      (bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 254 && bytes[1] === 255)) {
    throw new Error("The activation audit requires Shift_JIS source bytes, not a Unicode BOM");
  }
  const rows = [];
  const controls = [];
  let firstEndLine = null;
  let section = "";
  let commentCount = 0;
  let blankCount = 0;
  const otherLines = [];
  const lines = byteLines(bytes);
  for (const span of lines) {
    let raw;
    try { raw = new TextDecoder("shift_jis", { fatal: true }).decode(bytes.slice(span.start, span.contentEnd)); }
    catch { throw new Error(`Invalid Shift_JIS bytes at source line ${span.line}`); }
    const trimmed = raw.trim();
    if (!trimmed) { blankCount += 1; continue; }
    const commented = /^[ \t]*#/.test(raw);
    const content = commented ? raw.replace(/^([ \t]*)#/, "$1") : raw;
    const sectionMatch = raw.match(/^[ \t]*#\s*\u25ce(.*)$/u);
    if (sectionMatch) section = sectionMatch[1].trim();
    if (/^END\b/i.test(content.trim())) {
      controls.push({ ...span, kind: commented ? "commented-end" : "end", afterEnd: firstEndLine !== null });
      if (!commented && firstEndLine === null) firstEndLine = span.line;
      continue;
    }
    const match = ASSIGNMENT.exec(content);
    if (!match) {
      if (commented || trimmed.startsWith("//")) commentCount += 1;
      else otherLines.push({ ...span, kind: /^\d+[ \t]*=/.test(trimmed) ? "numeric-reference-row" : "unrecognized-line" });
      continue;
    }
    const key = match[1];
    const parsed = parseJwfText(`${content}\r\nEND\r\n`);
    const entry = Object.hasOwn(parsed.entries, key) ? parsed.entries[key] : null;
    const definition = entry?.definition || null;
    const afterEnd = firstEndLine !== null;
    const sameKey = (other) => other.key.toUpperCase() === key.toUpperCase();
    const previous = rows.filter(sameKey).map((other) => other.line);
    const reasons = [];
    if (commented) reasons.push("commented-assignment-requires-context-review");
    if (afterEnd) reasons.push("blocked-by-END-in-source");
    if (previous.length) reasons.push("alternative-or-duplicate-key");
    if (!definition) reasons.push("key-semantics-unverified");
    if (STARTUP_ONLY.has(key)) reasons.push("startup-only-reference");
    if (key === "REF_FILE") reasons.push("external-reference-requires-review");
    rows.push({
      ...span, key, section, commented, afterEnd,
      state: commented ? "commented-assignment" : afterEnd ? "after-END" : "active-assignment",
      values: entry?.values || [], family: entry?.family || "unknown",
      label: definition?.label || null,
      scope: definition?.scope || "unknown",
      definitionCoverage: !definition ? "unverified" : definition.valueSchema?.some((field) => field.includes("...")) ? "partial" : "named-fields-not-native-verified",
      requiredLoadMode: STARTUP_ONLY.has(key) ? "startup" : "unverified",
      previousSameKeyLines: previous, reviewReasons: reasons,
      rawLine: raw,
    });
  }
  for (const row of rows) {
    row.sameKeyLines = rows.filter((other) => other.key.toUpperCase() === row.key.toUpperCase()).map((other) => other.line);
    if (row.sameKeyLines.length > 1 && !row.reviewReasons.includes("alternative-or-duplicate-key")) row.reviewReasons.push("alternative-or-duplicate-key");
  }
  return {
    format: "jwf-activation-audit", formatVersion: 1,
    byteLength: bytes.length, lineCount: lines.length, firstEndLine, encoding: "shift_jis",
    nativeEvidence: "not-run",
    summary: {
      assignmentRows: rows.length,
      uniqueKeys: new Set(rows.map((row) => row.key)).size,
      activeRows: rows.filter((row) => row.state === "active-assignment").length,
      commentedRows: rows.filter((row) => row.commented).length,
      afterEndRows: rows.filter((row) => !row.commented && row.afterEnd).length,
      unverifiedDefinitionRows: rows.filter((row) => row.definitionCoverage === "unverified").length,
      commentCount, blankCount, otherLineCount: otherLines.length,
    },
    rows, controls, otherLines,
  };
}

function concatenate(...parts) {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}

export function createJwfActivationProbe(input, { line, expectedKey, reviewed = false, loadMode } = {}) {
  if (!reviewed) throw new Error("Review the source context and dependencies before generating an activation probe");
  if (!["manual", "startup"].includes(loadMode)) throw new Error("Choose an explicit manual or startup load mode");
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input || []);
  const audit = auditJwfBytes(bytes);
  const row = audit.rows.find((item) => item.line === line);
  if (!row || row.key !== expectedKey) throw new Error("Selected source line/key no longer matches the reviewed assignment");
  if (!row.commented) throw new Error("Activation probes require a commented assignment, not an active row, END, or explanation");
  if (row.requiredLoadMode === "startup" && loadMode !== "startup") throw new Error(`${row.key} requires the startup test protocol`);
  if (row.definitionCoverage === "unverified" || row.key === "REF_FILE") throw new Error(`${row.key} remains unverified; do not activate it speculatively`);
  const source = bytes.slice(row.start, row.contentEnd);
  let marker = 0;
  while ([9, 32].includes(source[marker])) marker += 1;
  if (source[marker] !== 35) throw new Error("The selected line does not have an ASCII comment marker");
  // Refuse malformed input; never replace undecodable source characters.
  new TextDecoder("shift_jis", { fatal: true }).decode(source);
  const active = concatenate(source.slice(0, marker), source.slice(marker + 1));
  const suffix = Uint8Array.from([13, 10, 69, 78, 68, 13, 10]);
  const inactiveBytes = concatenate(source, suffix);
  const activeBytes = concatenate(active, suffix);
  const inactiveParsed = parseJwfText(decodeJwfBytes(inactiveBytes));
  const activeParsed = parseJwfText(decodeJwfBytes(activeBytes));
  if (inactiveParsed.entryCount !== 0 || activeParsed.entryCount !== 1 || activeParsed.keys[0] !== row.key) throw new Error("Probe isolation failed");
  return {
    inactiveBytes, activeBytes,
    manifest: {
      format: "jwf-single-row-probe", formatVersion: 1,
      sourceLine: line, key: row.key, sourceWasAfterEnd: row.afterEnd,
      sourceSameKeyLines: row.sameKeyLines,
      removedCommentByteOffset: marker, removedByte: 35,
      loadMode, nativeEvidence: "not-run", gatewaySyntaxCheck: "passed",
      restoreIdenticalBaselineBeforeEachArm: true,
      inactiveProfileResetsSetting: false,
      sourceENDWasNotRemoved: true,
      dependencyReviewRequired: true,
      nativeResultMustInclude: ["Jw_cad version", "baseline environment", "load order", "UI before/after", "JWF export diff", "JWW save/reopen diff"],
    },
  };
}
