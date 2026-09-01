import { assessParsedJww, buildConformanceReport } from "./conformance.js";

describe("JWW conformance assessment", () => {
  it("separates a clean parser result from round-trip compatibility", () => {
    const result = assessParsedJww({
      version: 700,
      entities: [
        { value: { start_x: 0, start_y: 0, end_x: 1, end_y: 1 } },
        { value: { content: "JWW" } },
        { value: { type: "LINE" } },
      ],
      diagnostics: { unsupportedClasses: {}, unsupportedCount: 0, skippedCount: 0 },
    });

    expect(result.readAssessment).toBe("parsed-without-reported-loss");
    expect(result.entityTypes).toEqual({ LINE: 2, TEXT: 1 });
    expect(result.roundTripAssessment).toBe("not-tested");
    expect(result.exactCompatibility).toBe(false);
  });

  it("reports unsupported and skipped records as parser loss", () => {
    const result = assessParsedJww({
      version: 1000,
      entities: [],
      diagnostics: {
        unsupportedClasses: { CDataUnknown: 2 },
        unsupportedCount: 2,
        skippedCount: 1,
      },
    });

    expect(result.readAssessment).toBe("parsed-with-reported-loss");
    expect(result.unsupportedClasses).toEqual({ CDataUnknown: 2 });
    expect(result.unsupportedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
  });

  it("reports an unresolved entity-list boundary as parser loss", () => {
    const result = assessParsedJww({
      version: 600,
      entities: [],
      entity_list_complete: false,
      block_list_complete: false,
      embedded_image_list_complete: true,
      diagnostics: {
        unsupportedClasses: {},
        unsupportedCount: 0,
        skippedCount: 0,
      },
    });

    expect(result).toMatchObject({
      readAssessment: "parsed-with-reported-loss",
      entityListComplete: false,
      blockListComplete: false,
      embeddedImageListComplete: true,
    });
  });

  it("summarizes observed versions without declaring write support", () => {
    const report = buildConformanceReport(
      [
        assessParsedJww({ version: 700, entities: [], diagnostics: {} }),
        assessParsedJww({
          version: 1000,
          entities: [],
          diagnostics: { unsupportedCount: 1 },
        }),
      ],
      { generatedAt: "2026-08-27T00:00:00.000Z" }
    );

    expect(report.counts.versions).toEqual({ "700": 1, "1000": 1 });
    expect(report.counts.filesWithReportedLoss).toBe(1);
    expect(report.scope.write).toBe("separate bounded writer");
    expect(report.scope.roundTrip).toBe("not tested by this command");
  });
});
