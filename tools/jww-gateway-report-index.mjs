#!/usr/bin/env node
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const REPORT_DEFINITIONS = [
  {
    id: "verify-report",
    title: "Verify report",
    files: [
      "verify-report.txt",
      "verify-report.json",
      "verify-report.csv",
      "verify-report.html",
    ],
    command: "npm run verify:reports",
    purpose:
      "Package readiness, manifest validity, required files, unresolved keys, and SHA-256 inventory.",
  },
  {
    id: "open-items",
    title: "Open items",
    files: ["open-items.json", "open-items.html"],
    command:
      "npm run open-items -- --json -o reports\\open-items.json && npm run open-items -- --html -o reports\\open-items.html",
    purpose:
      "Classified limitations and remaining JWW/JWF research items, including conversion impact and release decision.",
  },
  {
    id: "sample-plan",
    title: "Sample plan",
    files: ["sample-plan.txt", "sample-plan.json", "sample-plan.csv", "sample-plan.html"],
    command:
      "npm run sample:plan -- docs\\JWW_GATEWAY_SAMPLE_SETS.example.json --html -o reports\\sample-plan.html",
    purpose: "Repeatable command plan for local .jww + .jwf sample sets.",
  },
  {
    id: "verify-diff",
    title: "Verify diff",
    files: ["verify-diff.txt", "verify-diff.json", "verify-diff.csv", "verify-diff.html"],
    command:
      "npm run verify:diff -- reports\\before-verify-report.json reports\\verify-report.json --html --allow-differences -o reports\\verify-diff.html",
    purpose: "Added, removed, and changed files between two verify-report JSON files.",
  },
  {
    id: "coverage-summary",
    title: "Coverage summary",
    files: ["sample-coverage-summary.html", "sample-coverage-summary.json"],
    command: "npm run coverage:summary -- reports\\*.coverage.json --html -o reports\\sample-coverage-summary.html",
    purpose: "Cross-sample JWF-like coverage summary.",
  },
  {
    id: "core-open-summary",
    title: "Core open summary",
    files: ["sample-core-open-summary.html", "sample-core-open-summary.json"],
    command: "npm run core:summary -- reports\\*.core-open.json --html -o reports\\sample-core-open-summary.html",
    purpose: "Cross-sample LTYPE_HC and LCOLLOR_M direct-match review.",
  },
  {
    id: "special-color-summary",
    title: "Special color summary",
    files: ["sample-special-color-summary.html", "sample-special-color-summary.json"],
    command:
      "npm run special-color:summary -- reports\\*.special-color.json --html -o reports\\sample-special-color-summary.html",
    purpose: "Cross-sample LCOLLOR_M nearby color candidate review.",
  },
  {
    id: "layer-defaults-summary",
    title: "Layer defaults summary",
    files: ["sample-layer-defaults-summary.html", "sample-layer-defaults-summary.json"],
    command:
      "npm run layer-defaults:summary -- reports\\*.layer-defaults.json --html -o reports\\sample-layer-defaults-summary.html",
    purpose: "Cross-sample LAYCOL, LAYWID, and LAYTYP audit summary.",
  },
];

function parseArgs(argv) {
  const args = {
    root: packageRoot,
    output: "",
    json: false,
    csv: false,
    html: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = path.resolve(argv[++index] || packageRoot);
    else if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
  }
  return args;
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfPresent(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

export async function buildReportIndex(options = {}) {
  const root = path.resolve(options.root || packageRoot);
  const reportsDir = path.join(root, "reports");
  let existingFiles = [];
  try {
    existingFiles = await readdir(reportsDir);
  } catch {
    existingFiles = [];
  }
  const existingSet = new Set(existingFiles);
  const manifest = await readJsonIfPresent(
    path.join(root, "JWW_GATEWAY_MANIFEST.json")
  );

  const rows = REPORT_DEFINITIONS.map((definition) => {
    const files = definition.files.map((file) => ({
      file,
      exists: existingSet.has(file),
      path: `reports/${file}`,
    }));
    return {
      ...definition,
      files,
      available: files.some((file) => file.exists),
    };
  });

  return {
    format: "jww-gateway-report-index",
    generatedAt: new Date().toISOString(),
    packageName: manifest?.packageName || "",
    packageVersion: manifest?.packageVersion || "",
    manifestGeneratedAt: manifest?.generatedAt || "",
    reportsDir: "reports",
    counts: {
      reportGroups: rows.length,
      availableGroups: rows.filter((row) => row.available).length,
      files: existingFiles.length,
    },
    rows,
  };
}

export function formatReportIndexText(index) {
  const lines = [
    "JWW Gateway Report Index",
    `Package: ${index.packageName} ${index.packageVersion}`.trimEnd(),
    `Report groups: ${index.counts.availableGroups}/${index.counts.reportGroups}`,
    `Report files: ${index.counts.files}`,
    "",
    "Reports:",
  ];
  for (const row of index.rows) {
    const files = row.files
      .filter((file) => file.exists)
      .map((file) => file.file)
      .join(", ");
    lines.push(
      `  ${row.available ? "yes" : "no "} ${row.title}: ${files || "not generated"}`,
      `      ${row.purpose}`,
      `      ${row.command}`
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function formatReportIndexCsv(index) {
  const rows = [
    ["id", "title", "available", "files", "purpose", "command"],
    ...index.rows.map((row) => [
      row.id,
      row.title,
      row.available ? "yes" : "no",
      row.files
        .filter((file) => file.exists)
        .map((file) => file.file)
        .join("; "),
      row.purpose,
      row.command,
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

function reportLinks(row) {
  const links = row.files.filter((file) => file.exists);
  if (!links.length) return "not generated";
  return links
    .map(
      (file) =>
        `<a href="${htmlEscape(file.file)}">${htmlEscape(file.file)}</a>`
    )
    .join("<br>");
}

export function formatReportIndexHtml(index) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Gateway Report Index</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    .meta { margin: 0 0 16px; color: #42526b; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; vertical-align: top; }
    th { background: #eef3f8; }
    .yes { color: #136b2c; font-weight: 700; }
    .no { color: #8a4b00; font-weight: 700; }
    code { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>JWW Gateway Report Index</h1>
  <p class="meta">Package ${htmlEscape(index.packageName)} ${htmlEscape(index.packageVersion)} / available groups ${htmlEscape(index.counts.availableGroups)} of ${htmlEscape(index.counts.reportGroups)}</p>
  <table>
    <thead>
      <tr><th>Status</th><th>Report</th><th>Files</th><th>Purpose</th><th>Command</th></tr>
    </thead>
    <tbody>
${index.rows
  .map(
    (row) => `      <tr>
        <td class="${row.available ? "yes" : "no"}">${row.available ? "available" : "missing"}</td>
        <td>${htmlEscape(row.title)}</td>
        <td>${reportLinks(row)}</td>
        <td>${htmlEscape(row.purpose)}</td>
        <td><code>${htmlEscape(row.command)}</code></td>
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
  const index = await buildReportIndex({ root: args.root });
  const output = args.json
    ? `${JSON.stringify(index, null, 2)}\n`
    : args.csv
      ? formatReportIndexCsv(index)
      : args.html
        ? formatReportIndexHtml(index)
        : formatReportIndexText(index);
  if (args.output) await writeFile(path.resolve(args.output), output, "utf8");
  else process.stdout.write(output);
  process.exitCode = (await fileExists(path.join(args.root, "reports")))
    ? 0
    : 1;
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
