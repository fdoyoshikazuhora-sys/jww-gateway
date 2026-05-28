#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertJwwBytes } from "./jww-gateway.mjs";

function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
    encoding: "shift_jis",
    json: false,
    csv: false,
    html: false,
    scope: "",
    family: "",
    status: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--encoding") args.encoding = argv[++index] || "shift_jis";
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--scope") args.scope = argv[++index] || "";
    else if (arg === "--family") args.family = argv[++index] || "";
    else if (arg === "--status") args.status = argv[++index] || "";
    else if (!args.input) args.input = arg;
  }
  return args;
}

function familyForKey(key) {
  if (/^S_COMM_/.test(key)) return "general";
  if (/^LCOLLOR_/.test(key)) return "screenColors";
  if (/^PCOLLOR_/.test(key)) return "printColors";
  if (/^LTYPE_/.test(key)) return "lineTypes";
  if (/^LAYNAM_/.test(key)) return "layerNames";
  if (/^LAYCOL_/.test(key)) return "layerColors";
  if (/^LAYWID_/.test(key)) return "layerWidths";
  if (/^LAYTYP_/.test(key)) return "layerLineTypes";
  if (/^(MSET|MHEN|MWIDE|MHIGH|MDIST|MPEN|MOFST)/.test(key)) return "text";
  if (/^(S_STR|S_SET)/.test(key)) return "dimensions";
  if (/^HATCH_/.test(key)) return "hatch";
  if (/^(KEY|N_KEY)/.test(key)) return "keys";
  if (/^(LD|RD|COM|GCOM|AC_COM|WD_COM)/.test(key)) return "commands";
  return "other";
}

function scopeForKey(key) {
  if (
    /^(LCOLLOR_|PCOLLOR_|LTYPE_|LAYNAM_|LAYCOL_|LAYWID_|LAYTYP_|LAYSCALE$)/.test(
      key
    )
  ) {
    return "drawing";
  }
  if (
    /^(MSET|MHEN|MWIDE|MHIGH|MDIST|MPEN|MOFST|S_STR|S_SET|HATCH_|ZF_SET|SL_SET|CU_SET|MS_SET|R_STR0_00|P_dpi$)/.test(
      key
    )
  ) {
    return "document";
  }
  if (
    /^(S_COMM_|S_MESH_0$|ZOOM$|R_CROSS_SET$|KEY|N_KEY|LD|RD|COM|GCOM|AC_COM|WD_COM)/.test(
      key
    )
  ) {
    return "operation";
  }
  return "unknown";
}

