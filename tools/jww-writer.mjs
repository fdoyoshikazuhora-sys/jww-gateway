#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildJwwWriteResult,
  extractJwwTemplatePrefix,
} from "../src/jww/writer.js";

function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
    template: "",
    version: null,
    allowUnsupported: false,
    summary: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--template") args.template = argv[++index] || "";
    else if (arg === "--version") args.version = Number(argv[++index]);
    else if (arg === "--allow-unsupported") args.allowUnsupported = true;
    else if (arg === "--summary") args.summary = true;
    else if (!args.input) args.input = arg;
  }
  return args;
}

export async function writeJwwJsonFile(args) {
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const document = JSON.parse(await readFile(inputPath, "utf8"));
  let template = null;
  if (args.template) {
    const templatePath = path.resolve(args.template);
    template = extractJwwTemplatePrefix(
      new Uint8Array(await readFile(templatePath)),
      { encoding: document.encoding || "shift_jis" }
    );
  }
  const result = buildJwwWriteResult({
    entities: document.entities,
    meta: document.meta,
    dxfMeta: document.meta?.dxf || document.dxfMeta || {},
    paperSize: document.meta?.paperCode,
    memo: document.meta?.memo,
    templatePrefix: template?.prefixBytes || null,
    version:
      args.version || template?.version || document.meta?.jwwVersion || 700,
    strict: !args.allowUnsupported,
  });
  await writeFile(outputPath, result.bytes);
  return {
    input: inputPath,
    output: outputPath,
    bytes: result.bytes.length,
    version: result.version,
    recordsWritten: result.recordsWritten,
    blockDefinitionsWritten: result.blockDefinitionsWritten,
    embeddedImagesWritten: result.embeddedImagesWritten,
    unsupportedEntities: result.unsupportedEntities,
    template: args.template ? path.resolve(args.template) : "built-in-v700",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) {
    console.error(
      "Usage: node tools/jww-writer.mjs <input.json> -o <output.jww> [--template source.jww] [--version 600|700] [--allow-unsupported] [--summary]"
    );
    process.exitCode = 1;
    return;
  }
  const summary = await writeJwwJsonFile(args);
  if (args.summary) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else {
    process.stdout.write(
      `Wrote ${summary.output} (${summary.bytes} bytes, JWW ${summary.version}, ${summary.recordsWritten} records)\n`
    );
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
