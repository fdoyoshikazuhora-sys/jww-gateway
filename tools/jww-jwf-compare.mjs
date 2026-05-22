#!/usr/bin/env node
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertJwwBytes } from "./jww-gateway.mjs";
import { parseJwfBytes } from "../src/jww/jwf.js";

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
    scope: "",
    family: "",
    key: "",
    status: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--jww") args.jww = argv[++index] || "";
    else if (arg === "--jwf") args.jwf = argv[++index] || "";
    else if (arg === "-o" || arg === "--output")
      args.output = argv[++index] || "";
    else if (arg === "--encoding") args.encoding = argv[++index] || "shift_jis";
    else if (arg === "--include-after-end") args.includeAfterEnd = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--scope") args.scope = argv[++index] || "";
    else if (arg === "--family") args.family = argv[++index] || "";
    else if (arg === "--key") args.key = argv[++index] || "";
    else if (arg === "--status") args.status = argv[++index] || "";
    else if (!args.jww) args.jww = arg;
    else if (!args.jwf) args.jwf = arg;
  }
  return args;
}

function csvValue(value) {
  const text = Array.isArray(value)
    ? value.join("; ")
    : value === null || value === undefined
      ? ""
      : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  return `${rows.map((row) => row.map(csvValue).join(",")).join("\n")}\n`;
}

function scopeStatusCounts(rows) {
  return (rows || []).reduce((acc, row) => {
    const scope = row.definition?.scope || "unknown";
    const status = row.status || "unknown";
    if (!acc[scope]) acc[scope] = {};
    acc[scope][status] = (acc[scope][status] || 0) + 1;
    return acc;
  }, {});
}

function familyStatusCounts(rows) {
  return (rows || []).reduce((acc, row) => {
    const family = row.family || "unknown";
    const status = row.status || "unknown";
    if (!acc[family]) acc[family] = {};
    acc[family][status] = (acc[family][status] || 0) + 1;
    return acc;
  }, {});
}

function formatScopeStatusCounts(counts) {
  return Object.entries(counts || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([scope, values]) => {
      const parts = Object.entries(values)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([status, count]) => `${status} ${count}`)
        .join(" / ");
      return `${scope}: ${parts}`;
    });
}

function formatFamilyStatusCounts(counts) {
  return Object.entries(counts || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, values]) => {
      const parts = Object.entries(values)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([status, count]) => `${status} ${count}`)
        .join(" / ");
      return `${family}: ${parts}`;
    });
}

function buildComparison(converted, parsedJwf, sources) {
  const environment = converted.meta?.jwwEnvironment || {};
  const environmentRegion = converted.meta?.environmentRegion || null;
  const supported = new Set(environment.coverage?.supportedKeys || []);
  const missing = new Set(environment.coverage?.missingJwfKeys || []);
  const jwfKeys = parsedJwf.keys || [];
  const rows = jwfKeys.map((key) => ({
    key,
    family: parsedJwf.entries?.[key]?.family || "unknown",
    definition: parsedJwf.entries?.[key]?.definition || null,
    status: supported.has(key)
      ? "extracted"
      : missing.has(key)
        ? "missing"
        : "not-tracked",
    values: parsedJwf.entries?.[key]?.values || [],
  }));
  const counts = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});

  return {
    sources,
    jwwVersion: converted.meta?.jwwVersion ?? null,
    paperSize: converted.meta?.paperSize ?? null,
    environmentRegion,
    jwfEntryCount: parsedJwf.entryCount || 0,
    trackedJwfKeys: environment.coverage?.totalJwfKeysTracked || 0,
    counts,
    scopeStatusCounts: scopeStatusCounts(rows),
    familyStatusCounts: familyStatusCounts(rows),
    rows,
  };
}

