export const GATEWAY_MANIFEST_FORMAT = "jww-gateway-package-manifest";
export const GATEWAY_MANIFEST_VERSION = 1;
export const GATEWAY_MANIFEST_SCHEMA = "docs/jww-gateway-manifest.schema.json";
export const GATEWAY_OUTPUT_SCHEMA = "docs/cadstudio-jww-json.schema.json";
export const GATEWAY_HANDOFF_ENTRY = "JWW_GATEWAY_HANDOFF.md";
export const GATEWAY_SAMPLE_SETS_SCHEMA =
  "docs/jww-gateway-sample-sets.schema.json";
export const GATEWAY_SAMPLE_SETS_EXAMPLE =
  "docs/JWW_GATEWAY_SAMPLE_SETS.example.json";
export const GATEWAY_OUTPUT_FORMAT = "cadstudio-jww-json";
export const GATEWAY_OUTPUT_FORMAT_VERSION = 1;
export const SUPPORTED_JWW_ENCODINGS = [
  "shift_jis",
  "utf-8",
  "utf-16le",
  "utf-16be",
];
export const UNRESOLVED_ENVIRONMENT_KEYS = ["LTYPE_HC", "LCOLLOR_M"];
export const GATEWAY_OPEN_ITEMS = [
  {
    id: "jww-write",
    status: "not-supported",
    category: "output",
    classification: "separate-project",
    conversionImpact: "none for import; required only for round-trip JWW editing",
    releaseDecision: "not a release blocker for read-only Gateway",
    title: "JWW save/write",
    detail:
      "Gateway is read/import only. Editing results are exported as CAD Studio JSON and do not update the source JWW file.",
    evidence:
      "capabilities.jwwWrite is fixed to false and verify:handoff checks that the read-only contract is explicit.",
    nextAction:
      "Keep JWW write disabled until a separate writer format and round-trip test suite exist.",
  },
  {
    id: "LTYPE_HC",
    status: "sample-blocked",
    category: "jwf-environment",
    classification: "sample-blocked",
    conversionImpact:
      "low for current conversion; candidate bytes are retained for later comparison",
    releaseDecision: "keep open until direct matches repeat in real files",
    title: "Hatch/line type environment key",
    detail:
      "Candidate bytes after LTYPE_L4 are retained, but tested sample files do not directly match the JWF LTYPE_HC values.",
    evidence:
      "core-open summaries across current sample sets show matched 0 and direct-match false.",
    nextAction:
      "Review new real files that actively use this setting before promoting it to extracted coverage.",
  },
  {
    id: "LCOLLOR_M",
    status: "sample-blocked",
    category: "jwf-environment",
    classification: "sample-blocked",
    conversionImpact:
      "low for entity rendering; affects a JWF special/zoom text color rather than parsed entity colors",
    releaseDecision: "keep open until exact RGB matches repeat in real files",
    title: "Zoom text/special color environment key",
    detail:
      "Special color audits search nearby RGB triplets, but no stable direct match has been found yet.",
    evidence:
      "special-color audits found no direct LCOLLOR_M match in the current real-file set.",
    nextAction:
      "Promote only after direct matches repeat across real JWW/JWF pairs.",
  },
  {
    id: "LAYCOL_LAYWID_LAYTYP",
    status: "audit-only",
    category: "jwf-environment",
    classification: "audit-only",
    conversionImpact:
      "low for imported drawing display; entity-level color, width, and line type are already read",
    releaseDecision: "not promoted until a stable storage pattern is found",
    title: "Layer default color, width, and line type settings",
    detail:
      "Entity-level pen color, width, and style are read, but JWF layer default setting rows remain audit-only.",
    evidence:
      "layer-default summaries keep promotionCandidates at 0; non-zero M-08 layer defaults still do not direct-match.",
    nextAction:
      "Use layer-defaults audit/summary reports when new sample sets are added.",
  },
  {
    id: "jww-text-decoration-rendering",
    status: "downstream-renderer",
    category: "renderer",
    classification: "metadata-ready",
    conversionImpact:
      "medium visual-fidelity item; converted metadata exists but Gateway does not draw a view",
    releaseDecision: "not a parser blocker because decoration metadata is exported",
    title: "JWW text decoration overprint rendering",
    detail:
      "Special text runs and decoration segments are preserved as metadata, but exact visual overprint reproduction is not implemented in Gateway.",
    evidence:
      "Gateway exports jwwSpecialRuns and jwwTextSegments for renderer-side overprint work.",
    nextAction:
      "Implement in the downstream renderer using jwwSpecialRuns and jwwTextSegments.",
  },
  {
    id: "tilted-ellipse-arc-comparison",
    status: "needs-samples",
    category: "geometry",
    classification: "sample-comparison",
    conversionImpact:
      "medium for rare complex arcs; source angles and diagnostics are preserved",
    releaseDecision: "not promoted further without confirmed before/after examples",
    title: "Tilted arcs and ellipse-like arcs",
    detail:
      "Arc source angles and diagnostics are retained, but complex tilted/ellipse-like cases still require real-file comparison.",
    evidence:
      "Current parser retains JWW and converted angles so future samples can be compared without changing the import contract.",
    nextAction:
      "Add targeted before/after diagnostics when more confirmed JWW examples are available.",
  },
  {
    id: "jwf-operation-settings",
    status: "not-required-for-conversion",
    category: "environment",
    classification: "out-of-scope-for-conversion",
    conversionImpact:
      "none for drawing import; useful only for complete Jw_cad environment persistence",
    releaseDecision: "track in audits but do not block Gateway release",
    title: "Operation-only JWF settings",
    detail:
      "Command, key assignment, clock menu, and other operation settings are tracked in audits but are outside drawing conversion.",
    evidence:
      "operation-scope value scans show no stable extraction candidates and these settings do not affect converted geometry.",
    nextAction:
      "Keep them visible in coverage reports; promote only if a connected app needs full environment persistence.",
  },
];
export const REQUIRED_PACKAGE_FILE_MARKERS = [
  "JWW_GATEWAY_MANIFEST.json",
  "tools/jww-manifest-validate.mjs",
  "docs/jww-gateway-manifest.schema.json",
  "src/jww/gatewayManifest.js",
  "src/jww/gatewayPackageFiles.js",
  "reports/README.md",
];

