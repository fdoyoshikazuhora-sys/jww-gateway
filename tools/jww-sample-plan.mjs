#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function parseArgs(argv) {
  const args = {
    manifest: "docs/JWW_GATEWAY_SAMPLE_SETS.example.json",
    output: "",
    base: "",
    json: false,
    csv: false,
    html: false,
    strict: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--base") args.base = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--strict") args.strict = true;
    else args.manifest = arg;
  }
  return args;
}

function samplesFromManifest(manifest) {
  if (Array.isArray(manifest)) return manifest;
  if (Array.isArray(manifest.samples)) return manifest.samples;
  throw new Error("sample manifest must be an array or contain samples[]");
}

export function validateSampleManifest(manifest) {
  const errors = [];
  let samples = [];
  if (Array.isArray(manifest)) {
    samples = manifest;
  } else if (manifest && typeof manifest === "object") {
    if (
      manifest.format !== undefined &&
      manifest.format !== "jww-gateway-sample-sets"
    ) {
      errors.push({
        path: "format",
        message: "must be jww-gateway-sample-sets when present",
      });
    }
    if (!Array.isArray(manifest.samples)) {
      errors.push({ path: "samples", message: "must be an array" });
    } else {
      samples = manifest.samples;
    }
  } else {
    errors.push({ path: "$", message: "must be an object or array" });
  }

  samples.forEach((sample, index) => {
    const pathPrefix = `samples[${index}]`;
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
      errors.push({ path: pathPrefix, message: "must be an object" });
      return;
    }
    if (typeof sample.jww !== "string" || !sample.jww.trim()) {
      errors.push({
        path: `${pathPrefix}.jww`,
        message: "must be a non-empty string",
      });
    }
    for (const key of ["name", "slug", "jwf", "notes"]) {
      if (sample[key] !== undefined && typeof sample[key] !== "string") {
        errors.push({
          path: `${pathPrefix}.${key}`,
          message: "must be a string",
        });
      }
    }
    if (
      sample.tags !== undefined &&
      (!Array.isArray(sample.tags) ||
        sample.tags.some((tag) => typeof tag !== "string"))
    ) {
      errors.push({
        path: `${pathPrefix}.tags`,
        message: "must be an array of strings",
      });
    }
  });

  return { valid: errors.length === 0, errors, samples };
}

function slug(value, fallback) {
  const text = String(value || fallback || "sample")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || fallback || "sample";
}

function resolveSamplePath(file, baseDir) {
  if (!file) return "";
  return path.isAbsolute(file) ? file : path.resolve(baseDir, file);
}

async function exists(file) {
  if (!file) return false;
  try {
    const info = await stat(file);
    return info.isFile();
  } catch {
    return false;
  }
}

function commandSetForSample(sample, nameSlug, hasJwf) {
  const jww = sample.jww;
  const jwf = sample.jwf;
  const commands = [
    {
      purpose: "convert",
      command: `npm run convert -- "${jww}" -o reports\\${nameSlug}.jww-gateway.json`,
    },
    {
      purpose: "diagnose",
      command: `npm run diagnose -- "${jww}" --html -o reports\\${nameSlug}.diagnostics.html`,
    },
    {
      purpose: "coverage-json",
      command: `npm run coverage -- "${jww}" --scope drawing --json -o reports\\${nameSlug}.coverage.json`,
    },
    {
      purpose: "coverage-html",
      command: `npm run coverage -- "${jww}" --scope drawing --html -o reports\\${nameSlug}.coverage.html`,
    },
  ];
  if (hasJwf) {
    commands.push(
      {
        purpose: "jwf:compare",
        command: `npm run jwf:compare -- "${jww}" "${jwf}" --include-after-end --html -o reports\\${nameSlug}.jwf-compare.html`,
      },
      {
        purpose: "jwf:value-scan",
        command: `npm run jwf:value-scan -- "${jww}" "${jwf}" --include-after-end --html -o reports\\${nameSlug}.value-scan.html`,
      },
      {
        purpose: "core-open",
        command: `npm run jwf:value-scan -- "${jww}" "${jwf}" --include-after-end --key LTYPE_HC,LCOLLOR_M --json -o reports\\${nameSlug}.core-open.json`,
      },
      {
        purpose: "special-color",
        command: `npm run special-color:audit -- "${jww}" "${jwf}" --include-after-end --json -o reports\\${nameSlug}.special-color.json`,
      },
      {
        purpose: "layer-defaults",
        command: `npm run layer-defaults:audit -- "${jww}" "${jwf}" --include-after-end --json -o reports\\${nameSlug}.layer-defaults.json`,
      }
    );
  }
  return commands;
}

