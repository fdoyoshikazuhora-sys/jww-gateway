#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJwfBytes } from "../src/jww/jwf.js";

function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
    encoding: "shift_jis",
    includeAfterEnd: false,
    summary: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--encoding") args.encoding = argv[++index] || "shift_jis";
    else if (arg === "--include-after-end") args.includeAfterEnd = true;
    else if (arg === "--summary") args.summary = true;
    else if (!args.input) args.input = arg;
  }
  return args;
}

function summaryFor(parsed, inputPath) {
  return {
    source: inputPath,
    format: parsed.format,
    stoppedAtEnd: parsed.stoppedAtEnd,
    entryCount: parsed.entryCount,
    families: Object.fromEntries(
      Object.entries(parsed.families || {}).map(([family, entries]) => [
        family,
        Object.keys(entries || {}).length,
      ])
    ),
    screenColorCount: Object.keys(parsed.colorSettings?.screenColors || {}).length,
    printColorCount: Object.keys(parsed.colorSettings?.printColors || {}).length,
    keys: parsed.keys,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error(
      "Usage: node tools/jwf-parse.mjs <input.jwf> [--encoding shift_jis] [--include-after-end] [--summary] [-o output.json]"
    );
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(args.input);
  const bytes = new Uint8Array(await readFile(inputPath));
  const parsed = parseJwfBytes(bytes, {
    encoding: args.encoding,
    includeAfterEnd: args.includeAfterEnd,
  });
  const output = args.summary ? summaryFor(parsed, inputPath) : parsed;
  const json = `${JSON.stringify(output, null, 2)}\n`;

  if (args.output) await writeFile(path.resolve(args.output), json, "utf8");
  else process.stdout.write(json);
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