export const REQUIRED_GATEWAY_COMMANDS = [
  "convert",
  "coverage",
  "coverage:summary",
  "diagnose",
  "diff",
  "validate",
  "env:scan",
  "jwf:parse",
  "jwf:compare",
  "jwf:value-scan",
  "layer-defaults:audit",
  "layer-defaults:summary",
  "special-color:audit",
  "special-color:summary",
  "value-scan:summary",
  "core:summary",
  "sample:plan",
  "open-items",
  "reports:index",
  "manifest:validate",
  "status",
  "verify:report",
  "verify:reports",
  "verify:diff",
  "verify:handoff",
  "smoke",
  "verify",
  "verify:all",
];

export const REQUIRED_GATEWAY_BINARIES = [
  "jww-gateway",
  "jww-coverage",
  "jww-coverage-summary",
  "jww-diagnostics",
  "jww-diagnostics-diff",
  "jww-schema-validate",
  "jww-env-scan",
  "jwf-parse",
  "jww-jwf-compare",
  "jww-jwf-value-scan",
  "jww-layer-defaults-audit",
  "jww-layer-defaults-summary",
  "jww-special-color-audit",
  "jww-special-color-summary",
  "jww-value-scan-summary",
  "jww-core-open-summary",
  "jww-sample-plan",
  "jww-gateway-open-items",
  "jww-gateway-report-index",
  "jww-manifest-validate",
  "jww-gateway-status",
  "jww-gateway-verify-report",
  "jww-gateway-verify-report-diff",
];

export const REQUIRED_GATEWAY_CAPABILITIES = [
  "convert",
  "coverage",
  "coverageSummary",
  "diagnose",
  "diagnosticsDiff",
  "schemaValidate",
  "environmentScan",
  "jwfParse",
  "jwfCompare",
  "jwfValueScan",
  "layerDefaultsAudit",
  "layerDefaultsSummary",
  "specialColorAudit",
  "specialColorSummary",
  "valueScanSummary",
  "promotionCandidateGate",
  "coreOpenSummary",
  "samplePlan",
  "openItemsReport",
  "reportIndex",
  "jwwWrite",
];