function aggregateCommandsForSamples(samples) {
  const withJwf = samples.filter((sample) => sample.jwf);
  const coverageReports = samples
    .map((sample) => `reports\\${sample.slug}.coverage.json`)
    .join(" ");
  const coreOpenReports = withJwf
    .map((sample) => `reports\\${sample.slug}.core-open.json`)
    .join(" ");
  const specialColorReports = withJwf
    .map((sample) => `reports\\${sample.slug}.special-color.json`)
    .join(" ");
  const layerDefaultReports = withJwf
    .map((sample) => `reports\\${sample.slug}.layer-defaults.json`)
    .join(" ");
  const commands = [];
  if (samples.length) {
    commands.push({
      purpose: "coverage-summary",
      command: `npm run coverage:summary -- ${coverageReports} --html -o reports\\sample-coverage-summary.html`,
    });
  }
  if (withJwf.length) {
    commands.push(
      {
        purpose: "core-open-summary",
        command: `npm run core:summary -- ${coreOpenReports} --html -o reports\\sample-core-open-summary.html`,
      },
      {
        purpose: "special-color-summary",
        command: `npm run special-color:summary -- ${specialColorReports} --html -o reports\\sample-special-color-summary.html`,
      },
      {
        purpose: "layer-defaults-summary",
        command: `npm run layer-defaults:summary -- ${layerDefaultReports} --html -o reports\\sample-layer-defaults-summary.html`,
      }
    );
  }
  return commands;
}

export async function buildSamplePlan(options = {}) {
  const manifestFile = path.resolve(
    options.root || packageRoot,
    options.manifest || "docs/JWW_GATEWAY_SAMPLE_SETS.example.json"
  );
  const baseDir = path.resolve(options.base || path.dirname(manifestFile));
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const manifestValidation = validateSampleManifest(manifest);
  const rawSamples = manifestValidation.valid
    ? manifestValidation.samples
    : (Array.isArray(manifest) ? manifest : manifest?.samples || []).filter(
        (sample) =>
          sample && typeof sample === "object" && !Array.isArray(sample)
      );
  const samples = [];
  for (const [index, raw] of rawSamples.entries()) {
    const name = raw.name || `sample-${index + 1}`;
    const nameSlug = slug(raw.slug || name, `sample-${index + 1}`);
    const jww = resolveSamplePath(raw.jww, baseDir);
    const jwf = resolveSamplePath(raw.jwf, baseDir);
    const jwwExists = await exists(jww);
    const jwfExists = await exists(jwf);
    const hasJwf = Boolean(jwf);
    samples.push({
      name,
      slug: nameSlug,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      notes: raw.notes || "",
      jww,
      jwf,
      exists: { jww: jwwExists, jwf: hasJwf ? jwfExists : null },
      complete: jwwExists && (!hasJwf || jwfExists),
      commands: commandSetForSample({ jww, jwf }, nameSlug, hasJwf),
    });
  }
  const missingFiles = samples.flatMap((sample) => {
    const missing = [];
    if (!sample.exists.jww)
      missing.push({ sample: sample.name, kind: "jww", file: sample.jww });
    if (sample.exists.jwf === false)
      missing.push({ sample: sample.name, kind: "jwf", file: sample.jwf });
    return missing;
  });
  return {
    format: "jww-gateway-sample-plan",
    generatedAt: new Date().toISOString(),
    manifestFile,
    baseDir,
    valid: manifestValidation.valid && missingFiles.length === 0,
    manifest: {
      valid: manifestValidation.valid,
      errors: manifestValidation.errors,
    },
    counts: {
      samples: samples.length,
      withJwf: samples.filter((sample) => sample.jwf).length,
      complete: samples.filter((sample) => sample.complete).length,
      missingFiles: missingFiles.length,
      plannedCommands: samples.reduce(
        (total, sample) => total + sample.commands.length,
        0
      ),
      aggregateCommands: aggregateCommandsForSamples(samples).length,
      validationErrors: manifestValidation.errors.length,
    },
    missingFiles,
    samples,
    aggregateCommands: aggregateCommandsForSamples(samples),
  };
}

