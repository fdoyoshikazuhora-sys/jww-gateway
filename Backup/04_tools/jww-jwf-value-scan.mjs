#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJwfBytes } from "../src/jww/jwf.js";
import {
  candidatePatterns,
  isLowInformationNumericSequence,
} from "../src/jww/jwfValueScan.js";
import { convertJwwBytes } from "./jww-gateway.mjs";

export { candidatePatterns };

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
    scope: "",
    family: "",
    key: "",
    status: "",
    gatewayStatus: "",
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
    else if (arg === "--max-matches")
      args.maxMatches = Number(argv[++index]) || 8;
    else if (arg === "--scope") args.scope = argv[++index] || "";
    else if (arg === "--family") args.family = argv[++index] || "";
    else if (arg === "--key") args.key = argv[++index] || "";
    else if (arg === "--status") args.status = argv[++index] || "";
    else if (arg === "--gateway-status")
      args.gatewayStatus = argv[++index] || "";
    else if (!args.jww) args.jww = arg;
    else if (!args.jwf) args.jwf = arg;
  }
  return args;
}

function findMatches(data, pattern, maxMatches) {
  if (!pattern || pattern.length < 3) return [];
  const matches = [];
  const max = data.length - pattern.length;
  for (let offset = 0; offset <= max; offset += 1) {
    let ok = true;
    for (let index = 0; index < pattern.length; index += 1) {
      if (data[offset + index] !== pattern[index]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    matches.push(offset);
    if (matches.length >= maxMatches) break;
  }
  return matches;
}

function byteSignature(bytes) {
  return Array.from(bytes || [])
    .slice(0, 32)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

export function scanValues(
  jwwBytes,
  parsedJwf,
  maxMatches,
  extractionStatus = {},
  gatewayEnvironment = {}
) {
  const rows = [];
  for (const key of parsedJwf.keys || []) {
    const entry = parsedJwf.entries?.[key];
    if (!entry) continue;
    const patterns = candidatePatterns(entry);
    const testedPatterns = patterns.map((pattern) => ({
      kind: pattern.kind,
      byteLength: pattern.bytes.length,
      signature: byteSignature(pattern.bytes),
    }));
    if (!patterns.length) {
      const gatewayCandidate = gatewayCandidateForKey(key, gatewayEnvironment);
      rows.push({
        key,
        family: entry.family,
        definition: entry.definition || null,
        gatewayStatus: extractionStatus[key] || "not-tracked",
        status: "not-scanned",
        reason: "no numeric byte pattern",
        values: entry.values,
        testedPatterns: [],
        gatewayCandidate,
        gatewayCandidateComparison: compareGatewayCandidate(
          key,
          entry.values,
          gatewayCandidate
        ),
      });
      continue;
    }
    const matches = patterns
      .map((pattern) => ({
        kind: pattern.kind,
        byteLength: pattern.bytes.length,
        signature: byteSignature(pattern.bytes),
        offsets: findMatches(jwwBytes, pattern.bytes, maxMatches),
      }))
      .filter((pattern) => pattern.offsets.length);
    const repeatedMatches = matches.some(
      (pattern) => pattern.offsets.length > 1
    );
    const lowInformation = isLowInformationNumericSequence(entry.values);
    const ambiguous = matches.length && (lowInformation || repeatedMatches);
    const gatewayCandidate = gatewayCandidateForKey(key, gatewayEnvironment);
    rows.push({
      key,
      family: entry.family,
      definition: entry.definition || null,
      gatewayStatus: extractionStatus[key] || "not-tracked",
      status: ambiguous ? "ambiguous" : matches.length ? "matched" : "missing",
      ...(ambiguous
        ? {
            reason: lowInformation
              ? "low-information numeric sequence; byte match is not enough to promote"
              : "multiple byte matches; candidate is not unique enough to promote",
          }
        : {}),
      values: entry.values,
      testedPatterns,
      gatewayCandidate,
      gatewayCandidateComparison: compareGatewayCandidate(
        key,
        entry.values,
        gatewayCandidate
      ),
      matches,
    });
  }
  return rows;
}

function gatewayCandidateForKey(key, environment = {}) {
  if (key === "LTYPE_HC") {
    return environment.lineTypes?.LTYPE_HC_candidate || null;
  }
  if (key === "LCOLLOR_M") {
    return {
      LCOLLOR_S: environment.colors?.LCOLLOR_S || null,
      LCOLLOR_K: environment.colors?.LCOLLOR_K || null,
      LCOLLOR_Z: environment.colors?.LCOLLOR_Z || null,
      LCOLLOR_M: environment.colors?.LCOLLOR_M || null,
    };
  }
  return null;
}

function sameNumericSequence(a = [], b = []) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, index) => Number(value) === Number(b[index]))
  );
}

