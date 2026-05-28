#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { packageRequiredFiles } from "../src/jww/gatewayPackageFiles.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function assertFile(relativePath) {
  const fullPath = path.join(packageRoot, relativePath);
  await access(fullPath);
  return fullPath;
}

async function importRelative(relativePath) {
  const fullPath = await assertFile(relativePath);
  return import(pathToFileURL(fullPath).href);
}

export async function main() {
  for (const file of packageRequiredFiles()) {
    await assertFile(file);
  }

  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8")
  );
  const manifest = JSON.parse(
    await readFile(path.join(packageRoot, "JWW_GATEWAY_MANIFEST.json"), "utf8")
  );
  const readme = await readFile(path.join(packageRoot, "README.md"), "utf8");
  const handoff = await readFile(
    path.join(packageRoot, "JWW_GATEWAY_HANDOFF.md"),
    "utf8"
  );
  const reportsReadme = await readFile(
    path.join(packageRoot, "reports", "README.md"),
    "utf8"
  );
  if (manifest.format !== "jww-gateway-package-manifest") {
    throw new Error("JWW_GATEWAY_MANIFEST.json has an unexpected format");
  }
  if (manifest.manifestSchema !== "docs/jww-gateway-manifest.schema.json") {
    throw new Error("manifest is missing its schema path");
  }
  if (!manifest.capabilities?.schemaValidate) {
    throw new Error("manifest is missing schemaValidate capability");
  }
  if (!manifest.capabilities?.valueScanSummary) {
    throw new Error("manifest is missing valueScanSummary capability");
  }
  if (!manifest.capabilities?.layerDefaultsSummary) {
    throw new Error("manifest is missing layerDefaultsSummary capability");
  }
  if (!manifest.capabilities?.specialColorAudit) {
    throw new Error("manifest is missing specialColorAudit capability");
  }
  if (!manifest.capabilities?.specialColorSummary) {
    throw new Error("manifest is missing specialColorSummary capability");
  }
  if (!manifest.capabilities?.promotionCandidateGate) {
    throw new Error("manifest is missing promotionCandidateGate capability");
  }
  if (!manifest.capabilities?.samplePlan) {
    throw new Error("manifest is missing samplePlan capability");
  }
  if (!manifest.capabilities?.openItemsReport) {
    throw new Error("manifest is missing openItemsReport capability");
  }
  if (!manifest.capabilities?.reportIndex) {
    throw new Error("manifest is missing reportIndex capability");
  }
  if (!manifest.capabilities || manifest.capabilities.jwwWrite !== false) {
    throw new Error("manifest must state that JWW write is unsupported");
  }
  if (!manifest.openItems?.some((item) => item.id === "jww-write")) {
    throw new Error("manifest is missing open item metadata");
  }
  if (
    !manifest.unresolvedEnvironmentKeys?.includes("LTYPE_HC") ||
    !manifest.unresolvedEnvironmentKeys?.includes("LCOLLOR_M")
  ) {
    throw new Error("manifest is missing unresolved core environment keys");
  }
  if (!packageJson.bin?.["jww-gateway"]) {
    throw new Error("package.json is missing jww-gateway bin entry");
  }
  if (!packageJson.bin?.["jww-coverage"]) {
    throw new Error("package.json is missing jww-coverage bin entry");
  }
  if (!packageJson.bin?.["jww-coverage-summary"]) {
    throw new Error("package.json is missing jww-coverage-summary bin entry");
  }
  if (!packageJson.bin?.["jww-layer-defaults-audit"]) {
    throw new Error(
      "package.json is missing jww-layer-defaults-audit bin entry"
    );
  }
  if (!packageJson.bin?.["jww-layer-defaults-summary"]) {
    throw new Error(
      "package.json is missing jww-layer-defaults-summary bin entry"
    );
  }
  if (!packageJson.bin?.["jww-special-color-audit"]) {
    throw new Error(
      "package.json is missing jww-special-color-audit bin entry"
    );
  }
  if (!packageJson.bin?.["jww-special-color-summary"]) {
    throw new Error(
      "package.json is missing jww-special-color-summary bin entry"
    );
  }
  if (!packageJson.bin?.["jww-env-scan"]) {
    throw new Error("package.json is missing jww-env-scan bin entry");
  }
  if (!packageJson.bin?.["jww-core-open-summary"]) {
    throw new Error("package.json is missing jww-core-open-summary bin entry");
  }
  if (!packageJson.bin?.["jww-sample-plan"]) {
    throw new Error("package.json is missing jww-sample-plan bin entry");
  }
  if (!packageJson.bin?.["jww-gateway-open-items"]) {
    throw new Error("package.json is missing jww-gateway-open-items bin entry");
  }
  if (!packageJson.bin?.["jww-gateway-report-index"]) {
    throw new Error("package.json is missing jww-gateway-report-index bin entry");
  }
  if (!packageJson.bin?.["jww-value-scan-summary"]) {
    throw new Error("package.json is missing jww-value-scan-summary bin entry");
  }
  if (!packageJson.bin?.["jww-manifest-validate"]) {
    throw new Error("package.json is missing jww-manifest-validate bin entry");
  }
  if (!packageJson.bin?.["jww-gateway-status"]) {
    throw new Error("package.json is missing jww-gateway-status bin entry");
  }
  if (!packageJson.bin?.["jww-gateway-verify-report"]) {
    throw new Error(
      "package.json is missing jww-gateway-verify-report bin entry"
    );
  }
  if (!packageJson.bin?.["jww-gateway-verify-report-diff"]) {
    throw new Error(
      "package.json is missing jww-gateway-verify-report-diff bin entry"
    );
  }
  if (!packageJson.scripts?.convert || !packageJson.scripts?.diagnose) {
    throw new Error("package.json is missing expected scripts");
  }
  if (!packageJson.scripts?.coverage) {
    throw new Error("package.json is missing coverage script");
  }
  if (!packageJson.scripts?.["coverage:summary"]) {
    throw new Error("package.json is missing coverage:summary script");
  }
  if (!packageJson.scripts?.["layer-defaults:audit"]) {
    throw new Error("package.json is missing layer-defaults:audit script");
  }
  if (!packageJson.scripts?.["layer-defaults:summary"]) {
    throw new Error("package.json is missing layer-defaults:summary script");
  }
  if (!packageJson.scripts?.["special-color:audit"]) {
    throw new Error("package.json is missing special-color:audit script");
  }
  if (!packageJson.scripts?.["special-color:summary"]) {
    throw new Error("package.json is missing special-color:summary script");
  }
  if (!packageJson.scripts?.validate) {
    throw new Error("package.json is missing validate script");
  }
  if (!packageJson.scripts?.["core:summary"]) {
    throw new Error("package.json is missing core:summary script");
  }
  if (!packageJson.scripts?.["sample:plan"]) {
    throw new Error("package.json is missing sample:plan script");
  }
  if (!packageJson.scripts?.["open-items"]) {
    throw new Error("package.json is missing open-items script");
  }
  if (!packageJson.scripts?.["reports:index"]) {
    throw new Error("package.json is missing reports:index script");
  }
  if (!packageJson.scripts?.["value-scan:summary"]) {
    throw new Error("package.json is missing value-scan:summary script");
  }
  if (!packageJson.scripts?.["manifest:validate"]) {
    throw new Error("package.json is missing manifest:validate script");
  }
  if (!packageJson.scripts?.status) {
    throw new Error("package.json is missing status script");
  }
  if (!packageJson.scripts?.["verify:report"]) {
    throw new Error("package.json is missing verify:report script");
  }
  if (!packageJson.scripts?.["verify:reports"]) {
    throw new Error("package.json is missing verify:reports script");
  }
  if (!packageJson.scripts?.["verify:diff"]) {
    throw new Error("package.json is missing verify:diff script");
  }
  if (!packageJson.scripts?.verify) {
    throw new Error("package.json is missing verify script");
  }
  if (!packageJson.scripts?.["verify:all"]) {
    throw new Error("package.json is missing verify:all script");
  }
  if (!packageJson.scripts?.["verify:handoff"]) {
    throw new Error("package.json is missing verify:handoff script");
  }
  if (!packageJson.scripts?.test || !packageJson.scripts?.["test:jww"]) {
    throw new Error("package.json is missing test scripts");
  }
  if (!readme.includes("reports\\") || !readme.includes("npm run verify")) {
    throw new Error("README.md is missing package verification notes");
  }
  if (!readme.includes("direct-match true/false")) {
    throw new Error("README.md is missing direct-match summary notes");
  }
  if (!readme.includes("open-items")) {
    throw new Error("README.md is missing open-items notes");
  }
  if (!readme.includes("LTYPE_HC") || !readme.includes("LCOLLOR_M")) {
    throw new Error("README.md is missing unresolved core key notes");
  }
  if (!handoff.includes("verify:handoff") || !handoff.includes("sample:plan")) {
    throw new Error("JWW_GATEWAY_HANDOFF.md is missing entry-point commands");
  }
  if (
    !reportsReadme.includes("verify-report") ||
    !reportsReadme.includes("sample-plan")
  ) {
    throw new Error("reports/README.md is missing expected report notes");
  }

  const parser = await importRelative("src/jww/parser.js");
  const gateway = await importRelative("tools/jww-gateway.mjs");
  const coverageCli = await importRelative("tools/jww-coverage.mjs");
  const coverageSummaryCli = await importRelative(
    "tools/jww-coverage-summary.mjs"
  );
  const layerDefaultsAuditCli = await importRelative(
    "tools/jww-layer-defaults-audit.mjs"
  );
  const layerDefaultsSummaryCli = await importRelative(
    "tools/jww-layer-defaults-summary.mjs"
  );
  const specialColorAuditCli = await importRelative(
    "tools/jww-special-color-audit.mjs"
  );
  const specialColorSummaryCli = await importRelative(
    "tools/jww-special-color-summary.mjs"
  );
  await importRelative("tools/jww-diagnostics.mjs");
  await importRelative("tools/jww-diagnostics-diff.mjs");
  await importRelative("tools/jww-env-scan.mjs");
  await importRelative("tools/jww-jwf-compare.mjs");
  const valueScan = await importRelative("tools/jww-jwf-value-scan.mjs");
  const valueScanSummary = await importRelative(
    "tools/jww-value-scan-summary.mjs"
  );
  const coreSummary = await importRelative("tools/jww-core-open-summary.mjs");
  const samplePlan = await importRelative("tools/jww-sample-plan.mjs");
  const openItems = await importRelative("tools/jww-gateway-open-items.mjs");
  const reportIndex = await importRelative("tools/jww-gateway-report-index.mjs");
  const manifestCli = await importRelative("tools/jww-manifest-validate.mjs");
  const statusCli = await importRelative("tools/jww-gateway-status.mjs");
  const verifyReport = await importRelative(
    "tools/jww-gateway-verify-report.mjs"
  );
  const verifyReportDiff = await importRelative(
    "tools/jww-gateway-verify-report-diff.mjs"
  );
  const validator = await importRelative("tools/jww-schema-validate.mjs");
  const jwf = await importRelative("src/jww/jwf.js");
  const gatewayManifest = await importRelative("src/jww/gatewayManifest.js");

  if (typeof parser.parse !== "function") {
    throw new Error("src/jww/parser.js does not export parse()");
  }
  if (typeof gateway.convertJwwBytes !== "function") {
    throw new Error("tools/jww-gateway.mjs does not export convertJwwBytes()");
  }
  if (typeof coverageCli.buildCoverageReport !== "function") {
    throw new Error(
      "tools/jww-coverage.mjs does not export buildCoverageReport()"
    );
  }
  if (typeof coverageSummaryCli.summarizeCoverageReports !== "function") {
    throw new Error(
      "tools/jww-coverage-summary.mjs does not export summarizeCoverageReports()"
    );
  }
  const coverageSummary = coverageSummaryCli.summarizeCoverageReports([
    {
      source: "a.jww",
      rows: [
        {
          key: "LAYCOL_0",
          scope: "drawing",
          family: "layerColors",
          status: "missing",
        },
      ],
    },
  ]);
  if (coverageSummary.counts.alwaysMissingDrawing !== 1) {
    throw new Error("coverage summary drawing missing count is not working");
  }
  if (coverageSummary.counts.alwaysMissingDrawingLayerDefaults !== 1) {
    throw new Error(
      "coverage summary drawing layer-default count is not working"
    );
  }
  if (
    !coverageSummaryCli
      .formatCoverageSummaryText(coverageSummary)
      .includes("layer defaults: 1")
  ) {
    throw new Error("coverage summary text output is not working");
  }
  if (typeof layerDefaultsAuditCli.buildLayerDefaultsAudit !== "function") {
    throw new Error(
      "tools/jww-layer-defaults-audit.mjs does not export buildLayerDefaultsAudit()"
    );
  }
  if (
    typeof layerDefaultsSummaryCli.summarizeLayerDefaultsAudits !== "function"
  ) {
    throw new Error(
      "tools/jww-layer-defaults-summary.mjs does not export summarizeLayerDefaultsAudits()"
    );
  }
  if (
    typeof layerDefaultsSummaryCli.formatLayerDefaultsSummaryText !== "function"
  ) {
    throw new Error(
      "tools/jww-layer-defaults-summary.mjs does not export formatLayerDefaultsSummaryText()"
    );
  }
  if (typeof specialColorAuditCli.buildSpecialColorAudit !== "function") {
    throw new Error(
      "tools/jww-special-color-audit.mjs does not export buildSpecialColorAudit()"
    );
  }
  if (
    typeof specialColorSummaryCli.summarizeSpecialColorAudits !== "function"
  ) {
    throw new Error(
      "tools/jww-special-color-summary.mjs does not export summarizeSpecialColorAudits()"
    );
  }
  if (typeof validator.validateJwwGatewayJson !== "function") {
    throw new Error(
      "tools/jww-schema-validate.mjs does not export validateJwwGatewayJson()"
    );
  }
  if (typeof statusCli.formatGatewayStatusText !== "function") {
    throw new Error(
      "tools/jww-gateway-status.mjs does not export formatGatewayStatusText()"
    );
  }
  const validValidation = validator.validateJwwGatewayJson({
    format: "jww-gateway-json",
    formatVersion: 1,
    sourceFormat: "JWW",
    encoding: "shift_jis",
    meta: {
      jwwVersion: 700,
      paperCode: 2,
      paperSize: "A2",
      colorSettings: {
        screenColors: {
          1: { red: 120, green: 120, blue: 120, width: 1, hex: "#787878" },
        },
        specialColors: {
          S: { red: 255, green: 0, blue: 0, hex: "#ff0000" },
          K: { red: 255, green: 128, blue: 0, hex: "#ff8000" },
          Z: { red: 128, green: 128, blue: 128, hex: "#808080" },
          M: null,
        },
      },
      lineTypeSettings: {
        offset: 100,
        byteLength: 292,
        rows: {
          LTYPE_02: {
            pattern: "99999999",
            params: [4, 1, 5],
            values: ["99999999", 4, 1, 5],
            offset: 100,
          },
        },
      },
      jwwEnvironment: {
        coverage: {
          totalJwfKeysTracked: 210,
          supportedKeys: ["LCOLLOR_S"],
          missingJwfKeys: ["LTYPE_HC", "LCOLLOR_M"],
        },
      },
    },
    entities: [],
  });
  if (!validValidation.valid) {
    throw new Error("schema validator rejects valid JWW metadata");
  }
  const validation = validator.validateJwwGatewayJson({
    format: "jww-gateway-json",
    formatVersion: 1,
    sourceFormat: "JWW",
    encoding: "shift_jis",
    meta: {
      jwwVersion: 700,
      paperCode: 2,
      paperSize: "A2",
      colorSettings: { screenColors: { 1: { hex: "bad" } } },
    },
    entities: [],
  });
  if (
    !validation.errors.some(
      (error) => error.path === "meta.colorSettings.screenColors.1.hex"
    )
  ) {
    throw new Error("schema validator is missing color hex checks");
  }
  if (typeof jwf.parseJwfText !== "function") {
    throw new Error("src/jww/jwf.js does not export parseJwfText()");
  }
  const manifestValidation = gatewayManifest.validateGatewayManifest(manifest);
  if (!manifestValidation.valid) {
    throw new Error(
      `manifest validation failed: ${JSON.stringify(manifestValidation.errors)}`
    );
  }
  const manifestFileValidation = await manifestCli.validateManifestFile(
    path.join(packageRoot, "JWW_GATEWAY_MANIFEST.json"),
    { checkFiles: true }
  );
  if (!manifestFileValidation.valid) {
    throw new Error("manifest validation CLI rejects packaged manifest");
  }
  if (typeof verifyReport.buildGatewayVerifyReport !== "function") {
    throw new Error(
      "tools/jww-gateway-verify-report.mjs does not export buildGatewayVerifyReport()"
    );
  }
  const packageReport = await verifyReport.buildGatewayVerifyReport({
    root: packageRoot,
  });
  if (!packageReport.valid || packageReport.counts.missingFiles !== 0) {
    throw new Error("gateway verify report rejects packaged files");
  }
  if (typeof verifyReportDiff.diffGatewayVerifyReports !== "function") {
    throw new Error(
      "tools/jww-gateway-verify-report-diff.mjs does not export diffGatewayVerifyReports()"
    );
  }
  const noDiff = verifyReportDiff.diffGatewayVerifyReports(
    packageReport,
    packageReport
  );
  if (noDiff.counts.changed !== 0 || noDiff.counts.added !== 0) {
    throw new Error(
      "gateway verify report diff does not handle identical reports"
    );
  }
  if (typeof valueScan.candidatePatterns !== "function") {
    throw new Error(
      "tools/jww-jwf-value-scan.mjs does not export candidatePatterns()"
    );
  }
  if (typeof coreSummary.buildCoreOpenSummary !== "function") {
    throw new Error(
      "tools/jww-core-open-summary.mjs does not export buildCoreOpenSummary()"
    );
  }
  if (typeof coreSummary.formatCoreOpenSummaryText !== "function") {
    throw new Error(
      "tools/jww-core-open-summary.mjs does not export formatCoreOpenSummaryText()"
    );
  }
  if (typeof samplePlan.buildSamplePlan !== "function") {
    throw new Error(
      "tools/jww-sample-plan.mjs does not export buildSamplePlan()"
    );
  }
  if (typeof openItems.buildOpenItemsReport !== "function") {
    throw new Error(
      "tools/jww-gateway-open-items.mjs does not export buildOpenItemsReport()"
    );
  }
  const openItemsReport = openItems.buildOpenItemsReport(manifest);
  if (!openItemsReport.openItems.some((item) => item.id === "LCOLLOR_M")) {
    throw new Error("open items report is missing LCOLLOR_M");
  }
  if (!openItems.formatOpenItemsText(openItemsReport).includes("JWW write")) {
    throw new Error("open items text output is not working");
  }
  if (typeof reportIndex.buildReportIndex !== "function") {
    throw new Error(
      "tools/jww-gateway-report-index.mjs does not export buildReportIndex()"
    );
  }
  const indexReport = await reportIndex.buildReportIndex({ root: packageRoot });
  if (!reportIndex.formatReportIndexText(indexReport).includes("Verify report")) {
    throw new Error("report index text output is not working");
  }
  if (typeof valueScanSummary.buildValueScanSummary !== "function") {
    throw new Error(
      "tools/jww-value-scan-summary.mjs does not export buildValueScanSummary()"
    );
  }
  if (typeof valueScanSummary.formatValueScanSummaryText !== "function") {
    throw new Error(
      "tools/jww-value-scan-summary.mjs does not export formatValueScanSummaryText()"
    );
  }
  const valueSummary = valueScanSummary.buildValueScanSummary(
    ["a.json"],
    [
      {
        key: "MSET",
        family: "text",
        status: "missing",
        gatewayStatus: "missing",
      },
    ]
  );
  if (valueSummary.byKey.MSET?.missing !== 1) {
    throw new Error("value scan summary missing count is not working");
  }
  const promotionSummary = valueScanSummary.buildValueScanSummary(
    ["candidate.json"],
    [
      {
        key: "NEW_KEY",
        family: "other",
        status: "matched",
        gatewayStatus: "missing",
      },
    ]
  );
  if (promotionSummary.counts.promotionCandidates !== 1) {
    throw new Error(
      "value scan summary promotion candidate count is not working"
    );
  }
  const layerDefaultsSummary =
    layerDefaultsSummaryCli.summarizeLayerDefaultsAudits([
      {
        sources: { jww: "a.jww", jwf: "a.jwf" },
        counts: {
          rows: 1,
          directMatchCandidates: 0,
          promotionCandidates: 0,
        },
        rows: [
          {
            key: "LAYCOL_0",
            family: "layerColors",
            status: "missing",
            gatewayStatus: "missing",
          },
        ],
      },
    ]);
  if (layerDefaultsSummary.counts.alwaysMissing !== 1) {
    throw new Error("layer defaults summary missing count is not working");
  }
  if (
    !layerDefaultsSummaryCli
      .formatLayerDefaultsSummaryText(layerDefaultsSummary)
      .includes("Direct match candidates: 0")
  ) {
    throw new Error("layer defaults summary text output is not working");
  }
  if (
    !valueScanSummary
      .formatValueScanSummaryText(promotionSummary)
      .includes("Promotion candidates: 1")
  ) {
    throw new Error("value scan summary text output is not working");
  }
  const summary = coreSummary.buildCoreOpenSummary(
    ["a.json"],
    [{ key: "LTYPE_HC", status: "missing", directU32Match: false }]
  );
  if (summary.byKey.LTYPE_HC?.directMatchFalse !== 1) {
    throw new Error("core open summary direct false count is not working");
  }
  if (summary.counts.directMatchFalse !== 1) {
    throw new Error("core open summary direct false total is not working");
  }
  if (!coreSummary.formatCoreOpenSummaryText(summary).includes("LTYPE_HC")) {
    throw new Error("core open summary text output is not working");
  }
  const plannedSamples = await samplePlan.buildSamplePlan({
    root: packageRoot,
    manifest: "docs/JWW_GATEWAY_SAMPLE_SETS.example.json",
  });
  if (plannedSamples.counts.samples < 1) {
    throw new Error("sample plan did not read the packaged example manifest");
  }
  if (
    !samplePlan
      .formatSamplePlanText(plannedSamples)
      .includes("JWW Gateway Sample Plan")
  ) {
    throw new Error("sample plan text output is not working");
  }
  const specialSummary =
    await specialColorSummaryCli.summarizeSpecialColorAudits([]);
  if (specialSummary.counts.directMatches !== 0) {
    throw new Error("special color summary direct match count is not working");
  }
  if (
    !specialColorSummaryCli
      .formatSpecialColorSummaryText(specialSummary)
      .includes("LCOLLOR_M")
  ) {
    throw new Error("special color summary text output is not working");
  }
  const rgbPatterns = valueScan.candidatePatterns({
    key: "LCOLLOR_M",
    values: [200, 200, 200],
  });
  if (!rgbPatterns.some((pattern) => pattern.kind === "rgb-triplet")) {
    throw new Error("value scan is missing rgb-triplet pattern support");
  }

  process.stdout.write("JWW Gateway smoke check passed\n");
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
