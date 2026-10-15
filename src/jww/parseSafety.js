export function jwwParseIssues(diagnostics = {}) {
  const issues = [];
  if (diagnostics.unsupportedCount > 0) issues.push("unsupported records");
  if (diagnostics.skippedCount > 0) issues.push("skipped records");
  if (diagnostics.incompleteLists) issues.push("incomplete data lists");
  if (diagnostics.headerIssues?.length) issues.push("unverified document header");
  if (diagnostics.unverifiedValues?.length) issues.push("unverified entity values");
  if (diagnostics.embeddedImageTruncatedCount > 0 || diagnostics.embeddedImageIssues?.length) issues.push("incomplete embedded images");
  if (diagnostics.trailingByteLength > 0) issues.push("unparsed trailing bytes");
  return issues;
}

export function assertJwwParseSafe(diagnostics, allowUnsupported = false) {
  const issues = jwwParseIssues(diagnostics);
  if (issues.length && !allowUnsupported) {
    const error = new Error(`JWW conversion blocked: ${issues.join(", ")}. Use --allow-unsupported only after reviewing diagnostics.`);
    error.code = "JWW_UNSUPPORTED_SOURCE";
    throw error;
  }
  return issues;
}
