#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {
    inputs: [],
    output: "",
    json: false,
    csv: false,
    html: false,
    summary: false,
    failOnDirectMatches: false,
    limit: 30,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--summary") args.summary = true;
    else if (arg === "--fail-on-direct-matches") {
      args.failOnDirectMatches = true;
    } else if (arg === "--limit") args.limit = Number(argv[++index]) || 30;
    else args.inputs.push(arg);
  }
  return args;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function addCount(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function countsObject(map) {
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  );
}

function summarizeRows(groups) {
  return [...groups.values()]
    .map((group) => {
      const distances = group.rows.map((row) => Number(row.distance) || 0);
      return {
        key: group.key,
        relativeOffset: group.relativeOffset,
        hex: group.hex,
        rows: group.rows.length,
        files: [...group.files].sort(),
        fileCount: group.files.size,
        directMatches: group.rows.filter((row) => row.directMatch).length,
        minDistance: Math.min(...distances),
        averageDistance: average(distances),
        hexCounts: countsObject(group.hexCounts),
        knownKeyCounts: countsObject(group.knownKeyCounts),
      };
    })
    .sort(
      (a, b) =>
        b.fileCount - a.fileCount ||
        b.rows - a.rows ||
        a.averageDistance - b.averageDistance ||
        String(a.key).localeCompare(String(b.key))
    );
}

export async function summarizeSpecialColorAudits(inputFiles) {
  const reports = await Promise.all(
    inputFiles.map(async (input) => {
      const file = path.resolve(input);
      const report = JSON.parse(await readFile(file, "utf8"));
      return { file, report };
    })
  );
  const byRelativeOffset = new Map();
  const byHex = new Map();
  let candidateRows = 0;
  let directMatches = 0;

  for (const { file, report } of reports) {
    const sourceName = report.sources?.jww
      ? path.basename(report.sources.jww)
      : path.basename(file);
    directMatches += Number(report.counts?.directMatches) || 0;
    for (const row of report.nearestCandidates || []) {
      candidateRows += 1;
      const relativeKey = String(row.relativeOffset);
      if (!byRelativeOffset.has(relativeKey)) {
        byRelativeOffset.set(relativeKey, {
          key: relativeKey,
          relativeOffset: row.relativeOffset,
          rows: [],
          files: new Set(),
          hexCounts: new Map(),
          knownKeyCounts: new Map(),
        });
      }
      const offsetGroup = byRelativeOffset.get(relativeKey);
      offsetGroup.rows.push(row);
      offsetGroup.files.add(sourceName);
      addCount(offsetGroup.hexCounts, row.hex);
      addCount(offsetGroup.knownKeyCounts, row.knownKey);

      const hexKey = String(row.hex || "");
      if (!byHex.has(hexKey)) {
        byHex.set(hexKey, {
          key: hexKey,
          hex: row.hex || "",
          rows: [],
          files: new Set(),
          hexCounts: new Map(),
          knownKeyCounts: new Map(),
        });
      }
      const hexGroup = byHex.get(hexKey);
      hexGroup.rows.push(row);
      hexGroup.files.add(sourceName);
      addCount(hexGroup.hexCounts, row.hex);
      addCount(hexGroup.knownKeyCounts, row.knownKey);
    }
  }

  const relativeOffsetSummary = summarizeRows(byRelativeOffset);
  const hexSummary = summarizeRows(byHex);
  return {
    format: "jww-special-color-summary",
    generatedAt: new Date().toISOString(),
    inputs: reports.map(({ file }) => file),
    counts: {
      reports: reports.length,
      candidateRows,
      directMatches,
      repeatedRelativeOffsets: relativeOffsetSummary.filter(
        (row) => row.fileCount > 1
      ).length,
      repeatedHexes: hexSummary.filter((row) => row.fileCount > 1).length,
    },
    conclusion:
      directMatches > 0
        ? "Direct LCOLLOR_M matches were found. Review before promotion."
        : "No direct LCOLLOR_M matches were found. Keep LCOLLOR_M unresolved.",
    byRelativeOffset: relativeOffsetSummary,
    byHex: hexSummary,
  };
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}

