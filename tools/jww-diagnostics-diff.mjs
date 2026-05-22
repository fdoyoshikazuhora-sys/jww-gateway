#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IGNORED_KEYS = new Set(["exportedAt", "loadedAt"]);

function parseArgs(argv) {
  const args = {
    before: "",
    after: "",
    output: "",
    html: false,
    json: false,
    all: false,
    scope: "all",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") args.output = argv[++i] || "";
    else if (arg === "--html") args.html = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--all") args.all = true;
    else if (arg === "--scope") args.scope = argv[++i] || "all";
    else if (!args.before) args.before = arg;
    else if (!args.after) args.after = arg;
  }
  return args;
}

function documentLabel(document, index) {
  return document?.fileName || document?.id || document?.source || `document-${index}`;
}

function pickScope(value, scope) {
  if (scope === "all") return value;
  if (scope === "arcs") {
    if (value?.arcs) return { arcs: value.arcs };
    if (Array.isArray(value?.documents)) {
      return {
        documents: value.documents.map((document, index) => ({
          file: documentLabel(document, index),
          arcDiagnostics:
            document?.jww?.arcDiagnostics ||
            document?.meta?.jww?.arcDiagnostics ||
            document?.jwwArcDiagnostics ||
            null,
        })),
      };
    }
    return { arcs: null };
  }
  if (scope === "colors") {
    if (value?.colors) return { colors: value.colors };
    if (Array.isArray(value?.documents)) {
      return {
        documents: value.documents.map((document, index) => ({
          file: documentLabel(document, index),
          colorSettings:
            document?.jww?.colorSettings ||
            document?.meta?.jww?.colorSettings ||
            null,
          colorDiagnostics:
            document?.jww?.colorDiagnostics ||
            document?.meta?.jww?.colorDiagnostics ||
            null,
        })),
      };
    }
    return { colors: null };
  }
  if (scope === "text") {
    if (value?.text) return { text: value.text };
    return { text: null };
  }
  if (scope === "outliers") {
    if (value?.outliers) return { outliers: value.outliers };
    if (Array.isArray(value?.documents)) {
      return {
        documents: value.documents.map((document, index) => ({
          file: documentLabel(document, index),
          outlierDiagnostics: document?.outlierDiagnostics || null,
        })),
      };
    }
    return { outliers: null };
  }
  return value;
}

function stableValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function isPrimitive(value) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function shortHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function arrayLabel(item, index) {
  if (item && typeof item === "object") {
    const label =
      item.id ||
      item.fileName ||
      item.source ||
      item.type ||
      item.key ||
      item.colorNumber ||
      item.group;
    if (label !== undefined && label !== null && label !== "") {
      return String(label).replace(/[.[\]]/g, "_");
    }
  }
  return String(index);
}

function flatten(value, prefix = "", rows = {}) {
  if (isPrimitive(value)) {
    rows[prefix || "value"] = stableValue(value);
    return rows;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const label = arrayLabel(item, index);
      flatten(item, `${prefix}[${label}]`, rows);
    });
    if (!value.length) rows[prefix] = "[]";
    return rows;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([key]) => !IGNORED_KEYS.has(key)
    );
    if (!entries.length && prefix) rows[prefix] = "{}";
    entries
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, child]) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        flatten(child, nextPrefix, rows);
      });
  }
  return rows;
}

function buildDiff(beforeJson, afterJson, beforePath, afterPath, options = {}) {
  const scope = options.scope || "all";
  const beforeScoped = pickScope(beforeJson, scope);
  const afterScoped = pickScope(afterJson, scope);
  const beforeFlat = flatten(beforeScoped);
  const afterFlat = flatten(afterScoped);
  const keys = Array.from(
    new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])
  ).sort();
  const rows = keys
    .map((key) => {
      const before = beforeFlat[key];
      const after = afterFlat[key];
      const existsBefore = Object.prototype.hasOwnProperty.call(beforeFlat, key);
      const existsAfter = Object.prototype.hasOwnProperty.call(afterFlat, key);
      const status = !existsBefore
        ? "added"
        : !existsAfter
          ? "removed"
          : before === after
            ? "same"
            : "changed";
      return { key, status, before: before || "", after: after || "" };
    })
    .filter((row) => options.all || row.status !== "same");

  const counts = rows.reduce(
    (total, row) => {
      total[row.status] = (total[row.status] || 0) + 1;
      return total;
    },
    { added: 0, removed: 0, changed: 0, same: 0 }
  );

  return {
    format: "cadstudio-diagnostics-diff",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    before: path.resolve(beforePath),
    after: path.resolve(afterPath),
    scope,
    beforeHash: shortHash(JSON.stringify(beforeJson)),
    afterHash: shortHash(JSON.stringify(afterJson)),
    counts,
    rows,
  };
}

