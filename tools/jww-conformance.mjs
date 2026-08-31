#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessParsedJww, buildConformanceReport } from "../src/jww/conformance.js";
import { parse } from "../src/jww/parser.js";

function parseArgs(argv) {
  const args = { inputs: [], output: "", encoding: "shift_jis", recursive: false, json: false, csv: false, requireCleanParse: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--encoding") args.encoding = argv[++index] || "shift_jis";
    else if (arg === "-r" || arg === "--recursive") args.recursive = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--require-clean-parse") args.requireCleanParse = true;
    else args.inputs.push(arg);
  }
  return args;
}

async function collectJwwFiles(input, recursive) {
  const resolved = path.resolve(input);
  const info = await stat(resolved);
  if (info.isFile()) return [resolved];
  if (!info.isDirectory()) return [];
  const files = [];
  for (const entry of await readdir(resolved, { withFileTypes: true })) {
    const fullPath = path.join(resolved, entry.name);
    if (entry.isDirectory() && recursive) files.push(...(await collectJwwFiles(fullPath, true)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".jww")) files.push(fullPath);
  }
  return files;
}

function csvValue(value) {
  const text = value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCsv(report) {
  const rows = [["source", "bytes", "encoding", "jwwVersion", "entityCount", "entityTypes", "unsupportedCount", "unsupportedClasses", "skippedCount", "readAssessment", "roundTripAssessment", "exactCompatibility"]];
  for (const file of report.files) {
    rows.push([file.source, file.bytes, file.encoding, file.jwwVersion, file.entityCount, file.entityTypes, file.unsupportedCount, file.unsupportedClasses, file.skippedCount, file.readAssessment, file.roundTripAssessment, file.exactCompatibility]);
  }
  return `${rows.map((row) => row.map(csvValue).join(",")).join("\n")}\n`;
}

function formatText(report) {
  const lines = [
    "JWW Gateway Conformance Audit",
    `Files: ${report.counts.files}`,
    "Scope: parser diagnostics only; writer and Jw_cad round-trip evidence are evaluated separately",
    "",
  ];
  for (const file of report.files) {
    lines.push(file.fileName);
    lines.push(`  Version: ${file.jwwVersion || "unknown"} / bytes: ${file.bytes} / encoding: ${file.encoding}`);
    lines.push(`  Entities: ${file.entityCount} ${JSON.stringify(file.entityTypes)}`);
    lines.push(`  Parser: ${file.readAssessment} / unsupported: ${file.unsupportedCount} / skipped: ${file.skippedCount}`);
    lines.push("  Round-trip: not-tested / exact compatibility: false", "");
  }
  return `${lines.join("\n")}\n`;
}

async function scanFile(filePath, encoding) {
  const bytes = new Uint8Array(await readFile(filePath));
  const result = assessParsedJww(parse(bytes, { encoding, sourcePath: filePath }));
  return { source: filePath, fileName: path.basename(filePath), bytes: bytes.length, encoding, ...result };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.inputs.length) {
    console.error("Usage: node tools/jww-conformance.mjs <file-or-dir> [...] [--recursive] [--encoding shift_jis] [--json|--csv] [--require-clean-parse] [-o output]");
    process.exitCode = 1;
    return;
  }
  const files = [];
  for (const input of args.inputs) files.push(...(await collectJwwFiles(input, args.recursive)));
  const rows = [];
  for (const filePath of Array.from(new Set(files)).sort()) rows.push(await scanFile(filePath, args.encoding));
  const report = buildConformanceReport(rows);
  const output = args.csv ? formatCsv(report) : args.json ? `${JSON.stringify(report, null, 2)}\n` : formatText(report);
  if (args.output) await writeFile(path.resolve(args.output), output, "utf8");
  else process.stdout.write(output);
  if (args.requireCleanParse && report.files.some((file) => file.readAssessment !== "parsed-without-reported-loss")) process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