export function formatSpecialColorSummaryText(summary, options = {}) {
  const limit = options.limit || 30;
  const lines = [
    "JWW Special Color Summary",
    `Reports: ${summary.counts.reports}`,
    `Candidate rows: ${summary.counts.candidateRows}`,
    `Direct matches: ${summary.counts.directMatches}`,
    `Repeated relative offsets: ${summary.counts.repeatedRelativeOffsets}`,
    `Repeated colors: ${summary.counts.repeatedHexes}`,
    `Conclusion: ${summary.conclusion}`,
    "",
    "Top Relative Offsets:",
  ];
  for (const row of summary.byRelativeOffset.slice(0, limit)) {
    lines.push(
      `  ${row.relativeOffset}: files ${row.fileCount}, rows ${row.rows}, avg distance ${formatNumber(row.averageDistance)}, colors ${JSON.stringify(row.hexCounts)}`
    );
  }
  lines.push("", "Top Colors:");
  for (const row of summary.byHex.slice(0, limit)) {
    lines.push(
      `  ${row.hex}: files ${row.fileCount}, rows ${row.rows}, avg distance ${formatNumber(row.averageDistance)}, offsets ${JSON.stringify(row.files)}`
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function formatSpecialColorSummaryCsv(summary) {
  const rows = [
    [
      "section",
      "key",
      "fileCount",
      "rows",
      "directMatches",
      "minDistance",
      "averageDistance",
      "hexCounts",
      "knownKeyCounts",
      "files",
    ],
    ...summary.byRelativeOffset.map((row) => [
      "relativeOffset",
      row.relativeOffset,
      row.fileCount,
      row.rows,
      row.directMatches,
      row.minDistance,
      row.averageDistance,
      row.hexCounts,
      row.knownKeyCounts,
      row.files,
    ]),
    ...summary.byHex.map((row) => [
      "hex",
      row.hex,
      row.fileCount,
      row.rows,
      row.directMatches,
      row.minDistance,
      row.averageDistance,
      row.hexCounts,
      row.knownKeyCounts,
      row.files,
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

function rowsHtml(rows, keyName, limit) {
  return rows
    .slice(0, limit)
    .map(
      (row) => `      <tr>
        <td>${htmlEscape(row[keyName])}</td>
        <td>${row.hex ? `<span class="swatch" style="background:${htmlEscape(row.hex)}"></span>${htmlEscape(row.hex)}` : htmlEscape(JSON.stringify(row.hexCounts))}</td>
        <td>${htmlEscape(row.fileCount)}</td>
        <td>${htmlEscape(row.rows)}</td>
        <td>${htmlEscape(row.directMatches)}</td>
        <td>${htmlEscape(formatNumber(row.minDistance))}</td>
        <td>${htmlEscape(formatNumber(row.averageDistance))}</td>
        <td>${htmlEscape(row.files.join(", "))}</td>
      </tr>`
    )
    .join("\n");
}

export function formatSpecialColorSummaryHtml(summary, options = {}) {
  const limit = options.limit || 30;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Special Color Summary</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    table { border-collapse: collapse; min-width: 960px; font-size: 13px; margin-bottom: 24px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; vertical-align: top; }
    th { background: #eef3f8; }
    .swatch { display: inline-block; width: 32px; height: 16px; border: 1px solid #8792a2; vertical-align: middle; margin-right: 6px; }
  </style>
</head>
<body>
  <h1>JWW Special Color Summary</h1>
  <p>Reports ${htmlEscape(summary.counts.reports)}, candidate rows ${htmlEscape(summary.counts.candidateRows)}, direct matches ${htmlEscape(summary.counts.directMatches)}.</p>
  <p>${htmlEscape(summary.conclusion)}</p>
  <h2>Relative Offsets</h2>
  <table>
    <thead><tr><th>Relative</th><th>Colors</th><th>Files</th><th>Rows</th><th>Direct</th><th>Min Distance</th><th>Avg Distance</th><th>File Names</th></tr></thead>
    <tbody>
${rowsHtml(summary.byRelativeOffset, "relativeOffset", limit)}
    </tbody>
  </table>
  <h2>Colors</h2>
  <table>
    <thead><tr><th>Color</th><th>Color</th><th>Files</th><th>Rows</th><th>Direct</th><th>Min Distance</th><th>Avg Distance</th><th>File Names</th></tr></thead>
    <tbody>
${rowsHtml(summary.byHex, "hex", limit)}
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
      "Usage: node tools/jww-special-color-summary.mjs <audit-a.json> <audit-b.json> [--json|--csv|--html] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const summary = await summarizeSpecialColorAudits(args.inputs);
  const output = args.json
    ? `${JSON.stringify(summary, null, 2)}\n`
    : args.csv
      ? formatSpecialColorSummaryCsv(summary)
      : args.html
        ? formatSpecialColorSummaryHtml(summary, args)
        : formatSpecialColorSummaryText(summary, args);
  if (args.output) {
    const outputPath = path.resolve(args.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
  if (args.failOnDirectMatches && summary.counts.directMatches > 0) {
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