export function formatSamplePlanText(plan) {
  const lines = [
    "JWW Gateway Sample Plan",
    `Valid: ${plan.valid ? "yes" : "no"}`,
    `Samples: ${plan.counts.samples}`,
    `With JWF: ${plan.counts.withJwf}`,
    `Complete: ${plan.counts.complete}`,
    `Missing files: ${plan.counts.missingFiles}`,
    `Validation errors: ${plan.counts.validationErrors}`,
    `Planned commands: ${plan.counts.plannedCommands}`,
    `Aggregate commands: ${plan.counts.aggregateCommands}`,
  ];
  if (plan.manifest?.errors?.length) {
    lines.push("", "Validation Errors:");
    for (const error of plan.manifest.errors) {
      lines.push(`  ${error.path}: ${error.message}`);
    }
  }
  for (const sample of plan.samples) {
    lines.push(
      "",
      `${sample.name}`,
      `  JWW: ${sample.exists.jww ? "ok" : "missing"} ${sample.jww}`,
      `  JWF: ${sample.exists.jwf === null ? "none" : sample.exists.jwf ? "ok" : "missing"} ${sample.jwf || ""}`
    );
    for (const command of sample.commands) {
      lines.push(`  ${command.purpose}: ${command.command}`);
    }
  }
  if (plan.aggregateCommands?.length) {
    lines.push("", "Aggregate Commands:");
    for (const command of plan.aggregateCommands) {
      lines.push(`  ${command.purpose}: ${command.command}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function csvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  return `${rows.map((row) => row.map(csvValue).join(",")).join("\n")}\n`;
}

export function formatSamplePlanCsv(plan) {
  return rowsToCsv([
    [
      "sample",
      "jww",
      "jwf",
      "jwwExists",
      "jwfExists",
      "complete",
      "validationErrors",
      "commandCount",
      "aggregateCommandCount",
      "tagsOrCommand",
    ],
    ...plan.samples.map((sample) => [
      sample.name,
      sample.jww,
      sample.jwf,
      sample.exists.jww ? "yes" : "no",
      sample.exists.jwf === null ? "" : sample.exists.jwf ? "yes" : "no",
      sample.complete ? "yes" : "no",
      "",
      sample.commands.length,
      "",
      sample.tags.join(";"),
    ]),
    ...((plan.aggregateCommands || []).map((command) => [
      `aggregate:${command.purpose}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      plan.aggregateCommands.length,
      command.command,
    ]) || []),
  ]);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatSamplePlanHtml(plan) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Gateway Sample Plan</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    table { border-collapse: collapse; min-width: 720px; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; vertical-align: top; }
    th { background: #eef3f8; }
    code { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>JWW Gateway Sample Plan</h1>
  <p>Status: <strong>${plan.valid ? "valid" : "check required"}</strong></p>
  <p>Samples: ${plan.counts.samples}, with JWF: ${plan.counts.withJwf}, validation errors: ${plan.counts.validationErrors}, planned commands: ${plan.counts.plannedCommands}, aggregate commands: ${plan.counts.aggregateCommands}</p>
  <h2>Validation Errors</h2>
  <table>
    <thead>
      <tr><th>Path</th><th>Message</th></tr>
    </thead>
    <tbody>
${(plan.manifest?.errors || [])
  .map(
    (error) => `      <tr>
        <td>${htmlEscape(error.path)}</td>
        <td>${htmlEscape(error.message)}</td>
      </tr>`
  )
  .join("\n")}
    </tbody>
  </table>
  <table>
    <thead>
      <tr><th>Sample</th><th>JWW</th><th>JWF</th><th>Commands</th></tr>
    </thead>
    <tbody>
${plan.samples
  .map(
    (sample) => `      <tr>
        <td>${htmlEscape(sample.name)}</td>
        <td>${htmlEscape(sample.exists.jww ? "ok" : "missing")}<br>${htmlEscape(sample.jww)}</td>
        <td>${htmlEscape(sample.exists.jwf === null ? "none" : sample.exists.jwf ? "ok" : "missing")}<br>${htmlEscape(sample.jwf || "")}</td>
        <td>${sample.commands.map((item) => `<code>${htmlEscape(item.command)}</code>`).join("<br>")}</td>
      </tr>`
  )
  .join("\n")}
    </tbody>
  </table>
  <h2>Aggregate Commands</h2>
  <table>
    <thead>
      <tr><th>Purpose</th><th>Command</th></tr>
    </thead>
    <tbody>
${(plan.aggregateCommands || [])
  .map(
    (item) => `      <tr>
        <td>${htmlEscape(item.purpose)}</td>
        <td><code>${htmlEscape(item.command)}</code></td>
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
  const plan = await buildSamplePlan({
    manifest: args.manifest,
    base: args.base,
  });
  const output = args.json
    ? `${JSON.stringify(plan, null, 2)}\n`
    : args.csv
      ? formatSamplePlanCsv(plan)
      : args.html
        ? formatSamplePlanHtml(plan)
        : formatSamplePlanText(plan);
  if (args.output) {
    await mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
    await writeFile(path.resolve(args.output), output, "utf8");
  } else {
    process.stdout.write(output);
  }
  process.exitCode = !plan.manifest.valid
    ? 1
    : args.strict && !plan.valid
      ? 2
      : 0;
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
