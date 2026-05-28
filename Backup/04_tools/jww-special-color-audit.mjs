#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJwfBytes } from "../src/jww/jwf.js";
import { rgbToHex } from "../src/jww/shared.js";
import { convertJwwBytes } from "./jww-gateway.mjs";

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
    radius: 1024,
    limit: 24,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--encoding") args.encoding = argv[++index] || "shift_jis";
    else if (arg === "--include-after-end") args.includeAfterEnd = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--radius") args.radius = Number(argv[++index]) || 1024;
    else if (arg === "--limit") args.limit = Number(argv[++index]) || 24;
    else if (!args.jww) args.jww = arg;
    else if (!args.jwf) args.jwf = arg;
  }
  return args;
}

function rgbAt(bytes, offset) {
  if (offset < 0 || offset + 2 >= bytes.length) return null;
  const red = bytes[offset];
  const green = bytes[offset + 1];
  const blue = bytes[offset + 2];
  return { red, green, blue, hex: rgbToHex(red, green, blue) };
}

function colorDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.sqrt(
    (a.red - b.red) ** 2 + (a.green - b.green) ** 2 + (a.blue - b.blue) ** 2
  );
}

function jwfColor(parsedJwf, key) {
  const values = parsedJwf.entries?.[key]?.values || [];
  if (values.length < 3) return null;
  const [red, green, blue] = values.map(Number);
  if (![red, green, blue].every(Number.isFinite)) return null;
  return { red, green, blue, hex: rgbToHex(red, green, blue) };
}

function candidateRows(
  bytes,
  colorTableOffset,
  expected,
  knownOffsets,
  radius
) {
  if (!Number.isFinite(colorTableOffset) || !expected) return [];
  const start = Math.max(0, colorTableOffset - radius);
  const end = Math.min(bytes.length - 3, colorTableOffset + radius);
  const knownByOffset = Object.fromEntries(
    Object.entries(knownOffsets || {})
      .filter(([, offset]) => Number.isFinite(offset))
      .map(([key, offset]) => [offset, key])
  );
  const rows = [];
  for (let offset = start; offset <= end; offset += 1) {
    const color = rgbAt(bytes, offset);
    if (!color) continue;
    const distance = colorDistance(color, expected);
    rows.push({
      offset,
      relativeOffset: offset - colorTableOffset,
      distance,
      knownKey: knownByOffset[offset] || "",
      ...color,
      directMatch: distance === 0,
    });
  }
  return rows.sort(
    (a, b) =>
      a.distance - b.distance ||
      Math.abs(a.relativeOffset) - Math.abs(b.relativeOffset)
  );
}

export async function buildSpecialColorAudit(options) {
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
  const parsedJwf = parseJwfBytes(new Uint8Array(jwfBytes), {
    encoding: options.encoding,
    includeAfterEnd: options.includeAfterEnd,
  });
  const colorSettings = converted.meta?.colorSettings || {};
  const specialColors = colorSettings.specialColors || {};
  const colorTableOffset = Number(colorSettings.offset);
  const expected = jwfColor(parsedJwf, "LCOLLOR_M");
  const knownOffsets = Object.fromEntries(
    ["S", "K", "Z", "M"].map((suffix) => [
      `LCOLLOR_${suffix}`,
      Number(specialColors[suffix]?.offset),
    ])
  );
  const rows = candidateRows(
    new Uint8Array(jwwBytes),
    colorTableOffset,
    expected,
    knownOffsets,
    options.radius
  );
  const directMatches = rows.filter((row) => row.directMatch);
  return {
    format: "jww-special-color-audit",
    generatedAt: new Date().toISOString(),
    sources: { jww: jwwPath, jwf: jwfPath },
    targetKey: "LCOLLOR_M",
    expected,
    colorTableOffset: Number.isFinite(colorTableOffset)
      ? colorTableOffset
      : null,
    radius: options.radius,
    counts: {
      candidates: rows.length,
      directMatches: directMatches.length,
    },
    knownSpecialColors: Object.fromEntries(
      Object.entries(specialColors).map(([suffix, entry]) => [
        `LCOLLOR_${suffix}`,
        entry
          ? {
              hex: entry.hex || "",
              offset: entry.offset ?? null,
              relativeOffset: entry.relativeOffset ?? null,
            }
          : null,
      ])
    ),
    directMatches,
    nearestCandidates: rows.slice(0, options.limit),
  };
}

