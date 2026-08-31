function addStatusCount(target, key, status) {
  target[key] ||= {
    key,
    total: 0,
    missing: 0,
    matched: 0,
    ambiguous: 0,
    extracted: 0,
    reasons: {},
    valueSignatures: {},
    matchKinds: {},
    files: [],
  };
  target[key].total += 1;
  target[key][status] = (target[key][status] || 0) + 1;
}

function sourceLabel(report) {
  return report.sources?.jww || report.source || report.file || "";
}

function addRowEvidence(target, row) {
  const reason = row.reason || "";
  if (reason) {
    target.reasons[reason] = (target.reasons[reason] || 0) + 1;
  }
  const valueSignature = Array.isArray(row.values) ? row.values.join(",") : "";
  if (valueSignature) {
    target.valueSignatures[valueSignature] =
      (target.valueSignatures[valueSignature] || 0) + 1;
  }
  for (const kind of row.matchKinds || []) {
    target.matchKinds[kind] = (target.matchKinds[kind] || 0) + 1;
  }
}

function summarizeMap(map, limit = 3) {
  const entries = Object.entries(map || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "";
  return entries
    .slice(0, limit)
    .map(([key, count]) => `${key} (${count})`)
    .join("; ");
}

export function summarizeLayerDefaultsAudits(reports) {
  const byKey = {};
  const byFamily = {};
  let totalRows = 0;
  let promotionCandidates = 0;
  let directMatchCandidates = 0;
  let nonSerialized = 0;

  for (const report of reports) {
    const source = sourceLabel(report);
    totalRows += report.counts?.rows || 0;
    promotionCandidates += report.counts?.promotionCandidates || 0;
    directMatchCandidates += report.counts?.directMatchCandidates || 0;
    nonSerialized += report.counts?.nonSerialized || 0;
    for (const row of report.rows || []) {
      const status = row.status || "unknown";
      const family = row.family || "unknown";
      addStatusCount(byKey, row.key, status);
      byKey[row.key].family = family;
      byKey[row.key].gatewayStatus = row.gatewayStatus || "";
      byKey[row.key].nonSerializedJwfKey =
        row.nonSerializedJwfKey === true;
      addRowEvidence(byKey[row.key], row);
      if (source && !byKey[row.key].files.includes(source)) {
        byKey[row.key].files.push(source);
      }
      addStatusCount(byFamily, family, status);
      addRowEvidence(byFamily[family], row);
    }
  }

  const keys = Object.values(byKey).sort((a, b) => a.key.localeCompare(b.key));
  const alwaysMissing = keys.filter((row) => row.missing === reports.length);
  const withDirectMatches = keys.filter((row) => row.matched > 0);
  const mixed = keys.filter(
    (row) =>
      new Set(
        ["missing", "matched", "ambiguous", "extracted"].filter(
          (status) => row[status] > 0
        )
      ).size > 1
  );

  return {
    format: "jww-layer-defaults-summary",
    generatedAt: new Date().toISOString(),
    reportCount: reports.length,
    sourceFiles: reports.map(sourceLabel).filter(Boolean),
    counts: {
      keys: keys.length,
      rows: totalRows,
      alwaysMissing: alwaysMissing.length,
      withDirectMatches: withDirectMatches.length,
      mixed: mixed.length,
      nonSerialized,
      directMatchCandidates,
      promotionCandidates,
    },
    conclusion:
      totalRows > 0 && nonSerialized === totalRows
        ? "All audited LAYCOL/LAYWID/LAYTYP rows are JWF-only write-layer operation defaults and are not serialized into JWW."
        : promotionCandidates === 0 && directMatchCandidates === 0
        ? "No direct LAYCOL/LAYWID/LAYTYP promotion candidates were found across the audited reports."
        : "Review direct matches before promoting any LAYCOL/LAYWID/LAYTYP extraction.",
    byFamily: Object.values(byFamily).sort((a, b) =>
      a.key.localeCompare(b.key)
    ),
    byKey: keys.map((row) => ({
      ...row,
      reasonSummary: summarizeMap(row.reasons),
      valueSignatureSummary: summarizeMap(row.valueSignatures, 2),
      matchKindSummary: summarizeMap(row.matchKinds),
    })),
  };
}
