import {
  buildGatewayManifest,
  JWF_ONLY_OPERATION_KEYS,
  REQUIRED_GATEWAY_BINARIES,
  REQUIRED_GATEWAY_COMMANDS,
  validateGatewayManifest,
} from "./gatewayManifest.js";
import { packageRequiredFiles } from "./gatewayPackageFiles.js";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const manifestValidatorScript = path.join(
  process.cwd(),
  "tools",
  "jww-manifest-validate.mjs"
);
const verifyReportScript = path.join(
  process.cwd(),
  "tools",
  "jww-gateway-verify-report.mjs"
);
const statusScript = path.join(
  process.cwd(),
  "tools",
  "jww-gateway-status.mjs"
);
const verifyReportDiffScript = path.join(
  process.cwd(),
  "tools",
  "jww-gateway-verify-report-diff.mjs"
);
const samplePlanScript = path.join(
  process.cwd(),
  "tools",
  "jww-sample-plan.mjs"
);
const openItemsScript = path.join(
  process.cwd(),
  "tools",
  "jww-gateway-open-items.mjs"
);
const reportIndexScript = path.join(
  process.cwd(),
  "tools",
  "jww-gateway-report-index.mjs"
);
const manifestSchemaFile = path.join(
  process.cwd(),
  "docs",
  "jww-gateway-manifest.schema.json"
);

function validManifest(overrides = {}) {
  return buildGatewayManifest({
    packageName: "jww-gateway",
    packageVersion: "0.1.0",
    commands: REQUIRED_GATEWAY_COMMANDS,
    binaries: REQUIRED_GATEWAY_BINARIES,
    packageFiles: packageRequiredFiles(),
    generatedAt: "2026-05-13T00:00:00.000Z",
    ...overrides,
  });
}

function writeManifest(manifest, files = []) {
  const folder = mkdtempSync(path.join(tmpdir(), "jww-manifest-"));
  const file = path.join(folder, "JWW_GATEWAY_MANIFEST.json");
  for (const relativePath of files) {
    if (relativePath === "JWW_GATEWAY_MANIFEST.json") continue;
    const fullPath = path.join(folder, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, "", "utf8");
  }
  writeFileSync(file, JSON.stringify(manifest), "utf8");
  return file;
}

function runManifestValidator(manifest, options = {}) {
  const file = writeManifest(manifest, options.files || []);
  const args = ["--no-warnings", manifestValidatorScript, file, "--json"];
  if (options.checkFiles) args.push("--check-files");
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  const stdout = result.stdout ?? result.output?.[1]?.toString() ?? "";
  if (!stdout) {
    throw new Error(
      `manifest validator produced no stdout: status=${result.status} error=${result.error?.message || ""} stderr=${result.stderr || ""}`
    );
  }
  return {
    status: result.status,
    stderr: result.stderr,
    output: JSON.parse(stdout),
  };
}

function packageJsonForManifest({
  commands = REQUIRED_GATEWAY_COMMANDS,
  binaries = REQUIRED_GATEWAY_BINARIES,
} = {}) {
  return {
    name: "jww-gateway",
    version: "0.1.0",
    scripts: Object.fromEntries(commands.map((command) => [command, "echo"])),
    bin: Object.fromEntries(binaries.map((binary) => [binary, "echo"])),
  };
}

function writePackageJsonForManifest(manifestFile, packageJson) {
  writeFileSync(
    path.join(path.dirname(manifestFile), "package.json"),
    JSON.stringify(packageJson),
    "utf8"
  );
}

function runVerifyReport(manifest, options = {}) {
  const fixtureManifest = JSON.parse(JSON.stringify(manifest));
  if (options.mutateManifest) options.mutateManifest(fixtureManifest);
  const file = writeManifest(fixtureManifest, options.files || []);
  writePackageJsonForManifest(
    file,
    options.packageJson || packageJsonForManifest()
  );
  const args = ["--no-warnings", verifyReportScript, file];
  if (options.json) args.push("--json");
  if (options.html) args.push("--html");
  if (options.csv) args.push("--csv");
  if (options.expectedUnresolved) {
    args.push("--expect-unresolved", options.expectedUnresolved);
  }
  if (options.expectNoUnresolved) args.push("--expect-no-unresolved");
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? result.output?.[1]?.toString() ?? "",
    stderr: result.stderr,
  };
}

