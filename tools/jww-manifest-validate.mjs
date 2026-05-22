#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateGatewayManifest } from "../src/jww/gatewayManifest.js";

function parseArgs(argv) {
  const args = {
    input: "JWW_GATEWAY_MANIFEST.json",
    json: false,
    checkFiles: false,
  };
  for (const arg of argv) {
    if (arg === "--json") args.json = true;
    else if (arg === "--check-files") args.checkFiles = true;
    else args.input = arg;
  }
  return args;
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function validateManifestFile(input, options = {}) {
  const inputPath = path.resolve(input);
  const manifest = JSON.parse(await readFile(inputPath, "utf8"));
  const result = { file: inputPath, ...validateGatewayManifest(manifest) };
  if (options.checkFiles) {
    const root = path.dirname(inputPath);
    const missingFiles = [];
    for (const file of manifest.packageFiles || []) {
      if (!(await fileExists(path.join(root, file)))) missingFiles.push(file);
    }
    result.missingFiles = missingFiles;
    if (missingFiles.length) {
      result.valid = false;
      result.errors.push({
        path: "packageFiles",
        message: `missing package files: ${missingFiles.join(", ")}`,
      });
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await validateManifestFile(args.input, {
    checkFiles: args.checkFiles,
  });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.valid) {
    process.stdout.write(`Valid JWW Gateway manifest: ${result.file}\n`);
  } else {
    process.stdout.write(`Invalid JWW Gateway manifest: ${result.file}\n`);
    for (const error of result.errors) {
      process.stdout.write(`- ${error.path}: ${error.message}\n`);
    }
  }
  process.exitCode = result.valid ? 0 : 1;
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
