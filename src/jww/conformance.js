function finiteCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function inferRawEntityType(value = {}) {
  if (value.dimension_line) return "DIMENSION";
  if ("content" in value) return "TEXT";
  if ("point1_x" in value) return "SOLID";
  if ("center_x" in value) return value.is_full_circle ? "CIRCLE" : "ARC";
  if ("ref_x" in value && "def_number" in value) return "BLOCK";
  if ("is_temporary" in value && "x" in value && "y" in value) return "POINT";
  if ("start_x" in value && "end_x" in value) return "LINE";
  return "UNKNOWN";
}

function countEntityTypes(entities = []) {
  const counts = {};
  for (const entry of entities) {
    const value = entry?.value || entry || {};
    const type = String(
      value.type || entry?.type || inferRawEntityType(value)
    ).toUpperCase();
    counts[type] = (counts[type] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function assessParsedJww(doc = {}) {
  const diagnostics = doc.diagnostics || {};
  const unsupportedClasses = { ...(diagnostics.unsupportedClasses || {}) };
  const unsupportedCount = finiteCount(diagnostics.unsupportedCount);
  const skippedCount = finiteCount(diagnostics.skippedCount);
  const jwwVersion = Number.isFinite(Number(doc.version)) ? Number(doc.version) : 0;
  const entityTypes = countEntityTypes(doc.entities);
  const entityCount = Object.values(entityTypes).reduce((sum, count) => sum + count, 0);
  const readAssessment = !jwwVersion
    ? "invalid-or-unparsed"
    : unsupportedCount || skippedCount
      ? "parsed-with-reported-loss"
      : "parsed-without-reported-loss";

  return {
    jwwVersion,
    entityCount,
    entityTypes,
    unsupportedClasses,
    unsupportedCount,
    skippedCount,
    readAssessment,
    roundTripAssessment: "not-tested",
    exactCompatibility: false,
  };
}

export function buildConformanceReport(files = [], options = {}) {
  const versions = {};
  const readAssessments = {};
  for (const file of files) {
    const version = String(file.jwwVersion || "unknown");
    versions[version] = (versions[version] || 0) + 1;
    readAssessments[file.readAssessment] =
      (readAssessments[file.readAssessment] || 0) + 1;
  }
  return {
    format: "jww-gateway-conformance-report",
    formatVersion: 1,
    generatedAt: options.generatedAt || new Date().toISOString(),
    scope: {
      read: "parser diagnostics only",
      write: "separate bounded writer",
      roundTrip: "not tested by this command",
    },
    counts: {
      files: files.length,
      versions,
      readAssessments,
      filesWithReportedLoss: files.filter(
        (file) => file.readAssessment === "parsed-with-reported-loss"
      ).length,
    },
    files,
  };
}
