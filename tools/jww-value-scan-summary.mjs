#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildValueScanSummary,
  compactValueScanRow,
  formatValueScanSummaryText,
} from "../src/jww/valueScanSummary.js";

export {
  buildValueScanSummary,
  compactValueScanRow,
  formatValueScanSummaryText,
};

function parseArgs(argv) {
  const args = {
    inputs: [],
    output: "",
    json: false,
    csv: false,
    html: false,
    summary: false,
    failOnPromotionCandidates: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--summary") args.summary = true;
    else if (arg === "--fail-on-promotion-candidates")
      args.failOnPromotionCandidates = true;
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
  const text = await readFile(file, "utf8");
  const report = JSON.parse(text.replace(/^\uFEFF/, ""));
  return (report.rows || []).map((row) => compactValueScanRow(report, row));
}

function csvForSummary(summary) {
  return rowsToCsv([
    ["status", "count"],
    ...Object.entries(summary.byStatus || {}).map(([status, count]) => [
      status,
      count,
    ]),
    [],
    ["family", "status", "count"],
    ...Object.entries(summary.byFamilyStatus || {}).flatMap(
      ([family, counts]) =>
        Object.entries(counts).map(([status, count]) => [family, status, count])
    ),
    [],
    [
      "key",
      "total",
      "matched",
      "missing",
      "ambiguous",
      "notScanned",
      "gatewayExtracted",
      "gatewayMissing",
    ],
    ...Object.entries(summary.byKey || {}).map(([key, counts]) => [
      key,
      counts.total || 0,
      counts.matched || 0,
      counts.missing || 0,
      counts.ambiguous || 0,
      counts.notScanned || 0,
      counts.gatewayExtracted || 0,
      counts.gatewayMissing || 0,
    ]),
    [],
    [
      "promotionCandidate",
      "source",
      "jwf",
      "scope",
      "family",
      "key",
      "status",
      "gatewayStatus",
      "reason",
      "values",
      "matchKinds",
      "matchCount",
    ],
    ...(summary.promotionCandidates || []).map((row) => [
      "yes",
      row.source,
      row.jwf,
      row.scope,
      row.family,
      row.key,
      row.status,
      row.gatewayStatus,
      row.reason,
      row.values,
      row.matchKinds,
      row.matchCount,
    ]),
    [],
    [
      "source",
      "jwf",
      "scope",
      "family",
      "key",
      "status",
      "gatewayStatus",
      "reason",
      "values",
      "testedKinds",
      "matchKinds",
      "matchCount",
    ],
    ...(summary.rows || []).map((row) => [
      row.source,
      row.jwf,
      row.scope,
      row.family,
      row.key,
      row.status,
      row.gatewayStatus,
      row.reason,
      row.values,
      row.testedKinds,
      row.matchKinds,
      row.matchCount,
    ]),
  ]);
}

function htmlForSummary(summary) {
  const keyRows = Object.entries(summary.byKey || {});
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>JWW Value Scan Summary</title>
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
  <h1>JWW Value Scan Summary</h1>
  <p>Reports: ${htmlEscape(summary.counts.reports)} / Rows: ${htmlEscape(summary.counts.rows)} / Promotion candidates: ${htmlEscape(summary.counts.promotionCandidates || 0)}</p>
  <h2>Promotion Candidates</h2>
  <table>
    <thead>
      <tr>
        <th>Source</th>
        <th>JWF</th>
        <th>Scope</th>
        <th>Family</th>
        <th>Key</th>
        <th>Reason</th>
        <th>Values</th>
        <th>Matches</th>
      </tr>
    </thead>
    <tbody>
${(summary.promotionCandidates || [])
  .map(
    (row) => `      <tr>
        <td>${htmlEscape(row.source)}</td>
        <td>${htmlEscape(row.jwf)}</td>
        <td>${htmlEscape(row.scope)}</td>
        <td>${htmlEscape(row.family)}</td>
        <td><code>${htmlEscape(row.key)}</code></td>
        <td>${htmlEscape(row.reason)}</td>
        <td><code>${htmlEscape((row.values || []).join(", "))}</code></td>
        <td>${htmlEscape(row.matchKinds.join(", "))} (${htmlEscape(row.matchCount)})</td>
      </tr>`
  )
  .join("\n")}
    </tbody>
  </table>
  <table>
    <thead>
      <tr>
        <th>Key</th>
        <th>Total</th>
        <th>Matched</th>
        <th>Missing</th>
        <th>Ambiguous</th>
        <th>Not scanned</th>
        <th>Gateway extracted</th>
        <th>Gateway missing</th>
      </tr>
    </thead>
    <tbody>
${keyRows
  .map(
    ([key, counts]) => `      <tr>
        <td><code>${htmlEscape(key)}</code></td>
        <td>${htmlEscape(counts.total || 0)}</td>
        <td>${htmlEscape(counts.matched || 0)}</td>
        <td>${htmlEscape(counts.missing || 0)}</td>
        <td>${htmlEscape(counts.ambiguous || 0)}</td>
        <td>${htmlEscape(counts.notScanned || 0)}</td>
        <td>${htmlEscape(counts.gatewayExtracted || 0)}</td>
        <td>${htmlEscape(counts.gatewayMissing || 0)}</td>
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
        <th>Scope</th>
        <th>Family</th>
        <th>Key</th>
        <th>Status</th>
        <th>Gateway</th>
        <th>Reason</th>
        <th>Values</th>
        <th>Matches</th>
      </tr>
    </thead>
    <tbody>
${summary.rows
  .map(
    (row) => `      <tr>
        <td>${htmlEscape(row.source)}</td>
        <td>${htmlEscape(row.jwf)}</td>
        <td>${htmlEscape(row.scope)}</td>
        <td>${htmlEscape(row.family)}</td>
        <td><code>${htmlEscape(row.key)}</code></td>
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.gatewayStatus)}</td>
        <td>${htmlEscape(row.reason)}</td>
        <td><code>${htmlEscape((row.values || []).join(", "))}</code></td>
        <td>${htmlEscape(row.matchKinds.join(", "))} (${htmlEscape(row.matchCount)})</td>
      </tr>`
  )
  .join("\n")}
    </tbody>
  </table>
</body>
</html>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.inputs.length) {
    console.error(
      "Usage: node tools/jww-value-scan-summary.mjs <value-scan-report.json...> [--json|--csv|--html|--summary] [--fail-on-promotion-candidates] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const rows = (
    await Promise.all(args.inputs.map((file) => readReport(file)))
  ).flat();
  const summary = buildValueScanSummary(
    args.inputs.map((file) => path.resolve(file)),
    rows
  );
  const output = args.csv
    ? csvForSummary(summary)
    : args.html
      ? htmlForSummary(summary)
      : args.summary
        ? formatValueScanSummaryText(summary)
        : `${JSON.stringify(summary, null, 2)}\n`;
  if (args.output) await writeFile(path.resolve(args.output), output, "utf8");
  else process.stdout.write(output);
  if (
    args.failOnPromotionCandidates &&
    summary.promotionCandidates.length > 0
  ) {
    process.stderr.write(
      `Promotion candidates found: ${summary.promotionCandidates.length}\n`
    );
    process.exitCode = 2;
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