function filterRows(rows, filters = {}) {
  const scopes = new Set(
    String(filters.scope || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const statuses = new Set(
    String(filters.status || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const families = new Set(
    String(filters.family || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const keys = new Set(
    String(filters.key || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  if (!scopes.size && !statuses.size && !families.size && !keys.size) {
    return rows;
  }
  return (rows || []).filter((row) => {
    const scope = row.definition?.scope || "unknown";
    return (
      (!scopes.size || scopes.has(scope)) &&
      (!families.size || families.has(row.family)) &&
      (!keys.size || keys.has(row.key)) &&
      (!statuses.size || statuses.has(row.status))
    );
  });
}

function applyFilters(report, filters = {}) {
  const rows = filterRows(report.rows, filters);
  const counts = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  return {
    ...report,
    filters: {
      ...(filters.scope ? { scope: filters.scope } : {}),
      ...(filters.family ? { family: filters.family } : {}),
      ...(filters.key ? { key: filters.key } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    counts,
    scopeStatusCounts: scopeStatusCounts(rows),
    familyStatusCounts: familyStatusCounts(rows),
    rows,
  };
}

function textForComparison(report) {
  const lines = [];
  lines.push("JWW / JWF Environment Comparison");
  lines.push(`JWW: ${report.sources.jww}`);
  lines.push(`JWF: ${report.sources.jwf}`);
  if (report.filters && Object.keys(report.filters).length) {
    lines.push(`Filters: ${JSON.stringify(report.filters)}`);
  }
  lines.push(
    `JWF entries: ${report.jwfEntryCount} / tracked keys: ${report.trackedJwfKeys}`
  );
  lines.push(
    `Extracted: ${report.counts.extracted || 0} / Missing: ${report.counts.missing || 0} / Not tracked: ${report.counts["not-tracked"] || 0}`
  );
  for (const line of formatScopeStatusCounts(report.scopeStatusCounts)) {
    lines.push(`Scope ${line}`);
  }
  for (const line of formatFamilyStatusCounts(report.familyStatusCounts)) {
    lines.push(`Family ${line}`);
  }
  if (report.environmentRegion) {
    lines.push(
      `Raw region: ${report.environmentRegion.afterLayerNamesOffset ?? "-"}..${report.environmentRegion.entityListOffset ?? "-"} (${report.environmentRegion.byteLength ?? "-"} bytes)`
    );
    const pairRuns = (report.environmentRegion.u32PairRuns || [])
      .slice(0, 8)
      .map(
        (row) => `${row.first}/${row.second}x${row.count}@${row.firstOffset}`
      );
    if (pairRuns.length) lines.push(`U32 pair runs: ${pairRuns.join(", ")}`);
  }
  lines.push("");
  for (const row of report.rows) {
    lines.push(
      `${row.status.padEnd(11)} ${row.family.padEnd(16)} ${row.key}${
        row.definition?.label ? ` (${row.definition.label})` : ""
      }`
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvForComparison(report) {
  return rowsToCsv([
    [
      "summary",
      "environmentRegion",
      "start",
      report.environmentRegion?.afterLayerNamesOffset ?? "",
      "end",
      report.environmentRegion?.entityListOffset ?? "",
      "bytes",
      report.environmentRegion?.byteLength ?? "",
    ],
    ["scope", "status", "count"],
    ...Object.entries(report.scopeStatusCounts || {}).flatMap(
      ([scope, values]) =>
        Object.entries(values).map(([status, count]) => [scope, status, count])
    ),
    [],
    ["family", "status", "count"],
    ...Object.entries(report.familyStatusCounts || {}).flatMap(
      ([family, values]) =>
        Object.entries(values).map(([status, count]) => [family, status, count])
    ),
    [],
    ["key", "family", "status", "scope", "meaning", "values"],
    ...report.rows.map((row) => [
      row.key,
      row.family,
      row.status,
      row.definition?.scope || "",
      row.definition?.label || "",
      row.values,
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

function statusClass(status) {
  return String(status || "").replace(/[^a-z0-9_-]/gi, "-");
}

function htmlForComparison(report) {
  const rows = report.rows || [];
  const region = report.environmentRegion || {};
  const scopeRows = Object.entries(report.scopeStatusCounts || {}).flatMap(
    ([scope, values]) =>
      Object.entries(values).map(([status, count]) => [scope, status, count])
  );
  const familyRows = Object.entries(report.familyStatusCounts || {}).flatMap(
    ([family, values]) =>
      Object.entries(values).map(([status, count]) => [family, status, count])
  );
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>JWW / JWF Environment Comparison</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #162033; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    .meta { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin-bottom: 16px; font-size: 13px; }
    .counts { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 18px; }
    .pill { border: 1px solid #bcc8d8; border-radius: 999px; padding: 4px 10px; font-size: 12px; background: #f7f9fc; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #d9e0ea; padding: 6px 8px; vertical-align: top; }
    th { position: sticky; top: 0; background: #eaf0f7; text-align: left; }
    tr.extracted { background: #f1fbf4; }
    tr.missing { background: #fff4f4; }
    tr.not-tracked { background: #f6f7f9; }
    code { font-family: Consolas, "Liberation Mono", monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>JWW / JWF Environment Comparison</h1>
  <div class="meta">
    <strong>JWW</strong><span>${htmlEscape(report.sources?.jww)}</span>
    <strong>JWF</strong><span>${htmlEscape(report.sources?.jwf)}</span>
    <strong>Paper</strong><span>${htmlEscape(report.paperSize || "")}</span>
    <strong>JWF entries</strong><span>${htmlEscape(report.jwfEntryCount)}</span>
    <strong>Raw region</strong><span>${htmlEscape(`${region.afterLayerNamesOffset ?? "-"}..${region.entityListOffset ?? "-"} (${region.byteLength ?? "-"} bytes)`)}</span>
  </div>
  <div class="counts">
    <span class="pill">Extracted: ${htmlEscape(report.counts?.extracted || 0)}</span>
    <span class="pill">Missing: ${htmlEscape(report.counts?.missing || 0)}</span>
    <span class="pill">Not tracked: ${htmlEscape(report.counts?.["not-tracked"] || 0)}</span>
  </div>
  <table>
    <thead><tr><th>Scope</th><th>Status</th><th>Count</th></tr></thead>
    <tbody>
${scopeRows
  .map(
    ([scope, status, count]) => `      <tr>
        <td>${htmlEscape(scope)}</td>
        <td>${htmlEscape(status)}</td>
        <td>${htmlEscape(count)}</td>
      </tr>`
  )
  .join("\n")}
    </tbody>
  </table>
  <p></p>
  <table>
    <thead><tr><th>Family</th><th>Status</th><th>Count</th></tr></thead>
    <tbody>
${familyRows
  .map(
    ([family, status, count]) => `      <tr>
        <td>${htmlEscape(family)}</td>
        <td>${htmlEscape(status)}</td>
        <td>${htmlEscape(count)}</td>
      </tr>`
  )
  .join("\n")}
    </tbody>
  </table>
  <p></p>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Family</th>
        <th>Scope</th>
        <th>Key</th>
        <th>Meaning</th>
        <th>Values</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
${rows
  .map(
    (row) => `      <tr class="${htmlEscape(statusClass(row.status))}">
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.family)}</td>
        <td>${htmlEscape(row.definition?.scope || "")}</td>
        <td><code>${htmlEscape(row.key)}</code></td>
        <td>${htmlEscape(row.definition?.label || "")}</td>
        <td><code>${htmlEscape(Array.isArray(row.values) ? row.values.join(", ") : row.values)}</code></td>
        <td>${htmlEscape(row.definition?.note || "")}</td>
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
      "Usage: node tools/jww-jwf-compare.mjs <input.jww> <input.jwf> [--encoding shift_jis] [--include-after-end] [--scope drawing] [--family layerColors] [--key LTYPE_HC] [--status missing] [--json|--csv|--html] [-o output]"
    );
    process.exitCode = 1;
    return;
  }

  const jwwPath = path.resolve(args.jww);
  const jwfPath = path.resolve(args.jwf);
  const jwwStats = await stat(jwwPath);
  const converted = convertJwwBytes(new Uint8Array(await readFile(jwwPath)), {
    encoding: args.encoding,
    sourcePath: jwwPath,
    sourceName: path.basename(jwwPath),
    lastModified: jwwStats.mtime,
  });
  const parsedJwf = parseJwfBytes(new Uint8Array(await readFile(jwfPath)), {
    encoding: args.encoding,
    includeAfterEnd: args.includeAfterEnd,
  });
  const report = buildComparison(converted, parsedJwf, {
    jww: jwwPath,
    jwf: jwfPath,
  });
  const filteredReport = applyFilters(report, args);
  const output = args.csv
    ? csvForComparison(filteredReport)
    : args.html
      ? htmlForComparison(filteredReport)
      : args.json
        ? `${JSON.stringify(filteredReport, null, 2)}\n`
        : textForComparison(filteredReport);

  if (args.output) await writeFile(path.resolve(args.output), output, "utf8");
  else process.stdout.write(output);
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
