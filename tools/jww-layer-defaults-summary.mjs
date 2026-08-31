#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeLayerDefaultsAudits } from "../src/jww/layerDefaultsSummary.js";

export { summarizeLayerDefaultsAudits };

function parseArgs(argv) {
  const args = {
    inputs: [],
    output: "",
    json: false,
    csv: false,
    html: false,
    failOnDirectMatches: false,
    failOnPromotionCandidates: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--fail-on-direct-matches")
      args.failOnDirectMatches = true;
    else if (arg === "--fail-on-promotion-candidates")
      args.failOnPromotionCandidates = true;
    else args.inputs.push(arg);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export function formatLayerDefaultsSummaryText(summary) {
  const lines = [
    "JWW Layer Defaults Summary",
    `Reports: ${summary.reportCount}`,
    `Rows: ${summary.counts.rows}`,
    `Keys: ${summary.counts.keys}`,
    `Always missing: ${summary.counts.alwaysMissing}`,
    `Keys with direct matches: ${summary.counts.withDirectMatches}`,
    `Mixed: ${summary.counts.mixed}`,
    `Non-serialized JWF keys: ${summary.counts.nonSerialized}`,
    `Direct match candidates: ${summary.counts.directMatchCandidates}`,
    `Promotion candidates: ${summary.counts.promotionCandidates}`,
    `Conclusion: ${summary.conclusion}`,
    "",
    "Family Totals:",
    ...summary.byFamily.map(
      (row) =>
        `  ${row.key}: missing ${row.missing || 0}, matched ${row.matched || 0}, ambiguous ${row.ambiguous || 0}`
    ),
    "",
    "Always Missing Keys:",
  ];
  for (const row of summary.byKey.filter(
    (item) => item.missing === summary.reportCount
  )) {
    lines.push(`  ${row.key} (${row.family})`);
  }
  const ambiguousRows = summary.byKey.filter((item) => item.ambiguous > 0);
  if (ambiguousRows.length) {
    lines.push("", "Ambiguous Keys:");
    for (const row of ambiguousRows.slice(0, 40)) {
      lines.push(
        `  ${row.key} (${row.family}): ${row.reasonSummary || "-"} / values ${row.valueSignatureSummary || "-"}`
      );
    }
    if (ambiguousRows.length > 40) {
      lines.push(`  ... ${ambiguousRows.length - 40} more`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function formatLayerDefaultsSummaryCsv(summary) {
  const rows = [
    ["section", "key", "value"],
    ["summary", "reports", summary.reportCount],
    ["summary", "rows", summary.counts.rows],
    ["summary", "keys", summary.counts.keys],
    ["summary", "alwaysMissing", summary.counts.alwaysMissing],
    ["summary", "withDirectMatches", summary.counts.withDirectMatches],
    ["summary", "mixed", summary.counts.mixed],
    ["summary", "nonSerialized", summary.counts.nonSerialized],
    ["summary", "directMatchCandidates", summary.counts.directMatchCandidates],
    ["summary", "promotionCandidates", summary.counts.promotionCandidates],
    ["summary", "conclusion", summary.conclusion],
    [],
    ["section", "family", "total", "missing", "matched", "ambiguous"],
    ...summary.byFamily.map((row) => [
      "family",
      row.key,
      row.total || 0,
      row.missing || 0,
      row.matched || 0,
      row.ambiguous || 0,
    ]),
    [],
    [
      "key",
      "family",
      "gatewayStatus",
      "total",
      "missing",
      "matched",
      "ambiguous",
      "reasonSummary",
      "valueSignatureSummary",
      "matchKindSummary",
      "files",
    ],
    ...summary.byKey.map((row) => [
      row.key,
      row.family || "",
      row.gatewayStatus || "",
      row.total || 0,
      row.missing || 0,
      row.matched || 0,
      row.ambiguous || 0,
      row.reasonSummary || "",
      row.valueSignatureSummary || "",
      row.matchKindSummary || "",
      row.files.join("; "),
    ]),
  ];
  return `${rows.map((row) => row.map(csvValue).join(",")).join("\n")}\n`;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatLayerDefaultsSummaryHtml(summary) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Layer Defaults Summary</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    table { border-collapse: collapse; min-width: 840px; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; vertical-align: top; }
    th { background: #eef3f8; }
  </style>
</head>
<body>
  <h1>JWW Layer Defaults Summary</h1>
  <p>Reports ${summary.reportCount}, rows ${summary.counts.rows}, always missing ${summary.counts.alwaysMissing}, non-serialized ${summary.counts.nonSerialized}, promotion candidates ${summary.counts.promotionCandidates}</p>
  <p><strong>Conclusion:</strong> ${htmlEscape(summary.conclusion)}</p>
  <h2>Family Totals</h2>
  <table>
    <thead><tr><th>Family</th><th>Total</th><th>Missing</th><th>Matched</th><th>Ambiguous</th></tr></thead>
    <tbody>
${summary.byFamily
  .map(
    (row) => `      <tr>
        <td>${htmlEscape(row.key)}</td>
        <td>${htmlEscape(row.total || 0)}</td>
        <td>${htmlEscape(row.missing || 0)}</td>
        <td>${htmlEscape(row.matched || 0)}</td>
        <td>${htmlEscape(row.ambiguous || 0)}</td>
      </tr>`
  )
  .join("\n")}
    </tbody>
  </table>
  <h2>Key Totals</h2>
  <table>
    <thead><tr><th>Key</th><th>Family</th><th>Gateway</th><th>Total</th><th>Missing</th><th>Matched</th><th>Ambiguous</th><th>Reason</th><th>Values</th><th>Match Kinds</th></tr></thead>
    <tbody>
${summary.byKey
  .map(
    (row) => `      <tr>
        <td>${htmlEscape(row.key)}</td>
        <td>${htmlEscape(row.family)}</td>
        <td>${htmlEscape(row.gatewayStatus)}</td>
        <td>${htmlEscape(row.total || 0)}</td>
        <td>${htmlEscape(row.missing || 0)}</td>
        <td>${htmlEscape(row.matched || 0)}</td>
        <td>${htmlEscape(row.ambiguous || 0)}</td>
        <td>${htmlEscape(row.reasonSummary)}</td>
        <td>${htmlEscape(row.valueSignatureSummary)}</td>
        <td>${htmlEscape(row.matchKindSummary)}</td>
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
      "Usage: node tools/jww-layer-defaults-summary.mjs <audit-a.json> <audit-b.json> [--json|--csv|--html] [--fail-on-direct-matches] [--fail-on-promotion-candidates] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const reports = await Promise.all(args.inputs.map(readJson));
  const summary = summarizeLayerDefaultsAudits(reports);
  const output = args.json
    ? `${JSON.stringify(summary, null, 2)}\n`
    : args.csv
      ? formatLayerDefaultsSummaryCsv(summary)
      : args.html
        ? formatLayerDefaultsSummaryHtml(summary)
        : formatLayerDefaultsSummaryText(summary);
  if (args.output) {
    const outputPath = path.resolve(args.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
  if (
    args.failOnPromotionCandidates &&
    summary.counts.promotionCandidates > 0
  ) {
    console.error(
      `Layer defaults summary found ${summary.counts.promotionCandidates} promotion candidates.`
    );
    process.exitCode = 1;
  }
  if (args.failOnDirectMatches && summary.counts.directMatchCandidates > 0) {
    console.error(
      `Layer defaults summary found ${summary.counts.directMatchCandidates} direct match candidates.`
    );
    process.exitCode = 1;
  }
}

if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
