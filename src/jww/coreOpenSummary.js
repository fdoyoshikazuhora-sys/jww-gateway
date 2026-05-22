function basename(value) {
  return (
    String(value || "")
      .split(/[\\/]/)
      .pop() || ""
  );
}

export function compactCoreOpenRow(report, row) {
  const comparison = row.gatewayCandidateComparison || {};
  return {
    source: basename(report.sources?.jww),
    jwf: basename(report.sources?.jwf),
    key: row.key,
    status: row.status,
    values: row.values || [],
    directU32Match: comparison.directU32Match ?? null,
    directSpecialMatch: comparison.directSpecialMatch ?? null,
    expectedHex: comparison.expectedHex || null,
    candidateU32: comparison.candidateU32 || null,
    specialHexes: comparison.specialHexes || null,
  };
}

export function buildCoreOpenSummary(inputs, rows) {
  let directMatchTrue = 0;
  let directMatchFalse = 0;
  const byKey = rows.reduce((acc, row) => {
    if (!acc[row.key]) {
      acc[row.key] = {
        total: 0,
        missing: 0,
        matched: 0,
        directMatchTrue: 0,
        directMatchFalse: 0,
      };
    }
    const directMatch = row.directU32Match ?? row.directSpecialMatch;
    acc[row.key].total += 1;
    acc[row.key][row.status] = (acc[row.key][row.status] || 0) + 1;
    if (directMatch === true) {
      acc[row.key].directMatchTrue += 1;
      directMatchTrue += 1;
    }
    if (directMatch === false) {
      acc[row.key].directMatchFalse += 1;
      directMatchFalse += 1;
    }
    return acc;
  }, {});
  return {
    format: "jww-core-open-summary",
    sources: inputs,
    counts: {
      reports: inputs.length,
      rows: rows.length,
      directMatchTrue,
      directMatchFalse,
    },
    byKey,
    rows,
  };
}