export function buildGatewayManifest({
  packageName,
  packageVersion,
  commands,
  binaries,
  packageFiles = [],
  generatedAt = new Date().toISOString(),
}) {
  return {
    format: GATEWAY_MANIFEST_FORMAT,
    formatVersion: GATEWAY_MANIFEST_VERSION,
    generatedAt,
    packageName,
    packageVersion,
    commands: [...commands].sort(),
    binaries: [...binaries].sort(),
    packageFiles: [...packageFiles].sort(),
    supportedEncodings: [...SUPPORTED_JWW_ENCODINGS],
    outputFormat: {
      format: GATEWAY_OUTPUT_FORMAT,
      formatVersion: GATEWAY_OUTPUT_FORMAT_VERSION,
      schema: GATEWAY_OUTPUT_SCHEMA,
    },
    manifestSchema: GATEWAY_MANIFEST_SCHEMA,
    handoff: {
      entrypoint: GATEWAY_HANDOFF_ENTRY,
      releaseChecklist: "docs/JWW_GATEWAY_RELEASE_CHECKLIST.md",
      sampleSetsExample: GATEWAY_SAMPLE_SETS_EXAMPLE,
      sampleSetsSchema: GATEWAY_SAMPLE_SETS_SCHEMA,
      verifyCommand: "npm run verify:handoff",
      samplePlanCommand:
        "npm run sample:plan -- docs\\JWW_GATEWAY_SAMPLE_SETS.example.json --html -o reports\\sample-plan.html",
      openItemsCommand:
        "npm run open-items -- --html -o reports\\open-items.html",
      reportIndexCommand:
        "npm run reports:index -- --html -o reports\\index.html",
    },
    capabilities: {
      convert: true,
      coverage: true,
      coverageSummary: true,
      diagnose: true,
      diagnosticsDiff: true,
      schemaValidate: true,
      environmentScan: true,
      jwfParse: true,
      jwfCompare: true,
      jwfValueScan: true,
      layerDefaultsAudit: true,
      layerDefaultsSummary: true,
      specialColorAudit: true,
      specialColorSummary: true,
      valueScanSummary: true,
      promotionCandidateGate: true,
      coreOpenSummary: true,
      samplePlan: true,
      openItemsReport: true,
      reportIndex: true,
      jwwWrite: false,
    },
    unresolvedEnvironmentKeys: [...UNRESOLVED_ENVIRONMENT_KEYS],
    openItems: GATEWAY_OPEN_ITEMS.map((item) => ({ ...item })),
    notes: [
      "JWW save/write is not supported.",
      "LTYPE_HC and LCOLLOR_M remain unresolved until real files show stable direct matches.",
      "Open items include classification, conversion impact, evidence, and release decision fields so sample-blocked research is not mistaken for a release blocker.",
    ],
  };
}

function addError(errors, path, message) {
  errors.push({ path, message });
}

function expectStringArray(errors, path, value) {
  if (!Array.isArray(value)) {
    addError(errors, path, "must be an array");
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string") {
      addError(errors, `${path}[${index}]`, "must be a string");
    }
  });
}

