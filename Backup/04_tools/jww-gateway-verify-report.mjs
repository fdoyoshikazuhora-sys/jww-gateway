#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifestFile } from "./jww-manifest-validate.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function parseArgs(argv) {
  const args = {
    manifest: "JWW_GATEWAY_MANIFEST.json",
    output: "",
    json: false,
    html: false,
    csv: false,
    expectedUnresolved: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-o" || arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--html") args.html = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--expect-unresolved") {
      args.expectedUnresolved = (argv[++index] || "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
    } else args.manifest = arg;
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function packageRelativePath(root, file) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative;
  }
  return path.basename(file);
}

async function fileInventory(root, files) {
  const inventory = [];
  for (const file of files || []) {
    const fullPath = path.join(root, file);
    try {
      const bytes = await readFile(fullPath);
      inventory.push({
        file,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    } catch {
      inventory.push({ file, missing: true });
    }
  }
  return inventory;
}

function unresolvedExpectation(actual, expected) {
  if (!expected?.length) {
    return {
      checked: false,
      valid: true,
      expected: [],
      missing: [],
      unexpected: [],
    };
  }
  const actualSet = new Set(actual || []);
  const expectedSet = new Set(expected || []);
  const missing = [...expectedSet].filter((key) => !actualSet.has(key)).sort();
  const unexpected = [...actualSet]
    .filter((key) => !expectedSet.has(key))
    .sort();
  return {
    checked: true,
    valid: missing.length === 0 && unexpected.length === 0,
    expected: [...expectedSet].sort(),
    missing,
    unexpected,
  };
}

export async function buildGatewayVerifyReport(options = {}) {
  const manifestFile = path.resolve(
    options.root || packageRoot,
    options.manifest || "JWW_GATEWAY_MANIFEST.json"
  );
  const root = path.dirname(manifestFile);
  const [manifest, packageJson, manifestValidation] = await Promise.all([
    readJson(manifestFile),
    readJson(path.join(root, "package.json")),
    validateManifestFile(manifestFile, { checkFiles: true }),
  ]);

  const commandSet = new Set(manifest.commands || []);
  const binarySet = new Set(manifest.binaries || []);
  const scriptSet = new Set(Object.keys(packageJson.scripts || {}));
  const binSet = new Set(Object.keys(packageJson.bin || {}));
  const missingScripts = [...commandSet].filter(
    (command) => !scriptSet.has(command)
  );
  const missingBins = [...binarySet].filter((binary) => !binSet.has(binary));
  const inventory = await fileInventory(root, manifest.packageFiles || []);
  const unresolvedCheck = unresolvedExpectation(
    manifest.unresolvedEnvironmentKeys || [],
    options.expectedUnresolved || []
  );

  return {
    format: "jww-gateway-verify-report",
    generatedAt: new Date().toISOString(),
    packageName: manifest.packageName,
    packageVersion: manifest.packageVersion,
    manifestFile: packageRelativePath(root, manifestFile),
    manifestGeneratedAt: manifest.generatedAt || "",
    manifestSchema: manifest.manifestSchema || "",
    valid:
      manifestValidation.valid &&
      !missingScripts.length &&
      !missingBins.length &&
      unresolvedCheck.valid,
    manifest: {
      valid: manifestValidation.valid,
      errors: manifestValidation.errors,
      missingFiles: manifestValidation.missingFiles || [],
    },
    counts: {
      commands: commandSet.size,
      binaries: binarySet.size,
      packageFiles: manifest.packageFiles?.length || 0,
      missingFiles: manifestValidation.missingFiles?.length || 0,
      missingScripts: missingScripts.length,
      missingBins: missingBins.length,
      unresolvedEnvironmentKeys:
        manifest.unresolvedEnvironmentKeys?.length || 0,
      unexpectedUnresolvedEnvironmentKeys: unresolvedCheck.unexpected.length,
      missingExpectedUnresolvedEnvironmentKeys: unresolvedCheck.missing.length,
      openItems: manifest.openItems?.length || 0,
    },
    missingScripts,
    missingBins,
    fileInventory: inventory,
    handoff: manifest.handoff || {},
    capabilities: manifest.capabilities || {},
    unresolvedEnvironmentKeys: manifest.unresolvedEnvironmentKeys || [],
    unresolvedExpectation: unresolvedCheck,
    openItems: manifest.openItems || [],
    notes: manifest.notes || [],
  };
}

export function formatGatewayVerifyReportText(report) {
  const lines = [
    "JWW Gateway Verify Report",
    `Package: ${report.packageName} ${report.packageVersion}`,
    `Manifest generated: ${report.manifestGeneratedAt || "unknown"}`,
    `Manifest schema: ${report.manifestSchema || "unknown"}`,
    `Valid: ${report.valid ? "yes" : "no"}`,
    `Commands: ${report.counts.commands}`,
    `Binaries: ${report.counts.binaries}`,
    `Package files: ${report.counts.packageFiles}`,
    `Missing files: ${report.counts.missingFiles}`,
    `Missing scripts: ${report.counts.missingScripts}`,
    `Missing bins: ${report.counts.missingBins}`,
    `Handoff entry: ${report.handoff?.entrypoint || "none"}`,
    `Unresolved environment keys: ${report.unresolvedEnvironmentKeys.join(", ") || "none"}`,
    `Open items: ${report.counts.openItems}`,
  ];
  if (report.unresolvedExpectation?.checked) {
    lines.push(
      `Expected unresolved keys: ${report.unresolvedExpectation.expected.join(", ") || "none"}`,
      `Missing expected unresolved keys: ${report.unresolvedExpectation.missing.join(", ") || "none"}`,
      `Unexpected unresolved keys: ${report.unresolvedExpectation.unexpected.join(", ") || "none"}`
    );
  }

  if (report.manifest.errors.length) {
    lines.push("", "Manifest Errors:");
    for (const error of report.manifest.errors) {
      lines.push(`  ${error.path}: ${error.message}`);
    }
  }

  if (report.notes.length) {
    lines.push("", "Notes:");
    for (const note of report.notes) lines.push(`  ${note}`);
  }

  if (report.fileInventory?.length) {
    lines.push("", "File Inventory:");
    for (const item of report.fileInventory.slice(0, 12)) {
      lines.push(
        `  ${item.file}: ${item.missing ? "missing" : `${item.bytes} bytes / ${item.sha256.slice(0, 16)}...`}`
      );
    }
    if (report.fileInventory.length > 12) {
      lines.push(`  ... ${report.fileInventory.length - 12} more`);
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

export function formatGatewayVerifyReportCsv(report) {
  return rowsToCsv([
    ["file", "bytes", "sha256", "missing"],
    ...(report.fileInventory || []).map((item) => [
      item.file,
      item.bytes ?? "",
      item.sha256 || "",
      item.missing ? "yes" : "no",
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

function rowsToHtml(rows) {
  return rows
    .map(
      ([label, value]) => `      <tr>
        <th>${htmlEscape(label)}</th>
        <td>${htmlEscape(value)}</td>
      </tr>`
    )
    .join("\n");
}

export function formatGatewayVerifyReportHtml(report) {
  const status = report.valid ? "Valid" : "Invalid";
  const rows = [
    ["Package", `${report.packageName} ${report.packageVersion}`],
    ["Manifest generated", report.manifestGeneratedAt || "unknown"],
    ["Manifest schema", report.manifestSchema || "unknown"],
    ["Status", status],
    ["Commands", report.counts.commands],
    ["Binaries", report.counts.binaries],
    ["Package files", report.counts.packageFiles],
    ["Missing files", report.counts.missingFiles],
    ["Missing scripts", report.counts.missingScripts],
    ["Missing bins", report.counts.missingBins],
    ["Handoff entry", report.handoff?.entrypoint || "none"],
    ["Handoff check", report.handoff?.verifyCommand || "none"],
    ["Sample plan", report.handoff?.samplePlanCommand || "none"],
    ["Report index", report.handoff?.reportIndexCommand || "none"],
    ["Open items", report.counts.openItems],
    [
      "Unresolved environment keys",
      report.unresolvedEnvironmentKeys.join(", ") || "none",
    ],
  ];
  if (report.unresolvedExpectation?.checked) {
    rows.push(
      [
        "Expected unresolved keys",
        report.unresolvedExpectation.expected.join(", ") || "none",
      ],
      [
        "Missing expected unresolved keys",
        report.unresolvedExpectation.missing.join(", ") || "none",
      ],
      [
        "Unexpected unresolved keys",
        report.unresolvedExpectation.unexpected.join(", ") || "none",
      ]
    );
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JWW Gateway Verify Report</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    table { border-collapse: collapse; min-width: 520px; font-size: 13px; }
    th, td { border: 1px solid #d8e0ea; padding: 7px 10px; text-align: left; }
    th { background: #eef3f8; width: 220px; }
    .status { display: inline-block; padding: 3px 8px; border-radius: 4px; background: ${report.valid ? "#e3f7e8" : "#ffe7e7"}; color: ${report.valid ? "#136b2c" : "#a20f0f"}; font-weight: 700; }
    ul { margin-top: 8px; }
  </style>
</head>
<body>
  <h1>JWW Gateway Verify Report</h1>
  <p><span class="status">${htmlEscape(status)}</span></p>
  <table>
    <tbody>
${rowsToHtml(rows)}
    </tbody>
  </table>
  <h2>Notes</h2>
  <ul>
${(report.notes || []).map((note) => `    <li>${htmlEscape(note)}</li>`).join("\n")}
  </ul>
  <h2>File Inventory</h2>
  <table>
    <thead>
      <tr><th>File</th><th>Bytes</th><th>SHA-256</th></tr>
    </thead>
    <tbody>
${(report.fileInventory || [])
  .map(
    (item) => `      <tr>
        <td>${htmlEscape(item.file)}</td>
        <td>${htmlEscape(item.missing ? "missing" : item.bytes)}</td>
        <td>${htmlEscape(item.sha256 || "")}</td>
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
  const report = await buildGatewayVerifyReport({
    manifest: args.manifest,
    expectedUnresolved: args.expectedUnresolved,
  });
  const output = args.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : args.csv
      ? formatGatewayVerifyReportCsv(report)
      : args.html
        ? formatGatewayVerifyReportHtml(report)
        : formatGatewayVerifyReportText(report);
  if (args.output) await writeFile(path.resolve(args.output), output, "utf8");
  else process.stdout.write(output);
  process.exitCode = report.valid ? 0 : 1;
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
