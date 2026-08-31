import { summarizeLayerDefaultsAudits } from "./layerDefaultsSummary.js";

describe("layer defaults summary", () => {
  it("counts missing, ambiguous, and promotion candidates across audits", () => {
    const summary = summarizeLayerDefaultsAudits([
      {
        sources: { jww: "C:\\samples\\a.jww", jwf: "C:\\samples\\a.jwf" },
        counts: { rows: 3, directMatchCandidates: 1, promotionCandidates: 1 },
        rows: [
          {
            key: "LAYCOL_0",
            family: "layerColors",
            status: "ambiguous",
            gatewayStatus: "missing",
            reason: "low-information numeric sequence",
            values: [0, 0, 0, 0],
            matchKinds: ["u8-sequence"],
          },
          {
            key: "LAYWID_0",
            family: "layerWidths",
            status: "missing",
            gatewayStatus: "missing",
            values: [1, 1, 1, 1],
          },
          {
            key: "LAYTYP_0",
            family: "layerLineTypes",
            status: "matched",
            gatewayStatus: "missing",
            values: [2, 2, 2, 2],
            matchKinds: ["u16-sequence"],
          },
        ],
      },
      {
        sources: { jww: "C:\\samples\\b.jww", jwf: "C:\\samples\\b.jwf" },
        counts: { rows: 3, directMatchCandidates: 0, promotionCandidates: 0 },
        rows: [
          {
            key: "LAYCOL_0",
            family: "layerColors",
            status: "missing",
            gatewayStatus: "missing",
            values: [3, 4, 5, 6],
          },
          {
            key: "LAYWID_0",
            family: "layerWidths",
            status: "missing",
            gatewayStatus: "missing",
            values: [1, 1, 1, 1],
          },
          {
            key: "LAYTYP_0",
            family: "layerLineTypes",
            status: "ambiguous",
            gatewayStatus: "missing",
            reason: "low-information numeric sequence",
            values: [0, 0, 0, 0],
            matchKinds: ["u8-sequence"],
          },
        ],
      },
    ]);

    expect(summary.counts).toEqual({
      keys: 3,
      rows: 6,
      alwaysMissing: 1,
      withDirectMatches: 1,
      mixed: 2,
      nonSerialized: 0,
      directMatchCandidates: 1,
      promotionCandidates: 1,
    });
    expect(summary.byFamily).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "layerWidths", missing: 2 }),
        expect.objectContaining({ key: "layerColors", ambiguous: 1 }),
      ])
    );
    expect(summary.byKey.find((row) => row.key === "LAYCOL_0")).toEqual(
      expect.objectContaining({
        ambiguous: 1,
        missing: 1,
        reasonSummary: "low-information numeric sequence (1)",
        valueSignatureSummary: "0,0,0,0 (1); 3,4,5,6 (1)",
        matchKindSummary: "u8-sequence (1)",
      })
    );
    expect(summary.conclusion).toContain("Review direct matches");
  });

  it("keeps the no-promotion conclusion when no direct candidates exist", () => {
    const summary = summarizeLayerDefaultsAudits([
      {
        sources: { jww: "C:\\samples\\a.jww" },
        counts: { rows: 1, directMatchCandidates: 0, promotionCandidates: 0 },
        rows: [
          {
            key: "LAYWID_0",
            family: "layerWidths",
            status: "missing",
            gatewayStatus: "missing",
          },
        ],
      },
    ]);

    expect(summary.counts.promotionCandidates).toBe(0);
    expect(summary.conclusion).toContain("No direct");
  });

  it("reports a resolved conclusion when every row is non-serialized", () => {
    const summary = summarizeLayerDefaultsAudits([
      {
        sources: { jww: "C:\\samples\\resolved.jww" },
        counts: {
          rows: 3,
          nonSerialized: 3,
          directMatchCandidates: 0,
          promotionCandidates: 0,
        },
        rows: ["LAYCOL_0", "LAYWID_0", "LAYTYP_0"].map((key) => ({
          key,
          family: "layerDefaults",
          status: "missing",
          gatewayStatus: "not-serialized",
          nonSerializedJwfKey: true,
        })),
      },
    ]);

    expect(summary.counts.nonSerialized).toBe(3);
    expect(summary.conclusion).toContain("not serialized into JWW");
  });
});