function splitFilter(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = row[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function countByPair(rows, firstKey, secondKey) {
  return rows.reduce((counts, row) => {
    const first = row[firstKey] || "unknown";
    const second = row[secondKey] || "unknown";
    counts[first] ||= {};
    counts[first][second] = (counts[first][second] || 0) + 1;
    return counts;
  }, {});
}

export function buildCoverageReport(converted, options = {}) {
  const coverage = converted.meta?.jwwEnvironment?.coverage || {};
  const supported = new Set(coverage.supportedKeys || []);
  const missing = new Set(coverage.missingJwfKeys || []);
  const partialFamilies = new Set(
    (coverage.partialKeys || []).map((key) => key.replace("_*", ""))
  );
  const keys = Array.from(new Set([...supported, ...missing])).sort();
  const scopeFilter = new Set(splitFilter(options.scope));
  const familyFilter = new Set(splitFilter(options.family));
  const statusFilter = new Set(splitFilter(options.status));

  const rows = keys
    .map((key) => {
      const family = familyForKey(key);
      const status = supported.has(key) ? "extracted" : "missing";
      const partial =
        partialFamilies.has(family) ||
        [...partialFamilies].some((prefix) => key.startsWith(prefix));
      return {
        key,
        scope: scopeForKey(key),
        family,
        status,
        partial: partial ? "yes" : "no",
      };
    })
    .filter(
      (row) =>
        (!scopeFilter.size || scopeFilter.has(row.scope)) &&
        (!familyFilter.size || familyFilter.has(row.family)) &&
        (!statusFilter.size || statusFilter.has(row.status))
    );

  return {
    format: "jww-coverage-report",
    generatedAt: new Date().toISOString(),
    source: options.source || "",
    sourceFormat: converted.sourceFormat,
    paperSize: converted.meta?.paperSize || null,
    entityCount: converted.entities?.length || 0,
    counts: {
      total: keys.length,
      filtered: rows.length,
      extracted: keys.filter((key) => supported.has(key)).length,
      missing: keys.filter((key) => missing.has(key)).length,
    },
    statusCounts: countBy(rows, "status"),
    scopeCounts: countBy(rows, "scope"),
    familyCounts: countBy(rows, "family"),
    scopeStatusCounts: countByPair(rows, "scope", "status"),
    familyStatusCounts: countByPair(rows, "family", "status"),
    rows,
  };
}

function formatNestedCounts(title, counts) {
  const lines = [title];
  for (const [group, statusCounts] of Object.entries(counts).sort()) {
    const summary = Object.entries(statusCounts)
      .sort()
      .map(([status, count]) => `${status} ${count}`)
      .join(", ");
    lines.push(`  ${group}: ${summary}`);
  }
  return lines;
}

export function formatCoverageText(report) {
  const lines = [
    "JWW Coverage Report",
    `Paper: ${report.paperSize || "-"}`,
    `Entities: ${report.entityCount}`,
    `Tracked keys: ${report.counts.total}`,
    `Extracted: ${report.counts.extracted}`,
    `Missing: ${report.counts.missing}`,
    `Rows: ${report.counts.filtered}`,
    "",
    ...formatNestedCounts("Scope Status:", report.scopeStatusCounts),
    "",
    ...formatNestedCounts("Family Status:", report.familyStatusCounts),
    "",
    "Open Items:",
  ];
  for (const row of report.rows
    .filter((item) => item.status === "missing")
    .slice(0, 30)) {
    lines.push(`  ${row.key} (${row.scope}/${row.family})`);
  }
  const missingCount = report.rows.filter(
    (item) => item.status === "missing"
  ).length;
  if (missingCount > 30) lines.push(`  ... ${missingCount - 30} more`);
  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function formatCoverageCsv(report) {
  const rows = [
    ["section", "group", "status", "count"],
    ...Object.entries(report.scopeStatusCounts).flatMap(
      ([scope, statusCounts]) =>
        Object.entries(statusCounts).map(([status, count]) => [
          "scopeStatus",
          scope,
          status,
          count,
        ])
    ),
    ...Object.entries(report.familyStatusCounts).flatMap(
      ([family, statusCounts]) =>
        Object.entries(statusCounts).map(([status, count]) => [
          "familyStatus",
          family,
          status,
          count,
        ])
    ),
    [],
    ["key", "scope", "family", "status", "partial"],
    ...report.rows.map((row) => [
      row.key,
      row.scope,
      row.family,
      row.status,
      row.partial,
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

function nestedCountsRows(counts) {
  return Object.entries(counts)
    .sort()
    .flatMap(([group, statusCounts]) =>
      Object.entries(statusCounts)
        .sort()
        .map(
          ([status, count]) => `      <tr>
        <td>${htmlEscape(group)}</td>
        <td>${htmlEscape(status)}</td>
        <td>${htmlEscape(count)}</td>
      </tr>`
        )
    )
    .join("\n");
}

export function formatCoverageHtml(report) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Coverage Report</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    table { border-collapse: collapse; min-width: 720px; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; }
    th { background: #eef3f8; }
    .missing { color: #a20f0f; font-weight: 700; }
    .extracted { color: #136b2c; font-weight: 700; }
  </style>
</head>
<body>
  <h1>JWW Coverage Report</h1>
  <p>Tracked ${report.counts.total}, extracted ${report.counts.extracted}, missing ${report.counts.missing}, rows ${report.counts.filtered}</p>
  <h2>Scope Status</h2>
  <table>
    <thead><tr><th>Scope</th><th>Status</th><th>Count</th></tr></thead>
    <tbody>
${nestedCountsRows(report.scopeStatusCounts)}
    </tbody>
  </table>
  <h2>Family Status</h2>
  <table>
    <thead><tr><th>Family</th><th>Status</th><th>Count</th></tr></thead>
    <tbody>
${nestedCountsRows(report.familyStatusCounts)}
    </tbody>
  </table>
  <h2>Keys</h2>
  <table>
    <thead><tr><th>Key</th><th>Scope</th><th>Family</th><th>Status</th><th>Partial</th></tr></thead>
    <tbody>
${report.rows
  .map(
    (row) => `      <tr>
        <td>${htmlEscape(row.key)}</td>
        <td>${htmlEscape(row.scope)}</td>
        <td>${htmlEscape(row.family)}</td>
        <td class="${htmlEscape(row.status)}">${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.partial)}</td>
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
  if (!args.input) {
    console.error(
      "Usage: node tools/jww-coverage.mjs <input.jww> [--encoding shift_jis] [--scope drawing] [--family lineTypes] [--status missing] [--json|--csv|--html] [-o output]"
    );
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(args.input);
  const inputStats = await stat(inputPath);
  const bytes = new Uint8Array(await readFile(inputPath));
  const converted = convertJwwBytes(bytes, {
    encoding: args.encoding,
    sourcePath: inputPath,
    lastModified: inputStats.mtime,
  });
  const report = buildCoverageReport(converted, args);
  report.source = inputPath;
  const output = args.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : args.csv
      ? formatCoverageCsv(report)
      : args.html
        ? formatCoverageHtml(report)
        : formatCoverageText(report);
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