function runStatus(manifest, options = {}) {
  const file = writeManifest(manifest, options.files || []);
  writePackageJsonForManifest(
    file,
    options.packageJson || packageJsonForManifest()
  );
  const args = ["--no-warnings", statusScript, file];
  if (options.json) args.push("--json");
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? result.output?.[1]?.toString() ?? "",
    stderr: result.stderr,
  };
}

function writeReport(folder, name, report) {
  const file = path.join(folder, name);
  writeFileSync(file, JSON.stringify(report), "utf8");
  return file;
}

function runVerifyReportDiff(before, after, options = {}) {
  const folder = mkdtempSync(path.join(tmpdir(), "jww-verify-diff-"));
  const beforeFile = writeReport(folder, "before.json", before);
  const afterFile = writeReport(folder, "after.json", after);
  const args = ["--no-warnings", verifyReportDiffScript, beforeFile, afterFile];
  if (options.json) args.push("--json");
  if (options.html) args.push("--html");
  if (options.csv) args.push("--csv");
  if (options.allowDifferences) args.push("--allow-differences");
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? result.output?.[1]?.toString() ?? "",
    stderr: result.stderr,
  };
}

describe("JWW Gateway package manifest", () => {
  it("builds a valid manifest with package capabilities", () => {
    const manifest = validManifest();

    expect(manifest.commands).toEqual([...REQUIRED_GATEWAY_COMMANDS].sort());
    expect(manifest.capabilities.coverage).toBe(true);
    expect(manifest.capabilities.coverageSummary).toBe(true);
    expect(manifest.capabilities.layerDefaultsAudit).toBe(true);
    expect(manifest.capabilities.layerDefaultsSummary).toBe(true);
    expect(manifest.capabilities.specialColorAudit).toBe(true);
    expect(manifest.capabilities.specialColorSummary).toBe(true);
    expect(manifest.capabilities.jwwWrite).toBe(true);
    expect(manifest.capabilities.semanticDiff).toBe(true);
    expect(manifest.capabilities.valueScanSummary).toBe(true);
    expect(manifest.capabilities.promotionCandidateGate).toBe(true);
    expect(manifest.capabilities.openItemsReport).toBe(true);
    expect(manifest.capabilities.reportIndex).toBe(true);
    expect(manifest.capabilities.nativeOpen).toBe(true);
    expect(manifest.openItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "jww-version-conformance" }),
      ])
    );
    expect(
      manifest.openItems.find((item) => item.id === "jww-version-conformance")
        ?.detail
    ).toContain("Fifteen Jw_cad-installed v600 samples totaling 22,624 drawing entities");
    expect(
      manifest.openItems.find((item) => item.id === "jww-version-conformance")
        ?.detail
    ).toContain("one LINE");
    expect(manifest.packageFiles).toContain(
      "docs/JWW_VERSION_CONFORMANCE_EVIDENCE.md"
    );
    expect(manifest.packageFiles).toContain(
      "docs/JWW_TEXT_DECORATION_CONTRACT.md"
    );
    expect(manifest.openItems.map((item) => item.id)).not.toEqual(
      expect.arrayContaining([
        "jww-write",
        "jww-text-decoration-rendering",
        "LTYPE_HC",
        "LCOLLOR_M",
        "tilted-ellipse-arc-comparison",
      ])
    );
    expect(manifest.unresolvedEnvironmentKeys).toEqual([]);
    expect(manifest.jwfOnlyOperationKeys).toEqual(JWF_ONLY_OPERATION_KEYS);
    expect(manifest.jwfOnlyOperationKeys.length).toBe(50);
    expect(manifest.packageFiles).toEqual(
      expect.arrayContaining([
        "tools/jww-manifest-validate.mjs",
        "src/jww/arcGeometry.js",
        "src/jww/arcGeometry.test.js",
        "docs/JWW_ELLIPSE_ARC_EVIDENCE.md",
      ])
    );
    expect(validateGatewayManifest(manifest)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("reports missing output contract and unresolved key information", () => {
    const manifest = validManifest();
    manifest.outputFormat.schema = "wrong.json";
    manifest.capabilities.jwwWrite = false;
    manifest.unresolvedEnvironmentKeys = ["LTYPE_HC"];
    manifest.jwfOnlyOperationKeys = ["LTYPE_HC"];

    const result = validateGatewayManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "outputFormat.schema",
        "capabilities.jwwWrite",
        "unresolvedEnvironmentKeys",
        "jwfOnlyOperationKeys",
      ])
    );
  });

  it("validates manifests through the CLI", () => {
    const manifest = validManifest();

    const result = runManifestValidator(manifest);

    expect(result.status).toBe(0);
    expect(result.output.valid).toBe(true);
    expect(result.output.errors).toEqual([]);
  });

  it("returns CLI errors for invalid manifests", () => {
    const manifest = validManifest();
    manifest.capabilities.jwwWrite = false;
    manifest.unresolvedEnvironmentKeys = ["UNEXPECTED"];
    manifest.packageFiles = [];
    manifest.commands = ["convert"];
    manifest.binaries = ["jww-gateway"];

    const result = runManifestValidator(manifest);

    expect(result.status).toBe(1);
    expect(result.output.valid).toBe(false);
    expect(result.output.errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "capabilities.jwwWrite",
        "unresolvedEnvironmentKeys",
        "packageFiles",
        "commands",
        "binaries",
      ])
    );
  });

  it("checks packageFiles through the CLI when requested", () => {
    const manifest = validManifest();

    const result = runManifestValidator(manifest, {
      checkFiles: true,
      files: packageRequiredFiles(),
    });

    expect(result.status).toBe(0);
    expect(result.output.valid).toBe(true);
    expect(result.output.missingFiles).toEqual([]);
  });

  it("reports missing packageFiles through the CLI when requested", () => {
    const manifest = validManifest({
      packageFiles: ["package.json", "tools/missing.mjs"],
    });

    const result = runManifestValidator(manifest, {
      checkFiles: true,
      files: ["package.json"],
    });

    expect(result.status).toBe(1);
    expect(result.output.valid).toBe(false);
    expect(result.output.missingFiles).toEqual(["tools/missing.mjs"]);
  });

  it("tracks required standalone package files", () => {
    expect(packageRequiredFiles()).toEqual(
      expect.arrayContaining([
        "JWW_GATEWAY_MANIFEST.json",
        "JWW_GATEWAY_HANDOFF.md",
        "jww-gateway-convert.cmd",
        "jww-gateway-coverage.cmd",
        "jww-gateway-coverage-summary.cmd",
        "jww-gateway-core-open-summary.cmd",
        "jww-gateway-diagnose.cmd",
        "jww-gateway-diff.cmd",
        "jww-gateway-env-scan.cmd",
        "jww-gateway-jwf-compare.cmd",
        "jww-gateway-jwf-parse.cmd",
        "jww-gateway-jwf-value-scan.cmd",
        "jww-gateway-layer-defaults-audit.cmd",
        "jww-gateway-layer-defaults-summary.cmd",
        "jww-gateway-sample-plan.cmd",
        "jww-gateway-special-color-audit.cmd",
        "jww-gateway-special-color-summary.cmd",
        "jww-gateway-status.cmd",
        "jww-gateway-validate.cmd",
        "jww-gateway-verify-all.cmd",
        "jww-gateway-verify-diff.cmd",
        "jww-gateway-verify-handoff.cmd",
        "jww-gateway-open-items.cmd",
        "jww-gateway-report-index.cmd",
        "jww-gateway-verify-report.cmd",
        "tools/jww-manifest-validate.mjs",
        "tools/jww-gateway-status.mjs",
        "docs/jww-gateway-manifest.schema.json",
        "docs/JWW_GATEWAY_RELEASE_CHECKLIST.md",
        "docs/JWW_NATIVE_API.md",
        "src/jww/index.js",
        "src/jww/native.js",
        "src/jww/native.test.js",
        "docs/JWW_GATEWAY_RELEASE_NOTES.md",
        "docs/JWW_GATEWAY_REPORTS.md",
        "docs/JWW_GATEWAY_HANDOFF.md",
        "docs/JWW_GATEWAY_WINDOWS_COMMANDS.md",
        "docs/JWW_GATEWAY_SAMPLE_SETS.example.json",
        "docs/JWW_GATEWAY_SAMPLE_SETS.local.json",
        "docs/jww-gateway-sample-sets.schema.json",
        "samples/jwf-pairs/jwf-open-items-core.jww",
        "samples/jwf-pairs/jwf-open-items-layer-defaults.jwf",
        "src/jww/gatewayManifest.js",
        "src/jww/gatewayPackageFiles.js",
        "src/jww/testHarness.js",
        "src/jww/parser.test.js",
        "src/jww/jwf.test.js",
        "src/jww/jwfFixturePairs.test.js",
        "src/jww/valueScanSummary.js",
        "src/jww/valueScanSummary.test.js",
        "src/jww/layerDefaultsSummary.js",
        "src/jww/layerDefaultsSummary.test.js",
        "tools/jww-value-scan-summary.mjs",
        "tools/jww-layer-defaults-summary.mjs",
        "tools/jww-special-color-audit.mjs",
        "tools/jww-special-color-summary.mjs",
        "tools/jww-sample-plan.mjs",
        "tools/jww-gateway-open-items.mjs",
        "tools/jww-gateway-report-index.mjs",
        "tools/jww-gateway-verify-report.mjs",
        "tools/jww-gateway-verify-report-diff.mjs",
        "reports/.gitkeep",
        "reports/README.md",
      ])
    );
  });

  it("keeps the published JSON schema aligned with required commands and files", () => {
    const schema = JSON.parse(readFileSync(manifestSchemaFile, "utf8"));

    expect(schema.required).toEqual(
      expect.arrayContaining(["manifestSchema", "handoff"])
    );
    expect(schema.properties.commands.items.enum).toEqual(
      expect.arrayContaining([
        "verify",
        "coverage",
        "coverage:summary",
        "layer-defaults:audit",
        "layer-defaults:summary",
        "special-color:audit",
        "special-color:summary",
        "sample:plan",
        "open-items",
        "reports:index",
        "status",
        "verify:report",
        "verify:reports",
        "verify:all",
        "verify:handoff",
        "value-scan:summary",
      ])
    );
    expect(schema.properties.binaries.items.enum).toEqual(
      expect.arrayContaining([
        "jww-manifest-validate",
        "jww-coverage",
        "jww-coverage-summary",
        "jww-layer-defaults-audit",
        "jww-layer-defaults-summary",
        "jww-special-color-audit",
        "jww-special-color-summary",
        "jww-sample-plan",
        "jww-gateway-open-items",
        "jww-gateway-report-index",
        "jww-gateway-status",
        "jww-gateway-verify-report",
        "jww-gateway-verify-report-diff",
        "jww-value-scan-summary",
      ])
    );
    expect(
      schema.properties.packageFiles.allOf.some(
        (entry) => entry.contains?.const === "reports/.gitkeep"
      )
    ).toBe(true);
    expect(
      schema.properties.packageFiles.allOf.some(
        (entry) => entry.contains?.const === "reports/README.md"
      )
    ).toBe(true);
    expect(schema.properties.handoff.properties.entrypoint.const).toBe(
      "JWW_GATEWAY_HANDOFF.md"
    );
    expect(schema.required).toEqual(expect.arrayContaining(["openItems"]));
  });

  it("builds a sample verification plan through the CLI", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "jww-sample-plan-"));
    const jww = path.join(folder, "sample.jww");
    const jwf = path.join(folder, "sample.jwf");
    const manifest = path.join(folder, "samples.json");
    writeFileSync(jww, "jww", "utf8");
    writeFileSync(jwf, "jwf", "utf8");
    writeFileSync(
      manifest,
      JSON.stringify({
        samples: [{ name: "Sample", jww, jwf, tags: ["fixture"] }],
      }),
      "utf8"
    );

    const result = spawnSync(
      process.execPath,
      ["--no-warnings", samplePlanScript, manifest, "--json", "--strict"],
      { encoding: "utf8" }
    );
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(output.valid).toBe(true);
    expect(output.counts.samples).toBe(1);
    expect(output.counts.plannedCommands).toBeGreaterThan(3);
    expect(output.counts.aggregateCommands).toBe(4);
    expect(output.samples[0].commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: "core-open" }),
        expect.objectContaining({ purpose: "layer-defaults" }),
      ])
    );
    expect(output.aggregateCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: "coverage-summary" }),
        expect.objectContaining({ purpose: "special-color-summary" }),
      ])
    );
  });

  it("reports sample manifest validation errors through the CLI", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "jww-sample-plan-invalid-"));
    const manifest = path.join(folder, "samples.json");
    writeFileSync(
      manifest,
      JSON.stringify({
        format: "jww-gateway-sample-sets",
        samples: [{ name: "Invalid", tags: ["fixture"] }],
      }),
      "utf8"
    );

    const result = spawnSync(
      process.execPath,
      ["--no-warnings", samplePlanScript, manifest, "--json"],
      { encoding: "utf8" }
    );
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(output.valid).toBe(false);
    expect(output.manifest.valid).toBe(false);
    expect(output.counts.validationErrors).toBe(1);
    expect(output.manifest.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "samples[0].jww" }),
      ])
    );
  });

  it("builds an open-items report through the CLI", () => {
    const manifest = validManifest();
    const file = writeManifest(manifest, packageRequiredFiles());

    const result = spawnSync(
      process.execPath,
      ["--no-warnings", openItemsScript, file, "--json"],
      { encoding: "utf8" }
    );
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(output.format).toBe("jww-gateway-open-items");
    expect(output.manifestFile).toBe("JWW_GATEWAY_MANIFEST.json");
    expect(path.isAbsolute(output.manifestFile)).toBe(false);
    expect(output.counts.total).toBe(1);
    expect(output.counts.byClassification["independent-v600-samples"]).toBe(1);
    expect(output.openItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "jww-version-conformance",
          releaseDecision: expect.stringContaining("version-wide"),
        }),
      ])
    );
    expect(output.openItems.map((item) => item.id)).not.toEqual(
      expect.arrayContaining(["jww-write", "LTYPE_HC", "LCOLLOR_M"])
    );
  });

  it("builds a report index through the CLI", () => {
    const manifest = validManifest();
    const manifestFile = writeManifest(manifest, packageRequiredFiles());
    const folder = path.dirname(manifestFile);
    mkdirSync(path.join(folder, "reports"), { recursive: true });
    writeFileSync(
      path.join(folder, "reports", "verify-report.html"),
      "<html></html>",
      "utf8"
    );

    const result = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        reportIndexScript,
        "--root",
        folder,
        "--json",
      ],
      { encoding: "utf8" }
    );
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(output.format).toBe("jww-gateway-report-index");
    expect(output.reportsDir).toBe("reports");
    expect(path.isAbsolute(output.reportsDir)).toBe(false);
    expect(output.counts.availableGroups).toBeGreaterThan(0);
    expect(output.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "verify-report", available: true }),
      ])
    );
  });

  it("builds a handoff verify report through the CLI", () => {
    const manifest = validManifest();

    const result = runVerifyReport(manifest, {
      files: packageRequiredFiles(),
      json: true,
    });
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(output.valid).toBe(true);
    expect(output.manifestFile).toBe("JWW_GATEWAY_MANIFEST.json");
    expect(path.isAbsolute(output.manifestFile)).toBe(false);
    expect(output.manifestGeneratedAt).toBe("2026-05-13T00:00:00.000Z");
    expect(output.manifestSchema).toBe("docs/jww-gateway-manifest.schema.json");
    expect(output.counts.missingFiles).toBe(0);
    expect(output.counts.missingScripts).toBe(0);
    expect(output.counts.missingBins).toBe(0);
    expect(output.counts.openItems).toBe(1);
    expect(output.fileInventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "package.json",
          bytes: expect.any(Number),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      ])
    );
    expect(output.unresolvedEnvironmentKeys).toEqual([]);
    expect(output.jwfOnlyOperationKeys).toEqual(JWF_ONLY_OPERATION_KEYS);
    expect(output.handoff.entrypoint).toBe("JWW_GATEWAY_HANDOFF.md");
  });

  it("prints a compact package status through the CLI", () => {
    const manifest = validManifest();

    const result = runStatus(manifest, {
      files: packageRequiredFiles(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("JWW Gateway Status");
    expect(result.stdout).toContain("Ready: yes");
    expect(result.stdout).toContain(
      "Manifest schema: docs/jww-gateway-manifest.schema.json"
    );
    expect(result.stdout).toContain("Handoff: JWW_GATEWAY_HANDOFF.md");
    expect(result.stdout).toContain("Verify: npm run verify:handoff");
    expect(result.stdout).toContain("Open items: npm run open-items");
    expect(result.stdout).toContain("Report index: npm run reports:index");
    expect(result.stdout).toContain("Known open items:");
    expect(result.stdout).toContain("Unresolved: none");
    expect(result.stdout).toContain(
      "JWF-only operation keys: LTYPE_HC, LCOLLOR_M"
    );
    expect(result.stdout).toContain("LAYCOL_0");
    expect(result.stdout).toContain("LAYWID_F");
    expect(result.stdout).toContain("LAYTYP_F");
  });

  it("reports script mismatches in the handoff verify report", () => {
    const manifest = validManifest();

    const result = runVerifyReport(manifest, {
      files: packageRequiredFiles(),
      json: true,
      packageJson: packageJsonForManifest({
        commands: REQUIRED_GATEWAY_COMMANDS.filter(
          (command) => command !== "verify:report"
        ),
      }),
    });
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(output.valid).toBe(false);
    expect(output.missingScripts).toEqual(["verify:report"]);
  });

  it("can gate that no unresolved keys remain in the handoff verify report", () => {
    const manifest = validManifest();

    const result = runVerifyReport(manifest, {
      files: packageRequiredFiles(),
      json: true,
      expectNoUnresolved: true,
      mutateManifest: (value) => {
        value.unresolvedEnvironmentKeys = ["UNEXPECTED"];
      },
    });
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(output.valid).toBe(false);
    expect(output.unresolvedExpectation).toEqual(
      expect.objectContaining({
        checked: true,
        expected: [],
        missing: [],
        unexpected: ["UNEXPECTED"],
      })
    );
  });

  it("formats a handoff verify report as HTML", () => {
    const manifest = validManifest();

    const result = runVerifyReport(manifest, {
      files: packageRequiredFiles(),
      html: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("<title>JWW Gateway Verify Report</title>");
    expect(result.stdout).toContain("Manifest schema");
    expect(result.stdout).toContain("JWW_GATEWAY_HANDOFF.md");
    expect(result.stdout).toContain("JWF-only operation keys");
    expect(result.stdout).toContain("LTYPE_HC, LCOLLOR_M");
    expect(result.stdout).toContain("File Inventory");
    expect(result.stdout).toContain("package.json");
  });

  it("formats a handoff verify report inventory as CSV", () => {
    const manifest = validManifest();

    const result = runVerifyReport(manifest, {
      files: packageRequiredFiles(),
      csv: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"file","bytes","sha256","missing"');
    expect(result.stdout).toContain('"package.json"');
  });

  it("diffs handoff verify report inventories", () => {
    const before = {
      fileInventory: [
        { file: "package.json", bytes: 10, sha256: "a" },
        { file: "README.md", bytes: 20, sha256: "b" },
      ],
    };
    const after = {
      fileInventory: [
        { file: "package.json", bytes: 12, sha256: "c" },
        { file: "README.ja.md", bytes: 30, sha256: "d" },
      ],
    };

    const result = runVerifyReportDiff(before, after, { json: true });
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(output.counts).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      unchanged: 0,
    });
    expect(output.changed[0].file).toBe("package.json");
  });

  it("can allow handoff verify report differences for report generation", () => {
    const before = {
      fileInventory: [{ file: "package.json", bytes: 10, sha256: "a" }],
    };
    const after = {
      fileInventory: [{ file: "package.json", bytes: 12, sha256: "b" }],
    };

    const result = runVerifyReportDiff(before, after, {
      json: true,
      allowDifferences: true,
    });
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(output.counts.changed).toBe(1);
  });

  it("formats handoff verify report diffs as CSV", () => {
    const before = {
      fileInventory: [{ file: "package.json", bytes: 10, sha256: "a" }],
    };
    const after = {
      fileInventory: [{ file: "package.json", bytes: 12, sha256: "b" }],
    };

    const result = runVerifyReportDiff(before, after, {
      csv: true,
      allowDifferences: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '"status","file","beforeBytes","afterBytes","beforeSha256","afterSha256"'
    );
    expect(result.stdout).toContain('"changed","package.json","10","12"');
  });
});
