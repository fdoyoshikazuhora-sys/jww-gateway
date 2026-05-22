#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function parseArgs(argv) {
  const args = {
    manifest: "JWW_GATEWAY_MANIFEST.json",
    output: "",
    json: false,
    csv: false,
    html: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else args.manifest = arg;
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function packageRelativePath(root, file) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative;
  }
  return path.basename(file);
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = row[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

export function buildOpenItemsReport(manifest, options = {}) {
  const openItems = Array.isArray(manifest.openItems)
    ? manifest.openItems.map((item) => ({ ...item }))
    : [];
  return {
    format: "jww-gateway-open-items",
    generatedAt: new Date().toISOString(),
    packageName: manifest.packageName || "",
    packageVersion: manifest.packageVersion || "",
    manifestFile: options.manifestFile || "",
    manifestGeneratedAt: manifest.generatedAt || "",
    unresolvedEnvironmentKeys: manifest.unresolvedEnvironmentKeys || [],
    counts: {
      total: openItems.length,
      byStatus: countBy(openItems, "status"),
      byCategory: countBy(openItems, "category"),
      byClassification: countBy(openItems, "classification"),
      byReleaseDecision: countBy(openItems, "releaseDecision"),
    },
    openItems,
  };
}

export async function buildOpenItemsReportFromFile(
  manifest = "JWW_GATEWAY_MANIFEST.json",
  options = {}
) {
  const manifestFile = path.resolve(options.root || packageRoot, manifest);
  const root = path.resolve(options.root || path.dirname(manifestFile));
  return buildOpenItemsReport(await readJson(manifestFile), {
    manifestFile: packageRelativePath(root, manifestFile),
  });
}

export function formatOpenItemsText(report) {
  const lines = [
    "JWW Gateway Open Items",
    `Package: ${report.packageName} ${report.packageVersion}`,
    `Manifest generated: ${report.manifestGeneratedAt || "unknown"}`,
    `Open items: ${report.counts.total}`,
    `Unresolved environment keys: ${report.unresolvedEnvironmentKeys.join(", ") || "none"}`,
  ];

  if (report.openItems.length) {
    lines.push("", "Items:");
    for (const item of report.openItems) {
      lines.push(
        `  [${item.status || "unknown"}] ${item.id || "unknown"} - ${item.title || ""}`,
        `    Category: ${item.category || "unknown"}`,
        `    Classification: ${item.classification || "unknown"}`,
        `    Conversion impact: ${item.conversionImpact || "unknown"}`,
        `    Release decision: ${item.releaseDecision || "unknown"}`,
        `    Detail: ${item.detail || ""}`
      );
      if (item.evidence) lines.push(`    Evidence: ${item.evidence}`);
      if (item.nextAction) lines.push(`    Next: ${item.nextAction}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function formatOpenItemsCsv(report) {
  const rows = [
    [
      "id",
      "status",
      "category",
      "classification",
      "conversionImpact",
      "releaseDecision",
      "title",
      "detail",
      "evidence",
      "nextAction",
    ],
    ...report.openItems.map((item) => [
      item.id,
      item.status,
      item.category,
      item.classification,
      item.conversionImpact,
      item.releaseDecision,
      item.title,
      item.detail,
      item.evidence,
      item.nextAction,
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

export function formatOpenItemsHtml(report) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Gateway Open Items</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; vertical-align: top; }
    th { background: #eef3f8; }
    .meta { margin-bottom: 16px; color: #42526b; }
  </style>
</head>
<body>
  <h1>JWW Gateway Open Items</h1>
  <p class="meta">Package ${htmlEscape(report.packageName)} ${htmlEscape(report.packageVersion)} / ${htmlEscape(report.counts.total)} items</p>
  <table>
    <thead>
      <tr><th>ID</th><th>Status</th><th>Category</th><th>Class</th><th>Impact</th><th>Decision</th><th>Title</th><th>Detail</th><th>Evidence</th><th>Next</th></tr>
    </thead>
    <tbody>
${report.openItems
  .map(
    (item) => `      <tr>
        <td>${htmlEscape(item.id)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${htmlEscape(item.category)}</td>
        <td>${htmlEscape(item.classification)}</td>
        <td>${htmlEscape(item.conversionImpact)}</td>
        <td>${htmlEscape(item.releaseDecision)}</td>
        <td>${htmlEscape(item.title)}</td>
        <td>${htmlEscape(item.detail)}</td>
        <td>${htmlEscape(item.evidence)}</td>
        <td>${htmlEscape(item.nextAction)}</td>
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
  const report = await buildOpenItemsReportFromFile(args.manifest);
  const output = args.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : args.csv
      ? formatOpenItemsCsv(report)
      : args.html
        ? formatOpenItemsHtml(report)
        : formatOpenItemsText(report);
  if (args.output) await writeFile(path.resolve(args.output), output, "utf8");
  else process.stdout.write(output);
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
