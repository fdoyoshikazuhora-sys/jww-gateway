import {
  JWF_ONLY_OPERATION_KEYS as JWF_ONLY_KEYS_FROM_JWF,
} from "./jwf.js";

export const GATEWAY_MANIFEST_FORMAT = "jww-gateway-package-manifest";
export const GATEWAY_MANIFEST_VERSION = 1;
export const GATEWAY_MANIFEST_SCHEMA = "docs/jww-gateway-manifest.schema.json";
export const GATEWAY_OUTPUT_SCHEMA = "docs/jww-gateway-json.schema.json";
export const GATEWAY_HANDOFF_ENTRY = "JWW_GATEWAY_HANDOFF.md";
export const GATEWAY_SAMPLE_SETS_SCHEMA =
  "docs/jww-gateway-sample-sets.schema.json";
export const GATEWAY_SAMPLE_SETS_EXAMPLE =
  "docs/JWW_GATEWAY_SAMPLE_SETS.example.json";
export const GATEWAY_OUTPUT_FORMAT = "jww-gateway-json";
export const GATEWAY_OUTPUT_FORMAT_VERSION = 1;
export const SUPPORTED_JWW_ENCODINGS = [
  "shift_jis",
  "utf-8",
  "utf-16le",
  "utf-16be",
];
export const UNRESOLVED_ENVIRONMENT_KEYS = [];
export const JWF_ONLY_OPERATION_KEYS = [...JWF_ONLY_KEYS_FROM_JWF];
export const GATEWAY_OPEN_ITEMS = [
  {
    id: "jww-version-conformance",
    status: "external-sample-blocked",
    category: "compatibility",
    classification: "independent-v600-samples",
    conversionImpact:
      "bounded v600/v700, generated-fixture Jw_cad 6.20 Save As/reload including one intentional LINE edit, and public legacy-source v214/v351 to v600 DIMENSION/BLOCK/IMAGE conversion evidence are established; independently authored v600 ARC/CIRCLE/LINE/SOLID/TEXT parser evidence is established, while independently distributed native-v600 DIMENSION/BLOCK/IMAGE remain unverified",
    releaseDecision:
      "claim only the recorded Jw_cad 10.02.1, bounded v600/v700, generated-fixture Jw_cad 6.20, and public legacy-source Jw_cad 6.20 conversion/reload results including the recorded normalizations; do not claim version-wide compatibility or independently authored/distributed native-v600 DIMENSION/BLOCK/IMAGE coverage",
    title: "JWW version and entity conformance corpus",
    detail:
      "Fifteen Jw_cad-installed v600 samples totaling 22,624 drawing entities parse cleanly and survive Gateway template rewrites with drawing and document semantic equality. A public GitHub mirror in KEINOS/Jw_cad-for-Mac contains byte-identical copies of all fifteen files; a separate Gateway scan again reports internal version 600 with zero unsupported or skipped records. This makes the installed-sample baseline publicly reproducible, but the mirrored files remain the same standard sample set. Two independently authored Matrix vehicle drawings published in 2008 and 2009 were retrieved from the public distributor with archive MD5 values matching the published checksums. Gateway identifies both as internal version 600 and parses their combined 2,267 ARC/CIRCLE/LINE records with zero unsupported or skipped records. Eleven independently authored Meiji-maru drawings published by Tokyo University of Marine Science and Technology use internal version 600 with runtime-class schema 700 and parse 48,974 ARC/CIRCLE/LINE/SOLID/TEXT records with zero unsupported or skipped records after decoupling the class schema from the document version. The Matrix and university sets total 51,241 independently authored v600 records. Jw_cad 10.02.1 opened, edited, saved, and reopened the representative standard-sample Gateway output. An actual Jw_cad 6.20 runtime in a dedicated VM opened, separately saved, and reopened generated v600 DIMENSION, BLOCK/INSERT, and external IMAGE-reference fixtures; every output was non-empty and parser-clean, while Jw_cad 6.20 applied the recorded DIMENSION text-endpoint/settings, BLOCK definition-number, and IMAGE pen-color/text-endpoint normalizations. A separate generated DIMENSION-fixture cycle added one LINE, saved a 16,460-byte parser-clean v600 file, isolated the intended LINE from Jw_cad 6.20 normalization, and reloaded visibly. Public HinoADO v351 DIMENSION and Shirai v214 BLOCK/IMAGE samples were also opened in Jw_cad 6.20, saved as 130,490-byte, 49,087-byte, and 14,765-byte internal-v600 outputs, parsed with zero loss, and reopened from disk. Entity counts stayed stable while Jw_cad populated DIMENSION helper defaults, BLOCK/TEXT pen widths and raw-name metadata, and IMAGE/TEXT pen widths. The IMAGE absolute-path reference frame reloaded, but bitmap pixels did not because the historical G: path was unavailable. These public legacy-source conversions strengthen real-content coverage but are not files independently authored or distributed as native v600. Independently authored/distributed native-v600 DIMENSION, BLOCK/INSERT, and IMAGE records remain unavailable.",
    evidence:
      "JWW_VERSION_CONFORMANCE_EVIDENCE.md separates installed-sample, byte-identical public-mirror, independently authored Matrix parser evidence, and independently authored university parser evidence including the document-version/runtime-class-schema distinction; generated entity-family coverage; Jw_cad 10.02.1 GUI evidence; Jw_cad 6.20 generated-fixture Save As/reload and intentional LINE-edit evidence; public legacy-source v214/v351 to v600 conversion/reload evidence; automatic normalizations; and the remaining independently authored native-v600 entity-family boundary.",
    nextAction:
      "Obtain non-private independently authored/distributed files that were already internal v600 before the current test and contain DIMENSION, BLOCK/INSERT, and IMAGE, then record parser, visual, Save As, semantic-diff, and Jw_cad 6.20 reload evidence without treating generated fixtures, public legacy-source conversions, or mirrored standard samples as native-v600 independent-author evidence.",
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
  "conformance",
  "write",
  "semantic:diff",
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
  "verify:conformance",
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
  "jww-conformance",
  "jww-writer",
  "jww-semantic-diff",
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
  "conformanceAudit",
  "semanticDiff",
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
  "nativeOpen",
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
      conformanceAudit: true,
      semanticDiff: true,
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
      nativeOpen: true,
      jwwWrite: true,
    },
    unresolvedEnvironmentKeys: [...UNRESOLVED_ENVIRONMENT_KEYS],
    jwfOnlyOperationKeys: [...JWF_ONLY_OPERATION_KEYS],
    openItems: GATEWAY_OPEN_ITEMS.map((item) => ({ ...item })),
    notes: [
      "JWW write is limited to internal versions 600 and 700 and supported entities; unsupported entity types fail by default.",
      "Jw_cad 10.02.1 reopened and edited a v700 Gateway file containing every supported entity family; the normalized Gateway rewrite was byte-identical before the intended edit.",
      "JWW text decoration raw controls, special runs, and segments survive Gateway JSON and native rebuild write paths; visual overprint is a downstream renderer responsibility.",
      "LTYPE_HC, LCOLLOR_M, and LAYCOL/LAYWID/LAYTYP_0..F are resolved as JWF-only operation/default settings and are not serialized into JWW.",
      "Tilted circles and ellipse arcs expose parameter-preserving render geometry and exact bounds; Jw_cad 10.02.1 reopened and resaved the targeted v700 fixture without drawing differences.",
      "Open items include classification, conversion impact, evidence, and release decision fields so missing independent v600 sample evidence is not mistaken for current-version parser loss.",
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
  if (capabilities.jwwWrite !== true) {
    addError(errors, "capabilities.jwwWrite", "must be true");
  }

  if (manifest.unresolvedEnvironmentKeys?.length) {
    addError(errors, "unresolvedEnvironmentKeys", "must be empty");
  }
  for (const key of JWF_ONLY_OPERATION_KEYS) {
    if (!manifest.jwfOnlyOperationKeys?.includes(key)) {
      addError(errors, "jwfOnlyOperationKeys", `must include ${key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
