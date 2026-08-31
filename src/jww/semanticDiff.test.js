import { buildJwwSemanticDiff } from "./semanticDiff.js";

function document(entities, overrides = {}) {
  return {
    entities,
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    layerGroups: [],
    groupScaleState: {},
    meta: {
      paperCode: 3,
      paperSize: "A3",
      diagnostics: { unsupportedCount: 0, skippedCount: 0 },
      jwwInternalSettings: { records: [] },
      ...overrides,
    },
  };
}

const lineA = {
  id: "before-id",
  type: "LINE",
  layer: "0-0",
  entity: {
    start: { x: 0, y: 0 },
    end: { x: 10, y: 10 },
    jww: { layerGroup: 0, layer: 0, penColor: 2, penStyle: 1 },
  },
};

const lineB = {
  ...lineA,
  id: "after-id",
};

describe("JWW semantic diff", () => {
  it("ignores generated ids and separates Jw_cad internal setting changes", () => {
    const before = document([lineA]);
    const after = document([lineB], {
      paperCode: 3,
      paperSize: "A3",
      diagnostics: { unsupportedCount: 0, skippedCount: 0 },
      jwwInternalSettings: {
        records: [
          {
            key: "View_Direct2d",
            settingValue: 0,
            text: "View_Direct2d = 0",
          },
        ],
      },
    });

    const result = buildJwwSemanticDiff(before, after);

    expect(result.drawingSemanticEqual).toBe(true);
    expect(result.drawingRoundTripCompatible).toBe(true);
    expect(result.roundTripCompatible).toBe(true);
    expect(result.documentMetadataEqual).toBe(true);
    expect(result.internalSettingsEqual).toBe(false);
  });

  it("requires document metadata equality for full round-trip compatibility", () => {
    const before = document([lineA]);
    const after = document([lineB], {
      paperCode: 2,
      paperSize: "A2",
      diagnostics: { unsupportedCount: 0, skippedCount: 0 },
      jwwInternalSettings: { records: [] },
    });

    const result = buildJwwSemanticDiff(before, after);

    expect(result.drawingSemanticEqual).toBe(true);
    expect(result.drawingRoundTripCompatible).toBe(true);
    expect(result.documentMetadataEqual).toBe(false);
    expect(result.roundTripCompatible).toBe(false);
  });

  it("ignores parser byte offsets while comparing metadata values", () => {
    const before = document([lineA], {
      colorSettings: {
        colorTableOffset: 100,
        screenColors: { 2: { red: 0, green: 0, blue: 0, width: 1 } },
        colorTableCandidates: [{ offset: 80, score: 10 }],
      },
      lineTypeSettings: {
        offset: 200,
        byteLength: 16,
        rows: { LTYPE_02: { pattern: "99999999", offset: 200 } },
      },
    });
    const after = document([lineB], {
      colorSettings: {
        colorTableOffset: 900,
        screenColors: { 2: { red: 0, green: 0, blue: 0, width: 1 } },
        colorTableCandidates: [{ offset: 850, score: 99 }],
      },
      lineTypeSettings: {
        offset: 1200,
        byteLength: 16,
        rows: { LTYPE_02: { pattern: "99999999", offset: 1200 } },
      },
    });

    const result = buildJwwSemanticDiff(before, after);

    expect(result.documentMetadataEqual).toBe(true);
    expect(result.roundTripCompatible).toBe(true);
  });

  it("reports geometry changes", () => {
    const changed = {
      ...lineB,
      entity: { ...lineB.entity, end: { x: 11, y: 10 } },
    };
    const result = buildJwwSemanticDiff(document([lineA]), document([changed]));

    expect(result.drawingSemanticEqual).toBe(false);
    expect(result.drawing.unorderedEqual).toBe(false);
    expect(result.drawing.changes.length).toBe(1);
  });

  it("reports changes to native image placement and CDataMoji attributes", () => {
    const image = {
      type: "IMAGE",
      layer: "0-0",
      entity: {
        position: { x: 10, y: 20 },
        endPoint: { x: 75, y: 20 },
        fileName: "fixture.bmp",
        width: 114.163642,
        height: 129.166667,
        paperTextWidth: 2,
        paperTextHeight: 2,
        paperTextSpacing: 0,
        rotation: 0,
        jwwTextType: 0,
        fontFamily: "MS Gothic",
        jwwImageText: "^@BMfixture.bmp,114.163642,129.166667",
        jww: { layerGroup: 0, layer: 0, penColor: 2, penStyle: 1 },
      },
    };
    const changed = {
      ...image,
      entity: {
        ...image.entity,
        endPoint: { x: 76, y: 20 },
        paperTextWidth: 3,
        rotation: 15,
      },
    };

    const result = buildJwwSemanticDiff(document([image]), document([changed]));

    expect(result.drawingSemanticEqual).toBe(false);
    expect(result.drawingRoundTripCompatible).toBe(false);
    expect(result.drawing.changes.length).toBe(1);
  });

  it("treats entity order as semantic because JWW draw order matters", () => {
    const second = {
      ...lineA,
      entity: { ...lineA.entity, start: { x: 1, y: 0 } },
    };
    const result = buildJwwSemanticDiff(
      document([lineA, second]),
      document([second, lineB])
    );

    expect(result.drawingSemanticEqual).toBe(false);
    expect(result.drawing.unorderedEqual).toBe(true);
    expect(result.drawing.orderOnlyDifference).toBe(true);
  });
});
