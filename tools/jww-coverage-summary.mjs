#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CORE_DRAWING_KEYS = new Set(["LTYPE_HC", "LCOLLOR_M"]);
const LAYER_DEFAULT_FAMILIES = new Set([
  "layerColors",
  "layerWidths",
  "layerLineTypes",
]);

function parseArgs(argv) {
  const args = {
    inputs: [],
    output: "",
    json: false,
    csv: false,
    html: false,
    summary: false,
    failOnAlwaysMissingDrawing: false,
    limit: 40,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--summary") args.summary = true;
    else if (arg === "--fail-on-always-missing-drawing") {
      args.failOnAlwaysMissingDrawing = true;
    } else if (arg === "--limit") args.limit = Number(argv[++index]) || 40;
    else args.inputs.push(arg);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function addCount(target, key, status) {
  target[key] ||= { key, total: 0, extracted: 0, missing: 0, files: [] };
  target[key].total += 1;
  target[key][status] = (target[key][status] || 0) + 1;
}

function drawingMissingCategory(row) {
  if (row.scope !== "drawing") return "";
  if (CORE_DRAWING_KEYS.has(row.key)) return "core";
  if (LAYER_DEFAULT_FAMILIES.has(row.family)) return "layerDefaults";
  return "other";
}

export function summarizeCoverageReports(reports) {
  const byKey = {};
  const byFamily = {};
  const byScope = {};
  for (const report of reports) {
    const source = report.source || report.file || "";
    for (const row of report.rows || []) {
      addCount(byKey, row.key, row.status);
      byKey[row.key].scope = row.scope;
      byKey[row.key].family = row.family;
      if (source && !byKey[row.key].files.includes(source)) {
        byKey[row.key].files.push(source);
      }
      addCount(byFamily, row.family || "unknown", row.status);
      addCount(byScope, row.scope || "unknown", row.status);
    }
  }
  const keys = Object.values(byKey).sort((a, b) => a.key.localeCompare(b.key));
  const alwaysMissingDrawingRows = keys.filter(
    (row) => row.scope === "drawing" && row.missing === reports.length
  );
  const alwaysMissingDrawingByCategory = {
    core: alwaysMissingDrawingRows.filter(
      (row) => drawingMissingCategory(row) === "core"
    ).length,
    layerDefaults: alwaysMissingDrawingRows.filter(
      (row) => drawingMissingCategory(row) === "layerDefaults"
    ).length,
    other: alwaysMissingDrawingRows.filter(
      (row) => drawingMissingCategory(row) === "other"
    ).length,
  };
  return {
    format: "jww-coverage-summary",
    generatedAt: new Date().toISOString(),
    reportCount: reports.length,
    sourceFiles: reports.map((report) => report.source || "").filter(Boolean),
    counts: {
      keys: keys.length,
      alwaysMissing: keys.filter((row) => row.missing === reports.length)
        .length,
      alwaysMissingDrawing: alwaysMissingDrawingRows.length,
      alwaysMissingDrawingCore: alwaysMissingDrawingByCategory.core,
      alwaysMissingDrawingLayerDefaults:
        alwaysMissingDrawingByCategory.layerDefaults,
      alwaysMissingDrawingOther: alwaysMissingDrawingByCategory.other,
      alwaysExtracted: keys.filter((row) => row.extracted === reports.length)
        .length,
      mixed: keys.filter((row) => row.extracted > 0 && row.missing > 0).length,
    },
    alwaysMissingDrawingByCategory,
    byScope: Object.values(byScope).sort((a, b) => a.key.localeCompare(b.key)),
    byFamily: Object.values(byFamily).sort((a, b) =>
      a.key.localeCompare(b.key)
    ),
    byKey: keys,
  };
}

export function formatCoverageSummaryText(summary, options = {}) {
  const limit = options.limit || 40;
  const lines = [
    "JWW Coverage Summary",
    `Reports: ${summary.reportCount}`,
    `Keys: ${summary.counts.keys}`,
    `Always missing: ${summary.counts.alwaysMissing}`,
    `Always missing drawing: ${summary.counts.alwaysMissingDrawing || 0}`,
    `  core: ${summary.counts.alwaysMissingDrawingCore || 0}`,
    `  layer defaults: ${summary.counts.alwaysMissingDrawingLayerDefaults || 0}`,
    `  other: ${summary.counts.alwaysMissingDrawingOther || 0}`,
    `Always extracted: ${summary.counts.alwaysExtracted}`,
    `Mixed: ${summary.counts.mixed}`,
    "",
    "Scope Totals:",
    ...summary.byScope.map(
      (row) =>
        `  ${row.key}: extracted ${row.extracted || 0}, missing ${row.missing || 0}`
    ),
    "",
    "Family Totals:",
    ...summary.byFamily.map(
      (row) =>
        `  ${row.key}: extracted ${row.extracted || 0}, missing ${row.missing || 0}`
    ),
    "",
    "Always Missing Keys:",
  ];
  for (const row of summary.byKey
    .filter((item) => item.missing === summary.reportCount)
    .slice(0, limit)) {
    lines.push(`  ${row.key} (${row.scope}/${row.family})`);
  }
  const remaining =
    summary.counts.alwaysMissing -
    Math.min(summary.counts.alwaysMissing, limit);
  if (remaining > 0) lines.push(`  ... ${remaining} more`);
  const drawingRows = summary.byKey.filter(
    (item) => item.scope === "drawing" && item.missing === summary.reportCount
  );
  lines.push("", "Always Missing Drawing Keys:");
  if (!drawingRows.length) {
    lines.push("  none");
  } else {
    for (const row of drawingRows.slice(0, limit)) {
      lines.push(
        `  ${row.key} (${row.family}, ${drawingMissingCategory(row)})`
      );
    }
    const drawingRemaining =
      drawingRows.length - Math.min(drawingRows.length, limit);
    if (drawingRemaining > 0) lines.push(`  ... ${drawingRemaining} more`);
  }
  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function formatCoverageSummaryCsv(summary) {
  const rows = [
    ["section", "group", "total", "extracted", "missing"],
    ...summary.byScope.map((row) => [
      "scope",
      row.key,
      row.total || 0,
      row.extracted || 0,
      row.missing || 0,
    ]),
    ...summary.byFamily.map((row) => [
      "family",
      row.key,
      row.total || 0,
      row.extracted || 0,
      row.missing || 0,
    ]),
    [],
    ["drawingMissingCategory", "count"],
    ...Object.entries(summary.alwaysMissingDrawingByCategory || {}).map(
      ([category, count]) => [category, count]
    ),
    [],
    [
      "key",
      "scope",
      "family",
      "drawingMissingCategory",
      "total",
      "extracted",
      "missing",
    ],
    ...summary.byKey.map((row) => [
      row.key,
      row.scope || "",
      row.family || "",
      drawingMissingCategory(row),
      row.total || 0,
      row.extracted || 0,
      row.missing || 0,
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

export function formatCoverageSummaryHtml(summary) {
  const summaryRows = (rows, label) =>
    rows
      .map(
        (row) => `      <tr>
        <td>${htmlEscape(label)}</td>
        <td>${htmlEscape(row.key)}</td>
        <td>${htmlEscape(row.total || 0)}</td>
        <td>${htmlEscape(row.extracted || 0)}</td>
        <td>${htmlEscape(row.missing || 0)}</td>
      </tr>`
      )
      .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Coverage Summary</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    table { border-collapse: collapse; min-width: 760px; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; }
    th { background: #eef3f8; }
  </style>
</head>
<body>
  <h1>JWW Coverage Summary</h1>
  <p>Reports ${summary.reportCount}, keys ${summary.counts.keys}, always missing ${summary.counts.alwaysMissing}, mixed ${summary.counts.mixed}</p>
  <p>Always missing drawing keys ${summary.counts.alwaysMissingDrawing || 0}: core ${summary.counts.alwaysMissingDrawingCore || 0}, layer defaults ${summary.counts.alwaysMissingDrawingLayerDefaults || 0}, other ${summary.counts.alwaysMissingDrawingOther || 0}</p>
  <h2>Scope And Family Totals</h2>
  <table>
    <thead><tr><th>Section</th><th>Group</th><th>Total</th><th>Extracted</th><th>Missing</th></tr></thead>
    <tbody>
${summaryRows(summary.byScope, "scope")}
${summaryRows(summary.byFamily, "family")}
    </tbody>
  </table>
  <h2>Key Totals</h2>
  <table>
    <thead><tr><th>Key</th><th>Scope</th><th>Family</th><th>Drawing Missing Category</th><th>Total</th><th>Extracted</th><th>Missing</th></tr></thead>
    <tbody>
${summary.byKey
  .map(
    (row) => `      <tr>
        <td>${htmlEscape(row.key)}</td>
        <td>${htmlEscape(row.scope)}</td>
        <td>${htmlEscape(row.family)}</td>
        <td>${htmlEscape(drawingMissingCategory(row))}</td>
        <td>${htmlEscape(row.total || 0)}</td>
        <td>${htmlEscape(row.extracted || 0)}</td>
        <td>${htmlEscape(row.missing || 0)}</td>
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
      "Usage: node tools/jww-coverage-summary.mjs <coverage-a.json> <coverage-b.json> [--json|--csv|--html] [--fail-on-always-missing-drawing] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const reports = await Promise.all(args.inputs.map(readJson));
  const summary = summarizeCoverageReports(reports);
  const output = args.json
    ? `${JSON.stringify(summary, null, 2)}\n`
    : args.csv
      ? formatCoverageSummaryCsv(summary)
      : args.html
        ? formatCoverageSummaryHtml(summary)
        : formatCoverageSummaryText(summary, args);
  if (args.output) {
    const outputPath = path.resolve(args.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
  if (
    args.failOnAlwaysMissingDrawing &&
    summary.counts.alwaysMissingDrawing > 0
  ) {
    process.exitCode = 2;
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
