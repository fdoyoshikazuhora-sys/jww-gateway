#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJwfBytes } from "../src/jww/jwf.js";
import { convertJwwBytes } from "./jww-gateway.mjs";
import { scanValues } from "./jww-jwf-value-scan.mjs";

const LAYER_FAMILIES = new Set([
  "layerColors",
  "layerWidths",
  "layerLineTypes",
]);

function parseArgs(argv) {
  const args = {
    jww: "",
    jwf: "",
    output: "",
    encoding: "shift_jis",
    includeAfterEnd: false,
    json: false,
    csv: false,
    html: false,
    maxMatches: 8,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--encoding") args.encoding = argv[++index] || "shift_jis";
    else if (arg === "--include-after-end") args.includeAfterEnd = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--max-matches")
      args.maxMatches = Number(argv[++index]) || 8;
    else if (!args.jww) args.jww = arg;
    else if (!args.jwf) args.jwf = arg;
  }
  return args;
}

function extractionStatusFromEnvironment(environment = {}) {
  const supported = new Set(environment.coverage?.supportedKeys || []);
  const missing = new Set(environment.coverage?.missingJwfKeys || []);
  const nonSerialized = new Set(
    environment.coverage?.nonSerializedJwfKeys || []
  );
  return Object.fromEntries(
    [...new Set([...supported, ...missing, ...nonSerialized])].map((key) => [
      key,
      supported.has(key)
        ? "extracted"
        : nonSerialized.has(key)
          ? "not-serialized"
          : "missing",
    ])
  );
}

function countByFamilyStatus(rows) {
  return rows.reduce((counts, row) => {
    const family = row.family || "unknown";
    const status = row.status || "unknown";
    counts[family] ||= {};
    counts[family][status] = (counts[family][status] || 0) + 1;
    return counts;
  }, {});
}

function matchCount(row) {
  return (row.matches || []).reduce(
    (total, match) => total + (match.offsets?.length || 0),
    0
  );
}

function compactRow(row) {
  return {
    key: row.key,
    family: row.family,
    status: row.status,
    gatewayStatus: row.gatewayStatus,
    reason: row.reason || "",
    values: row.values || [],
    testedPatterns: (row.testedPatterns || []).map((pattern) => pattern.kind),
    matchKinds: (row.matches || []).map((match) => match.kind),
    matchCount: matchCount(row),
    nonSerializedJwfKey:
      row.gatewayCandidateComparison?.nonSerializedJwfKey === true,
  };
}

export async function buildLayerDefaultsAudit(options) {
  const jwwPath = path.resolve(options.jww);
  const jwfPath = path.resolve(options.jwf);
  const [jwwStats, jwwBytes, jwfBytes] = await Promise.all([
    stat(jwwPath),
    readFile(jwwPath),
    readFile(jwfPath),
  ]);
  const converted = convertJwwBytes(new Uint8Array(jwwBytes), {
    encoding: options.encoding,
    sourcePath: jwwPath,
    lastModified: jwwStats.mtime,
  });
  const environment = converted.meta?.jwwEnvironment || {};
  const parsedJwf = parseJwfBytes(new Uint8Array(jwfBytes), {
    encoding: options.encoding,
    includeAfterEnd: options.includeAfterEnd,
  });
  const rows = scanValues(
    new Uint8Array(jwwBytes),
    parsedJwf,
    options.maxMatches,
    extractionStatusFromEnvironment(environment),
    environment
  )
    .filter((row) => LAYER_FAMILIES.has(row.family))
    .map(compactRow);
  const nonSerializedRows = rows.filter((row) => row.nonSerializedJwfKey);
  const directByteMatches = rows.filter((row) => row.status === "matched");
  const directMatchCandidates = directByteMatches.filter(
    (row) => !row.nonSerializedJwfKey
  );
  const promotionCandidates = directMatchCandidates.filter(
    (row) => row.gatewayStatus !== "extracted"
  );
  const missingRows = rows.filter((row) => row.status === "missing");
  const conclusion =
    nonSerializedRows.length === rows.length
      ? "LAYCOL/LAYWID/LAYTYP rows are JWF-only write-layer operation defaults and are not serialized into JWW. Byte matches are incidental and are not parser promotion candidates."
      : "Review matched or ambiguous rows before promoting any layer defaults.";
  return {
    format: "jww-layer-defaults-audit",
    generatedAt: new Date().toISOString(),
    sources: { jww: jwwPath, jwf: jwfPath },
    paperSize: converted.meta?.paperSize || null,
    entityCount: converted.entities?.length || 0,
    counts: {
      rows: rows.length,
      missing: missingRows.length,
      nonSerialized: nonSerializedRows.length,
      directByteMatches: directByteMatches.length,
      directMatchCandidates: directMatchCandidates.length,
      promotionCandidates: promotionCandidates.length,
    },
    conclusion,
    familyStatusCounts: countByFamilyStatus(rows),
    promotionCandidates,
    rows,
  };
}

