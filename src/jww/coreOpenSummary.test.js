import { buildCoreOpenSummary, compactCoreOpenRow } from "./coreOpenSummary.js";

describe("core open summary", () => {
  it("compacts LTYPE_HC comparison rows", () => {
    const row = compactCoreOpenRow(
      {
        sources: {
          jww: "C:\\samples\\A-00 断面図.jww",
          jwf: "C:\\samples\\断面図.JWF",
        },
      },
      {
        key: "LTYPE_HC",
        status: "missing",
        values: [1, 1, 0, 2, 1, 0],
        gatewayCandidateComparison: {
          directU32Match: false,
          candidateU32: [0, 1, 2, 1, 0, 0],
        },
      }
    );

    expect(row.source).toBe("A-00 断面図.jww");
    expect(row.jwf).toBe("断面図.JWF");
    expect(row.directU32Match).toBe(false);
    expect(row.candidateU32).toEqual([0, 1, 2, 1, 0, 0]);
  });

  it("counts unresolved keys across reports", () => {
    const summary = buildCoreOpenSummary(
      ["a.json", "b.json"],
      [
        { key: "LTYPE_HC", status: "missing", directU32Match: false },
        { key: "LCOLLOR_M", status: "missing", directSpecialMatch: false },
        { key: "LTYPE_HC", status: "missing", directU32Match: false },
        { key: "LCOLLOR_M", status: "matched", directSpecialMatch: true },
      ]
    );

    expect(summary.counts).toEqual({
      reports: 2,
      rows: 4,
      directMatchTrue: 1,
      directMatchFalse: 3,
    });
    expect(summary.byKey.LTYPE_HC).toEqual({
      total: 2,
      missing: 2,
      matched: 0,
      directMatchTrue: 0,
      directMatchFalse: 2,
    });
    expect(summary.byKey.LCOLLOR_M).toEqual({
      total: 2,
      missing: 1,
      matched: 1,
      directMatchTrue: 1,
      directMatchFalse: 1,
    });
  });
});
