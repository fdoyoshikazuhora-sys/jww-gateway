function basename(value) {
  return (
    String(value || "")
      .split(/[\\/]/)
      .pop() || ""
  );
}

function countInto(target, key) {
  const value = key || "-";
  target[value] = (target[value] || 0) + 1;
}

function matchCount(row) {
  return (row.matches || []).reduce(
    (total, match) => total + (match.offsets?.length || 0),
    0
  );
}

export function compactValueScanRow(report, row) {
  return {
    source: basename(report.sources?.jww),
    jwf: basename(report.sources?.jwf),
    key: row.key,
    family: row.family || "-",
    scope: row.definition?.scope || "unknown",
    status: row.status,
    gatewayStatus: row.gatewayStatus || "not-tracked",
    reason: row.reason || "",
    values: row.values || [],
    testedKinds: (row.testedPatterns || []).map((pattern) => pattern.kind),
    matchKinds: (row.matches || []).map((match) => match.kind),
    matchCount: matchCount(row),
  };
}

export function buildValueScanSummary(inputs, rows) {
  const byStatus = {};
  const byFamilyStatus = {};
  const byKey = {};
  const promotionCandidates = [];

  for (const row of rows) {
    countInto(byStatus, row.status);

    const family = row.family || "-";
    if (!byFamilyStatus[family]) byFamilyStatus[family] = {};
    countInto(byFamilyStatus[family], row.status);

    if (!byKey[row.key]) {
      byKey[row.key] = {
        total: 0,
        matched: 0,
        missing: 0,
        ambiguous: 0,
        notScanned: 0,
        gatewayExtracted: 0,
        gatewayMissing: 0,
      };
    }
    const keyCounts = byKey[row.key];
    keyCounts.total += 1;
    if (row.status === "not-scanned") keyCounts.notScanned += 1;
    else keyCounts[row.status] = (keyCounts[row.status] || 0) + 1;
    if (row.gatewayStatus === "extracted") keyCounts.gatewayExtracted += 1;
    if (row.gatewayStatus === "missing") keyCounts.gatewayMissing += 1;

    if (row.status === "matched" && row.gatewayStatus !== "extracted") {
      promotionCandidates.push(row);
    }
  }

  return {
    format: "jww-value-scan-summary",
    sources: inputs,
    counts: {
      reports: inputs.length,
      rows: rows.length,
      promotionCandidates: promotionCandidates.length,
    },
    byStatus,
    byFamilyStatus,
    byKey,
    promotionCandidates,
    rows,
  };
}

export function formatValueScanSummaryText(summary) {
  const lines = [
    "JWW Value Scan Summary",
    `Reports: ${summary.counts.reports}`,
    `Rows: ${summary.counts.rows}`,
    `Promotion candidates: ${summary.counts.promotionCandidates || 0}`,
    "",
    "Status:",
  ];

  for (const [status, count] of Object.entries(summary.byStatus || {})) {
    lines.push(`  ${status}: ${count}`);
  }

  lines.push("", "Families:");
  for (const [family, counts] of Object.entries(summary.byFamilyStatus || {})) {
    const entries = Object.entries(counts)
      .map(([status, count]) => `${status} ${count}`)
      .join(" / ");
    lines.push(`  ${family}: ${entries}`);
  }

  lines.push("", "Promotion Candidates:");
  if (!summary.promotionCandidates?.length) {
    lines.push("  none");
  } else {
    for (const row of summary.promotionCandidates) {
      lines.push(
        `  ${row.source} / ${row.jwf} / ${row.key}: ${row.reason || row.status}`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
