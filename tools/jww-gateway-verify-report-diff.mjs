#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {
    before: "",
    after: "",
    output: "",
    json: false,
    html: false,
    csv: false,
    allowDifferences: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--allow-differences") args.allowDifferences = true;
    else if (!args.before) args.before = arg;
    else args.after = arg;
  }
  return args;
}

async function readReport(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function inventoryByFile(report) {
  return new Map((report.fileInventory || []).map((item) => [item.file, item]));
}

export function diffGatewayVerifyReports(before, after) {
  const beforeFiles = inventoryByFile(before);
  const afterFiles = inventoryByFile(after);
  const files = [
    ...new Set([...beforeFiles.keys(), ...afterFiles.keys()]),
  ].sort();
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const file of files) {
    const oldItem = beforeFiles.get(file);
    const newItem = afterFiles.get(file);
    if (!oldItem && newItem) added.push(newItem);
    else if (oldItem && !newItem) removed.push(oldItem);
    else if (
      oldItem.sha256 !== newItem.sha256 ||
      oldItem.bytes !== newItem.bytes
    ) {
      changed.push({ file, before: oldItem, after: newItem });
    } else {
      unchanged.push(newItem);
    }
  }

  return {
    format: "jww-gateway-verify-report-diff",
    before: before.manifestFile || "",
    after: after.manifestFile || "",
    counts: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: unchanged.length,
    },
    added,
    removed,
    changed,
    unchanged: unchanged.map((item) => item.file),
  };
}

export function formatGatewayVerifyReportDiffText(diff) {
  const lines = [
    "JWW Gateway Verify Report Diff",
    `Added: ${diff.counts.added}`,
    `Removed: ${diff.counts.removed}`,
    `Changed: ${diff.counts.changed}`,
    `Unchanged: ${diff.counts.unchanged}`,
  ];
  if (diff.changed.length) {
    lines.push("", "Changed Files:");
    for (const item of diff.changed) {
      lines.push(
        `  ${item.file}: ${item.before.bytes} -> ${item.after.bytes} bytes`
      );
    }
  }
  if (diff.added.length) {
    lines.push("", "Added Files:");
    for (const item of diff.added) lines.push(`  ${item.file}`);
  }
  if (diff.removed.length) {
    lines.push("", "Removed Files:");
    for (const item of diff.removed) lines.push(`  ${item.file}`);
  }
  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  return `${rows.map((row) => row.map(csvValue).join(",")).join("\n")}\n`;
}

export function formatGatewayVerifyReportDiffCsv(diff) {
  return rowsToCsv([
    [
      "status",
      "file",
      "beforeBytes",
      "afterBytes",
      "beforeSha256",
      "afterSha256",
    ],
    ...diff.added.map((item) => [
      "added",
      item.file,
      "",
      item.bytes ?? "",
      "",
      item.sha256 || "",
    ]),
    ...diff.removed.map((item) => [
      "removed",
      item.file,
      item.bytes ?? "",
      "",
      item.sha256 || "",
      "",
    ]),
    ...diff.changed.map((item) => [
      "changed",
      item.file,
      item.before.bytes ?? "",
      item.after.bytes ?? "",
      item.before.sha256 || "",
      item.after.sha256 || "",
    ]),
  ]);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatGatewayVerifyReportDiffHtml(diff) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Gateway Verify Report Diff</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; }
    th { background: #eef3f8; }
  </style>
</head>
<body>
  <h1>JWW Gateway Verify Report Diff</h1>
  <p>Added: ${htmlEscape(diff.counts.added)} / Removed: ${htmlEscape(diff.counts.removed)} / Changed: ${htmlEscape(diff.counts.changed)} / Unchanged: ${htmlEscape(diff.counts.unchanged)}</p>
  <table>
    <thead><tr><th>Status</th><th>File</th><th>Before</th><th>After</th></tr></thead>
    <tbody>
${[
  ...diff.added.map(
    (item) =>
      `      <tr><td>added</td><td>${htmlEscape(item.file)}</td><td></td><td>${htmlEscape(item.sha256 || "")}</td></tr>`
  ),
  ...diff.removed.map(
    (item) =>
      `      <tr><td>removed</td><td>${htmlEscape(item.file)}</td><td>${htmlEscape(item.sha256 || "")}</td><td></td></tr>`
  ),
  ...diff.changed.map(
    (item) =>
      `      <tr><td>changed</td><td>${htmlEscape(item.file)}</td><td>${htmlEscape(item.before.sha256 || "")}</td><td>${htmlEscape(item.after.sha256 || "")}</td></tr>`
  ),
].join("\n")}
    </tbody>
  </table>
</body>
</html>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.before || !args.after) {
    console.error(
      "Usage: node tools/jww-gateway-verify-report-diff.mjs <before-report.json> <after-report.json> [--json|--csv|--html] [--allow-differences] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const diff = diffGatewayVerifyReports(
    await readReport(args.before),
    await readReport(args.after)
  );
  const output = args.json
    ? `${JSON.stringify(diff, null, 2)}\n`
    : args.csv
      ? formatGatewayVerifyReportDiffCsv(diff)
      : args.html
        ? formatGatewayVerifyReportDiffHtml(diff)
        : formatGatewayVerifyReportDiffText(diff);
  if (args.output) await writeFile(path.resolve(args.output), output, "utf8");
  else process.stdout.write(output);
  process.exitCode =
    !args.allowDifferences &&
    (diff.counts.added || diff.counts.removed || diff.counts.changed)
      ? 1
      : 0;
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
