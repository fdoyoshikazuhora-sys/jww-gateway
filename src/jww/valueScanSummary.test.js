import {
  buildValueScanSummary,
  compactValueScanRow,
  formatValueScanSummaryText,
} from "./valueScanSummary.js";

describe("value scan summary", () => {
  it("compacts value scan rows for cross-file reports", () => {
    const row = compactValueScanRow(
      {
        sources: {
          jww: "C:\\samples\\A-11 仕上表.jww",
          jwf: "C:\\samples\\仕上げ表.JWF",
        },
      },
      {
        key: "S_STR2",
        family: "dimensions",
        definition: { scope: "document" },
        status: "ambiguous",
        gatewayStatus: "missing",
        reason: "low-information numeric sequence",
        values: [1, 0, 1, 1, 0],
        testedPatterns: [{ kind: "u16-sequence" }],
        matches: [{ kind: "u16-sequence", offsets: [10, 20] }],
      }
    );

    expect(row.source).toBe("A-11 仕上表.jww");
    expect(row.jwf).toBe("仕上げ表.JWF");
    expect(row.scope).toBe("document");
    expect(row.matchCount).toBe(2);
    expect(row.testedKinds).toEqual(["u16-sequence"]);
  });

  it("counts rows by status, family, and key", () => {
    const summary = buildValueScanSummary(
      ["a.json", "b.json"],
      [
        {
          key: "MSET",
          family: "text",
          status: "missing",
          gatewayStatus: "missing",
        },
        {
          key: "S_STR2",
          family: "dimensions",
          status: "ambiguous",
          gatewayStatus: "missing",
        },
        {
          key: "S_STR2",
          family: "dimensions",
          status: "not-scanned",
          gatewayStatus: "not-tracked",
        },
        {
          key: "ZF_SET",
          family: "other",
          status: "matched",
          gatewayStatus: "missing",
        },
        {
          key: "LTYPE_R1",
          family: "lineTypes",
          status: "matched",
          gatewayStatus: "extracted",
        },
      ]
    );

    expect(summary.counts).toEqual({
      reports: 2,
      rows: 5,
      promotionCandidates: 1,
    });
    expect(summary.byStatus).toEqual({
      missing: 1,
      ambiguous: 1,
      "not-scanned": 1,
      matched: 2,
    });
    expect(summary.byFamilyStatus.dimensions).toEqual({
      ambiguous: 1,
      "not-scanned": 1,
    });
    expect(summary.byKey.S_STR2).toEqual({
      total: 2,
      matched: 0,
      missing: 0,
      ambiguous: 1,
      notScanned: 1,
      gatewayExtracted: 0,
      gatewayMissing: 1,
    });
    expect(summary.promotionCandidates.map((row) => row.key)).toEqual([
      "ZF_SET",
    ]);
  });

  it("formats compact text output for verification gates", () => {
    const summary = buildValueScanSummary(
      ["a.json"],
      [
        {
          source: "a.jww",
          jwf: "a.jwf",
          key: "ZF_SET",
          family: "other",
          status: "matched",
          gatewayStatus: "missing",
          reason: "exact u16 sequence",
        },
        {
          source: "a.jww",
          jwf: "a.jwf",
          key: "MSET",
          family: "text",
          status: "missing",
          gatewayStatus: "missing",
        },
      ]
    );

    expect(formatValueScanSummaryText(summary)).toContain(
      "Promotion candidates: 1"
    );
    expect(formatValueScanSummaryText(summary)).toContain("  matched: 1");
    expect(formatValueScanSummaryText(summary)).toContain("  other: matched 1");
    expect(formatValueScanSummaryText(summary)).toContain(
      "  a.jww / a.jwf / ZF_SET: exact u16 sequence"
    );
  });
});
