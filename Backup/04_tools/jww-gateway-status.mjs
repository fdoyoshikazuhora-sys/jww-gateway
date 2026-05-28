#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGatewayVerifyReport,
  formatGatewayVerifyReportText,
} from "./jww-gateway-verify-report.mjs";

function parseArgs(argv) {
  const args = { manifest: "JWW_GATEWAY_MANIFEST.json", json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") args.json = true;
    else args.manifest = arg;
  }
  return args;
}

export function formatGatewayStatusText(report) {
  const lines = [
    "JWW Gateway Status",
    `Package: ${report.packageName} ${report.packageVersion}`,
    `Manifest generated: ${report.manifestGeneratedAt || "unknown"}`,
    `Manifest schema: ${report.manifestSchema || "unknown"}`,
    `Ready: ${report.valid ? "yes" : "no"}`,
    `Commands: ${report.counts.commands}`,
    `Binaries: ${report.counts.binaries}`,
    `Package files: ${report.counts.packageFiles}`,
    `Missing: files ${report.counts.missingFiles}, scripts ${report.counts.missingScripts}, bins ${report.counts.missingBins}`,
    `Handoff: ${report.handoff?.entrypoint || "none"}`,
    `Verify: ${report.handoff?.verifyCommand || "none"}`,
    `Sample plan: ${report.handoff?.samplePlanCommand || "none"}`,
    `Open items: ${report.handoff?.openItemsCommand || "none"}`,
    `Report index: ${report.handoff?.reportIndexCommand || "none"}`,
    `Known open items: ${report.counts.openItems}`,
    `Unresolved: ${report.unresolvedEnvironmentKeys.join(", ") || "none"}`,
    `JWW write: ${report.capabilities.jwwWrite ? "supported" : "unsupported"}`,
  ];

  if (!report.valid) {
    lines.push("", "Details:", formatGatewayVerifyReportText(report).trimEnd());
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await buildGatewayVerifyReport({ manifest: args.manifest });
  process.stdout.write(
    args.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatGatewayStatusText(report)
  );
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