function rgbHex(values = []) {
  if (!Array.isArray(values) || values.length < 3) return null;
  const [red, green, blue] = values.map(Number);
  if (![red, green, blue].every(Number.isFinite)) return null;
  if ([red, green, blue].some((value) => value < 0 || value > 255)) return null;
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function compareGatewayCandidate(key, values = [], candidate = null) {
  if (!candidate) return null;
  if (key === "LTYPE_HC") {
    return {
      expectedValues: values,
      candidateU32: candidate.u32 || [],
      candidateU16: candidate.u16 || [],
      directU32Match: sameNumericSequence(values, candidate.u32 || []),
      note: "directU32Match must be true before promoting this candidate to extracted",
    };
  }
  if (key === "LCOLLOR_M") {
    const expectedHex = rgbHex(values);
    const specialHexes = Object.fromEntries(
      Object.entries(candidate || {}).map(([name, entry]) => [
        name,
        entry?.hex || null,
      ])
    );
    return {
      expectedHex,
      specialHexes,
      directSpecialMatch: Object.values(specialHexes).some(
        (hex) => hex && hex.toLowerCase() === expectedHex
      ),
      note: "directSpecialMatch must be true or a dedicated M offset must be identified before promoting",
    };
  }
  return null;
}

function csvValue(value) {
  const text = Array.isArray(value)
    ? value.join("; ")
    : value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
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

function buildReport(jwwPath, jwfPath, parsedJwf, rows) {
  const counts = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  return {
    format: "jww-jwf-value-scan",
    sources: { jww: jwwPath, jwf: jwfPath },
    jwfEntryCount: parsedJwf.entryCount || 0,
    counts,
    scopeStatusCounts: scopeStatusCounts(rows),
    familyStatusCounts: familyStatusCounts(rows),
    rows,
  };
}

function gatewayContextForJww(jwwBytes, encoding) {
  const converted = convertJwwBytes(jwwBytes, { encoding });
  const environment = converted.meta?.jwwEnvironment || {};
  const supported = new Set(environment.coverage?.supportedKeys || []);
  const missing = new Set(environment.coverage?.missingJwfKeys || []);
  return {
    environment,
    extractionStatus: Object.fromEntries(
      [...supported, ...missing].map((key) => [
        key,
        supported.has(key) ? "extracted" : "missing",
      ])
    ),
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
  const gatewayStatuses = new Set(
    String(filters.gatewayStatus || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  if (
    !scopes.size &&
    !statuses.size &&
    !families.size &&
    !keys.size &&
    !gatewayStatuses.size
  ) {
    return rows;
  }
  return (rows || []).filter((row) => {
    const scope = row.definition?.scope || "unknown";
    return (
      (!scopes.size || scopes.has(scope)) &&
      (!families.size || families.has(row.family)) &&
      (!keys.size || keys.has(row.key)) &&
      (!statuses.size || statuses.has(row.status)) &&
      (!gatewayStatuses.size || gatewayStatuses.has(row.gatewayStatus))
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
      ...(filters.gatewayStatus
        ? { gatewayStatus: filters.gatewayStatus }
        : {}),
    },
    counts,
    scopeStatusCounts: scopeStatusCounts(rows),
    familyStatusCounts: familyStatusCounts(rows),
    rows,
  };
}

function textForReport(report) {
  const lines = [];
  lines.push("JWW / JWF Value Scan");
  lines.push(`JWW: ${report.sources.jww}`);
  lines.push(`JWF: ${report.sources.jwf}`);
  if (report.filters && Object.keys(report.filters).length) {
    lines.push(`Filters: ${JSON.stringify(report.filters)}`);
  }
  lines.push(
    `Matched: ${report.counts.matched || 0} / Ambiguous: ${
      report.counts.ambiguous || 0
    } / Missing: ${report.counts.missing || 0} / Not scanned: ${
      report.counts["not-scanned"] || 0
    }`
  );
  for (const line of formatScopeStatusCounts(report.scopeStatusCounts)) {
    lines.push(`Scope ${line}`);
  }
  for (const line of formatFamilyStatusCounts(report.familyStatusCounts)) {
    lines.push(`Family ${line}`);
  }
  lines.push("");
  for (const row of report.rows) {
    const first = row.matches?.[0];
    lines.push(
      `${row.status.padEnd(11)} ${(row.gatewayStatus || "-").padEnd(10)} ${row.family.padEnd(16)} ${row.key}${
        first ? ` ${first.kind}@${first.offsets.join(";")}` : ""
      }${row.reason ? ` (${row.reason})` : ""}`
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvForReport(report) {
  return rowsToCsv([
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
    [
      "key",
      "family",
      "status",
      "gatewayStatus",
      "scope",
      "meaning",
      "values",
      "gatewayCandidate",
      "gatewayCandidateComparison",
      "testedPatterns",
      "matches",
    ],
    ...report.rows.map((row) => [
      row.key,
      row.family,
      row.status,
      row.gatewayStatus || "",
      row.definition?.scope || "",
      row.definition?.label || "",
      row.values,
      row.gatewayCandidate || "",
      row.gatewayCandidateComparison || "",
      (row.testedPatterns || []).map((pattern) => pattern.kind).join("; "),
      row.matches || row.reason || "",
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

function htmlForReport(report) {
  const rows = report.rows || [];
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
  <title>JWW / JWF Value Scan</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #162033; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    .meta { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin-bottom: 16px; font-size: 13px; }
    .counts { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 18px; }
    .pill { border: 1px solid #bcc8d8; border-radius: 999px; padding: 4px 10px; font-size: 12px; background: #f7f9fc; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #d9e0ea; padding: 6px 8px; vertical-align: top; }
    th { position: sticky; top: 0; background: #eaf0f7; text-align: left; }
    tr.matched { background: #f1fbf4; }
    tr.ambiguous { background: #fff9eb; }
    tr.missing { background: #fff4f4; }
    tr.not-scanned { background: #f6f7f9; }
    code { font-family: Consolas, "Liberation Mono", monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>JWW / JWF Value Scan</h1>
  <div class="meta">
    <strong>JWW</strong><span>${htmlEscape(report.sources?.jww)}</span>
    <strong>JWF</strong><span>${htmlEscape(report.sources?.jwf)}</span>
    <strong>JWF entries</strong><span>${htmlEscape(report.jwfEntryCount)}</span>
  </div>
  <div class="counts">
    <span class="pill">Matched: ${htmlEscape(report.counts?.matched || 0)}</span>
    <span class="pill">Ambiguous: ${htmlEscape(report.counts?.ambiguous || 0)}</span>
    <span class="pill">Missing: ${htmlEscape(report.counts?.missing || 0)}</span>
    <span class="pill">Not scanned: ${htmlEscape(report.counts?.["not-scanned"] || 0)}</span>
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
        <th>Gateway</th>
        <th>Family</th>
        <th>Scope</th>
        <th>Key</th>
        <th>Meaning</th>
        <th>Values</th>
        <th>Gateway Candidate</th>
        <th>Candidate Comparison</th>
        <th>Tested</th>
        <th>Matches / Reason</th>
      </tr>
    </thead>
    <tbody>
${rows
  .map((row) => {
    const matches = row.matches?.length
      ? row.matches
          .map(
            (match) =>
              `${match.kind}@${(match.offsets || []).join(";")} (${match.byteLength} bytes)`
          )
          .join("\n")
      : row.reason || "";
    return `      <tr class="${htmlEscape(statusClass(row.status))}">
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.gatewayStatus || "")}</td>
        <td>${htmlEscape(row.family)}</td>
        <td>${htmlEscape(row.definition?.scope || "")}</td>
        <td><code>${htmlEscape(row.key)}</code></td>
        <td>${htmlEscape(row.definition?.label || "")}</td>
        <td><code>${htmlEscape(Array.isArray(row.values) ? row.values.join(", ") : row.values)}</code></td>
        <td><code>${htmlEscape(row.gatewayCandidate ? JSON.stringify(row.gatewayCandidate, null, 2) : "")}</code></td>
        <td><code>${htmlEscape(row.gatewayCandidateComparison ? JSON.stringify(row.gatewayCandidateComparison, null, 2) : "")}</code></td>
        <td><code>${htmlEscape((row.testedPatterns || []).map((pattern) => pattern.kind).join("\n"))}</code></td>
        <td><code>${htmlEscape(matches)}</code></td>
      </tr>`;
  })
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
      "Usage: node tools/jww-jwf-value-scan.mjs <input.jww> <input.jwf> [--encoding shift_jis] [--include-after-end] [--scope drawing] [--family layerColors] [--key LTYPE_HC] [--status missing] [--gateway-status missing] [--json|--csv|--html] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const jwwPath = path.resolve(args.jww);
  const jwfPath = path.resolve(args.jwf);
  const jwwBytes = new Uint8Array(await readFile(jwwPath));
  const gatewayContext = gatewayContextForJww(jwwBytes, args.encoding);
  const parsedJwf = parseJwfBytes(new Uint8Array(await readFile(jwfPath)), {
    encoding: args.encoding,
    includeAfterEnd: args.includeAfterEnd,
  });
  const report = buildReport(
    jwwPath,
    jwfPath,
    parsedJwf,
    scanValues(
      jwwBytes,
      parsedJwf,
      Math.max(1, args.maxMatches),
      gatewayContext.extractionStatus,
      gatewayContext.environment
    )
  );
  const filteredReport = applyFilters(report, args);
  const output = args.csv
    ? csvForReport(filteredReport)
    : args.html
      ? htmlForReport(filteredReport)
      : args.json
        ? `${JSON.stringify(filteredReport, null, 2)}\n`
        : textForReport(filteredReport);
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