export function formatSpecialColorAuditText(report) {
  const lines = [
    "JWW Special Color Audit",
    `JWW: ${report.sources.jww}`,
    `JWF: ${report.sources.jwf}`,
    `Target: ${report.targetKey}`,
    `Expected: ${report.expected?.hex || "-"}`,
    `Color table offset: ${report.colorTableOffset ?? "-"}`,
    `Candidates scanned: ${report.counts.candidates}`,
    `Direct matches: ${report.counts.directMatches}`,
    "",
    "Known Special Colors:",
  ];
  for (const [key, entry] of Object.entries(report.knownSpecialColors || {})) {
    lines.push(
      `  ${key}: ${entry?.hex || "-"} @ ${entry?.relativeOffset ?? "-"}`
    );
  }
  lines.push("", "Nearest Candidates:");
  for (const row of report.nearestCandidates || []) {
    lines.push(
      `  ${row.hex} @ ${row.relativeOffset} (${row.offset}) distance ${row.distance.toFixed(2)}${row.knownKey ? ` ${row.knownKey}` : ""}`
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

export function formatSpecialColorAuditCsv(report) {
  const rows = [
    ["section", "key", "value"],
    ["summary", "targetKey", report.targetKey],
    ["summary", "expected", report.expected?.hex || ""],
    ["summary", "colorTableOffset", report.colorTableOffset ?? ""],
    ["summary", "directMatches", report.counts.directMatches],
    [],
    ["offset", "relativeOffset", "hex", "distance", "knownKey", "directMatch"],
    ...report.nearestCandidates.map((row) => [
      row.offset,
      row.relativeOffset,
      row.hex,
      row.distance,
      row.knownKey,
      row.directMatch,
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

export function formatSpecialColorAuditHtml(report) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Special Color Audit</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    table { border-collapse: collapse; min-width: 860px; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; }
    th { background: #eef3f8; }
    .swatch { display: inline-block; width: 32px; height: 16px; border: 1px solid #8792a2; vertical-align: middle; margin-right: 6px; }
  </style>
</head>
<body>
  <h1>JWW Special Color Audit</h1>
  <p>Target ${htmlEscape(report.targetKey)}, expected ${htmlEscape(report.expected?.hex || "-")}, direct matches ${htmlEscape(report.counts.directMatches)}</p>
  <h2>Known Special Colors</h2>
  <table>
    <thead><tr><th>Key</th><th>Color</th><th>Relative Offset</th></tr></thead>
    <tbody>
${Object.entries(report.knownSpecialColors || {})
  .map(
    ([key, entry]) => `      <tr>
        <td>${htmlEscape(key)}</td>
        <td>${entry?.hex ? `<span class="swatch" style="background:${htmlEscape(entry.hex)}"></span>${htmlEscape(entry.hex)}` : "-"}</td>
        <td>${htmlEscape(entry?.relativeOffset ?? "")}</td>
      </tr>`
  )
  .join("\n")}
    </tbody>
  </table>
  <h2>Nearest Candidates</h2>
  <table>
    <thead><tr><th>Offset</th><th>Relative</th><th>Color</th><th>Distance</th><th>Known</th><th>Direct</th></tr></thead>
    <tbody>
${(report.nearestCandidates || [])
  .map(
    (row) => `      <tr>
        <td>${htmlEscape(row.offset)}</td>
        <td>${htmlEscape(row.relativeOffset)}</td>
        <td><span class="swatch" style="background:${htmlEscape(row.hex)}"></span>${htmlEscape(row.hex)}</td>
        <td>${htmlEscape(row.distance.toFixed(2))}</td>
        <td>${htmlEscape(row.knownKey)}</td>
        <td>${htmlEscape(row.directMatch)}</td>
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
      "Usage: node tools/jww-special-color-audit.mjs <input.jww> <input.jwf> [--include-after-end] [--json|--csv|--html] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const report = await buildSpecialColorAudit(args);
  const output = args.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : args.csv
      ? formatSpecialColorAuditCsv(report)
      : args.html
        ? formatSpecialColorAuditHtml(report)
        : formatSpecialColorAuditText(report);
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