function htmlText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlForDiff(diff) {
  const rows = diff.rows
    .map(
      (row) => `<tr class="${htmlText(row.status)}">
        <td>${htmlText(row.status)}</td>
        <td>${htmlText(row.key)}</td>
        <td><pre>${htmlText(row.before)}</pre></td>
        <td><pre>${htmlText(row.after)}</pre></td>
      </tr>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>Diagnostics Diff</title>
  <style>
    body { font-family: Arial, "Yu Gothic", Meiryo, sans-serif; margin: 24px; color: #0f172a; background: #f8fafc; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .meta { color: #475569; font-size: 12px; margin-bottom: 14px; }
    .summary { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
    .pill { border: 1px solid #cbd5e1; background: #fff; padding: 4px 8px; font-size: 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; font-size: 12px; }
    th { background: #e2e8f0; text-align: left; position: sticky; top: 0; }
    tr.added td:first-child { color: #047857; font-weight: 700; }
    tr.removed td:first-child { color: #b91c1c; font-weight: 700; }
    tr.changed td:first-child { color: #b45309; font-weight: 700; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: Consolas, monospace; font-size: 11px; }
  </style>
</head>
<body>
  <h1>Diagnostics Diff</h1>
  <div class="meta">Generated at ${htmlText(diff.generatedAt)}</div>
  <div class="meta">Scope: ${htmlText(diff.scope || "all")}</div>
  <div class="meta">Before: ${htmlText(diff.before)} (${htmlText(
    diff.beforeHash
  )})</div>
  <div class="meta">After: ${htmlText(diff.after)} (${htmlText(
    diff.afterHash
  )})</div>
  <div class="summary">
    <span class="pill">Changed: ${htmlText(diff.counts.changed)}</span>
    <span class="pill">Added: ${htmlText(diff.counts.added)}</span>
    <span class="pill">Removed: ${htmlText(diff.counts.removed)}</span>
    <span class="pill">Rows: ${htmlText(diff.rows.length)}</span>
  </div>
  <table>
    <thead>
      <tr><th>Status</th><th>Path</th><th>Before</th><th>After</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`;
}

function linesForDiff(diff) {
  const lines = [];
  lines.push("Diagnostics Diff");
  lines.push(`Before: ${diff.before}`);
  lines.push(`After: ${diff.after}`);
  lines.push(`Scope: ${diff.scope || "all"}`);
  lines.push(
    `Changed: ${diff.counts.changed}, Added: ${diff.counts.added}, Removed: ${diff.counts.removed}`
  );
  lines.push("");
  for (const row of diff.rows) {
    lines.push(`[${row.status}] ${row.key}`);
    if (row.status !== "added") lines.push(`  before: ${row.before}`);
    if (row.status !== "removed") lines.push(`  after : ${row.after}`);
  }
  return `${lines.join("\n")}\n`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), "utf8"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.before || !args.after) {
    console.error(
      "Usage: node tools/jww-diagnostics-diff.mjs <before.json> <after.json> [--html|--json] [--scope all|arcs|colors|text|outliers] [--all] [-o output.html]"
    );
    process.exitCode = 1;
    return;
  }

  const beforeJson = await readJson(args.before);
  const afterJson = await readJson(args.after);
  const diff = buildDiff(beforeJson, afterJson, args.before, args.after, {
    all: args.all,
    scope: args.scope,
  });
  const output = args.json
    ? `${JSON.stringify(diff, null, 2)}\n`
    : args.html
      ? htmlForDiff(diff)
      : linesForDiff(diff);

  if (args.output) {
    await writeFile(path.resolve(args.output), output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