export function formatLayerDefaultsAuditText(report) {
  const lines = [
    "JWW Layer Defaults Audit",
    `JWW: ${report.sources.jww}`,
    `JWF: ${report.sources.jwf}`,
    `Paper: ${report.paperSize || "-"}`,
    `Entities: ${report.entityCount}`,
    `Rows: ${report.counts.rows}`,
    `Missing: ${report.counts.missing}`,
    `Non-serialized JWF keys: ${report.counts.nonSerialized}`,
    `Direct byte matches: ${report.counts.directByteMatches}`,
    `Direct match candidates: ${report.counts.directMatchCandidates}`,
    `Promotion candidates: ${report.counts.promotionCandidates}`,
    `Conclusion: ${report.conclusion}`,
    "",
    "Family Status:",
  ];
  for (const [family, counts] of Object.entries(report.familyStatusCounts)) {
    const summary = Object.entries(counts)
      .map(([status, count]) => `${status} ${count}`)
      .join(", ");
    lines.push(`  ${family}: ${summary}`);
  }
  lines.push("", "Promotion Candidates:");
  if (!report.promotionCandidates.length) {
    lines.push("  none");
  } else {
    for (const row of report.promotionCandidates) {
      lines.push(`  ${row.key}: ${row.status}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  const text = Array.isArray(value)
    ? value.join("; ")
    : value && typeof value === "object"
      ? JSON.stringify(value)
      : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function formatLayerDefaultsAuditCsv(report) {
  const rows = [
    ["section", "key", "value"],
    ["summary", "rows", report.counts.rows],
    ["summary", "missing", report.counts.missing],
    ["summary", "nonSerialized", report.counts.nonSerialized],
    ["summary", "directByteMatches", report.counts.directByteMatches],
    ["summary", "directMatchCandidates", report.counts.directMatchCandidates],
    ["summary", "promotionCandidates", report.counts.promotionCandidates],
    ["summary", "conclusion", report.conclusion],
    [],
    ["section", "family", "status", "count"],
    ...Object.entries(report.familyStatusCounts || {}).flatMap(
      ([family, counts]) =>
        Object.entries(counts).map(([status, count]) => [
          "familyStatus",
          family,
          status,
          count,
        ])
    ),
    [],
    [
      "key",
      "family",
      "status",
      "gatewayStatus",
      "reason",
      "values",
      "testedPatterns",
      "matchKinds",
      "matchCount",
      "nonSerializedJwfKey",
    ],
    ...report.rows.map((row) => [
      row.key,
      row.family,
      row.status,
      row.gatewayStatus,
      row.reason,
      row.values,
      row.testedPatterns,
      row.matchKinds,
      row.matchCount,
      row.nonSerializedJwfKey,
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

export function formatLayerDefaultsAuditHtml(report) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Layer Defaults Audit</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    table { border-collapse: collapse; min-width: 900px; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; vertical-align: top; }
    th { background: #eef3f8; }
    tr.missing { background: #fff4f4; }
    tr.ambiguous { background: #fff9eb; }
    tr.matched { background: #eefaf0; }
  </style>
</head>
<body>
  <h1>JWW Layer Defaults Audit</h1>
  <p>Rows ${report.counts.rows}, missing ${report.counts.missing}, non-serialized ${report.counts.nonSerialized}, direct byte matches ${report.counts.directByteMatches}, direct match candidates ${report.counts.directMatchCandidates}, promotion candidates ${report.counts.promotionCandidates}</p>
  <p><strong>Conclusion:</strong> ${htmlEscape(report.conclusion)}</p>
  <h2>Family Status</h2>
  <table>
    <thead><tr><th>Family</th><th>Status</th><th>Count</th></tr></thead>
    <tbody>
${Object.entries(report.familyStatusCounts || {})
  .flatMap(([family, counts]) =>
    Object.entries(counts).map(
      ([status, count]) => `      <tr>
        <td>${htmlEscape(family)}</td>
        <td>${htmlEscape(status)}</td>
        <td>${htmlEscape(count)}</td>
      </tr>`
    )
  )
  .join("\n")}
    </tbody>
  </table>
  <h2>Rows</h2>
  <table>
    <thead><tr><th>Key</th><th>Family</th><th>Status</th><th>Gateway</th><th>Non-serialized</th><th>Reason</th><th>Values</th><th>Tested</th><th>Matches</th></tr></thead>
    <tbody>
${report.rows
  .map(
    (row) => `      <tr class="${htmlEscape(row.status)}">
        <td>${htmlEscape(row.key)}</td>
        <td>${htmlEscape(row.family)}</td>
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.gatewayStatus)}</td>
        <td>${htmlEscape(row.nonSerializedJwfKey)}</td>
        <td>${htmlEscape(row.reason)}</td>
        <td>${htmlEscape(row.values.join(", "))}</td>
        <td>${htmlEscape(row.testedPatterns.join(", "))}</td>
        <td>${htmlEscape(row.matchKinds.join(", ") || "-")}</td>
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
  if (!args.jww || !args.jwf) {
    console.error(
      "Usage: node tools/jww-layer-defaults-audit.mjs <input.jww> <input.jwf> [--encoding shift_jis] [--include-after-end] [--json|--csv|--html] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const report = await buildLayerDefaultsAudit(args);
  const output = args.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : args.csv
      ? formatLayerDefaultsAuditCsv(report)
      : args.html
        ? formatLayerDefaultsAuditHtml(report)
        : formatLayerDefaultsAuditText(report);
  if (args.output) {
    const outputPath = path.resolve(args.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
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