export function validateGatewayManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    addError(errors, "$", "must be an object");
    return { valid: false, errors };
  }

  if (manifest.format !== GATEWAY_MANIFEST_FORMAT) {
    addError(errors, "format", `must be ${GATEWAY_MANIFEST_FORMAT}`);
  }
  if (manifest.formatVersion !== GATEWAY_MANIFEST_VERSION) {
    addError(errors, "formatVersion", `must be ${GATEWAY_MANIFEST_VERSION}`);
  }
  if (typeof manifest.generatedAt !== "string" || !manifest.generatedAt) {
    addError(errors, "generatedAt", "must be a non-empty string");
  }
  if (typeof manifest.packageName !== "string" || !manifest.packageName) {
    addError(errors, "packageName", "must be a non-empty string");
  }
  if (typeof manifest.packageVersion !== "string" || !manifest.packageVersion) {
    addError(errors, "packageVersion", "must be a non-empty string");
  }
  if (manifest.manifestSchema !== GATEWAY_MANIFEST_SCHEMA) {
    addError(errors, "manifestSchema", `must be ${GATEWAY_MANIFEST_SCHEMA}`);
  }
  if (!manifest.handoff || typeof manifest.handoff !== "object") {
    addError(errors, "handoff", "must be an object");
  } else {
    const requiredHandoff = {
      entrypoint: GATEWAY_HANDOFF_ENTRY,
      sampleSetsExample: GATEWAY_SAMPLE_SETS_EXAMPLE,
      sampleSetsSchema: GATEWAY_SAMPLE_SETS_SCHEMA,
      verifyCommand: "npm run verify:handoff",
      openItemsCommand: "npm run open-items -- --html -o reports\\open-items.html",
      reportIndexCommand:
        "npm run reports:index -- --html -o reports\\index.html",
    };
    for (const [key, expected] of Object.entries(requiredHandoff)) {
      if (manifest.handoff[key] !== expected) {
        addError(errors, `handoff.${key}`, `must be ${expected}`);
      }
    }
  }

  expectStringArray(errors, "commands", manifest.commands);
  expectStringArray(errors, "binaries", manifest.binaries);
  expectStringArray(errors, "packageFiles", manifest.packageFiles);
  expectStringArray(errors, "supportedEncodings", manifest.supportedEncodings);
  expectStringArray(
    errors,
    "unresolvedEnvironmentKeys",
    manifest.unresolvedEnvironmentKeys
  );
  if (!Array.isArray(manifest.openItems) || !manifest.openItems.length) {
    addError(errors, "openItems", "must be a non-empty array");
  } else {
    for (const [index, item] of manifest.openItems.entries()) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        addError(errors, `openItems[${index}]`, "must be an object");
        continue;
      }
      for (const key of ["id", "status", "category", "title", "detail"]) {
        if (typeof item[key] !== "string" || !item[key]) {
          addError(errors, `openItems[${index}].${key}`, "must be a string");
        }
      }
    }
  }

  for (const encoding of SUPPORTED_JWW_ENCODINGS) {
    if (!manifest.supportedEncodings?.includes(encoding)) {
      addError(errors, "supportedEncodings", `must include ${encoding}`);
    }
  }

  for (const command of REQUIRED_GATEWAY_COMMANDS) {
    if (!manifest.commands?.includes(command)) {
      addError(errors, "commands", `must include ${command}`);
    }
  }

  for (const binary of REQUIRED_GATEWAY_BINARIES) {
    if (!manifest.binaries?.includes(binary)) {
      addError(errors, "binaries", `must include ${binary}`);
    }
  }

  for (const file of REQUIRED_PACKAGE_FILE_MARKERS) {
    if (!manifest.packageFiles?.includes(file)) {
      addError(errors, "packageFiles", `must include ${file}`);
    }
  }

  const outputFormat = manifest.outputFormat || {};
  if (outputFormat.format !== GATEWAY_OUTPUT_FORMAT) {
    addError(errors, "outputFormat.format", `must be ${GATEWAY_OUTPUT_FORMAT}`);
  }
  if (outputFormat.formatVersion !== GATEWAY_OUTPUT_FORMAT_VERSION) {
    addError(
      errors,
      "outputFormat.formatVersion",
      `must be ${GATEWAY_OUTPUT_FORMAT_VERSION}`
    );
  }
  if (outputFormat.schema !== GATEWAY_OUTPUT_SCHEMA) {
    addError(errors, "outputFormat.schema", `must be ${GATEWAY_OUTPUT_SCHEMA}`);
  }

  const capabilities = manifest.capabilities || {};
  for (const capability of REQUIRED_GATEWAY_CAPABILITIES) {
    if (typeof capabilities[capability] !== "boolean") {
      addError(errors, `capabilities.${capability}`, "must be a boolean");
    }
  }
  if (capabilities.jwwWrite !== false) {
    addError(errors, "capabilities.jwwWrite", "must be false");
  }

  for (const key of UNRESOLVED_ENVIRONMENT_KEYS) {
    if (!manifest.unresolvedEnvironmentKeys?.includes(key)) {
      addError(errors, "unresolvedEnvironmentKeys", `must include ${key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
