#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCoreOpenSummary,
  compactCoreOpenRow,
} from "../src/jww/coreOpenSummary.js";

export { buildCoreOpenSummary, compactCoreOpenRow };

function parseArgs(argv) {
  const args = {
    inputs: [],
    output: "",
    json: false,
    csv: false,
    html: false,
    summary: false,
    failOnDirectMatches: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--summary") args.summary = true;
    else if (arg === "--fail-on-direct-matches")
      args.failOnDirectMatches = true;
    else args.inputs.push(arg);
  }
  return args;
}

function csvValue(value) {
  const text =
    value === null || value === undefined
      ? ""
      : Array.isArray(value)
        ? value.join("; ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  return `${rows.map((row) => row.map(csvValue).join(",")).join("\n")}\n`;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function readReport(file) {
  const report = JSON.parse(await readFile(file, "utf8"));
  return (report.rows || []).map((row) => compactCoreOpenRow(report, row));
}

function htmlForSummary(summary) {
  const keyRows = Object.entries(summary.byKey || {});
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>JWW Core Open Summary</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #162033; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 14px; }
    th, td { border: 1px solid #d9e0ea; padding: 6px 8px; vertical-align: top; }
    th { position: sticky; top: 0; background: #eaf0f7; text-align: left; }
    code { font-family: Consolas, "Liberation Mono", monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>JWW Core Open Summary</h1>
  <p>Reports: ${htmlEscape(summary.counts.reports)} / Rows: ${htmlEscape(summary.counts.rows)} / Direct true: ${htmlEscape(summary.counts.directMatchTrue || 0)} / Direct false: ${htmlEscape(summary.counts.directMatchFalse || 0)}</p>
  <table>
    <thead>
      <tr>
        <th>Key</th>
        <th>Total</th>
        <th>Missing</th>
        <th>Matched</th>
        <th>Direct True</th>
        <th>Direct False</th>
      </tr>
    </thead>
    <tbody>
${keyRows
  .map(
    ([key, counts]) => `      <tr>
        <td><code>${htmlEscape(key)}</code></td>
        <td>${htmlEscape(counts.total || 0)}</td>
        <td>${htmlEscape(counts.missing || 0)}</td>
        <td>${htmlEscape(counts.matched || 0)}</td>
        <td>${htmlEscape(counts.directMatchTrue || 0)}</td>
        <td>${htmlEscape(counts.directMatchFalse || 0)}</td>
      </tr>`
  )
  .join("\n")}
    </tbody>
  </table>
  <table>
    <thead>
      <tr>
        <th>Source</th>
        <th>JWF</th>
        <th>Key</th>
        <th>Status</th>
        <th>Values</th>
        <th>Direct Match</th>
        <th>Candidate</th>
      </tr>
    </thead>
    <tbody>
${summary.rows
  .map((row) => {
    const direct =
      row.directU32Match !== null
        ? `u32=${row.directU32Match}`
        : row.directSpecialMatch !== null
          ? `special=${row.directSpecialMatch}`
          : "";
    const candidate = row.candidateU32
      ? `u32: ${row.candidateU32.join(", ")}`
      : row.specialHexes
        ? JSON.stringify(row.specialHexes, null, 2)
        : "";
    return `      <tr>
        <td>${htmlEscape(row.source)}</td>
        <td>${htmlEscape(row.jwf)}</td>
        <td><code>${htmlEscape(row.key)}</code></td>
        <td>${htmlEscape(row.status)}</td>
        <td><code>${htmlEscape((row.values || []).join(", "))}</code></td>
        <td>${htmlEscape(direct)}</td>
        <td><code>${htmlEscape(candidate)}</code></td>
      </tr>`;
  })
  .join("\n")}
    </tbody>
  </table>
</body>
</html>
`;
}

function csvForSummary(summary) {
  return rowsToCsv([
    [
      "key",
      "total",
      "missing",
      "matched",
      "directMatchTrue",
      "directMatchFalse",
    ],
    ...Object.entries(summary.byKey || {}).map(([key, counts]) => [
      key,
      counts.total || 0,
      counts.missing || 0,
      counts.matched || 0,
      counts.directMatchTrue || 0,
      counts.directMatchFalse || 0,
    ]),
    [],
    [
      "source",
      "jwf",
      "key",
      "status",
      "values",
      "directU32Match",
      "directSpecialMatch",
      "expectedHex",
      "candidateU32",
      "specialHexes",
    ],
    ...(summary.rows || []).map((row) => [
      row.source,
      row.jwf,
      row.key,
      row.status,
      row.values,
      row.directU32Match,
      row.directSpecialMatch,
      row.expectedHex,
      row.candidateU32,
      row.specialHexes,
    ]),
  ]);
}

export function formatCoreOpenSummaryText(summary) {
  const lines = [
    "JWW Core Open Summary",
    `Reports: ${summary.counts.reports}`,
    `Rows: ${summary.counts.rows}`,
    `Direct match true: ${summary.counts.directMatchTrue || 0}`,
    `Direct match false: ${summary.counts.directMatchFalse || 0}`,
    "",
    "Keys:",
  ];
  for (const [key, counts] of Object.entries(summary.byKey || {})) {
    lines.push(
      `  ${key}: missing ${counts.missing || 0}, matched ${counts.matched || 0}, direct true ${counts.directMatchTrue || 0}, direct false ${counts.directMatchFalse || 0}`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.inputs.length) {
    console.error(
      "Usage: node tools/jww-core-open-summary.mjs <core-open-report.json...> [--summary|--json|--csv|--html] [--fail-on-direct-matches] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const rows = (
    await Promise.all(args.inputs.map((file) => readReport(file)))
  ).flat();
  const summary = buildCoreOpenSummary(
    args.inputs.map((file) => path.resolve(file)),
    rows
  );
  const output = args.csv
    ? csvForSummary(summary)
    : args.html
      ? htmlForSummary(summary)
      : args.summary
        ? formatCoreOpenSummaryText(summary)
        : `${JSON.stringify(summary, null, 2)}\n`;
  if (args.output) await writeFile(path.resolve(args.output), output, "utf8");
  else process.stdout.write(output);
  if (args.failOnDirectMatches && summary.counts.directMatchTrue > 0) {
    console.error(
      `Core open summary found ${summary.counts.directMatchTrue} direct matches.`
    );
    process.exitCode = 1;
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
