#!/usr/bin/env node
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildJwwSemanticDiff } from "../src/jww/semanticDiff.js";
import { convertJwwBytes } from "./jww-gateway.mjs";

function parseArgs(argv) {
  const args = {
    before: "",
    after: "",
    output: "",
    json: false,
    tolerance: 1e-9,
    changeLimit: 24,
    failOnDrawingDifference: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--tolerance") args.tolerance = Number(argv[++index]);
    else if (arg === "--change-limit") args.changeLimit = Number(argv[++index]);
    else if (arg === "--fail-on-drawing-difference") {
      args.failOnDrawingDifference = true;
    } else if (!args.before) args.before = arg;
    else if (!args.after) args.after = arg;
  }
  return args;
}

async function convertFile(file) {
  const filePath = path.resolve(file);
  const info = await stat(filePath);
  return convertJwwBytes(new Uint8Array(await readFile(filePath)), {
    sourcePath: filePath,
    lastModified: info.mtime,
  });
}

function textReport(report, before, after) {
  const lines = [
    "JWW Semantic Diff",
    `Before: ${path.resolve(before)}`,
    `After: ${path.resolve(after)}`,
    `Drawing semantic equal: ${report.drawingSemanticEqual ? "yes" : "no"}`,
    `Drawing round-trip compatible: ${report.drawingRoundTripCompatible ? "yes" : "no"}`,
    `Document round-trip compatible: ${report.roundTripCompatible ? "yes" : "no"}`,
    `Document metadata equal: ${report.documentMetadataEqual ? "yes" : "no"}`,
    `Internal settings equal: ${report.internalSettingsEqual ? "yes" : "no"}`,
    `Parser clean: ${report.parserClean ? "yes" : "no"}`,
    `Entities: ${report.drawing.beforeCount} -> ${report.drawing.afterCount}`,
    `Order-only difference: ${report.drawing.orderOnlyDifference ? "yes" : "no"}`,
    `Changed positions reported: ${report.drawing.changes.length}`,
  ];
  return `${lines.join("\n")}\n`;
}

export async function runSemanticDiff(args) {
  const [before, after] = await Promise.all([
    convertFile(args.before),
    convertFile(args.after),
  ]);
  return buildJwwSemanticDiff(before, after, args);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.before || !args.after) {
    console.error(
      "Usage: node tools/jww-semantic-diff.mjs <before.jww> <after.jww> [--json] [--tolerance 1e-9] [--change-limit 24] [--fail-on-drawing-difference] [-o output]"
    );
    process.exitCode = 1;
    return;
  }
  const report = await runSemanticDiff(args);
  const output = args.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : textReport(report, args.before, args.after);
  if (args.output) await writeFile(path.resolve(args.output), output, "utf8");
  else process.stdout.write(output);
  if (args.failOnDrawingDifference && !report.drawingSemanticEqual) {
    process.exitCode = 2;
  }
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
