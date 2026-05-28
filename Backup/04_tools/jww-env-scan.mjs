#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertJwwBytes } from "./jww-gateway.mjs";

function parseArgs(argv) {
  const args = {
    inputs: [],
    output: "",
    encoding: "shift_jis",
    recursive: false,
    json: false,
    csv: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--encoding") args.encoding = argv[++index] || "shift_jis";
    else if (arg === "-r" || arg === "--recursive") args.recursive = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else args.inputs.push(arg);
  }
  return args;
}

async function collectJwwFiles(input, recursive) {
  const resolved = path.resolve(input);
  const info = await stat(resolved);
  if (info.isFile()) return [resolved];
  if (!info.isDirectory()) return [];
  const entries = await readdir(resolved, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(resolved, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...(await collectJwwFiles(fullPath, recursive)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".jww")) {
      files.push(fullPath);
    }
  }
  return files;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(number(value) * scale) / scale;
}

function summarizePairRuns(region) {
  return (region?.u32PairRuns || [])
    .slice(0, 8)
    .map((row) => `${row.first}/${row.second}x${row.count}@${row.firstOffset}`);
}

function summarizeDoubleSamples(region) {
  return (region?.doubleSamples || [])
    .slice(0, 8)
    .map((row) => `${round(row.value)}@${row.offset}`);
}

async function scanFile(filePath, encoding) {
  const info = await stat(filePath);
  const converted = convertJwwBytes(new Uint8Array(await readFile(filePath)), {
    encoding,
    sourcePath: filePath,
    sourceName: path.basename(filePath),
    lastModified: info.mtime,
  });
  const meta = converted.meta || {};
  const environment = meta.jwwEnvironment || {};
  const coverage = environment.coverage || {};
  const region = meta.environmentRegion || null;
  const colorSettings = meta.colorSettings || {};
  return {
    source: filePath,
    fileName: path.basename(filePath),
    encoding: converted.encoding,
    jwwVersion: meta.jwwVersion ?? null,
    paperSize: meta.paperSize ?? null,
    paperCode: meta.paperCode ?? null,
    entityCount: converted.entities?.length || 0,
    supportedKeys: coverage.supportedKeys?.length || 0,
    missingKeys: coverage.missingJwfKeys?.length || 0,
    totalTrackedKeys: coverage.totalJwfKeysTracked || 0,
    colorTableOffset: colorSettings.offset ?? null,
    printColorTableOffset: colorSettings.printColorTableOffset ?? null,
    environmentRegion: region,
    regionByteLength: region?.byteLength ?? 0,
    topU32PairRuns: summarizePairRuns(region),
    doubleSamples: summarizeDoubleSamples(region),
  };
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

function textForReport(report) {
  const lines = [];
  lines.push("JWW Environment Region Scan");
  lines.push(`Files: ${report.files.length}`);
  lines.push("");
  for (const row of report.files) {
    lines.push(`${row.fileName}`);
    lines.push(
      `  Paper: ${row.paperSize || "-"} (${row.paperCode ?? "-"}) / entities: ${row.entityCount}`
    );
    lines.push(
      `  JWF keys: ${row.supportedKeys}/${row.totalTrackedKeys} supported / missing ${row.missingKeys}`
    );
    lines.push(
      `  Colors: screen@${row.colorTableOffset ?? "-"} print@${row.printColorTableOffset ?? "-"}`
    );
    lines.push(
      `  Raw region: ${row.environmentRegion?.afterLayerNamesOffset ?? "-"}..${row.environmentRegion?.entityListOffset ?? "-"} (${row.regionByteLength} bytes)`
    );
    lines.push(
      `  U32 pair runs: ${row.topU32PairRuns.length ? row.topU32PairRuns.join(", ") : "none"}`
    );
    lines.push(
      `  Double samples: ${row.doubleSamples.length ? row.doubleSamples.join(", ") : "none"}`
    );
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function csvForReport(report) {
  return rowsToCsv([
    [
      "source",
      "encoding",
      "version",
      "paper",
      "paperCode",
      "entities",
      "supportedKeys",
      "missingKeys",
      "totalTrackedKeys",
      "colorTableOffset",
      "printColorTableOffset",
      "regionStart",
      "regionEnd",
      "regionBytes",
      "topU32PairRuns",
      "doubleSamples",
    ],
    ...report.files.map((row) => [
      row.source,
      row.encoding,
      row.jwwVersion,
      row.paperSize,
      row.paperCode,
      row.entityCount,
      row.supportedKeys,
      row.missingKeys,
      row.totalTrackedKeys,
      row.colorTableOffset,
      row.printColorTableOffset,
      row.environmentRegion?.afterLayerNamesOffset,
      row.environmentRegion?.entityListOffset,
      row.regionByteLength,
      row.topU32PairRuns,
      row.doubleSamples,
    ]),
  ]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.inputs.length) {
    console.error(
      "Usage: node tools/jww-env-scan.mjs <file-or-dir> [...] [--recursive] [--encoding shift_jis] [--json|--csv] [-o output]"
    );
    process.exitCode = 1;
    return;
  }

  const files = [];
  for (const input of args.inputs) {
    files.push(...(await collectJwwFiles(input, args.recursive)));
  }
  const uniqueFiles = Array.from(new Set(files)).sort();
  const report = {
    format: "jww-environment-region-scan",
    encoding: args.encoding,
    files: [],
  };
  for (const filePath of uniqueFiles) {
    report.files.push(await scanFile(filePath, args.encoding));
  }

  const output = args.csv
    ? csvForReport(report)
    : args.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : textForReport(report);

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
